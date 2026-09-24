export const visitorPattern = /^[a-f0-9]{32}$/;
export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export function analyticsDb(locals) {
  return locals?.runtime?.env?.ANALYTICS_DB || null;
}

export function readVisitor(cookie) {
  const match = /(?:^|;\s*)icse_visitor=([a-f0-9]{32})(?:;|$)/.exec(cookie || '');
  return match?.[1] || null;
}

export function validPage(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && value.length <= 180 && !/[?#]/.test(value);
}

export async function recordEvent(db, { visitorId, type, page = '', fileId = '' }, now = Date.now()) {
  if (!db || !visitorPattern.test(visitorId) || !['visit', 'download'].includes(type)) return false;
  if (type === 'visit' && !validPage(page)) return false;
  if (type === 'download' && (!/^[a-zA-Z0-9_-]{5,200}$/.test(fileId) || page)) return false;
  await db.prepare('INSERT INTO analytics_events (visitor_id, event_type, page_path, file_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(visitorId, type, page, fileId, now).run();
  if (Math.random() < 0.001) {
    await db.prepare('DELETE FROM analytics_events WHERE created_at < ?').bind(now - RETENTION_MS).run().catch(() => {});
  }
  return true;
}

export async function analyticsReport(db, now = Date.now()) {
  const since = now - RETENTION_MS;
  const day = now - 24 * 60 * 60 * 1000;
  const active = now - 15 * 60 * 1000;
  const [summary, students, files, pages] = await Promise.all([
    db.prepare(`SELECT COUNT(DISTINCT visitor_id) AS students, SUM(CASE WHEN event_type = 'visit' THEN 1 ELSE 0 END) AS visits, SUM(CASE WHEN event_type = 'download' THEN 1 ELSE 0 END) AS downloads, COUNT(DISTINCT CASE WHEN created_at >= ? THEN visitor_id END) AS active, COUNT(DISTINCT CASE WHEN created_at >= ? THEN visitor_id END) AS visitors24h FROM analytics_events WHERE created_at >= ?`).bind(active, day, since).first(),
    db.prepare(`SELECT visitor_id AS id, MIN(created_at) AS firstSeen, MAX(created_at) AS lastSeen, SUM(CASE WHEN event_type = 'visit' THEN 1 ELSE 0 END) AS visits, SUM(CASE WHEN event_type = 'download' THEN 1 ELSE 0 END) AS downloads FROM analytics_events WHERE created_at >= ? GROUP BY visitor_id ORDER BY lastSeen DESC LIMIT 100`).bind(since).all(),
    db.prepare(`SELECT file_id AS id, COUNT(*) AS downloads, COUNT(DISTINCT visitor_id) AS students FROM analytics_events WHERE event_type = 'download' AND created_at >= ? GROUP BY file_id ORDER BY downloads DESC LIMIT 100`).bind(since).all(),
    db.prepare(`SELECT page_path AS path, COUNT(*) AS visits FROM analytics_events WHERE event_type = 'visit' AND created_at >= ? GROUP BY page_path ORDER BY visits DESC LIMIT 30`).bind(since).all(),
  ]);
  return { periodDays: 90, generatedAt: now, summary: { students: summary?.students || 0, visits: summary?.visits || 0, downloads: summary?.downloads || 0, active: summary?.active || 0, visitors24h: summary?.visitors24h || 0 }, students: students.results || [], files: files.results || [], pages: pages.results || [] };
}
