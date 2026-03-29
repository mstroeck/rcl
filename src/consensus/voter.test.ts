import { describe, it, expect } from 'vitest';
import { voteOnFindings, filterByThresholds } from './voter.js';
import { FindingGroup } from './deduper.js';
import { ConsensusFinding } from './types.js';

describe('voteOnFindings', () => {
  it('should calculate consensus score correctly', () => {
    const group: FindingGroup = {
      file: 'test.ts',
      lineRange: { start: 10, end: 10 },
      findings: [
        {
          modelId: 'model1',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
        {
          modelId: 'model2',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const findings = voteOnFindings([group], 3);

    expect(findings).toHaveLength(1);
    expect(findings[0].consensusScore).toBeCloseTo(0.667, 2);
    expect(findings[0].modelCount).toBe(2);
    expect(findings[0].totalModels).toBe(3);
  });

  it('should mark unanimous findings', () => {
    const group: FindingGroup = {
      file: 'test.ts',
      lineRange: { start: 10, end: 10 },
      findings: [
        {
          modelId: 'model1',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
        {
          modelId: 'model2',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const findings = voteOnFindings([group], 2);

    expect(findings[0].unanimous).toBe(true);
    expect(findings[0].consensusScore).toBe(1);
  });

  it('should not elevate for single model', () => {
    const group: FindingGroup = {
      file: 'test.ts',
      lineRange: { start: 10, end: 10 },
      findings: [
        {
          modelId: 'model1',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'medium',
            category: 'bug',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const findings = voteOnFindings([group], 3);

    expect(findings[0].severity).toBe('medium');
    expect(findings[0].elevated).toBe(false);
  });

  it('should elevate for 2+ models', () => {
    const group: FindingGroup = {
      file: 'test.ts',
      lineRange: { start: 10, end: 10 },
      findings: [
        {
          modelId: 'model1',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'medium',
            category: 'bug',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
        {
          modelId: 'model2',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'medium',
            category: 'bug',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const findings = voteOnFindings([group], 3);

    expect(findings[0].severity).toBe('high');
    expect(findings[0].originalSeverity).toBe('medium');
    expect(findings[0].elevated).toBe(true);
  });

  it('should elevate for unanimous findings', () => {
    const group: FindingGroup = {
      file: 'test.ts',
      lineRange: { start: 10, end: 10 },
      findings: [
        {
          modelId: 'model1',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'low',
            category: 'style',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
        {
          modelId: 'model2',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'low',
            category: 'style',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const findings = voteOnFindings([group], 2);

    expect(findings[0].severity).toBe('medium');
    expect(findings[0].elevated).toBe(true);
    expect(findings[0].unanimous).toBe(true);
  });

  it('should not elevate critical severity', () => {
    const group: FindingGroup = {
      file: 'test.ts',
      lineRange: { start: 10, end: 10 },
      findings: [
        {
          modelId: 'model1',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'critical',
            category: 'security',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
        {
          modelId: 'model2',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'critical',
            category: 'security',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const findings = voteOnFindings([group], 2);

    expect(findings[0].severity).toBe('critical');
    expect(findings[0].elevated).toBe(false); // Cannot elevate critical further
  });

  it('should include model names', () => {
    const group: FindingGroup = {
      file: 'test.ts',
      lineRange: { start: 10, end: 10 },
      findings: [
        {
          modelId: 'claude',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
        {
          modelId: 'gpt',
          finding: {
            file: 'test.ts',
            line: 10,
            severity: 'high',
            category: 'security',
            message: 'Issue',
            suggestion: 'Fix',
          },
        },
      ],
    };

    const findings = voteOnFindings([group], 3);

    expect(findings[0].models).toEqual(['claude', 'gpt']);
  });
});

describe('filterByThresholds', () => {
  const baseFinding: ConsensusFinding = {
    file: 'test.ts',
    line: 10,
    severity: 'high',
    originalSeverity: 'high',
    elevated: false,
    category: 'security',
    message: 'Issue',
    suggestion: 'Fix',
    consensusScore: 0.67,
    modelCount: 2,
    totalModels: 3,
    unanimous: false,
    models: ['model1', 'model2'],
  };

  it('should filter by consensus score', () => {
    const findings = [
      { ...baseFinding, consensusScore: 0.33 },
      { ...baseFinding, consensusScore: 0.67 },
      { ...baseFinding, consensusScore: 1.0 },
    ];

    const filtered = filterByThresholds(findings, 0.5, 'low', false);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].consensusScore).toBeGreaterThanOrEqual(0.5);
  });

  it('should filter by severity', () => {
    const findings = [
      { ...baseFinding, severity: 'low' as const },
      { ...baseFinding, severity: 'medium' as const },
      { ...baseFinding, severity: 'high' as const },
    ];

    const filtered = filterByThresholds(findings, 0, 'medium', false);

    expect(filtered).toHaveLength(2);
    expect(filtered.every(f => f.severity === 'medium' || f.severity === 'high')).toBe(true);
  });

  it('should filter by unanimous requirement', () => {
    const findings = [
      { ...baseFinding, unanimous: false },
      { ...baseFinding, unanimous: true },
    ];

    const filtered = filterByThresholds(findings, 0, 'low', true);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].unanimous).toBe(true);
  });

  it('should apply all filters together', () => {
    const findings = [
      { ...baseFinding, consensusScore: 0.33, severity: 'low' as const, unanimous: false },
      { ...baseFinding, consensusScore: 0.67, severity: 'medium' as const, unanimous: false },
      { ...baseFinding, consensusScore: 1.0, severity: 'high' as const, unanimous: true },
    ];

    const filtered = filterByThresholds(findings, 0.5, 'medium', true);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].consensusScore).toBe(1.0);
    expect(filtered[0].severity).toBe('high');
    expect(filtered[0].unanimous).toBe(true);
  });
});
