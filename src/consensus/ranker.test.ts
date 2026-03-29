import { describe, it, expect } from 'vitest';
import { rankFindings, summarizeFindings } from './ranker.js';
import { ConsensusFinding } from './types.js';

describe('rankFindings', () => {
  const baseFinding: ConsensusFinding = {
    file: 'test.ts',
    line: 10,
    severity: 'medium',
    originalSeverity: 'medium',
    elevated: false,
    category: 'bug',
    message: 'Issue',
    suggestion: 'Fix',
    consensusScore: 0.5,
    modelCount: 1,
    totalModels: 2,
    unanimous: false,
    models: ['model1'],
  };

  it('should sort by severity first', () => {
    const findings = [
      { ...baseFinding, severity: 'low' as const },
      { ...baseFinding, severity: 'critical' as const },
      { ...baseFinding, severity: 'medium' as const },
      { ...baseFinding, severity: 'high' as const },
    ];

    const ranked = rankFindings(findings);

    expect(ranked[0].severity).toBe('critical');
    expect(ranked[1].severity).toBe('high');
    expect(ranked[2].severity).toBe('medium');
    expect(ranked[3].severity).toBe('low');
  });

  it('should sort by consensus score when severity is equal', () => {
    const findings = [
      { ...baseFinding, consensusScore: 0.33 },
      { ...baseFinding, consensusScore: 1.0 },
      { ...baseFinding, consensusScore: 0.67 },
    ];

    const ranked = rankFindings(findings);

    expect(ranked[0].consensusScore).toBe(1.0);
    expect(ranked[1].consensusScore).toBe(0.67);
    expect(ranked[2].consensusScore).toBe(0.33);
  });

  it('should sort by file path alphabetically', () => {
    const findings = [
      { ...baseFinding, file: 'src/c.ts' },
      { ...baseFinding, file: 'src/a.ts' },
      { ...baseFinding, file: 'src/b.ts' },
    ];

    const ranked = rankFindings(findings);

    expect(ranked[0].file).toBe('src/a.ts');
    expect(ranked[1].file).toBe('src/b.ts');
    expect(ranked[2].file).toBe('src/c.ts');
  });

  it('should sort by line number within same file', () => {
    const findings = [
      { ...baseFinding, file: 'test.ts', line: 30 },
      { ...baseFinding, file: 'test.ts', line: 10 },
      { ...baseFinding, file: 'test.ts', line: 20 },
    ];

    const ranked = rankFindings(findings);

    expect(ranked[0].line).toBe(10);
    expect(ranked[1].line).toBe(20);
    expect(ranked[2].line).toBe(30);
  });

  it('should apply all sorting rules in order', () => {
    const findings = [
      { ...baseFinding, severity: 'low' as const, consensusScore: 1.0, file: 'a.ts', line: 1 },
      { ...baseFinding, severity: 'high' as const, consensusScore: 0.5, file: 'b.ts', line: 2 },
      { ...baseFinding, severity: 'high' as const, consensusScore: 1.0, file: 'c.ts', line: 3 },
      { ...baseFinding, severity: 'high' as const, consensusScore: 1.0, file: 'a.ts', line: 10 },
      { ...baseFinding, severity: 'high' as const, consensusScore: 1.0, file: 'a.ts', line: 5 },
    ];

    const ranked = rankFindings(findings);

    // First: high severity with consensus 1.0, file a.ts, line 5
    expect(ranked[0].severity).toBe('high');
    expect(ranked[0].consensusScore).toBe(1.0);
    expect(ranked[0].file).toBe('a.ts');
    expect(ranked[0].line).toBe(5);

    // Last: low severity
    expect(ranked[4].severity).toBe('low');
  });
});

describe('summarizeFindings', () => {
  const baseFinding: ConsensusFinding = {
    file: 'test.ts',
    line: 10,
    severity: 'medium',
    originalSeverity: 'medium',
    elevated: false,
    category: 'bug',
    message: 'Issue',
    suggestion: 'Fix',
    consensusScore: 0.5,
    modelCount: 1,
    totalModels: 2,
    unanimous: false,
    models: ['model1'],
  };

  it('should count total findings', () => {
    const findings = [baseFinding, baseFinding, baseFinding];
    const summary = summarizeFindings(findings);

    expect(summary.total).toBe(3);
  });

  it('should count findings by severity', () => {
    const findings = [
      { ...baseFinding, severity: 'high' as const },
      { ...baseFinding, severity: 'high' as const },
      { ...baseFinding, severity: 'medium' as const },
      { ...baseFinding, severity: 'low' as const },
    ];

    const summary = summarizeFindings(findings);

    expect(summary.bySeverity.high).toBe(2);
    expect(summary.bySeverity.medium).toBe(1);
    expect(summary.bySeverity.low).toBe(1);
    expect(summary.bySeverity.critical).toBe(0);
  });

  it('should count unanimous findings', () => {
    const findings = [
      { ...baseFinding, unanimous: true },
      { ...baseFinding, unanimous: false },
      { ...baseFinding, unanimous: true },
    ];

    const summary = summarizeFindings(findings);

    expect(summary.unanimous).toBe(2);
  });

  it('should count elevated findings', () => {
    const findings = [
      { ...baseFinding, elevated: true },
      { ...baseFinding, elevated: false },
      { ...baseFinding, elevated: true },
      { ...baseFinding, elevated: true },
    ];

    const summary = summarizeFindings(findings);

    expect(summary.elevated).toBe(3);
  });

  it('should group by model count', () => {
    const findings = [
      { ...baseFinding, modelCount: 1 },
      { ...baseFinding, modelCount: 2 },
      { ...baseFinding, modelCount: 2 },
      { ...baseFinding, modelCount: 3 },
      { ...baseFinding, modelCount: 3 },
      { ...baseFinding, modelCount: 3 },
    ];

    const summary = summarizeFindings(findings);

    expect(summary.byModels).toHaveLength(3);

    // Should be sorted by modelCount descending
    expect(summary.byModels[0].modelCount).toBe(3);
    expect(summary.byModels[0].count).toBe(3);

    expect(summary.byModels[1].modelCount).toBe(2);
    expect(summary.byModels[1].count).toBe(2);

    expect(summary.byModels[2].modelCount).toBe(1);
    expect(summary.byModels[2].count).toBe(1);
  });

  it('should handle empty findings', () => {
    const summary = summarizeFindings([]);

    expect(summary.total).toBe(0);
    expect(summary.unanimous).toBe(0);
    expect(summary.elevated).toBe(0);
    expect(summary.byModels).toHaveLength(0);
  });
});
