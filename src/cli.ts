#!/usr/bin/env npx tsx

import { Command } from 'commander';
import { loadJourney } from './journey-loader.js';
import { executeJourney } from './executor.js';
import { generateReport } from './reporter.js';
import { setVerbose } from './utils.js';
import type { CLIOptions } from './types.js';

const program = new Command();

program
  .name('ai-journey')
  .description('Natural language browser journey testing powered by Claude AI')
  .version('1.0.0');

program
  .command('run')
  .description('Execute a journey test')
  .argument('<journey>', 'Path to YAML journey file')
  .option('--headed', 'Run in headed mode (show browser)', false)
  .option('--model <model>', 'Claude model to use', 'claude-haiku-4-5-20251001')
  .option('--delay <seconds>', 'Delay between steps in seconds (rate limit friendly)', '10')
  .option('--output <dir>', 'Report output directory', './reports')
  .option('--timeout <ms>', 'Default timeout per step in ms', '30000')
  .option('--verbose', 'Verbose logging', false)
  .option('--base-url <url>', 'Override the journey start URL')
  .option('--retries <count>', 'Retry count per step on failure', '1')
  .action(async (journeyPath: string, opts) => {
    if (opts.verbose) {
      setVerbose(true);
    }

    const options: CLIOptions = {
      journey: journeyPath,
      headed: opts.headed,
      model: opts.model,
      output: opts.output,
      timeout: parseInt(opts.timeout),
      verbose: opts.verbose,
      baseUrl: opts.baseUrl,
      retries: parseInt(opts.retries),
      delay: parseInt(opts.delay),
    };

    try {
      console.log(`\nLoading journey: ${journeyPath}`);
      const journey = loadJourney(journeyPath, options.baseUrl);
      console.log(`Journey: ${journey.name} (${journey.steps.length} steps)`);
      console.log(`Target: ${journey.url}\n`);

      const result = await executeJourney(journey, options);

      console.log('\n--- Summary ---');
      console.log(`Status: ${result.status.toUpperCase()}`);
      console.log(`Steps: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.warnings} warnings`);
      console.log(`UX Score: ${result.summary.overallUXScore}/10 (${result.summary.uxIssuesFound} issues found)`);
      console.log(`Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);

      const reportPath = generateReport(result, options.output!);
      console.log(`\nReport: ${reportPath}`);

      process.exit(result.status === 'failed' ? 1 : 0);
    } catch (e) {
      console.error(`\nError: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate a journey YAML file without executing')
  .argument('<journey>', 'Path to YAML journey file')
  .action((journeyPath: string) => {
    try {
      const journey = loadJourney(journeyPath);
      console.log(`Valid journey: "${journey.name}"`);
      console.log(`  URL: ${journey.url}`);
      console.log(`  Steps: ${journey.steps.length}`);
      journey.steps.forEach((step, i) => {
        console.log(`    ${i + 1}. ${step.action}`);
      });
    } catch (e) {
      console.error(`Invalid journey: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program.parse();
