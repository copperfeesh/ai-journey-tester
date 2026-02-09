import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { renderStep, generateReport, generateSuiteReport } from '../src/reporter.js';
import { makeStepResult, makeJourneyResult, makeSuiteResult } from './fixtures.js';

describe('renderStep', () => {
  it('renders passed badge', () => {
    const html = renderStep(makeStepResult({ status: 'passed' }), 0);
    expect(html).toContain('class="badge passed"');
    expect(html).toContain('>passed<');
  });

  it('renders failed badge', () => {
    const html = renderStep(makeStepResult({ status: 'failed' }), 0);
    expect(html).toContain('class="badge failed"');
  });

  it('renders warning badge', () => {
    const html = renderStep(makeStepResult({ status: 'warning' }), 0);
    expect(html).toContain('class="badge warning"');
  });

  it('renders step number', () => {
    const html = renderStep(makeStepResult(), 2);
    expect(html).toContain('>3<');
  });

  it('renders action text', () => {
    const html = renderStep(makeStepResult({ action: 'Click the login button' }), 0);
    expect(html).toContain('Click the login button');
  });

  it('renders error box when error present', () => {
    const html = renderStep(makeStepResult({ status: 'failed', error: 'Element not found' }), 0);
    expect(html).toContain('error-box');
    expect(html).toContain('Element not found');
  });

  it('does not render error box when no error', () => {
    const html = renderStep(makeStepResult({ status: 'passed' }), 0);
    expect(html).not.toContain('error-box');
  });

  it('renders UX issues', () => {
    const step = makeStepResult({
      interpretation: {
        thinking: 'test',
        actions: [],
        uxAnalysis: {
          score: 5,
          issues: [
            { severity: 'warning', category: 'accessibility', description: 'Missing alt text' },
          ],
          positives: [],
        },
      },
    });
    const html = renderStep(step, 0);
    expect(html).toContain('Missing alt text');
    expect(html).toContain('ux-issue warning');
  });

  it('renders UX positives', () => {
    const step = makeStepResult({
      interpretation: {
        thinking: 'test',
        actions: [],
        uxAnalysis: {
          score: 9,
          issues: [],
          positives: ['Good contrast'],
        },
      },
    });
    const html = renderStep(step, 0);
    expect(html).toContain('Good contrast');
    expect(html).toContain('Positive Observations');
  });

  it('renders screenshots when base64 provided', () => {
    const step = makeStepResult({
      pageStateBefore: {
        url: 'https://example.com',
        title: 'Test',
        ariaSnapshot: '',
        screenshotBase64: 'abc123',
        consoleMessages: [],
        networkErrors: [],
        timestamp: Date.now(),
      },
    });
    const html = renderStep(step, 0);
    expect(html).toContain('data:image/jpeg;base64,abc123');
  });

  it('escapes HTML in action text', () => {
    const html = renderStep(makeStepResult({ action: '<script>alert(1)</script>' }), 0);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('renders duration', () => {
    const html = renderStep(makeStepResult({ durationMs: 1234 }), 0);
    expect(html).toContain('1234ms');
  });
});

describe('generateReport', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('creates an HTML file', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'report-test-'));
    const result = makeJourneyResult();
    const path = generateReport(result, tmpDir);
    expect(existsSync(path)).toBe(true);
    expect(path).toMatch(/\.html$/);
  });

  it('contains journey name in report', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'report-test-'));
    const result = makeJourneyResult({
      journey: {
        name: 'My Custom Journey',
        url: 'https://example.com',
        steps: [{ action: 'Click' }],
      },
    });
    const path = generateReport(result, tmpDir);
    const html = readFileSync(path, 'utf-8');
    expect(html).toContain('My Custom Journey');
  });

  it('contains summary stats', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'report-test-'));
    const result = makeJourneyResult();
    const path = generateReport(result, tmpDir);
    const html = readFileSync(path, 'utf-8');
    expect(html).toContain('PASSED');
  });

  it('contains step content', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'report-test-'));
    const result = makeJourneyResult({
      steps: [makeStepResult({ action: 'Click the button' })],
    });
    const path = generateReport(result, tmpDir);
    const html = readFileSync(path, 'utf-8');
    expect(html).toContain('Click the button');
  });
});

describe('generateSuiteReport', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('creates an HTML file with suite_ prefix', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'suite-report-test-'));
    const result = makeSuiteResult();
    const path = generateSuiteReport(result, tmpDir);
    expect(existsSync(path)).toBe(true);
    const filename = path.split('/').pop()!;
    expect(filename).toMatch(/^suite_/);
  });

  it('contains suite name', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'suite-report-test-'));
    const result = makeSuiteResult();
    const path = generateSuiteReport(result, tmpDir);
    const html = readFileSync(path, 'utf-8');
    expect(html).toContain('Test Suite');
  });

  it('contains journey table', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'suite-report-test-'));
    const result = makeSuiteResult();
    const path = generateSuiteReport(result, tmpDir);
    const html = readFileSync(path, 'utf-8');
    expect(html).toContain('Journey Summary');
    expect(html).toContain('journey-table');
  });
});
