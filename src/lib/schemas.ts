import { z } from "zod";
import { normalizeArchiveUrl } from './archive-url.mjs';
const ArchiveUrlSchema = z.string().nullable().optional().refine(value => {
  if (value === undefined || value === null || !value.trim()) return true;
  try { return !!normalizeArchiveUrl(value); } catch { return false; }
}, 'Invalid Internet Archive URL');

export interface FileNode {
  name: string;
  type: "folder" | "file";
  id?: string;
  archiveUrl?: string;
  mimeType?: string;
  path?: string;
  children?: FileNode[];
}

// Recursive Zod schema for folder/file tree using z.lazy()
export const FileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(["folder", "file"]),
    id: z.string().optional(),
    archiveUrl: ArchiveUrlSchema,
    mimeType: z.string().optional(),
    path: z.string().optional(),
    children: z.array(FileNodeSchema).optional(),
  })
);

export const SearchItemSchema = z.object({
  name: z.string(),
  id: z.string(),
  path: z.string(),
  archiveUrl: ArchiveUrlSchema,
});

export const SearchIndexSchema = z.array(SearchItemSchema);

export type SearchItem = z.infer<typeof SearchItemSchema>;

// Helper validation functions
export function validateResourcesData(data: unknown): FileNode {
  return FileNodeSchema.parse(data);
}

export function validateSearchIndex(data: unknown): SearchItem[] {
  return SearchIndexSchema.parse(data);
}
