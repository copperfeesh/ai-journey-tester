import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parsePauseStep, escapeHtml, withRetry, safePath, validateNavigationUrl } from '../src/utils.js';
import { resolve, sep } from 'path';

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

describe('safePath', () => {
  const baseDir = '/tmp/test-journeys';

  it('resolves a valid filename', () => {
    const result = safePath(baseDir, 'my-journey.yaml');
    expect(result).toBe(resolve(baseDir, 'my-journey.yaml'));
    expect(result.startsWith(resolve(baseDir) + sep)).toBe(true);
  });

  it('appends .yaml if missing', () => {
    const result = safePath(baseDir, 'my-journey');
    expect(result.endsWith('.yaml')).toBe(true);
  });

  it('rejects path traversal with ../', () => {
    expect(() => safePath(baseDir, '../etc/passwd')).toThrow();
  });

  it('rejects absolute paths', () => {
    expect(() => safePath(baseDir, '/etc/passwd.yaml')).toThrow();
  });

  it('rejects null bytes', () => {
    expect(() => safePath(baseDir, 'journey\0.yaml')).toThrow('null bytes');
  });

  it('rejects empty filename', () => {
    expect(() => safePath(baseDir, '')).toThrow('Invalid filename');
  });

  it('rejects filename that becomes empty after sanitization', () => {
    expect(() => safePath(baseDir, '../../')).toThrow();
  });
});

describe('validateNavigationUrl', () => {
  it('allows http URLs', () => {
    expect(() => validateNavigationUrl('http://example.com')).not.toThrow();
  });

  it('allows https URLs', () => {
    expect(() => validateNavigationUrl('https://example.com')).not.toThrow();
  });

  it('rejects file: protocol', () => {
    expect(() => validateNavigationUrl('file:///etc/passwd')).toThrow('Disallowed URL protocol');
  });

  it('rejects javascript: protocol', () => {
    expect(() => validateNavigationUrl('javascript:alert(1)')).toThrow('Disallowed URL protocol');
  });

  it('rejects data: protocol', () => {
    expect(() => validateNavigationUrl('data:text/html,<h1>hi</h1>')).toThrow('Disallowed URL protocol');
  });

  it('rejects localhost', () => {
    expect(() => validateNavigationUrl('http://localhost:3000')).toThrow('private/internal');
  });

  it('rejects 127.x.x.x', () => {
    expect(() => validateNavigationUrl('http://127.0.0.1')).toThrow('private/internal');
  });

  it('rejects 10.x.x.x', () => {
    expect(() => validateNavigationUrl('http://10.0.0.1')).toThrow('private/internal');
  });

  it('rejects 192.168.x.x', () => {
    expect(() => validateNavigationUrl('http://192.168.1.1')).toThrow('private/internal');
  });

  it('rejects 172.16-31.x.x', () => {
    expect(() => validateNavigationUrl('http://172.16.0.1')).toThrow('private/internal');
    expect(() => validateNavigationUrl('http://172.31.255.255')).toThrow('private/internal');
  });

  it('allows 172.32.x.x (not private)', () => {
    expect(() => validateNavigationUrl('http://172.32.0.1')).not.toThrow();
  });

  it('rejects 169.254.x.x (link-local)', () => {
    expect(() => validateNavigationUrl('http://169.254.169.254')).toThrow('private/internal');
  });

  it('rejects 0.0.0.0', () => {
    expect(() => validateNavigationUrl('http://0.0.0.0')).toThrow('private/internal');
  });

  it('rejects ::1', () => {
    expect(() => validateNavigationUrl('http://[::1]')).toThrow('private/internal');
  });

  it('rejects invalid URLs', () => {
    expect(() => validateNavigationUrl('not-a-url')).toThrow('Invalid URL');
  });
});
