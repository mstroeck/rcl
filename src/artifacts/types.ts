import { FileChange } from '../resolver/types.js';
import { ReviewResponse } from '../dispatch/adapter.js';
import { ConsensusResult } from '../consensus/index.js';
import { PolicyResult } from '../ci/policy.js';

export interface ResolvedDiffArtifact {
  timestamp: string;
  stage: 'resolved-diff';
  data: {
    files: FileChange[];
    fileCount: number;
    totalAdditions: number;
    totalDeletions: number;
  };
}

export interface PromptArtifact {
  timestamp: string;
  stage: 'prompt';
  data: {
    chunkIndex: number;
    totalChunks: number;
    prompt: string;
    fileCount: number;
    estimatedTokens: number;
  };
}

export interface ModelRunArtifact {
  timestamp: string;
  stage: 'model-run';
  data: {
    chunkIndex: number;
    responses: ReviewResponse[];
  };
}

export interface ConsensusArtifact {
  timestamp: string;
  stage: 'consensus';
  data: ConsensusResult;
}

export interface PolicyArtifact {
  timestamp: string;
  stage: 'policy';
  data: PolicyResult;
}

export type Artifact =
  | ResolvedDiffArtifact
  | PromptArtifact
  | ModelRunArtifact
  | ConsensusArtifact
  | PolicyArtifact;
