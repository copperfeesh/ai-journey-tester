#!/usr/bin/env npx tsx

import 'dotenv/config';
import { createInterface } from 'readline';
import { Command } from 'commander';
import { loadJourney } from './journey-loader.js';
import { executeJourney } from './executor.js';
import { generateReport } from './reporter.js';
import { setVerbose } from './utils.js';
import type { CLIOptions, JourneyDefinition } from './types.js';

let _lines: AsyncIterableIterator<string> | null = null;

function promptUser(question: string): Promise<string> {
  if (!_lines) {
    const rl = createInterface({ input: process.stdin });
    _lines = rl[Symbol.asyncIterator]();
  }
  process.stdout.write(question);
  return _lines.next().then((result) => {
    if (result.done) return '';
    return result.value.trim();
  });
}

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

program
  .command('interactive')
  .description('Interactively build and run a journey test')
  .option('--headed', 'Run in headed mode (show browser)', false)
  .option('--model <model>', 'Claude model to use', 'claude-haiku-4-5-20251001')
  .option('--delay <seconds>', 'Delay between steps in seconds (rate limit friendly)', '10')
  .option('--output <dir>', 'Report output directory', './reports')
  .option('--timeout <ms>', 'Default timeout per step in ms', '30000')
  .option('--verbose', 'Verbose logging', false)
  .option('--retries <count>', 'Retry count per step on failure', '1')
  .action(async (opts) => {
    if (opts.verbose) {
      setVerbose(true);
    }

    console.log('\n--- Interactive Journey Builder ---\n');

    const url = await promptUser('Enter URL to test: ');
    if (!url) {
      console.error('URL is required.');
      process.exit(1);
    }

    const nameInput = await promptUser('Journey name (default: "Interactive Journey"): ');
    const name = nameInput || 'Interactive Journey';

    const steps: string[] = [];
    console.log('\nEnter journey steps one at a time. Type "done" or press Enter on an empty line to finish.\n');

    while (true) {
      const step = await promptUser(`  Step ${steps.length + 1}: `);
      if (!step || step.toLowerCase() === 'done') break;
      steps.push(step);
    }

    if (steps.length === 0) {
      console.error('\nAt least one step is required.');
      process.exit(1);
    }

    console.log(`\n--- Journey Summary ---`);
    console.log(`Name: ${name}`);
    console.log(`URL:  ${url}`);
    console.log(`Steps (${steps.length}):`);
    steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

    const confirm = await promptUser('\nProceed? (Y/n): ');
    if (confirm.toLowerCase() === 'n') {
      console.log('Cancelled.');
      process.exit(0);
    }

    const journey: JourneyDefinition = {
      name,
      url,
      steps: steps.map((action) => ({ action })),
    };

    const options: CLIOptions = {
      journey: '(interactive)',
      headed: opts.headed,
      model: opts.model,
      output: opts.output,
      timeout: parseInt(opts.timeout),
      verbose: opts.verbose,
      retries: parseInt(opts.retries),
      delay: parseInt(opts.delay),
    };

    try {
      console.log(`\nExecuting journey: ${name} (${steps.length} steps)`);
      console.log(`Target: ${url}\n`);

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

program.parse();
