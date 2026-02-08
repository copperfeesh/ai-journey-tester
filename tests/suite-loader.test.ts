import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { loadSuite } from '../src/suite-loader.js';

const tmpDir = join('/tmp', 'ajt-suite-tests-' + Date.now());

function writeTmpYaml(name: string, content: string): string {
  const p = join(tmpDir, name);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('loadSuite', () => {
  beforeAll(() => mkdirSync(tmpDir, { recursive: true }));
  afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('loads suite with string journey entries', () => {
    const p = writeTmpYaml('s1.yaml', `
name: My Suite
journeys:
  - login.yaml
  - checkout.yaml
`);
    const suite = loadSuite(p);
    expect(suite.name).toBe('My Suite');
    expect(suite.journeys).toHaveLength(2);
    expect(suite.journeys[0].path).toBe(join(tmpDir, 'login.yaml'));
    expect(suite.journeys[1].path).toBe(join(tmpDir, 'checkout.yaml'));
  });

  it('loads suite with object entries (path + variables)', () => {
    const p = writeTmpYaml('s2.yaml', `
name: Suite 2
journeys:
  - path: login.yaml
    variables:
      user: admin
`);
    const suite = loadSuite(p);
    expect(suite.journeys[0].path).toBe(join(tmpDir, 'login.yaml'));
    expect(suite.journeys[0].variables).toEqual({ user: 'admin' });
  });

  it('resolves paths relative to suite file directory', () => {
    const subDir = join(tmpDir, 'sub');
    mkdirSync(subDir, { recursive: true });
    const p = writeTmpYaml('sub/s3.yaml', `
name: Nested
journeys:
  - ../login.yaml
`);
    const suite = loadSuite(p);
    expect(suite.journeys[0].path).toBe(join(tmpDir, 'login.yaml'));
  });

  it('throws on missing name', () => {
    const p = writeTmpYaml('bad1.yaml', `
journeys:
  - a.yaml
`);
    expect(() => loadSuite(p)).toThrow('must have a "name" field');
  });

  it('throws on empty journeys array', () => {
    const p = writeTmpYaml('bad2.yaml', `
name: Bad
journeys: []
`);
    expect(() => loadSuite(p)).toThrow('non-empty "journeys" array');
  });

  it('throws on invalid entry type', () => {
    const p = writeTmpYaml('bad3.yaml', `
name: Bad
journeys:
  - 42
`);
    expect(() => loadSuite(p)).toThrow('must be a string path or object');
  });
});
