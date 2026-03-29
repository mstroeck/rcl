import fs from 'fs/promises';
import path from 'path';
import { Artifact } from './types.js';

export class ArtifactWriter {
  private baseDir: string;
  private sessionId: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    // Create unique session ID based on timestamp
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');
  }

  async init(): Promise<void> {
    const sessionDir = path.join(this.baseDir, this.sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
  }

  async write(artifact: Artifact): Promise<string> {
    const sessionDir = path.join(this.baseDir, this.sessionId);
    const filename = `${artifact.stage}-${artifact.timestamp}.json`;
    const filepath = path.join(sessionDir, filename);

    await fs.writeFile(filepath, JSON.stringify(artifact, null, 2), 'utf-8');
    return filepath;
  }

  getSessionDir(): string {
    return path.join(this.baseDir, this.sessionId);
  }
}

export function createArtifact<T extends Artifact>(
  stage: T['stage'],
  data: T['data']
): T {
  return {
    timestamp: new Date().toISOString(),
    stage,
    data,
  } as T;
}
