import { FileChange } from '../resolver/types.js';

export interface DiffChunk {
  files: FileChange[];
  estimatedTokens: number;
}

export function chunkDiff(files: FileChange[], maxChunkSize: number): DiffChunk[] {
  if (maxChunkSize <= 0) {
    throw new Error('maxChunkSize must be positive');
  }

  if (files.length === 0) {
    return [];
  }

  const chunks: DiffChunk[] = [];
  let currentChunk: FileChange[] = [];
  let currentSize = 0;

  for (const file of files) {
    const fileSize = estimateTokens(file);

    // If a single file exceeds max size, put it in its own chunk
    if (fileSize > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push({ files: currentChunk, estimatedTokens: currentSize });
        currentChunk = [];
        currentSize = 0;
      }
      chunks.push({ files: [file], estimatedTokens: fileSize });
      continue;
    }

    // If adding this file exceeds the limit, start a new chunk
    if (currentSize + fileSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push({ files: currentChunk, estimatedTokens: currentSize });
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(file);
    currentSize += fileSize;
  }

  if (currentChunk.length > 0) {
    chunks.push({ files: currentChunk, estimatedTokens: currentSize });
  }

  return chunks;
}

function estimateTokens(file: FileChange): number {
  // Rough estimate: 1 token ≈ 4 characters
  const pathTokens = file.path.length / 4;
  const diffTokens = file.diff.length / 4;
  return Math.ceil(pathTokens + diffTokens + 50); // +50 for metadata
}

export function formatChunkSummary(chunk: DiffChunk): string {
  const fileCount = chunk.files.length;
  const totalAdditions = chunk.files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = chunk.files.reduce((sum, f) => sum + f.deletions, 0);

  return `${fileCount} file${fileCount !== 1 ? 's' : ''} (+${totalAdditions}/-${totalDeletions})`;
}
