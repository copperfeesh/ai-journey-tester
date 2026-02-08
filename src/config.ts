import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'yaml';

export interface Config {
  model: string;
  delay: number;
  timeout: number;
  retries: number;
  outputDir: string;
  headed: boolean;
}

const DEFAULTS: Config = {
  model: 'claude-haiku-4-5-20251001',
  delay: 10,
  timeout: 30000,
  retries: 1,
  outputDir: './reports',
  headed: false,
};

const CONFIG_FILENAME = '.journeytester.yaml';

let cached: Config | null = null;

export function loadConfig(): Config {
  const config = { ...DEFAULTS };

  const configPath = resolve(CONFIG_FILENAME);
  if (existsSync(configPath)) {
    try {
      const raw = yaml.parse(readFileSync(configPath, 'utf-8'));
      if (raw && typeof raw === 'object') {
        if (typeof raw.model === 'string') config.model = raw.model;
        if (typeof raw.delay === 'number') config.delay = raw.delay;
        if (typeof raw.timeout === 'number') config.timeout = raw.timeout;
        if (typeof raw.retries === 'number') config.retries = raw.retries;
        if (typeof raw.outputDir === 'string') config.outputDir = raw.outputDir;
        if (typeof raw.headed === 'boolean') config.headed = raw.headed;
      }
    } catch {
      // Ignore malformed config — fall back to defaults
    }
  }

  cached = config;
  return config;
}

export function getConfig(): Config {
  if (!cached) return loadConfig();
  return cached;
}
