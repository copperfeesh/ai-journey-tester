#!/usr/bin/env npx tsx

import 'dotenv/config';
import { createInterface } from 'readline';
import { Command } from 'commander';
import { loadJourney } from './journey-loader.js';
import { executeJourney } from './executor.js';
import { generateReport, generateSuiteReport } from './reporter.js';
import { loadSuite } from './suite-loader.js';
import { executeSuite } from './suite-runner.js';
import { setVerbose } from './utils.js';
import { loadConfig, getConfig } from './config.js';
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

function collectVar(value: string, prev: Record<string, string>): Record<string, string> {
  const eqIndex = value.indexOf('=');
  if (eqIndex === -1) {
    throw new Error(`Invalid --var format: "${value}". Expected key=value`);
  }
  prev[value.slice(0, eqIndex)] = value.slice(eqIndex + 1);
  return prev;
}

loadConfig();

const program = new Command();

program
  .name('ai-journey')
  .description('Natural language browser journey testing powered by Claude AI')
  .version('1.0.0');

program
  .command('run')
  .description('Execute a journey test')
  .argument('<journey>', 'Path to YAML journey file')
  .option('--headed', 'Run in headed mode (show browser)', getConfig().headed)
  .option('--model <model>', 'Claude model to use', getConfig().model)
  .option('--fallback-model <model>', 'Fallback model if primary fails', getConfig().fallbackModel)
  .option('--delay <seconds>', 'Delay between steps in seconds (rate limit friendly)', String(getConfig().delay))
  .option('--output <dir>', 'Report output directory', getConfig().outputDir)
  .option('--timeout <ms>', 'Default timeout per step in ms', String(getConfig().timeout))
  .option('--verbose', 'Verbose logging', false)
  .option('--base-url <url>', 'Override the journey start URL')
  .option('--retries <count>', 'Retry count per step on failure', String(getConfig().retries))
  .option('--var <key=value>', 'Set a variable (repeatable)', collectVar, {})
  .action(async (journeyPath: string, opts) => {
    if (opts.verbose) {
      setVerbose(true);
    }

    const options: CLIOptions = {
      journey: journeyPath,
      headed: opts.headed,
      model: opts.model,
      fallbackModel: opts.fallbackModel,
      output: opts.output,
      timeout: parseInt(opts.timeout),
      verbose: opts.verbose,
      baseUrl: opts.baseUrl,
      retries: parseInt(opts.retries),
      delay: parseInt(opts.delay),
      vars: Object.keys(opts.var).length > 0 ? opts.var : undefined,
    };

    try {
      console.log(`\nLoading journey: ${journeyPath}`);
      const journey = loadJourney(journeyPath, options.baseUrl, options.vars);
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
  .option('--var <key=value>', 'Set a variable (repeatable)', collectVar, {})
  .action((journeyPath: string, opts) => {
    try {
      const vars = Object.keys(opts.var).length > 0 ? opts.var : undefined;
      const journey = loadJourney(journeyPath, undefined, vars);
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
  .option('--headed', 'Run in headed mode (show browser)', getConfig().headed)
  .option('--model <model>', 'Claude model to use', getConfig().model)
  .option('--fallback-model <model>', 'Fallback model if primary fails', getConfig().fallbackModel)
  .option('--delay <seconds>', 'Delay between steps in seconds (rate limit friendly)', String(getConfig().delay))
  .option('--output <dir>', 'Report output directory', getConfig().outputDir)
  .option('--timeout <ms>', 'Default timeout per step in ms', String(getConfig().timeout))
  .option('--verbose', 'Verbose logging', false)
  .option('--retries <count>', 'Retry count per step on failure', String(getConfig().retries))
  .option('--var <key=value>', 'Set a variable (repeatable)', collectVar, {})
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
      fallbackModel: opts.fallbackModel,
      output: opts.output,
      timeout: parseInt(opts.timeout),
      verbose: opts.verbose,
      retries: parseInt(opts.retries),
      delay: parseInt(opts.delay),
      vars: Object.keys(opts.var).length > 0 ? opts.var : undefined,
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

program
  .command('suite')
  .description('Execute a test suite (multiple journeys)')
  .argument('<path>', 'Path to YAML suite file')
  .option('--headed', 'Run in headed mode (show browser)', getConfig().headed)
  .option('--model <model>', 'Claude model to use', getConfig().model)
  .option('--fallback-model <model>', 'Fallback model if primary fails', getConfig().fallbackModel)
  .option('--delay <seconds>', 'Delay between steps in seconds (rate limit friendly)', String(getConfig().delay))
  .option('--output <dir>', 'Report output directory', getConfig().outputDir)
  .option('--timeout <ms>', 'Default timeout per step in ms', String(getConfig().timeout))
  .option('--verbose', 'Verbose logging', false)
  .option('--base-url <url>', 'Override the journey start URL')
  .option('--retries <count>', 'Retry count per step on failure', String(getConfig().retries))
  .option('--var <key=value>', 'Set a variable (repeatable)', collectVar, {})
  .action(async (suitePath: string, opts) => {
    if (opts.verbose) {
      setVerbose(true);
    }

    const options: CLIOptions = {
      journey: suitePath,
      headed: opts.headed,
      model: opts.model,
      fallbackModel: opts.fallbackModel,
      output: opts.output,
      timeout: parseInt(opts.timeout),
      verbose: opts.verbose,
      baseUrl: opts.baseUrl,
      retries: parseInt(opts.retries),
      delay: parseInt(opts.delay),
      vars: Object.keys(opts.var).length > 0 ? opts.var : undefined,
    };

    try {
      console.log(`\nLoading suite: ${suitePath}`);
      const suite = loadSuite(suitePath);
      console.log(`Suite: ${suite.name} (${suite.journeys.length} journeys)`);

      const result = await executeSuite(suite, options);

      console.log('\n\n=== Suite Summary ===');
      console.log(`Status: ${result.status.toUpperCase()}`);
      console.log(`Journeys: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.warnings} warnings`);
      console.log(`Total Steps: ${result.summary.totalSteps}`);
      console.log(`UX Score: ${result.summary.overallUXScore}/10`);
      console.log(`Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);

      const reportPath = generateSuiteReport(result, options.output!);
      console.log(`\nSuite Report: ${reportPath}`);

      process.exit(result.status === 'failed' ? 1 : 0);
    } catch (e) {
      console.error(`\nError: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

program
  .command('record')
  .description('Record browser interactions into a journey YAML file')
  .argument('<url>', 'URL to start recording from')
  .option('--name <name>', 'Journey name', 'Recorded Journey')
  .option('--output <file>', 'Output YAML path')
  .action(async (url: string, opts) => {
    const slugName = opts.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const output = opts.output || `journeys/${slugName}.yaml`;

    const { recordJourney } = await import('./recorder.js');
    await recordJourney({ url, name: opts.name, output });
  });

program
  .command('ui')
  .description('Start the web UI for managing journeys and suites')
  .option('--port <port>', 'Port to serve on', '3000')
  .action(async (opts) => {
    const { startUIServer } = await import('./ui-server.js');
    startUIServer(parseInt(opts.port));
  });

program.parse();
