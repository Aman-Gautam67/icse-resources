import type { FileNode } from './schemas';
import { safeArchiveUrl } from './archive-url.mjs';

export interface LibraryFile { name: string; id: string; path: string; archiveUrl?: string }
export interface LibraryCategory {
  name: string;
  files: LibraryFile[];
  count: number;
  subcategories?: LibraryCategory[];
}
export interface LibrarySubject {
  name: string;
  slug: string;
  description: string;
  categories: LibraryCategory[];
  count: number;
}

// Retain folder context to distinguish similarly named school/year papers.
export function collectLibraryFiles(node: FileNode, parents: string[] = []): LibraryFile[] {
  if (!node || typeof node !== 'object') return [];
  if (node.type === 'file') return node.id ? [{ name: node.name || '', id: node.id, path: parents.join(' / '), archiveUrl: safeArchiveUrl(node.archiveUrl) }] : [];
  return (node.children || []).flatMap(child => collectLibraryFiles(child, [...parents, node.name || '']));
}

function buildSubcategories(folder: FileNode, parentPaths: string[] = []): LibraryCategory[] {
  const subFolders = (folder.children || []).filter(c => c?.type === 'folder' && !/^sample papers?$/i.test(c.name || ''));
  const currentPath = folder.name ? [...parentPaths, folder.name] : parentPaths;
  return subFolders.map(sub => {
    const allSubFiles = collectLibraryFiles(sub, currentPath);
    const subFiles = allSubFiles.filter(f => {
      const folders = f.path.split('/').map(p => p.trim());
      return !folders.some(p => /^sample papers?$/i.test(p));
    });
    const nestedSubs = buildSubcategories(sub, currentPath);
    return {
      name: sub.name || '',
      files: subFiles,
      count: subFiles.length,
      subcategories: nestedSubs.length ? nestedSubs : undefined,
    };
  }).filter(sub => sub.count > 0);
}

export function getLibraryCategories(node: FileNode): LibraryCategory[] {
  if (!node || typeof node !== 'object') return [];
  const children = node.children || [];

  if (node.name === 'PYQ Prelims') {
    return children.filter(c => c?.type === 'folder').map(yearFolder => {
      const yearFiles = collectLibraryFiles(yearFolder);
      const subcategories = buildSubcategories(yearFolder, []);
      return {
        name: yearFolder.name || '',
        files: yearFiles,
        count: yearFiles.length,
        subcategories: subcategories.length ? subcategories : undefined,
      };
    });
  }

  const files = children.filter(child => child?.type === 'file').flatMap(child => collectLibraryFiles(child));
  const categories: LibraryCategory[] = files.length ? [{ name: 'Notes, guides & question banks', files, count: files.length }] : [];
  const samplePapers: LibraryFile[] = [];
  const sampleSolutions: LibraryFile[] = [];
  for (const child of children.filter(child => child?.type === 'folder')) {
    if (child.name === 'PYQ' || child.name === 'Specimen') {
      const files = collectLibraryFiles(child);
      if (files.length) categories.push({ name: child.name, files, count: files.length });
      continue;
    }
    const remaining: LibraryFile[] = [];
    for (const file of collectLibraryFiles(child)) {
      const folders = file.path.split('/').map(folder => folder.trim());
      if (folders.some(folder => /^sample papers?$/i.test(folder))) {
        // Use the original folder structure; a solved question paper is still a paper.
        (folders.some(folder => /^solutions?(?:\s+view)?$/i.test(folder)) ? sampleSolutions : samplePapers).push(file);
      } else remaining.push(file);
    }
    if (remaining.length) {
      const subcategories = buildSubcategories(child, [node.name || '']);
      categories.push({
        name: child.name,
        files: remaining,
        count: remaining.length,
        subcategories: subcategories.length > 0 ? subcategories : undefined,
      });
    }
  }
  if (samplePapers.length) categories.push({ name: 'Sample Papers', files: samplePapers, count: samplePapers.length });
  if (sampleSolutions.length) categories.push({ name: 'Sample Paper Solutions', files: sampleSolutions, count: sampleSolutions.length });
  return categories;
}
