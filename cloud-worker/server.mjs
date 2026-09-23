import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createWriteStream, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Environment configurations
const PORT = process.env.PORT || 10000;
const ACCESS_KEY = process.env.ARCHIVE_ACCESS_KEY || '';
const SECRET_KEY = process.env.ARCHIVE_SECRET_KEY || '';
const PREFIX = process.env.ARCHIVE_PREFIX || 'icse-resources-fb22e74acc';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
const SHARD = Number(process.env.SYNC_SHARD) || 1;
const TOTAL_SHARDS = Number(process.env.SYNC_TOTAL_SHARDS) || 2;
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT) || 2;
const RUN_DURATION_MINUTES = Number(process.env.RUN_DURATION_MINUTES) || 0;
const AUTO_EXIT_WHEN_DONE = process.env.AUTO_EXIT_WHEN_DONE === '1' || process.env.AUTO_EXIT_WHEN_DONE === 'true';

const SPOOL_DIR = path.join(os.tmpdir(), 'archive-spool');
if (!existsSync(SPOOL_DIR)) mkdirSync(SPOOL_DIR, { recursive: true });

// State
let googleAccessToken = null;
let googleTokenExpiry = 0;
const inFlight = new Map();
const recentDone = [];
let totalBytesTransferred = 0;
let startTime = Date.now();
let lastSpeedCalcTime = Date.now();
let lastBytes = 0;
let currentSpeedBps = 0;

const state = {
  active: true,
  completed: 0,
  verifying: 0,
  failed: 0,
  queued: 0,
  total: 0,
  percent: '0.0',
  speed: '0.0 MB/s',
  eta: 'calculating...',
};

// Sharding helper
function taskShard(taskId, totalShards = 1) {
  if (totalShards <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) hash = ((hash << 5) - hash + taskId.charCodeAt(i)) | 0;
  return Math.abs(hash) % totalShards;
}

const slug = value => (value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'resource';
const segment = value => (value || '').normalize('NFKC').replace(/[\\/\x00-\x1f]/g, '_').replace(/^\.+$/, '_');

function destinationFor(task) {
  const item = `${PREFIX}-${task.grade}th-${slug(task.section)}-${slug(task.subject)}-${createHash('sha256').update(`${task.grade}th/${task.section}/${task.subject}`).digest('hex').slice(0, 10)}`;
  const filename = task.name || 'resource.pdf';
  const dot = filename.lastIndexOf('.');
  const cut = dot > 0 ? dot : filename.length;
  const folders = (task.folders || []).filter(Boolean);
  const key = [...folders.map(segment), `${filename.slice(0, cut)}--${task.id}${filename.slice(cut)}`].join('/');
  return {
    item,
    key,
    url: `https://archive.org/download/${item}/${key.split('/').map(encodeURIComponent).join('/')}`
  };
}

// Google OAuth
async function getGoogleToken() {
  if (googleAccessToken && Date.now() < googleTokenExpiry - 60000) return googleAccessToken;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Missing Google OAuth environment variables (GOOGLE_CLIENT_ID, GOOGLE_REFRESH_TOKEN).');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  googleAccessToken = data.access_token;
  googleTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return googleAccessToken;
}

// Load tasks from catalog
function extractTasks() {
  const catalogPath = path.join(ROOT, 'public/data/resource-catalog.json');
  if (!existsSync(catalogPath)) return [];
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const tasks = new Map();

  for (const [grade, data] of Object.entries(catalog.classes || {})) {
    for (const [section, tree] of Object.entries(data || {})) {
      for (const subject of tree.children || []) {
        function walk(node, folders = []) {
          if (!node) return;
          if (node.type === 'file' && node.id) {
            if (!tasks.has(node.id)) {
              tasks.set(node.id, {
                id: node.id,
                name: node.name,
                grade,
                section,
                subject: subject.name,
                folders,
                archiveUrl: node.archiveUrl || null,
                status: node.archiveUrl ? 'complete' : 'queued',
                attempts: 0,
              });
            }
          } else if (Array.isArray(node.children)) {
            for (const child of node.children) walk(child, [...folders, node.name]);
          }
        }
        for (const child of subject.children || []) walk(child);
      }
    }
  }

  // Also include any local queue entries if present
  const queuePath = path.join(ROOT, '.local-admin/archive-queue.json');
  if (existsSync(queuePath)) {
    try {
      const q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
      for (const [id, t] of Object.entries(q.tasks || {})) {
        if (tasks.has(id)) {
          const task = tasks.get(id);
          if (t.archiveUrl) {
            task.archiveUrl = t.archiveUrl;
            task.status = 'complete';
          } else if (t.status === 'complete' && t.url) {
            task.archiveUrl = t.url;
            task.status = 'complete';
          }
        }
      }
    } catch {}
  }

  return [...tasks.values()];
}

// Download file from Drive
async function downloadFromDrive(fileId, targetPath) {
  const token = await getGoogleToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Google Drive download failed: ${res.status}`);
  const writeStream = createWriteStream(targetPath);
  await pipeline(res.body, writeStream);

  const fileBuffer = fs.readFileSync(targetPath);
  const size = fileBuffer.length;
  const md5 = createHash('md5').update(fileBuffer).digest('hex');
  return { size, md5 };
}

// Upload to Internet Archive
async function uploadToArchive(task, filePath, info, dest) {
  if (!ACCESS_KEY || !SECRET_KEY) throw new Error('Missing Archive credentials (ARCHIVE_ACCESS_KEY, ARCHIVE_SECRET_KEY).');
  const auth = `LOW ${ACCESS_KEY}:${SECRET_KEY}`;
  let target = `https://s3.us.archive.org/${dest.item}/${dest.key.split('/').map(encodeURIComponent).join('/')}`;

  for (let redirects = 0; redirects < 6; redirects++) {
    const fileStream = fs.createReadStream(filePath);
    let res;
    try {
      res = await fetch(target, {
        method: 'PUT',
        body: fileStream,
        duplex: 'half',
        headers: {
          Authorization: auth,
          'Content-Length': String(info.size),
          'Content-MD5': Buffer.from(info.md5, 'hex').toString('base64'),
          'Content-Type': 'application/octet-stream',
          'x-archive-auto-make-bucket': '1',
          'x-archive-queue-derive': '0',
          'x-archive-keep-old-version': '1',
          'x-archive-meta-mediatype': 'texts',
          'x-archive-meta-collection': 'opensource',
          'x-archive-meta-title': `uri(${encodeURIComponent(`Class ${task.grade} - ${task.subject} - ${task.section}`)})`,
          'x-archive-meta-description': 'Educational resources organised by class, section, subject and original subfolder.',
        },
      });
    } finally {
      fileStream.destroy();
    }

    if ([307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('Missing redirect location from Archive.org');
      target = new URL(loc, target).href;
      continue;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Archive upload HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    return dest.url;
  }
  throw new Error('Too many upload redirects');
}

// Sync catalog with new verified archiveUrl
function saveVerifiedMirror(taskId, archiveUrl) {
  const catalogPath = path.join(ROOT, 'public/data/resource-catalog.json');
  if (existsSync(catalogPath)) {
    try {
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      let modified = false;
      function walk(node) {
        if (!node) return;
        if (node.id === taskId) {
          node.archiveUrl = archiveUrl;
          modified = true;
        }
        if (Array.isArray(node.children)) node.children.forEach(walk);
      }
      for (const grade of Object.values(catalog.classes || {})) {
        for (const sec of Object.values(grade || {})) {
          if (Array.isArray(sec.children)) sec.children.forEach(walk);
        }
      }
      if (modified) fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    } catch {}
  }

  const searchIndexPath = path.join(ROOT, 'public/data/search-index.json');
  if (existsSync(searchIndexPath)) {
    try {
      const index = JSON.parse(fs.readFileSync(searchIndexPath, 'utf8'));
      let idxModified = false;
      for (const item of index) {
        if (item.id === taskId) {
          item.archiveUrl = archiveUrl;
          idxModified = true;
        }
      }
      if (idxModified) fs.writeFileSync(searchIndexPath, JSON.stringify(index, null, 2));
    } catch {}
  }
}

// Send Dweet heartbeat
async function sendHeartbeat() {
  const payload = {
    shard: SHARD,
    name: `Cloud Runner (Shard ${SHARD})`,
    timestamp: Date.now(),
    uploadSpeed: state.speed,
    uploadMbps: (currentSpeedBps * 8 / 1e6).toFixed(1) + ' Mbps',
    counts: {
      queued: state.queued,
      transferring: inFlight.size,
      complete: state.completed,
      failed: state.failed,
    },
    done: state.completed,
    total: state.total,
    percent: state.percent,
    eta: state.eta,
    transferring: [...inFlight.values()].map(t => ({ id: t.id, name: t.name, size: t.size })),
    recent: recentDone.slice(0, 3),
  };

  try {
    await fetch(`https://dweet.cc/dweet/for/icse-cluster-icse-resources-fb22e74acc-node1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

// Worker pump
async function runWorker() {
  const tasks = extractTasks();
  state.total = tasks.length;
  const targetShardIdx = Math.max(0, SHARD - 1);

  // Filter tasks assigned to this shard
  const myTasks = tasks.filter(t => TOTAL_SHARDS <= 1 || taskShard(t.id, TOTAL_SHARDS) === targetShardIdx);
  console.log(`[Worker] Loaded ${tasks.length} total tasks. Shard ${SHARD}/${TOTAL_SHARDS} assigned: ${myTasks.length} tasks.`);

  // Recalculate stats
  function updateStats() {
    state.completed = tasks.filter(t => t.status === 'complete').length;
    state.failed = tasks.filter(t => t.status === 'failed').length;
    state.queued = tasks.filter(t => t.status === 'queued').length;
    state.percent = state.total > 0 ? ((state.completed / state.total) * 100).toFixed(1) : '0.0';

    const now = Date.now();
    const elapsedSec = (now - lastSpeedCalcTime) / 1000;
    if (elapsedSec >= 5) {
      const bytesDiff = totalBytesTransferred - lastBytes;
      currentSpeedBps = bytesDiff / elapsedSec;
      lastBytes = totalBytesTransferred;
      lastSpeedCalcTime = now;
      state.speed = (currentSpeedBps / (1024 * 1024)).toFixed(2) + ' MB/s';

      if (currentSpeedBps > 0) {
        const remainingTasks = state.total - state.completed;
        const avgFileSize = 2 * 1024 * 1024; // assume 2MB
        const remainingBytes = remainingTasks * avgFileSize;
        const remainingSec = remainingBytes / currentSpeedBps;
        const hrs = Math.floor(remainingSec / 3600);
        const mins = Math.floor((remainingSec % 3600) / 60);
        state.eta = `${hrs}h ${mins}m`;
      }
    }
  }

  updateStats();
  setInterval(updateStats, 2000);
  setInterval(sendHeartbeat, 10000);

  async function processTask(task) {
    inFlight.set(task.id, task);
    const dest = destinationFor(task);
    const tempFile = path.join(SPOOL_DIR, `${task.id}.tmp`);

    try {
      console.log(`[Transfer] Starting: ${task.name} (${task.id})`);
      const info = await downloadFromDrive(task.id, tempFile);
      task.size = info.size;
      const archiveUrl = await uploadToArchive(task, tempFile, info, dest);

      task.archiveUrl = archiveUrl;
      task.status = 'complete';
      totalBytesTransferred += info.size;
      saveVerifiedMirror(task.id, archiveUrl);

      recentDone.unshift({ name: task.name, size: info.size, completedAt: new Date().toISOString() });
      if (recentDone.length > 5) recentDone.pop();
      console.log(`[Success] Mirrored: ${task.name} -> ${archiveUrl}`);
    } catch (err) {
      task.status = 'failed';
      task.attempts = (task.attempts || 0) + 1;
      console.error(`[Error] Failed ${task.name}:`, err.message);
    } finally {
      if (existsSync(tempFile)) {
        try { unlinkSync(tempFile); } catch {}
      }
      inFlight.delete(task.id);
    }
  }

  // Work loop
  while (state.active) {
    if (inFlight.size < MAX_CONCURRENT) {
      const nextTask = myTasks.find(t => t.status === 'queued' && !inFlight.has(t.id));
      if (nextTask) {
        processTask(nextTask);
      } else if (inFlight.size === 0) {
        if (AUTO_EXIT_WHEN_DONE) {
          console.log('[Worker] No more queued tasks for this shard. Exiting cleanly.');
          state.active = false;
          server.close(() => process.exit(0));
          setTimeout(() => process.exit(0), 2000).unref();
          break;
        }
        console.log('[Worker] No more queued tasks for this shard. Sleeping 30s before re-checking.');
        await new Promise(r => setTimeout(r, 30000));
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

// HTTP Server for Render & keep-alive monitors
const server = http.createServer((req, res) => {
  const url = req.url || '/';

  if (url === '/health' || url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: Math.round(process.uptime()), inFlight: inFlight.size }));
  }

  if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      state,
      inFlight: [...inFlight.values()].map(t => ({ id: t.id, name: t.name, size: t.size })),
      recent: recentDone,
      uptimeSec: Math.round(process.uptime()),
    }));
  }

  // Default Web Dashboard
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ICSE Resources Cloud Cluster</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; max-width: 800px; margin: 0 auto; }
    .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .stat { background: #0f172a; padding: 1rem; border-radius: 8px; border: 1px solid #334155; }
    .val { font-size: 1.75rem; font-weight: bold; color: #38bdf8; }
    .lbl { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; margin-top: 0.25rem; }
    .progress-bar { background: #334155; height: 12px; border-radius: 6px; overflow: hidden; margin-top: 1rem; }
    .progress-fill { background: #38bdf8; height: 100%; width: ${state.percent}%; transition: width 0.5s; }
  </style>
</head>
<body>
  <h1>🚀 ICSE Resources Cloud Upload Node</h1>
  <div class="card">
    <h2>Cluster Progress: ${state.percent}%</h2>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="stat-grid">
      <div class="stat"><div class="val">${state.completed}</div><div class="lbl">Completed</div></div>
      <div class="stat"><div class="val">${state.queued}</div><div class="lbl">Queued</div></div>
      <div class="stat"><div class="val">${state.speed}</div><div class="lbl">Speed</div></div>
      <div class="stat"><div class="val">${state.eta}</div><div class="lbl">ETA</div></div>
    </div>
  </div>
  <p style="color: #64748b; font-size: 0.85rem;">Active Node: Cloud Worker | Ping /health for keep-alive</p>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Cloud Node] HTTP Server listening on port ${PORT}`);
  if (RUN_DURATION_MINUTES > 0) {
    console.log(`[Cloud Node] Setting timer to exit gracefully in ${RUN_DURATION_MINUTES} minutes.`);
    setTimeout(() => {
      console.log(`[Cloud Node] Time limit reached (${RUN_DURATION_MINUTES}m). Shutting down server...`);
      state.active = false;
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    }, RUN_DURATION_MINUTES * 60 * 1000);
  }
  runWorker().catch(err => console.error('[Fatal Worker Error]', err));
});
