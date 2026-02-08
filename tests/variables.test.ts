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
