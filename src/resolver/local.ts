import fs from 'fs/promises';
import path from 'path';
import parseDiff from 'parse-diff';
import { DiffResult, FileChange } from './types.js';

export async function readLocalDiff(patchPath: string): Promise<DiffResult> {
  try {
    // Normalize and resolve the path
    const resolvedPath = path.resolve(patchPath);

    // Verify the file exists and is readable
    await fs.access(resolvedPath, fs.constants.R_OK);

    const content = await fs.readFile(resolvedPath, 'utf-8');
    return parseDiffContent(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read patch file: ${error.message}`);
    }
    throw error;
  }
}

export function parseDiffContent(diffContent: string): DiffResult {
  const parsed = parseDiff(diffContent);

  const files: FileChange[] = parsed.map(file => {
    let type: FileChange['type'] = 'modified';
    if (file.new && !file.deleted) type = 'added';
    else if (file.deleted) type = 'deleted';
    else if (file.from && file.to && file.from !== file.to) type = 'renamed';

    // Reconstruct the diff for this file
    const chunks = file.chunks.map(chunk => {
      const lines = chunk.changes.map(change => {
        // parse-diff already includes the prefix in change.content
        if (change.type === 'add') {
          return change.content.startsWith('+') ? change.content : `+${change.content}`;
        }
        if (change.type === 'del') {
          return change.content.startsWith('-') ? change.content : `-${change.content}`;
        }
        return change.content.startsWith(' ') ? change.content : ` ${change.content}`;
      });
      return `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@\n${lines.join('\n')}`;
    });

    const fileDiff = chunks.join('\n');

    return {
      path: file.to || file.from || 'unknown',
      type,
      oldPath: file.from !== file.to ? file.from : undefined,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      diff: fileDiff,
    };
  });

  return {
    files,
    source: 'local',
  };
}
