import { safeArchiveUrl } from './archive-url.mjs';
export function driveUrl(id, mode = 'view') {
  const cleanId = id ? encodeURIComponent(String(id)) : '';
  return mode === 'download' ? `https://drive.google.com/uc?export=download&id=${cleanId}` : `https://drive.google.com/file/d/${cleanId}/${mode === 'preview' ? 'preview' : 'view'}`;
}
export function resourceUrl(file, mode = 'view', server = '1') {
  if (!file || typeof file !== 'object') return '';
  const cleanId = file.id ? encodeURIComponent(String(file.id)) : '';
  return safeArchiveUrl(file.archiveUrl) ? `/resource?id=${cleanId}&mode=${mode}${server === '2' ? '&server=2' : ''}` : driveUrl(file.id, mode);
}

