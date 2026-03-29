export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  additions: number;
  deletions: number;
  diff: string;
}

export interface PRMetadata {
  number: number;
  title: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  url?: string;
}

export interface DiffResult {
  files: FileChange[];
  metadata?: PRMetadata;
  source: 'github' | 'local';
}

export interface ResolverOptions {
  githubToken?: string;
  diff?: string;
  patchFile?: string;
}
