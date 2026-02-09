import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parsePauseStep, escapeHtml, withRetry } from '../src/utils.js';

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

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it('returns unchanged string when no special chars', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles all special chars together', () => {
    expect(escapeHtml('<a href="x" class=\'y\'>&</a>')).toBe(
      '&lt;a href=&quot;x&quot; class=&#039;y&#039;&gt;&amp;&lt;/a&gt;'
    );
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, 5, 100);
    // Advance through the retry delays
    await vi.advanceTimersByTimeAsync(100); // 100ms * 2^0
    await vi.advanceTimersByTimeAsync(200); // 100ms * 2^1
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(withRetry(fn, 2, 1)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useFakeTimers();
  });

  it('uses longer delay for rate limit errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 rate_limit'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, 3, 100);
    // Rate limit delay = min(60000, 100 * 2^(0+1)) = 200
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects custom maxRetries and baseDelay', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, 2, 50);
    await vi.advanceTimersByTimeAsync(50); // 50 * 2^0
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
