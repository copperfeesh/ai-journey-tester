import { describe, it, expect } from 'vitest';
import { resolveVariables, substituteVariables } from '../src/variables.js';

describe('resolveVariables', () => {
  it('returns empty object when both inputs are undefined', () => {
    expect(resolveVariables()).toEqual({});
  });

  it('returns empty object when both inputs are empty', () => {
    expect(resolveVariables({}, {})).toEqual({});
  });

  it('merges YAML and CLI variables', () => {
    const result = resolveVariables({ a: '1' }, { b: '2' });
    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('CLI overrides YAML', () => {
    const result = resolveVariables({ key: 'yaml' }, { key: 'cli' });
    expect(result).toEqual({ key: 'cli' });
  });

  it('expands {{env:VAR}} from process.env', () => {
    const envKey = 'AJT_TEST_VAR_' + Date.now();
    process.env[envKey] = 'from-env';
    try {
      const result = resolveVariables({ x: `{{env:${envKey}}}` });
      expect(result).toEqual({ x: 'from-env' });
    } finally {
      delete process.env[envKey];
    }
  });

  it('throws on missing env var', () => {
    expect(() =>
      resolveVariables({ x: '{{env:DEFINITELY_MISSING_VAR_XYZ}}' })
    ).toThrow('Environment variable "DEFINITELY_MISSING_VAR_XYZ" is not set');
  });

  it('rejects sensitive env var ANTHROPIC_API_KEY', () => {
    expect(() =>
      resolveVariables({ x: '{{env:ANTHROPIC_API_KEY}}' })
    ).toThrow('sensitive environment variable');
  });

  it('rejects sensitive env var DB_PASSWORD', () => {
    expect(() =>
      resolveVariables({ x: '{{env:DB_PASSWORD}}' })
    ).toThrow('sensitive environment variable');
  });

  it('rejects sensitive env var MY_SECRET', () => {
    expect(() =>
      resolveVariables({ x: '{{env:MY_SECRET}}' })
    ).toThrow('sensitive environment variable');
  });

  it('rejects sensitive env var AUTH_TOKEN', () => {
    expect(() =>
      resolveVariables({ x: '{{env:AUTH_TOKEN}}' })
    ).toThrow('sensitive environment variable');
  });

  it('allows safe env vars like HOME', () => {
    const envKey = 'AJT_TEST_SAFE_' + Date.now();
    process.env[envKey] = 'safe-value';
    try {
      const result = resolveVariables({ x: `{{env:${envKey}}}` });
      expect(result).toEqual({ x: 'safe-value' });
    } finally {
      delete process.env[envKey];
    }
  });

  it('allows NODE_ENV', () => {
    const origVal = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const result = resolveVariables({ x: '{{env:NODE_ENV}}' });
      expect(result).toEqual({ x: 'test' });
    } finally {
      if (origVal === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = origVal;
    }
  });
});

describe('substituteVariables', () => {
  it('replaces a single placeholder', () => {
    expect(substituteVariables('Hello {{name}}', { name: 'World' })).toBe('Hello World');
  });

  it('replaces multiple placeholders', () => {
    const result = substituteVariables('{{a}} and {{b}}', { a: 'X', b: 'Y' });
    expect(result).toBe('X and Y');
  });

  it('returns text unchanged when no placeholders exist', () => {
    expect(substituteVariables('no vars here', { x: '1' })).toBe('no vars here');
  });

  it('throws on undefined variable', () => {
    expect(() =>
      substituteVariables('Hello {{missing}}', {})
    ).toThrow('Undefined variable "{{missing}}"');
  });
});
