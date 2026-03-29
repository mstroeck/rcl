import { ModelConfig } from '../config/schema.js';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';
import { GoogleAdapter } from './google.js';
import { OpenAICompatAdapter } from './openai-compat.js';

function createDefaultAdapters(): Record<string, ReviewAdapter> {
  return {
    anthropic: new AnthropicAdapter(),
    openai: new OpenAIAdapter(),
    google: new GoogleAdapter(),
    'openai-compat': new OpenAICompatAdapter(),
  };
}

export async function runReviews(
  prompt: string,
  models: ModelConfig[],
  timeout: number,
  maxConcurrent: number,
  adapters?: Record<string, ReviewAdapter>
): Promise<ReviewResponse[]> {
  const adapterMap = adapters || createDefaultAdapters();

  const requests: ReviewRequest[] = models.map(model => ({
    prompt,
    model,
    timeout,
  }));

  // Run reviews with concurrency limit
  const results: ReviewResponse[] = [];
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const batch = requests.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(req => {
        const adapter = adapterMap[req.model.provider];
        if (!adapter) {
          return Promise.resolve({
            provider: req.model.provider,
            model: req.model.model,
            rawResponse: '',
            success: false,
            error: `Unknown provider: ${req.model.provider}`,
            durationMs: 0,
          });
        }
        return adapter.review(req);
      })
    );

    // Convert settled results to ReviewResponse objects
    results.push(...batchResults.map((result, idx) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const req = batch[idx];
        return {
          provider: req.model.provider,
          model: req.model.model,
          rawResponse: '',
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          durationMs: 0,
        };
      }
    }));
  }

  return results;
}

export function getAdapter(provider: string, adapters?: Record<string, ReviewAdapter>): ReviewAdapter | null {
  const adapterMap = adapters || createDefaultAdapters();
  return adapterMap[provider] || null;
}
