import { createInterface } from 'readline';
import type { JourneyDefinition, CLIOptions, JourneyResult, StepResult } from './types.js';
import { launchBrowser, capturePageState, executeBrowserAction, type BrowserSession } from './browser.js';
import { interpretStep } from './ai.js';
import { log, logStep, logStatus, parsePauseStep, validateNavigationUrl } from './utils.js';

function waitForEnter(message: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`\n  PAUSE: ${message}\n  Press Enter to continue...`, () => {
      rl.close();
      resolve();
    });
  });
}

export async function executeJourney(
  journey: JourneyDefinition,
  options: CLIOptions,
  externalSession?: BrowserSession,
): Promise<JourneyResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const viewport = journey.viewport ?? { width: 1280, height: 720 };
  const session = externalSession ?? await launchBrowser(options.headed ?? false, viewport);
  if (externalSession) {
    await externalSession.page.setViewportSize(viewport);
    externalSession.consoleMessages.length = 0;
    externalSession.networkErrors.length = 0;
  }

  validateNavigationUrl(journey.url);
  console.log(`  Navigating to ${journey.url}`);
  await session.page.goto(journey.url, {
    waitUntil: 'networkidle',
    timeout: options.timeout ?? 30000,
  });

  const results: StepResult[] = [];

  for (let i = 0; i < journey.steps.length; i++) {
    const step = journey.steps[i];
    const maxRetries = options.retries ?? 1;

    logStep(i, journey.steps.length, step.action);

    // Check for pause step before doing anything else
    const pauseMessage = parsePauseStep(step.action);
    if (pauseMessage !== null) {
      const pageStateBefore = await capturePageState(session);
      if (process.stdin.isTTY) {
        await waitForEnter(pauseMessage);
      } else {
        console.log(`  PAUSE (auto-skipped, no TTY): ${pauseMessage}`);
      }
      const pageStateAfter = await capturePageState(session);

      results.push({
        stepIndex: i,
        action: step.action,
        status: 'passed',
        interpretation: {
          thinking: 'Manual pause step',
          actions: [],
          uxAnalysis: { score: 0, issues: [], positives: [] },
        },
        pageStateBefore,
        pageStateAfter,
        durationMs: 0,
      });

      logStatus('passed', 'Manual step completed');
      continue;
    }

    let result: StepResult | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`  Retry ${attempt}/${maxRetries - 1}...`);
      }

      const stepStart = Date.now();

      try {
        // Capture page state before action
        const pageStateBefore = await capturePageState(session);
        log(`Captured page state: ${pageStateBefore.url}`);

        // Ask Claude to interpret the step
        console.log('  Analyzing page and interpreting step...');
        const interpretation = await interpretStep(step, pageStateBefore, options.model, options.fallbackModel);
        log(`Claude returned ${interpretation.actions.length} action(s)`);

        // Execute each action
        let error: string | undefined;
        try {
          for (const action of interpretation.actions) {
            console.log(`  -> ${action.type}: ${action.description}`);
            await executeBrowserAction(
              session.page,
              action,
              step.timeout ?? options.timeout ?? 30000
            );
          }

          // Wait for page to settle
          await session.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          if (step.waitAfter) {
            await session.page.waitForTimeout(step.waitAfter);
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }

        // Capture page state after action
        const pageStateAfter = await capturePageState(session);

        const hasCriticalUX = interpretation.uxAnalysis.issues.some(i => i.severity === 'critical');

        result = {
          stepIndex: i,
          action: step.action,
          status: error ? 'failed' : hasCriticalUX ? 'warning' : 'passed',
          interpretation,
          pageStateBefore,
          pageStateAfter,
          error,
          durationMs: Date.now() - stepStart,
        };

        if (!error) {
          logStatus('passed', `${result.durationMs}ms`);
          if (interpretation.uxAnalysis.issues.length > 0) {
            console.log(`  UX issues: ${interpretation.uxAnalysis.issues.length} (score: ${interpretation.uxAnalysis.score}/10)`);
          }
          break;
        } else {
          logStatus('failed', error);
        }
      } catch (e) {
        // AI or capture-level error
        const errorMsg = e instanceof Error ? e.message : String(e);
        logStatus('failed', errorMsg);

        // Create a minimal failed result
        const emptyState = {
          url: session.page.url(),
          title: '',
          ariaSnapshot: '',
          screenshotBase64: '',
          consoleMessages: [],
          networkErrors: [],
          timestamp: Date.now(),
        };

        result = {
          stepIndex: i,
          action: step.action,
          status: 'failed',
          interpretation: {
            thinking: `Error during step execution: ${errorMsg}`,
            actions: [],
            uxAnalysis: { score: 0, issues: [], positives: [] },
          },
          pageStateBefore: emptyState,
          pageStateAfter: emptyState,
          error: errorMsg,
          durationMs: Date.now() - stepStart,
        };
      }
    }

    results.push(result!);

    // Stop journey if step failed (subsequent steps likely depend on prior ones)
    if (result!.status === 'failed') {
      console.log('\n  Journey stopped due to step failure.');
      break;
    }

    // Delay between steps to avoid rate limits
    const delaySec = options.delay ?? 10;
    if (delaySec > 0 && i < journey.steps.length - 1) {
      console.log(`  Waiting ${delaySec}s before next step...`);
      await new Promise(r => setTimeout(r, delaySec * 1000));
    }
  }

  if (!externalSession) {
    await session.browser.close();
  }

  return buildJourneyResult(journey, results, startedAt, startTime);
}

export function buildJourneyResult(
  journey: JourneyDefinition,
  steps: StepResult[],
  startedAt: string,
  startTime: number
): JourneyResult {
  const passed = steps.filter(s => s.status === 'passed').length;
  const failed = steps.filter(s => s.status === 'failed').length;
  const warnings = steps.filter(s => s.status === 'warning').length;

  const allIssues = steps.flatMap(s => s.interpretation.uxAnalysis.issues);
  const allScores = steps
    .map(s => s.interpretation.uxAnalysis.score)
    .filter(s => s > 0);
  const avgScore = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  const status = failed > 0 ? 'failed' : warnings > 0 ? 'warning' : 'passed';

  return {
    journey,
    startedAt,
    completedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    status,
    steps,
    summary: {
      totalSteps: journey.steps.length,
      passed,
      failed,
      warnings,
      uxIssuesFound: allIssues.length,
      overallUXScore: Math.round(avgScore * 10) / 10,
    },
  };
}
