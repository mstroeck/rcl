import { ModelConfig } from '../config/schema.js';

export interface ReviewRequest {
  prompt: string;
  model: ModelConfig;
  timeout: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ReviewResponse {
  provider: string;
  model: string;
  rawResponse: string;
  success: boolean;
  error?: string;
  durationMs: number;
  tokenUsage?: TokenUsage;
}

export interface ReviewAdapter {
  review(request: ReviewRequest): Promise<ReviewResponse>;
  getName(): string;
}
