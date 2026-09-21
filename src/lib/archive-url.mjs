/** Optional mirror links must point to an Internet Archive item or download. */
export function normalizeArchiveUrl(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid HTTPS archive.org item or download URL.');
  if (!value.trim()) return undefined;
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid HTTPS archive.org item or download URL.'); }
  if (url.protocol !== 'https:' || !['archive.org', 'www.archive.org'].includes(url.hostname) || url.port || url.username || url.password || !/^\/(details|download|stream)\/[^/]+/.test(url.pathname)) {
    throw new Error('Use an HTTPS archive.org/details/, /download/ or /stream/ link.');
  }
  return url.href;
}
export function safeArchiveUrl(value) {
  try { return normalizeArchiveUrl(value); } catch { return undefined; }
}
