import { resolve, sep } from 'path';

/** Validate that a filename stays within baseDir. Rejects traversal, null bytes, non-.yaml. */
export function safePath(baseDir: string, filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename');
  }
  // Reject null bytes
  if (filename.includes('\0')) {
    throw new Error('Invalid filename: null bytes not allowed');
  }
  // Reject path separators and traversal sequences
  if (/[/\\]/.test(filename) || filename.includes('..')) {
    throw new Error('Invalid filename: path traversal not allowed');
  }
  // Enforce .yaml extension
  let clean = filename;
  if (!clean.endsWith('.yaml')) clean += '.yaml';
  if (!clean || clean === '.yaml') throw new Error('Invalid filename');
  // Resolve and verify the path stays within baseDir
  const resolvedBase = resolve(baseDir);
  const resolvedPath = resolve(resolvedBase, clean);
  if (!resolvedPath.startsWith(resolvedBase + sep)) {
    throw new Error('Path traversal detected');
  }
  return resolvedPath;
}

/** Validate a navigation URL — allow only http/https, reject private/internal IPs. */
export function validateNavigationUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  // Allow only http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Disallowed URL protocol: ${parsed.protocol}`);
  }
  // Reject private/internal hostnames and IPs
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error(`Navigation to private/internal address is not allowed: ${hostname}`);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isRateLimit = lastError.message.includes('429') || lastError.message.includes('rate_limit');
      // Wait longer for rate limits (up to 60s), shorter for other errors
      const delay = isRateLimit
        ? Math.min(60000, baseDelayMs * Math.pow(2, i + 1))
        : baseDelayMs * Math.pow(2, i);
      if (i < maxRetries - 1) {
        log(`Retry ${i + 1}/${maxRetries - 1} after ${delay}ms${isRateLimit ? ' (rate limited)' : ''}: ${lastError.message.substring(0, 80)}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

let verboseMode = false;

export function setVerbose(enabled: boolean) {
  verboseMode = enabled;
}

export function log(message: string) {
  if (verboseMode) {
    console.log(`  [debug] ${message}`);
  }
}

export function logStep(index: number, total: number, action: string) {
  const progress = `[${index + 1}/${total}]`;
  console.log(`\n${progress} ${action}`);
}

export function logStatus(status: 'passed' | 'failed' | 'warning', detail?: string) {
  const icon = status === 'passed' ? 'PASS' : status === 'failed' ? 'FAIL' : 'WARN';
  const msg = detail ? `  ${icon}: ${detail}` : `  ${icon}`;
  console.log(msg);
}

export function parsePauseStep(action: string): string | null {
  const trimmed = action.trim();
  if (/^pause$/i.test(trimmed)) {
    return 'Paused. Press Enter to continue...';
  }
  const quotedMatch = trimmed.match(/^pause\s+["'](.+)["']$/i);
  if (quotedMatch) {
    return quotedMatch[1];
  }
  const unquotedMatch = trimmed.match(/^pause\s+(.+)$/i);
  if (unquotedMatch) {
    return unquotedMatch[1];
  }
  return null;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
