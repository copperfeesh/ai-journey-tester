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
