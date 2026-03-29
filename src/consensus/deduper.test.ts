import { describe, it, expect } from 'vitest';
import { deduplicateFindings, selectRepresentativeFinding } from './deduper.js';
import { Finding } from './types.js';

describe('deduplicateFindings', () => {
  it('should group exact duplicate findings', () => {
    const finding: Finding = {
      file: 'test.ts',
      line: 10,
      severity: 'high',
      category: 'security',
      message: 'SQL injection vulnerability detected here',
      suggestion: 'Use parameterized queries',
    };

    const reviews = [
      { modelId: 'claude', findings: [finding] },
      { modelId: 'gpt', findings: [finding] },
    ];

    const groups = deduplicateFindings(reviews, 5);

    expect(groups).toHaveLength(1);
    expect(groups[0].findings).toHaveLength(2);
    expect(groups[0].file).toBe('test.ts');
  });

  it('should group findings on nearby lines', () => {
    const finding1: Finding = {
      file: 'test.ts',
      line: 10,
      severity: 'high',
      category: 'security',
      message: 'SQL injection vulnerability detected',
      suggestion: 'Use parameterized queries',
    };

    const finding2: Finding = {
      file: 'test.ts',
      line: 12,
      severity: 'high',
      category: 'security',
      message: 'SQL injection vulnerability found',
      suggestion: 'Sanitize input',
    };

    const reviews = [
      { modelId: 'claude', findings: [finding1] },
      { modelId: 'gpt', findings: [finding2] },
    ];

    const groups = deduplicateFindings(reviews, 5);

    expect(groups).toHaveLength(1);
    expect(groups[0].findings).toHaveLength(2);
  });

  it('should separate findings beyond threshold', () => {
    const finding1: Finding = {
      file: 'test.ts',
      line: 10,
      severity: 'high',
      category: 'security',
      message: 'Issue at line 10',
      suggestion: 'Fix it',
    };

    const finding2: Finding = {
      file: 'test.ts',
      line: 20,
      severity: 'high',
      category: 'bug',
      message: 'Issue at line 20',
      suggestion: 'Fix it',
    };

    const reviews = [
      { modelId: 'claude', findings: [finding1] },
      { modelId: 'gpt', findings: [finding2] },
    ];

    const groups = deduplicateFindings(reviews, 5);

    expect(groups).toHaveLength(2);
  });

  it('should separate findings in different files', () => {
    const finding1: Finding = {
      file: 'test1.ts',
      line: 10,
      severity: 'high',
      category: 'security',
      message: 'Issue',
      suggestion: 'Fix it',
    };

    const finding2: Finding = {
      file: 'test2.ts',
      line: 10,
      severity: 'high',
      category: 'security',
      message: 'Issue',
      suggestion: 'Fix it',
    };

    const reviews = [
      { modelId: 'claude', findings: [finding1] },
      { modelId: 'gpt', findings: [finding2] },
    ];

    const groups = deduplicateFindings(reviews, 5);

    expect(groups).toHaveLength(2);
  });

  it('should group by category similarity', () => {
    const finding1: Finding = {
      file: 'test.ts',
      line: 10,
      severity: 'high',
      category: 'security',
      message: 'Authentication bypass vulnerability found',
      suggestion: 'Fix it',
    };

    const finding2: Finding = {
      file: 'test.ts',
      line: 11,
      severity: 'high',
      category: 'security',
      message: 'Bypass authentication vulnerability detected',
      suggestion: 'Fix differently',
    };

    const reviews = [
      { modelId: 'claude', findings: [finding1] },
      { modelId: 'gpt', findings: [finding2] },
    ];

    const groups = deduplicateFindings(reviews, 5);

    expect(groups).toHaveLength(1);
  });

  it('should expand line range when grouping', () => {
    const findings: Finding[] = [
      {
        file: 'test.ts',
        line: 10,
        severity: 'high',
        category: 'security',
        message: 'Input validation vulnerability found',
        suggestion: 'Fix',
      },
      {
        file: 'test.ts',
        line: 12,
        severity: 'high',
        category: 'security',
        message: 'Validation vulnerability for input',
        suggestion: 'Fix',
      },
      {
        file: 'test.ts',
        line: 14,
        severity: 'high',
        category: 'security',
        message: 'Found input validation issue',
        suggestion: 'Fix',
      },
    ];

    const reviews = findings.map((f, i) => ({
      modelId: `model${i}`,
      findings: [f],
    }));

    const groups = deduplicateFindings(reviews, 5);

    expect(groups).toHaveLength(1);
    expect(groups[0].lineRange.start).toBe(10);
    expect(groups[0].lineRange.end).toBe(14);
  });
});

describe('selectRepresentativeFinding', () => {
  it('should select finding with highest severity', () => {
    const group = {
      file: 'test.ts',
      lineRange: { start: 10, end: 12 },
      findings: [
        {
          modelId: 'model1',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'medium' as const,
            category: 'bug',
            message: 'Medium issue',
            suggestion: 'Fix',
          },
        },
        {
          modelId: 'model2',
          finding: {
            file: 'test.ts',
            line: 11,
            severity: 'high' as const,
            category: 'bug',
            message: 'High issue',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const representative = selectRepresentativeFinding(group);
    expect(representative.severity).toBe('high');
  });

  it('should prefer longer messages when severity is equal', () => {
    const group = {
      file: 'test.ts',
      lineRange: { start: 10, end: 12 },
      findings: [
        {
          modelId: 'model1',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'high' as const,
            category: 'bug',
            message: 'Short',
            suggestion: 'Fix',
          },
        },
        {
          modelId: 'model2',
          finding: {
            file: 'test.ts',
            line: 11,
            severity: 'high' as const,
            category: 'bug',
            message: 'This is a much longer and more detailed message',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const representative = selectRepresentativeFinding(group);
    expect(representative.message).toBe('This is a much longer and more detailed message');
  });
});
