import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { parse } from 'yaml';
import type { SuiteDefinition, SuiteJourneyRef } from './types.js';

export function loadSuite(filePath: string): SuiteDefinition {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parse(raw, { maxAliasCount: 100 });

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid suite file: ${filePath} - must be a YAML object`);
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('Suite must have a "name" field (string)');
  }

  if (!Array.isArray(parsed.journeys) || parsed.journeys.length === 0) {
    throw new Error('Suite must have a non-empty "journeys" array');
  }

  const suiteDir = dirname(resolve(filePath));

  const journeys: SuiteJourneyRef[] = parsed.journeys.map((entry: unknown, i: number) => {
    if (typeof entry === 'string') {
      const resolved = resolve(suiteDir, entry);
      if (!resolved.endsWith('.yaml')) {
        throw new Error(`Journey ${i + 1}: path must end with .yaml`);
      }
      return { path: resolved };
    }
    if (entry && typeof entry === 'object' && 'path' in entry) {
      const e = entry as Record<string, unknown>;
      if (typeof e.path !== 'string') {
        throw new Error(`Journey ${i + 1}: "path" must be a string`);
      }
      const resolvedPath = resolve(suiteDir, e.path);
      if (!resolvedPath.endsWith('.yaml')) {
        throw new Error(`Journey ${i + 1}: path must end with .yaml`);
      }
      const ref: SuiteJourneyRef = {
        path: resolvedPath,
      };
      if (e.variables && typeof e.variables === 'object') {
        ref.variables = e.variables as Record<string, string>;
      }
      return ref;
    }
    throw new Error(`Journey ${i + 1}: must be a string path or object with "path" field`);
  });

  const variables = parsed.variables && typeof parsed.variables === 'object'
    ? parsed.variables as Record<string, string>
    : undefined;

  const sharedSession = parsed.sharedSession === true;

  return {
    name: parsed.name,
    description: typeof parsed.description === 'string' ? parsed.description : undefined,
    variables,
    journeys,
    sharedSession: sharedSession || undefined,
  };
}
