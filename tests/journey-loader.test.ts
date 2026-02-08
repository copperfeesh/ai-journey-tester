import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { loadJourney } from '../src/journey-loader.js';

const tmpDir = join('/tmp', 'ajt-journey-tests-' + Date.now());

function writeTmpYaml(name: string, content: string): string {
  const p = join(tmpDir, name);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('loadJourney', () => {
  beforeAll(() => mkdirSync(tmpDir, { recursive: true }));
  afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('loads a basic journey without variables', () => {
    const p = writeTmpYaml('basic.yaml', `
name: Basic
url: https://example.com
steps:
  - Click the button
`);
    const j = loadJourney(p);
    expect(j.name).toBe('Basic');
    expect(j.url).toBe('https://example.com');
    expect(j.steps).toEqual([{ action: 'Click the button' }]);
    expect(j.variables).toBeUndefined();
  });

  it('substitutes YAML variables in URL and step actions', () => {
    const p = writeTmpYaml('vars.yaml', `
name: WithVars
url: https://{{host}}/path
variables:
  host: example.com
  item: Widget
steps:
  - Click on {{item}}
`);
    const j = loadJourney(p);
    expect(j.url).toBe('https://example.com/path');
    expect(j.steps[0].action).toBe('Click on Widget');
  });

  it('CLI vars override YAML vars', () => {
    const p = writeTmpYaml('override.yaml', `
name: Override
url: https://{{host}}
variables:
  host: yaml-host
steps:
  - Visit {{host}}
`);
    const j = loadJourney(p, undefined, { host: 'cli-host' });
    expect(j.url).toBe('https://cli-host');
    expect(j.steps[0].action).toBe('Visit cli-host');
  });

  it('baseUrlOverride takes precedence over resolved URL', () => {
    const p = writeTmpYaml('baseurl.yaml', `
name: BaseUrl
url: https://original.com
steps:
  - Do something
`);
    const j = loadJourney(p, 'https://override.com');
    expect(j.url).toBe('https://override.com');
  });

  it('expands env vars in variable values', () => {
    const envKey = 'AJT_TEST_HOST_' + Date.now();
    process.env[envKey] = 'env-host';
    try {
      const p = writeTmpYaml('envvar.yaml', `
name: EnvVar
url: https://{{host}}
variables:
  host: "{{env:${envKey}}}"
steps:
  - Visit {{host}}
`);
      const j = loadJourney(p);
      expect(j.url).toBe('https://env-host');
    } finally {
      delete process.env[envKey];
    }
  });

  it('throws on missing env var', () => {
    const p = writeTmpYaml('badenv.yaml', `
name: BadEnv
url: https://{{host}}
variables:
  host: "{{env:DEFINITELY_MISSING_XYZ}}"
steps:
  - Visit
`);
    expect(() => loadJourney(p)).toThrow('Environment variable "DEFINITELY_MISSING_XYZ" is not set');
  });

  it('throws on undefined placeholder in step', () => {
    const p = writeTmpYaml('undef.yaml', `
name: Undef
url: https://example.com
variables:
  a: hello
steps:
  - Click {{missing}}
`);
    expect(() => loadJourney(p)).toThrow('Undefined variable "{{missing}}"');
  });
});
