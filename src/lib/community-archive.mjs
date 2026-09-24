export const COMMUNITY_FOLDER = 'community-uploads';

export function communityDestination(prefix, submission) {
  if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(prefix || '') || !/^[a-f0-9-]{36}$/.test(submission?.id || '')) throw new Error('Invalid Archive destination.');
  const item = `${prefix}-${COMMUNITY_FOLDER}`;
  const folder = `${COMMUNITY_FOLDER}/${submission.id}`;
  const filename = submission.fileName.replace(/[\\/\x00-\x1f\x7f]/g, '_');
  const key = `${folder}/${filename}`;
  const infoKey = `${folder}/info.txt`;
  const url = key => `https://archive.org/download/${item}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return { item, key, infoKey, fileUrl: url(key), infoUrl: url(infoKey) };
}

export function communityInfo(submission, destination) {
  const lines = [
    'ICSE & ISC Resources - community upload',
    `Review ID: ${submission.id}`,
    `Review status: approved`,
    `Class: ${submission.grade}`,
    `Subject: ${submission.subject}`,
    `Resource type: ${submission.resourceType}`,
    `Original file: ${submission.fileName}`,
    `Content type: ${submission.contentType}`,
    `Size (bytes): ${submission.fileSize}`,
    `Submitted at: ${new Date(submission.submittedAt).toISOString()}`,
    `Approved at: ${new Date(submission.reviewedAt).toISOString()}`,
    `File URL: ${destination.fileUrl}`,
  ];
  const publicIds = submission.publicIdsOptIn === 1 || submission.publicIdsOptIn === true;
  if (publicIds && submission.discord) lines.push(`Discord ID: ${submission.discord}`);
  if (publicIds && submission.reddit) lines.push(`Reddit ID: ${submission.reddit}`);
  if (!publicIds || !submission.discord && !submission.reddit) lines.push('Contributor: anonymous');
  return lines.join('\n') + '\n';
}

export function isCommunityArchiveUrl(value, id) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    return url.protocol === 'https:' && url.hostname === 'archive.org' && !url.port && !url.username && !url.password && !url.search && !url.hash && parts.length >= 5 && parts[0] === 'download' && parts[1].endsWith(`-${COMMUNITY_FOLDER}`) && parts[2] === COMMUNITY_FOLDER && parts[3] === id && parts[4] !== 'info.txt';
  } catch { return false; }
}
