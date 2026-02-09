import { describe, it, expect } from 'vitest';
import { buildJourneyResult } from '../src/executor.js';
import { makeStepResult, makeJourneyDefinition } from './fixtures.js';
import type { StepResult } from '../src/types.js';

describe('buildJourneyResult', () => {
  const journey = makeJourneyDefinition({
    steps: [{ action: 'Step 1' }, { action: 'Step 2' }, { action: 'Step 3' }],
  });
  const startedAt = '2024-01-01T00:00:00.000Z';
  const startTime = Date.now() - 5000;

  it('counts passed/failed/warning steps', () => {
    const steps: StepResult[] = [
      makeStepResult({ stepIndex: 0, status: 'passed' }),
      makeStepResult({ stepIndex: 1, status: 'failed', error: 'err' }),
      makeStepResult({ stepIndex: 2, status: 'warning' }),
    ];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
    expect(result.summary.warnings).toBe(1);
  });

  it('sets status to failed if any step failed', () => {
    const steps: StepResult[] = [
      makeStepResult({ stepIndex: 0, status: 'passed' }),
      makeStepResult({ stepIndex: 1, status: 'failed', error: 'err' }),
    ];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.status).toBe('failed');
  });

  it('sets status to warning if no failures but warnings present', () => {
    const steps: StepResult[] = [
      makeStepResult({ stepIndex: 0, status: 'passed' }),
      makeStepResult({ stepIndex: 1, status: 'warning' }),
    ];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.status).toBe('warning');
  });

  it('sets status to passed when all pass', () => {
    const steps: StepResult[] = [
      makeStepResult({ stepIndex: 0, status: 'passed' }),
      makeStepResult({ stepIndex: 1, status: 'passed' }),
    ];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.status).toBe('passed');
  });

  it('averages UX scores excluding zero scores', () => {
    const steps: StepResult[] = [
      makeStepResult({
        stepIndex: 0,
        interpretation: {
          thinking: '',
          actions: [],
          uxAnalysis: { score: 8, issues: [], positives: [] },
        },
      }),
      makeStepResult({
        stepIndex: 1,
        interpretation: {
          thinking: '',
          actions: [],
          uxAnalysis: { score: 0, issues: [], positives: [] }, // zero — excluded
        },
      }),
      makeStepResult({
        stepIndex: 2,
        interpretation: {
          thinking: '',
          actions: [],
          uxAnalysis: { score: 6, issues: [], positives: [] },
        },
      }),
    ];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    // Average of 8 and 6 = 7
    expect(result.summary.overallUXScore).toBe(7);
  });

  it('counts total UX issues across all steps', () => {
    const steps: StepResult[] = [
      makeStepResult({
        stepIndex: 0,
        interpretation: {
          thinking: '',
          actions: [],
          uxAnalysis: {
            score: 5,
            issues: [
              { severity: 'warning', category: 'accessibility', description: 'Issue 1' },
              { severity: 'info', category: 'usability', description: 'Issue 2' },
            ],
            positives: [],
          },
        },
      }),
      makeStepResult({
        stepIndex: 1,
        interpretation: {
          thinking: '',
          actions: [],
          uxAnalysis: {
            score: 7,
            issues: [
              { severity: 'critical', category: 'error', description: 'Issue 3' },
            ],
            positives: [],
          },
        },
      }),
    ];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.summary.uxIssuesFound).toBe(3);
  });

  it('sets totalSteps from journey definition', () => {
    const steps: StepResult[] = [makeStepResult()];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.summary.totalSteps).toBe(3);
  });

  it('includes journey definition in result', () => {
    const steps: StepResult[] = [makeStepResult()];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.journey).toBe(journey);
  });

  it('records startedAt and completedAt', () => {
    const steps: StepResult[] = [makeStepResult()];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.startedAt).toBe(startedAt);
    expect(result.completedAt).toBeTruthy();
  });

  it('calculates totalDurationMs', () => {
    const steps: StepResult[] = [makeStepResult()];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.totalDurationMs).toBeGreaterThan(0);
  });

  it('handles empty steps array', () => {
    const result = buildJourneyResult(journey, [], startedAt, startTime);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.overallUXScore).toBe(0);
    expect(result.status).toBe('passed');
  });

  it('returns 0 UX score when all scores are zero', () => {
    const steps: StepResult[] = [
      makeStepResult({
        stepIndex: 0,
        interpretation: {
          thinking: '',
          actions: [],
          uxAnalysis: { score: 0, issues: [], positives: [] },
        },
      }),
    ];
    const result = buildJourneyResult(journey, steps, startedAt, startTime);
    expect(result.summary.overallUXScore).toBe(0);
  });
});
