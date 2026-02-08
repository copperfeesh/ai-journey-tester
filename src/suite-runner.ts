import type { SuiteDefinition, SuiteResult, JourneyResult, CLIOptions } from './types.js';
import { resolveVariables } from './variables.js';
import { loadJourney } from './journey-loader.js';
import { executeJourney } from './executor.js';
import { launchBrowser, type BrowserSession } from './browser.js';

export async function executeSuite(
  suite: SuiteDefinition,
  options: CLIOptions
): Promise<SuiteResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // Resolve suite-level variables (YAML + CLI overrides + env expansion)
  const suiteVars = resolveVariables(suite.variables, options.vars);

  // Create shared browser session if configured
  let sharedSession: BrowserSession | undefined;
  if (suite.sharedSession) {
    sharedSession = await launchBrowser(options.headed ?? false, { width: 1280, height: 720 });
  }

  const journeyResults: JourneyResult[] = [];

  for (let i = 0; i < suite.journeys.length; i++) {
    const ref = suite.journeys[i];
    console.log(`\n=== Journey ${i + 1}/${suite.journeys.length}: ${ref.path} ===`);

    // Merge: suite vars < journey-specific vars (journey overrides suite)
    const mergedVars = { ...suiteVars, ...ref.variables };

    try {
      const journey = loadJourney(ref.path, options.baseUrl, mergedVars);
      console.log(`  Name: ${journey.name} (${journey.steps.length} steps)`);
      console.log(`  URL: ${journey.url}`);

      const result = await executeJourney(journey, options, sharedSession);
      journeyResults.push(result);

      console.log(`  Result: ${result.status.toUpperCase()} (${result.summary.passed}/${result.summary.totalSteps} passed)`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`  Failed to load/run journey: ${errorMsg}`);

      // Create a stub failed result so suite continues
      journeyResults.push({
        journey: {
          name: ref.path,
          url: '',
          steps: [],
        },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 0,
        status: 'failed',
        steps: [],
        summary: {
          totalSteps: 0,
          passed: 0,
          failed: 1,
          warnings: 0,
          uxIssuesFound: 0,
          overallUXScore: 0,
        },
      });
    }
  }

  if (sharedSession) {
    await sharedSession.browser.close();
  }

  return buildSuiteResult(suite, journeyResults, startedAt, startTime);
}

function buildSuiteResult(
  suite: SuiteDefinition,
  journeyResults: JourneyResult[],
  startedAt: string,
  startTime: number
): SuiteResult {
  const passed = journeyResults.filter(r => r.status === 'passed').length;
  const failed = journeyResults.filter(r => r.status === 'failed').length;
  const warnings = journeyResults.filter(r => r.status === 'warning').length;

  const totalSteps = journeyResults.reduce((sum, r) => sum + r.summary.totalSteps, 0);

  const allScores = journeyResults
    .map(r => r.summary.overallUXScore)
    .filter(s => s > 0);
  const avgScore = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  const status = failed > 0 ? 'failed' : warnings > 0 ? 'warning' : 'passed';

  return {
    suite,
    startedAt,
    completedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    status,
    journeyResults,
    summary: {
      totalJourneys: suite.journeys.length,
      passed,
      failed,
      warnings,
      totalSteps,
      overallUXScore: Math.round(avgScore * 10) / 10,
    },
  };
}
