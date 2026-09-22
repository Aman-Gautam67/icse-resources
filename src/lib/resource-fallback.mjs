import { safeArchiveUrl } from './archive-url.mjs';
import { driveUrl } from './resource-link.mjs';

function allowedHost(url, provider) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && (provider === 'archive'
    ? url.hostname === 'archive.org' || url.hostname.endsWith('.archive.org')
    : ['drive.google.com', 'drive.usercontent.google.com'].includes(url.hostname) || url.hostname.endsWith('.googleusercontent.com'));
}

// A bounded public check: no credentials, no full downloads, no arbitrary hosts.
// Providers sometimes return an HTML error with HTTP 200, so check common error text.
export async function reachable(url, provider, fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    let target = new URL(url);
    for (let hop = 0; hop < 6; hop++) {
      if (!allowedHost(target, provider)) return false;
      if (provider === 'archive' && /^\/account\//.test(target.pathname)) return false;
      const response = await fetcher(target.href, { redirect: 'manual', signal: controller.signal, headers: { Range: 'bytes=0-65535', 'Accept-Language': 'en' } });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location) return false;
        try { target = new URL(location, target); } catch { return false; }
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); return false; }
      if (!/text\/html|text\/plain|application\/json/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); return true; }
      const reader = response.body?.getReader();
      if (!reader) return false;
      const decoder = new TextDecoder(); let text = '', bytes = 0;
      try {
        while (bytes < 65536) {
          const { done, value } = await reader.read(); if (done) break;
          text += decoder.decode(value.subarray(0, 65536 - bytes), { stream: true }); bytes += value.byteLength;
        }
      } finally { await reader.cancel(); }
      const unavailable = provider === 'drive'
        ? /you need access|request access|access denied|quota exceeded|download quota|too many users have viewed|file you have requested does not exist|unable to access this document|file is in the owner's trash/i
        : /item (?:is )?not available|item cannot be found|item has been removed|page not found|this item is no longer available|restricted item/i;
      return !unavailable.test(text) && !/<title>\s*(?:sign in|log in|login)[^<]*<\/title>/i.test(text);
    }
    return false;
  } catch { return false; } finally { clearTimeout(timer); }
}

export async function resolveResource(file, mode = 'view', check = reachable, server = '1') {
  const primary = driveUrl(file.id, mode);
  const mirror = safeArchiveUrl(file.archiveUrl);
  if (!mirror) return primary;
  if (server === '2') {
    if (await check(mirror, 'archive')) return mirror;
    if (await check(driveUrl(file.id, 'download'), 'drive')) return primary;
    return null;
  }
  if (await check(driveUrl(file.id, 'download'), 'drive')) return primary;
  if (await check(mirror, 'archive')) return mirror;
  return null;
}

export function createResourceHandler(files, check = reachable) {
  const safeFiles = Array.isArray(files) ? files : [];
  const mirrored = new Map(safeFiles.filter(file => safeArchiveUrl(file?.archiveUrl)).map(file => [file.id, file]));
  const cache = new Map();
  return async url => {
    try {
      if (!url || !url.searchParams) return new Response('Bad request.', { status: 400 });
      const id = url.searchParams.get('id');
      if (!id) return new Response('Resource not found.', { status: 404 });
      const mode = ['view', 'preview', 'download'].includes(url.searchParams.get('mode')) ? url.searchParams.get('mode') : 'view';
      const file = mirrored.get(id);
      if (!file) return new Response('Resource not found.', { status: 404 });
      const server = url.searchParams.get('server') === '2' ? '2' : '1';
      const key = `${id}:${mode}:${server}`;
      let cached = cache.get(key);
      if (!cached || cached.expires <= Date.now()) {
        const destination = await resolveResource(file, mode, check, server);
        cached = { destination, expires: Date.now() + (destination ? 60000 : 5000) };
        if (cache.size >= 1000) cache.delete(cache.keys().next().value);
        cache.set(key, cached);
      }
      if (cached.destination) {
        try {
          const destUrl = new URL(cached.destination);
          if (!allowedHost(destUrl, 'archive') && !allowedHost(destUrl, 'drive')) {
            return new Response('Invalid resource destination.', { status: 500 });
          }
          if (mode === 'download' && (destUrl.hostname === 'archive.org' || destUrl.hostname.endsWith('.archive.org'))) {
            try {
              const archiveRes = await fetch(cached.destination);
              if (archiveRes.ok) {
                const filename = file?.name || 'resource.pdf';
                return new Response(archiveRes.body, {
                  status: 200,
                  headers: {
                    'Content-Type': archiveRes.headers.get('content-type') || 'application/pdf',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
                    'Cache-Control': 'public, max-age=86400',
                  },
                });
              }
            } catch {
              // fallback to 302 redirect
            }
          }
        } catch {
          return new Response('Invalid resource destination.', { status: 500 });
        }
        return new Response(null, { status: 302, headers: { Location: cached.destination, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
      }
      return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resource temporarily unavailable</title><h1>This resource is temporarily unavailable.</h1><p>Neither copy could be reached. Please try again shortly.</p><p><a href="">Try again</a> · <a href="/study-materials">Back to resources</a></p></html>', {
        status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5', 'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'self'" },
      });
    } catch {
      return new Response('Resource temporarily unavailable.', { status: 500 });
    }
  };
}
