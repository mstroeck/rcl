import { describe, it, expect, vi } from 'vitest';
import { runReviews } from './runner.js';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';
import { ModelConfig } from '../config/schema.js';

/**
 * Mock adapter that fails a specified number of times then succeeds
 */
class RetryableAdapter implements ReviewAdapter {
  private attempts = 0;
  private failuresBeforeSuccess: number;

  constructor(failuresBeforeSuccess: number) {
    this.failuresBeforeSuccess = failuresBeforeSuccess;
  }

  getName(): string {
    return 'retryable';
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    this.attempts++;

    if (this.attempts <= this.failuresBeforeSuccess) {
      // Simulate a retryable error (503 Service Unavailable)
      return {
        provider: 'retryable',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: { status: 503, message: 'Service temporarily unavailable' } as any,
        durationMs: 10,
      };
    }

    // Success after retries
    return {
      provider: 'retryable',
      model: request.model.model,
      rawResponse: '[]',
      success: true,
      durationMs: 10,
    };
  }

  getAttempts(): number {
    return this.attempts;
  }
}

/**
 * Mock adapter that always fails with non-retryable error
 */
class NonRetryableAdapter implements ReviewAdapter {
  private attempts = 0;

  getName(): string {
    return 'non-retryable';
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    this.attempts++;

    // Simulate a non-retryable error (401 Unauthorized)
    return {
      provider: 'non-retryable',
      model: request.model.model,
      rawResponse: '',
      success: false,
      error: { status: 401, message: 'Invalid API key' } as any,
      durationMs: 10,
    };
  }

  getAttempts(): number {
    return this.attempts;
  }
}

describe('runner retry logic', () => {
  it('should retry on retryable errors and eventually succeed', async () => {
    const adapter = new RetryableAdapter(2); // Fail twice, then succeed
    const model: ModelConfig = {
      provider: 'retryable' as any,
      model: 'test-model',
      temperature: 0.3,
      maxTokens: 1000,
    };

    const results = await runReviews(
      'test prompt',
      [model],
      30,
      1,
      { retryable: adapter },
      3, // max 3 retries
      50 // 50ms base delay for fast tests
    );

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(adapter.getAttempts()).toBe(3); // Initial + 2 retries
  });

  it('should not retry on non-retryable errors', async () => {
    const adapter = new NonRetryableAdapter();
    const model: ModelConfig = {
      provider: 'non-retryable' as any,
      model: 'test-model',
      temperature: 0.3,
      maxTokens: 1000,
    };

    const results = await runReviews(
      'test prompt',
      [model],
      30,
      1,
      { 'non-retryable': adapter },
      3, // max 3 retries
      50
    );

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(adapter.getAttempts()).toBe(1); // Only one attempt, no retries
  });

  it('should give up after max retries exceeded', async () => {
    const adapter = new RetryableAdapter(10); // Fail 10 times (more than max retries)
    const model: ModelConfig = {
      provider: 'retryable' as any,
      model: 'test-model',
      temperature: 0.3,
      maxTokens: 1000,
    };

    const results = await runReviews(
      'test prompt',
      [model],
      30,
      1,
      { retryable: adapter },
      2, // max 2 retries
      50
    );

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(adapter.getAttempts()).toBe(3); // Initial + 2 retries = 3 attempts
  });

  it('should call onRetry callback when retrying', async () => {
    const adapter = new RetryableAdapter(1); // Fail once, then succeed
    const model: ModelConfig = {
      provider: 'retryable' as any,
      model: 'test-model',
      temperature: 0.3,
      maxTokens: 1000,
    };

    const onRetry = vi.fn();

    await runReviews(
      'test prompt',
      [model],
      30,
      1,
      { retryable: adapter },
      2,
      50,
      onRetry
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, 2, 'retryable', 'test-model');
  });

  it('should succeed immediately when no retries needed', async () => {
    const adapter = new RetryableAdapter(0); // Succeed on first try
    const model: ModelConfig = {
      provider: 'retryable' as any,
      model: 'test-model',
      temperature: 0.3,
      maxTokens: 1000,
    };

    const results = await runReviews(
      'test prompt',
      [model],
      30,
      1,
      { retryable: adapter },
      2,
      50
    );

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(adapter.getAttempts()).toBe(1); // Only one attempt
  });
});
