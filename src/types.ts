// ============================================================
// Journey Definition (parsed from YAML)
// ============================================================

export interface JourneyDefinition {
  name: string;
  description?: string;
  url: string;
  viewport?: { width: number; height: number };
  variables?: Record<string, string>;
  steps: JourneyStep[];
}

export interface JourneyStep {
  action: string;
  description?: string;
  timeout?: number;
  waitAfter?: number;
}

// ============================================================
// Page State (captured before each AI call)
// ============================================================

export interface PageState {
  url: string;
  title: string;
  ariaSnapshot: string;
  screenshotBase64: string;
  consoleMessages: ConsoleMessage[];
  networkErrors: NetworkError[];
  timestamp: number;
}

export interface ConsoleMessage {
  type: 'log' | 'warning' | 'error' | 'info';
  text: string;
}

export interface NetworkError {
  url: string;
  status: number;
  statusText: string;
  method: string;
}

// ============================================================
// AI Response: Structured action from Claude
// ============================================================

export type BrowserAction =
  | { type: 'click'; selector: string; description: string }
  | { type: 'fill'; selector: string; value: string; description: string }
  | { type: 'select'; selector: string; value: string; description: string }
  | { type: 'press_key'; key: string; description: string }
  | { type: 'navigate'; url: string; description: string }
  | { type: 'wait'; milliseconds: number; description: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number; description: string }
  | { type: 'hover'; selector: string; description: string }
  | { type: 'assert_visible'; text: string; description: string }
  | { type: 'assert_text'; text: string; description: string };

export interface AIStepInterpretation {
  thinking: string;
  actions: BrowserAction[];
  uxAnalysis: UXAnalysis;
}

export interface UXAnalysis {
  score: number;
  issues: UXIssue[];
  positives: string[];
}

export interface UXIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'accessibility' | 'usability' | 'error' | 'performance' | 'visual';
  description: string;
  element?: string;
  recommendation?: string;
}

// ============================================================
// Step Execution Result
// ============================================================

export interface StepResult {
  stepIndex: number;
  action: string;
  status: 'passed' | 'failed' | 'warning';
  interpretation: AIStepInterpretation;
  pageStateBefore: PageState;
  pageStateAfter: PageState;
  error?: string;
  durationMs: number;
}

// ============================================================
// Journey Result (full run)
// ============================================================

export interface JourneyResult {
  journey: JourneyDefinition;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  status: 'passed' | 'failed' | 'warning';
  steps: StepResult[];
  summary: {
    totalSteps: number;
    passed: number;
    failed: number;
    warnings: number;
    uxIssuesFound: number;
    overallUXScore: number;
  };
}

// ============================================================
// CLI Options
// ============================================================

export interface CLIOptions {
  journey: string;
  headed?: boolean;
  model?: string;
  output?: string;
  timeout?: number;
  verbose?: boolean;
  baseUrl?: string;
  retries?: number;
  delay?: number;
  vars?: Record<string, string>;
}

// ============================================================
// Suite Definition (parsed from YAML)
// ============================================================

export interface SuiteDefinition {
  name: string;
  description?: string;
  variables?: Record<string, string>;
  journeys: SuiteJourneyRef[];
}

export interface SuiteJourneyRef {
  path: string;
  variables?: Record<string, string>;
}

export interface SuiteResult {
  suite: SuiteDefinition;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  status: 'passed' | 'failed' | 'warning';
  journeyResults: JourneyResult[];
  summary: {
    totalJourneys: number;
    passed: number;
    failed: number;
    warnings: number;
    totalSteps: number;
    overallUXScore: number;
  };
}
