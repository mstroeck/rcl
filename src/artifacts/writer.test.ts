import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { ArtifactWriter, createArtifact, ResolvedDiffArtifact, PromptArtifact } from './index.js';

describe('ArtifactWriter', () => {
  const testDir = path.join(process.cwd(), '.test-artifacts');

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should initialize artifact directory', async () => {
    const writer = new ArtifactWriter(testDir);
    await writer.init();

    const sessionDir = writer.getSessionDir();
    const stats = await fs.stat(sessionDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should write artifact to file', async () => {
    const writer = new ArtifactWriter(testDir);
    await writer.init();

    const artifact = createArtifact<ResolvedDiffArtifact>('resolved-diff', {
      files: [],
      fileCount: 0,
      totalAdditions: 0,
      totalDeletions: 0,
    });

    const filepath = await writer.write(artifact);
    expect(filepath).toContain('resolved-diff');

    const content = await fs.readFile(filepath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.stage).toBe('resolved-diff');
    expect(parsed.data.fileCount).toBe(0);
  });

  it('should create timestamped artifacts', async () => {
    const artifact = createArtifact<PromptArtifact>('prompt', {
      chunkIndex: 0,
      totalChunks: 1,
      prompt: 'test prompt',
      fileCount: 1,
      estimatedTokens: 100,
    });

    expect(artifact.stage).toBe('prompt');
    expect(artifact.timestamp).toBeDefined();
    expect(artifact.data.prompt).toBe('test prompt');
  });

  it('should write multiple artifacts to same session', async () => {
    const writer = new ArtifactWriter(testDir);
    await writer.init();

    const artifact1 = createArtifact<ResolvedDiffArtifact>('resolved-diff', {
      files: [],
      fileCount: 0,
      totalAdditions: 0,
      totalDeletions: 0,
    });

    const artifact2 = createArtifact<PromptArtifact>('prompt', {
      chunkIndex: 0,
      totalChunks: 1,
      prompt: 'test',
      fileCount: 1,
      estimatedTokens: 50,
    });

    await writer.write(artifact1);
    await writer.write(artifact2);

    const sessionDir = writer.getSessionDir();
    const files = await fs.readdir(sessionDir);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('should create unique session IDs', async () => {
    const writer1 = new ArtifactWriter(testDir);
    await writer1.init();

    // Wait a tiny bit to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const writer2 = new ArtifactWriter(testDir);
    await writer2.init();

    const session1 = writer1.getSessionDir();
    const session2 = writer2.getSessionDir();

    expect(session1).not.toBe(session2);
  });
});
