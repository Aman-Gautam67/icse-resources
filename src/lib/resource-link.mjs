import { safeArchiveUrl } from './archive-url.mjs';
export function driveUrl(id, mode = 'view') {
  return mode === 'download' ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}` : `https://drive.google.com/file/d/${encodeURIComponent(id)}/${mode === 'preview' ? 'preview' : 'view'}`;
}
export function resourceUrl(file, mode = 'view', server = '1') {
  return safeArchiveUrl(file.archiveUrl) ? `/resource?id=${encodeURIComponent(file.id)}&mode=${mode}${server === '2' ? '&server=2' : ''}` : driveUrl(file.id, mode);
}
