import { describe, it, expect, vi, beforeEach } from 'vitest';
import { truncateAriaSnapshot, isVisualStep, parseUXReport } from '../src/ai.js';

describe('truncateAriaSnapshot', () => {
  it('returns unchanged when under limit', () => {
    const short = 'line1\nline2\nline3';
    expect(truncateAriaSnapshot(short)).toBe(short);
  });

  it('truncates when over default limit', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`);
    const snapshot = lines.join('\n');
    const result = truncateAriaSnapshot(snapshot);
    const resultLines = result.split('\n');
    // 150 content lines + 1 truncation notice
    expect(resultLines).toHaveLength(151);
    expect(result).toContain('truncated');
    expect(result).toContain('50 more lines');
  });

  it('respects custom maxLines', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    const snapshot = lines.join('\n');
    const result = truncateAriaSnapshot(snapshot, 10);
    const resultLines = result.split('\n');
    expect(resultLines).toHaveLength(11); // 10 + truncation notice
    expect(result).toContain('10 more lines');
  });

  it('returns unchanged when exactly at limit', () => {
    const lines = Array.from({ length: 150 }, (_, i) => `line ${i}`);
    const snapshot = lines.join('\n');
    expect(truncateAriaSnapshot(snapshot)).toBe(snapshot);
  });

  it('handles empty string', () => {
    expect(truncateAriaSnapshot('')).toBe('');
  });
});

describe('isVisualStep', () => {
  it('returns true for "verify" keywords', () => {
    expect(isVisualStep({ action: 'Verify the button is visible' })).toBe(true);
  });

  it('returns true for "check" keywords', () => {
    expect(isVisualStep({ action: 'Check the layout' })).toBe(true);
  });

  it('returns true for "confirm" keywords', () => {
    expect(isVisualStep({ action: 'Confirm the modal appears' })).toBe(true);
  });

  it('returns true for "ensure" keywords', () => {
    expect(isVisualStep({ action: 'Ensure the form is displayed' })).toBe(true);
  });

  it('returns true for "screenshot" keywords', () => {
    expect(isVisualStep({ action: 'Take a screenshot' })).toBe(true);
  });

  it('returns true for "visual" keywords', () => {
    expect(isVisualStep({ action: 'Do a visual check' })).toBe(true);
  });

  it('returns false for action steps', () => {
    expect(isVisualStep({ action: 'Click the submit button' })).toBe(false);
  });

  it('returns false for type steps', () => {
    expect(isVisualStep({ action: 'Type hello into the search box' })).toBe(false);
  });

  it('returns false for navigate steps', () => {
    expect(isVisualStep({ action: 'Navigate to the homepage' })).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isVisualStep({ action: 'VERIFY the page' })).toBe(true);
    expect(isVisualStep({ action: 'CHECK the layout' })).toBe(true);
  });
});

describe('parseUXReport', () => {
  it('parses valid JSON issues string', () => {
    const result = parseUXReport({
      score: 7,
      issues: JSON.stringify([
        { severity: 'warning', category: 'accessibility', description: 'Missing alt text' },
      ]),
      positives: 'Good contrast, Clear labels',
    });
    expect(result.score).toBe(7);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].category).toBe('accessibility');
    expect(result.issues[0].description).toBe('Missing alt text');
    expect(result.positives).toEqual(['Good contrast', 'Clear labels']);
  });

  it('handles issues as array directly', () => {
    const result = parseUXReport({
      score: 9,
      issues: [
        { severity: 'info', category: 'usability', description: 'Minor spacing issue' },
      ],
      positives: '',
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].description).toBe('Minor spacing issue');
  });

  it('falls back for invalid JSON to plain string issue', () => {
    const result = parseUXReport({
      score: 5,
      issues: 'Some plain text issue',
      positives: '',
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].description).toBe('Some plain text issue');
  });

  it('defaults score to 5 if missing', () => {
    const result = parseUXReport({
      issues: '[]',
      positives: '',
    });
    expect(result.score).toBe(5);
  });

  it('handles empty issues array', () => {
    const result = parseUXReport({
      score: 10,
      issues: '[]',
      positives: '',
    });
    expect(result.issues).toHaveLength(0);
  });

  it('handles empty positives', () => {
    const result = parseUXReport({
      score: 8,
      issues: '[]',
      positives: '',
    });
    expect(result.positives).toEqual([]);
  });

  it('fills in default severity and category', () => {
    const result = parseUXReport({
      score: 6,
      issues: JSON.stringify([{ description: 'Something wrong' }]),
      positives: '',
    });
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].category).toBe('usability');
  });

  it('preserves recommendation and element fields', () => {
    const result = parseUXReport({
      score: 6,
      issues: JSON.stringify([{
        severity: 'critical',
        category: 'accessibility',
        description: 'Missing label',
        element: 'input#email',
        recommendation: 'Add an aria-label',
      }]),
      positives: '',
    });
    expect(result.issues[0].element).toBe('input#email');
    expect(result.issues[0].recommendation).toBe('Add an aria-label');
  });
});
