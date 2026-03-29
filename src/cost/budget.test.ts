import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateCost } from './estimator.js';

describe('Budget Controls', () => {
  it('should estimate tokens for a prompt', () => {
    const text = 'This is a test prompt with some content.';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length); // Should be less than char count
  });

  it('should estimate cost for different models', () => {
    const tokens = 10000;

    const claudeCost = estimateCost(tokens, 'claude-sonnet-4');
    expect(claudeCost.total).toBeGreaterThan(0);
    expect(claudeCost.input).toBeGreaterThan(0);
    expect(claudeCost.output).toBeGreaterThan(0);

    const gptCost = estimateCost(tokens, 'gpt-4o');
    expect(gptCost.total).toBeGreaterThan(0);

    const geminiCost = estimateCost(tokens, 'gemini-flash');
    expect(geminiCost.total).toBeGreaterThan(0);

    // Gemini Flash should be cheapest
    expect(geminiCost.total).toBeLessThan(gptCost.total);
  });

  it('should use default pricing for unknown models', () => {
    const tokens = 10000;
    const unknownCost = estimateCost(tokens, 'unknown-model-xyz');
    expect(unknownCost.total).toBeGreaterThan(0);
  });

  it('should calculate budget correctly', () => {
    const tokens = 100000; // 100k tokens
    const cost = estimateCost(tokens, 'claude-sonnet-4');

    // With sonnet pricing ($3 input, $15 output per 1M tokens)
    // Input: 100k / 1M * 3 = $0.30
    // Output: ~10k / 1M * 15 = ~$0.15 (estimate is 10% of input, min 2500)
    // Total should be around $0.45
    expect(cost.total).toBeGreaterThan(0.4);
    expect(cost.total).toBeLessThan(0.6);
  });

  it('should estimate higher output cost for larger prompts', () => {
    const smallTokens = 5000;
    const largeTokens = 50000;

    const smallCost = estimateCost(smallTokens, 'claude-sonnet-4');
    const largeCost = estimateCost(largeTokens, 'claude-sonnet-4');

    // Output cost should scale with input size
    expect(largeCost.output).toBeGreaterThan(smallCost.output);
  });
});
