import { resolve, join } from 'path';
import { loadJourney } from './journey-loader.js';
import { executeJourney } from './executor.js';
import { generateReport } from './reporter.js';
import { getConfig } from './config.js';
import type { CLIOptions } from './types.js';

const JOURNEYS_DIR = resolve('journeys');
const MAX_JOBS = 50;

export interface RunJob {
  id: string;
  type: 'journey';
  filename: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  reportUrl?: string;
  summary?: { status: string; totalSteps: number; passed: number; failed: number };
}

const jobs = new Map<string, RunJob>();

function pruneJobs(): void {
  if (jobs.size <= MAX_JOBS) return;
  // Remove oldest completed/failed jobs first
  const entries = [...jobs.entries()]
    .filter(([, j]) => j.status !== 'running')
    .sort((a, b) => (a[1].startedAt < b[1].startedAt ? -1 : 1));
  while (jobs.size > MAX_JOBS && entries.length > 0) {
    jobs.delete(entries.shift()![0]);
  }
}

export function getJob(id: string): RunJob | undefined {
  return jobs.get(id);
}

export function getActiveRun(): RunJob | undefined {
  for (const job of jobs.values()) {
    if (job.status === 'running') return job;
  }
  return undefined;
}

export function startJourneyRun(filename: string): string {
  const id = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: RunJob = {
    id,
    type: 'journey',
    filename,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  pruneJobs();
  jobs.set(id, job);

  // Fire and forget
  (async () => {
    try {
      const filePath = join(JOURNEYS_DIR, filename);
      const journey = loadJourney(filePath);

      const cfg = getConfig();
      const reportsDir = resolve(cfg.outputDir);
      const options: CLIOptions = {
        journey: filePath,
        headed: cfg.headed,
        model: cfg.model,
        output: reportsDir,
        timeout: cfg.timeout,
        retries: cfg.retries,
        delay: cfg.delay,
      };

      const result = await executeJourney(journey, options);
      const reportPath = generateReport(result, reportsDir);
      const reportFilename = reportPath.split('/').pop()!;

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.reportUrl = `/reports/${reportFilename}`;
      job.summary = {
        status: result.status,
        totalSteps: result.summary.totalSteps,
        passed: result.summary.passed,
        failed: result.summary.failed,
      };
    } catch (e) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = e instanceof Error ? e.message : String(e);
    }
  })();

  return id;
}
