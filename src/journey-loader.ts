import { readFileSync } from 'fs';
import { parse } from 'yaml';
import type { JourneyDefinition, JourneyStep } from './types.js';

export function loadJourney(filePath: string, baseUrlOverride?: string): JourneyDefinition {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parse(raw);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid journey file: ${filePath} - must be a YAML object`);
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('Journey must have a "name" field (string)');
  }

  if (!parsed.url || typeof parsed.url !== 'string') {
    throw new Error('Journey must have a "url" field (string)');
  }

  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error('Journey must have a non-empty "steps" array');
  }

  const steps: JourneyStep[] = parsed.steps.map((step: unknown, i: number) => {
    if (typeof step === 'string') {
      return { action: step };
    }
    if (step && typeof step === 'object' && 'action' in step) {
      const s = step as Record<string, unknown>;
      if (typeof s.action !== 'string') {
        throw new Error(`Step ${i + 1}: "action" must be a string`);
      }
      return {
        action: s.action,
        description: typeof s.description === 'string' ? s.description : undefined,
        timeout: typeof s.timeout === 'number' ? s.timeout : undefined,
        waitAfter: typeof s.waitAfter === 'number' ? s.waitAfter : undefined,
      };
    }
    throw new Error(`Step ${i + 1}: must be a string or object with "action" field`);
  });

  const journey: JourneyDefinition = {
    name: parsed.name,
    description: typeof parsed.description === 'string' ? parsed.description : undefined,
    url: baseUrlOverride || parsed.url,
    steps,
  };

  if (parsed.viewport && typeof parsed.viewport === 'object') {
    const vp = parsed.viewport as Record<string, unknown>;
    if (typeof vp.width === 'number' && typeof vp.height === 'number') {
      journey.viewport = { width: vp.width, height: vp.height };
    }
  }

  return journey;
}
