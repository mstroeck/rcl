import { describe, it, expect } from 'vitest';
import { chunkDiff } from './chunker.js';
import { FileChange } from '../resolver/types.js';

describe('chunkDiff', () => {
  it('should return empty array when input is empty', () => {
    const result = chunkDiff([], 1000);
    expect(result).toEqual([]);
  });

  it('should throw error when maxChunkSize is not positive', () => {
    expect(() => chunkDiff([], 0)).toThrow('maxChunkSize must be positive');
    expect(() => chunkDiff([], -1)).toThrow('maxChunkSize must be positive');
  });

  it('should create single chunk for small file set', () => {
    const files: FileChange[] = [
      {
        path: 'file1.ts',
        type: 'modified',
        diff: 'small diff',
        additions: 1,
        deletions: 0,
      },
    ];

    const result = chunkDiff(files, 10000);
    expect(result).toHaveLength(1);
    expect(result[0].files).toEqual(files);
  });

  it('should split files into multiple chunks when size exceeds limit', () => {
    // Create files with known sizes
    // Each file will have diff of 4000 chars = ~1000 tokens
    const files: FileChange[] = [
      {
        path: 'file1.ts',
        type: 'modified',
        diff: 'x'.repeat(4000),
        additions: 100,
        deletions: 50,
      },
      {
        path: 'file2.ts',
        type: 'modified',
        diff: 'y'.repeat(4000),
        additions: 80,
        deletions: 20,
      },
      {
        path: 'file3.ts',
        type: 'modified',
        diff: 'z'.repeat(4000),
        additions: 60,
        deletions: 30,
      },
    ];

    // Max chunk size of 1200 tokens should fit 1 file per chunk
    const result = chunkDiff(files, 1200);
    expect(result).toHaveLength(3);
    expect(result[0].files).toHaveLength(1);
    expect(result[1].files).toHaveLength(1);
    expect(result[2].files).toHaveLength(1);
  });

  it('should put oversized file in its own chunk', () => {
    const files: FileChange[] = [
      {
        path: 'small.ts',
        type: 'modified',
        diff: 'x'.repeat(100),
        additions: 1,
        deletions: 0,
      },
      {
        path: 'huge.ts',
        type: 'modified',
        diff: 'y'.repeat(20000), // Very large file
        additions: 500,
        deletions: 200,
      },
      {
        path: 'normal.ts',
        type: 'modified',
        diff: 'z'.repeat(100),
        additions: 2,
        deletions: 1,
      },
    ];

    const result = chunkDiff(files, 1000);

    // Should create 3 chunks: [small], [huge], [normal]
    expect(result).toHaveLength(3);
    expect(result[0].files[0].path).toBe('small.ts');
    expect(result[1].files[0].path).toBe('huge.ts');
    expect(result[2].files[0].path).toBe('normal.ts');
  });

  it('should combine small files into same chunk', () => {
    const files: FileChange[] = [
      {
        path: 'file1.ts',
        type: 'modified',
        diff: 'x'.repeat(400),
        additions: 10,
        deletions: 5,
      },
      {
        path: 'file2.ts',
        type: 'modified',
        diff: 'y'.repeat(400),
        additions: 8,
        deletions: 3,
      },
      {
        path: 'file3.ts',
        type: 'modified',
        diff: 'z'.repeat(400),
        additions: 12,
        deletions: 7,
      },
    ];

    const result = chunkDiff(files, 10000);

    // All should fit in one chunk
    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(3);
  });

  it('should correctly estimate token counts', () => {
    const files: FileChange[] = [
      {
        path: 'test.ts',
        type: 'modified',
        diff: 'a'.repeat(4000), // 4000 chars ≈ 1000 tokens + path + metadata
        additions: 50,
        deletions: 25,
      },
    ];

    const result = chunkDiff(files, 10000);
    expect(result[0].estimatedTokens).toBeGreaterThan(1000);
    expect(result[0].estimatedTokens).toBeLessThan(1200);
  });
});
