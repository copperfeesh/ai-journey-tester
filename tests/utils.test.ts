import { describe, it, expect } from 'vitest';
import { parsePauseStep } from '../src/utils.js';

describe('parsePauseStep', () => {
  it('returns default message for "pause"', () => {
    expect(parsePauseStep('pause')).toBe('Paused. Press Enter to continue...');
  });

  it('is case insensitive', () => {
    expect(parsePauseStep('PAUSE')).toBe('Paused. Press Enter to continue...');
    expect(parsePauseStep('Pause')).toBe('Paused. Press Enter to continue...');
  });

  it('extracts double-quoted message', () => {
    expect(parsePauseStep('pause "my message"')).toBe('my message');
  });

  it('extracts single-quoted message', () => {
    expect(parsePauseStep("pause 'my message'")).toBe('my message');
  });

  it('extracts unquoted message', () => {
    expect(parsePauseStep('pause unquoted msg')).toBe('unquoted msg');
  });

  it('returns null for non-pause action', () => {
    expect(parsePauseStep('Click button')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePauseStep('')).toBeNull();
  });

  it('handles leading/trailing whitespace', () => {
    expect(parsePauseStep('  pause  ')).toBe('Paused. Press Enter to continue...');
  });
});
