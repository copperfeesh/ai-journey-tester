import type {
  PageState,
  StepResult,
  JourneyResult,
  JourneyDefinition,
  SuiteResult,
  SuiteDefinition,
  AIStepInterpretation,
} from '../src/types.js';

export function makePageState(overrides: Partial<PageState> = {}): PageState {
  return {
    url: 'https://example.com',
    title: 'Example',
    ariaSnapshot: '- heading "Example Domain"',
    screenshotBase64: '',
    consoleMessages: [],
    networkErrors: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

export function makeInterpretation(overrides: Partial<AIStepInterpretation> = {}): AIStepInterpretation {
  return {
    thinking: 'Test thinking',
    actions: [],
    uxAnalysis: { score: 8, issues: [], positives: [] },
    ...overrides,
  };
}

export function makeStepResult(overrides: Partial<StepResult> = {}): StepResult {
  return {
    stepIndex: 0,
    action: 'Click the button',
    status: 'passed',
    interpretation: makeInterpretation(),
    pageStateBefore: makePageState(),
    pageStateAfter: makePageState(),
    durationMs: 150,
    ...overrides,
  };
}

export function makeJourneyDefinition(overrides: Partial<JourneyDefinition> = {}): JourneyDefinition {
  return {
    name: 'Test Journey',
    url: 'https://example.com',
    steps: [{ action: 'Click the button' }],
    ...overrides,
  };
}

export function makeJourneyResult(overrides: Partial<JourneyResult> = {}): JourneyResult {
  return {
    journey: makeJourneyDefinition(),
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:01:00.000Z',
    totalDurationMs: 60000,
    status: 'passed',
    steps: [makeStepResult()],
    summary: {
      totalSteps: 1,
      passed: 1,
      failed: 0,
      warnings: 0,
      uxIssuesFound: 0,
      overallUXScore: 8,
    },
    ...overrides,
  };
}

export function makeSuiteDefinition(overrides: Partial<SuiteDefinition> = {}): SuiteDefinition {
  return {
    name: 'Test Suite',
    journeys: [{ path: 'journeys/test.yaml' }],
    ...overrides,
  };
}

export function makeSuiteResult(overrides: Partial<SuiteResult> = {}): SuiteResult {
  return {
    suite: makeSuiteDefinition(),
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:02:00.000Z',
    totalDurationMs: 120000,
    status: 'passed',
    journeyResults: [makeJourneyResult()],
    summary: {
      totalJourneys: 1,
      passed: 1,
      failed: 0,
      warnings: 0,
      totalSteps: 1,
      overallUXScore: 8,
    },
    ...overrides,
  };
}
