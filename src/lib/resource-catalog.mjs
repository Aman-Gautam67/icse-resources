// Public, credential-free projection of the Drive class/section/subject hierarchy.
export const SECTIONS = { subjects: 'Notes', pyq: 'PYQ', specimen: 'Specimen' };
export function subjectSlug(name) {
  return name.normalize('NFKC').toLowerCase().replace(/&/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'subject';
}
export function catalogMaterials(catalog, grade = '10') {
  const sections = catalog.classes?.[grade];
  const subjects = new Map();
  for (const [section, label] of Object.entries(SECTIONS)) {
    for (const folder of sections?.[section]?.children || []) {
      if (folder.type !== 'folder') continue;
      const key = folder.name.normalize('NFKC').trim().toLowerCase();
      if (!subjects.has(key)) subjects.set(key, { name: folder.name, type: 'folder', children: [] });
      const subject = subjects.get(key);
      if (section === 'subjects') subject.children.push(...(folder.children || []));
      else subject.children.push({ name: label, type: 'folder', children: folder.children || [] });
    }
  }
  return { name: `Class ${grade} Study Materials`, type: 'folder', children: [...subjects.values()] };
}
export function flattenCatalog(node, parents = []) {
  if (node.type === 'file') return [{ name: node.name, id: node.id, path: parents.join(' / ') }];
  return (node.children || []).flatMap(child => flattenCatalog(child, [...parents, node.name]));
}
