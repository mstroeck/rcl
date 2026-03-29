import { describe, it, expect } from 'vitest';
import { buildConsensus } from './index.js';
import { ReviewResponse } from '../dispatch/adapter.js';
import { ReviewConfig } from '../config/schema.js';

describe('Disagreement Analysis', () => {
  const mockConfig: ReviewConfig = {
    models: [],
    timeout: 60000,
    maxConcurrent: 3,
    includeFixSuggestions: true,
    chunkSize: 5000,
    promptHardening: true,
    nearMatchThreshold: 3,
    thresholds: {
      minConsensusScore: 0,
      minSeverity: 'info',
      requireUnanimous: false,
    },
    retries: 2,
    retryDelayMs: 1000,
  };

  it('should identify single-model findings', async () => {
    const responses: ReviewResponse[] = [
      {
        provider: 'anthropic',
        model: 'claude-3',
        rawResponse: JSON.stringify([
          {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'SQL injection vulnerability',
            suggestion: 'Use parameterized queries',
          },
        ]),
        success: true,
        durationMs: 1000,
      },
      {
        provider: 'openai',
        model: 'gpt-4',
        rawResponse: JSON.stringify([]),
        success: true,
        durationMs: 1000,
      },
    ];

    const result = await buildConsensus(responses, mockConfig, ['test.ts']);

    expect(result.disagreements).toHaveLength(1);
    expect(result.disagreements[0].reason).toBe('single-model');
    expect(result.disagreements[0].modelId).toBe('anthropic/claude-3');
    expect(result.disagreements[0].finding.severity).toBe('high');
  });

  it('should identify severity disagreements', async () => {
    const responses: ReviewResponse[] = [
      {
        provider: 'anthropic',
        model: 'claude-3',
        rawResponse: JSON.stringify([
          {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Potential SQL injection vulnerability detected in query',
            suggestion: 'Fix it',
          },
        ]),
        success: true,
        durationMs: 1000,
      },
      {
        provider: 'openai',
        model: 'gpt-4',
        rawResponse: JSON.stringify([
          {
            file: 'test.ts',
            line: 10,
            severity: 'medium',
            category: 'security',
            message: 'SQL injection vulnerability found in database query',
            suggestion: 'Fix it',
          },
        ]),
        success: true,
        durationMs: 1000,
      },
    ];

    const result = await buildConsensus(responses, mockConfig, ['test.ts']);

    const severityDisagreements = result.disagreements.filter(
      d => d.reason === 'severity-disagreement'
    );
    expect(severityDisagreements.length).toBeGreaterThan(0);
    expect(severityDisagreements[0].severityRange).toBeDefined();
    expect(severityDisagreements[0].severityRange?.min).toBe('medium');
    expect(severityDisagreements[0].severityRange?.max).toBe('high');
  });

  it('should not identify disagreements when all models agree', async () => {
    const responses: ReviewResponse[] = [
      {
        provider: 'anthropic',
        model: 'claude-3',
        rawResponse: JSON.stringify([
          {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Potential SQL injection vulnerability detected',
            suggestion: 'Fix it',
          },
        ]),
        success: true,
        durationMs: 1000,
      },
      {
        provider: 'openai',
        model: 'gpt-4',
        rawResponse: JSON.stringify([
          {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'SQL injection vulnerability found',
            suggestion: 'Fix it',
          },
        ]),
        success: true,
        durationMs: 1000,
      },
    ];

    const result = await buildConsensus(responses, mockConfig, ['test.ts']);

    // Should have no single-model findings (both models found it)
    const singleModel = result.disagreements.filter(d => d.reason === 'single-model');
    expect(singleModel).toHaveLength(0);

    // Should have no severity disagreements (both said 'high')
    const severityDis = result.disagreements.filter(d => d.reason === 'severity-disagreement');
    expect(severityDis).toHaveLength(0);
  });

  it('should handle multiple disagreements', async () => {
    const responses: ReviewResponse[] = [
      {
        provider: 'anthropic',
        model: 'claude-3',
        rawResponse: JSON.stringify([
          {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Critical security vulnerability detected in authentication',
            suggestion: 'Fix',
          },
          {
            file: 'test.ts',
            line: 20,
            severity: 'low',
            category: 'style',
            message: 'Missing semicolon formatting issue',
            suggestion: 'Fix',
          },
        ]),
        success: true,
        durationMs: 1000,
      },
      {
        provider: 'openai',
        model: 'gpt-4',
        rawResponse: JSON.stringify([
          {
            file: 'test.ts',
            line: 10,
            severity: 'medium',
            category: 'security',
            message: 'Security vulnerability found in authentication logic',
            suggestion: 'Fix',
          },
        ]),
        success: true,
        durationMs: 1000,
      },
    ];

    const result = await buildConsensus(responses, mockConfig, ['test.ts']);

    // Should have single-model finding (Issue 2)
    const singleModel = result.disagreements.filter(d => d.reason === 'single-model');
    expect(singleModel.length).toBeGreaterThan(0);

    // Should have severity disagreement (Issue 1)
    const severityDis = result.disagreements.filter(d => d.reason === 'severity-disagreement');
    expect(severityDis.length).toBeGreaterThan(0);
  });
});
