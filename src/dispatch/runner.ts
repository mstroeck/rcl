import { ModelConfig } from '../config/schema.js';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';
import { GoogleAdapter } from './google.js';
import { OpenAICompatAdapter } from './openai-compat.js';

/**
 * HTTP status codes that should trigger a retry
 */
const RETRYABLE_HTTP_CODES = [429, 500, 502, 503, 504];

/**
 * Network error codes that should trigger a retry
 */
const RETRYABLE_ERROR_CODES = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'];

/**
 * HTTP status codes that should NOT be retried (auth/config errors)
 */
const NON_RETRYABLE_HTTP_CODES = [400, 401, 403];

/**
 * Check if an error should trigger a retry
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const err = error as Record<string, unknown>;

  // Check HTTP status codes
  if (typeof err.status === 'number') {
    if (NON_RETRYABLE_HTTP_CODES.includes(err.status)) {
      return false;
    }
    if (RETRYABLE_HTTP_CODES.includes(err.status)) {
      return true;
    }
  }

  // Check error codes
  if (typeof err.code === 'string') {
    if (RETRYABLE_ERROR_CODES.includes(err.code)) {
      return true;
    }
  }

  // Check error message for common network issues
  if (typeof err.message === 'string') {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('timeout') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('rate limit')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract Retry-After header from error (in seconds)
 */
function getRetryAfter(error: unknown): number | null {
  const err = error as Record<string, unknown>;
  const response = err.response as Record<string, unknown> | undefined;
  const headers = response?.headers as Record<string, string> | undefined;

  // Check for Retry-After header in response
  if (headers?.['retry-after']) {
    const retryAfter = headers['retry-after'];
    const parsed = parseInt(retryAfter, 10);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  retryAfterSeconds: number | null
): number {
  // If server specified Retry-After, use that
  if (retryAfterSeconds !== null) {
    return retryAfterSeconds * 1000;
  }

  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a review request with exponential backoff
 */
async function retryReview(
  adapter: ReviewAdapter,
  request: ReviewRequest,
  maxRetries: number,
  baseDelayMs: number,
  onRetry?: (attempt: number, maxAttempts: number, provider: string, model: string) => void
): Promise<ReviewResponse> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await adapter.review(request);

      // If review succeeded, return it
      if (response.success) {
        return response;
      }

      // If review failed but error is not retryable, return failure immediately
      if (!isRetryableError(response.error)) {
        return response;
      }

      // Store error for retry
      lastError = response.error;

      // If this was the last attempt, return the failed response
      if (attempt === maxRetries) {
        return response;
      }

      // Calculate backoff delay
      const retryAfter = getRetryAfter(response.error);
      const delay = calculateBackoffDelay(attempt, baseDelayMs, retryAfter);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, request.model.provider, request.model.model);
      }

      // Wait before retrying
      await sleep(delay);
    } catch (error) {
      lastError = error;

      // If error is not retryable or this was the last attempt, throw
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      // Calculate backoff delay
      const retryAfter = getRetryAfter(error);
      const delay = calculateBackoffDelay(attempt, baseDelayMs, retryAfter);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, request.model.provider, request.model.model);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error during retry');
}

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
  adapters?: Record<string, ReviewAdapter>,
  retries: number = 2,
  retryDelayMs: number = 1000,
  onRetry?: (attempt: number, maxAttempts: number, provider: string, model: string) => void
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
        return retryReview(adapter, req, retries, retryDelayMs, onRetry);
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
