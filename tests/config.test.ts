import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

// We mock fs and path to avoid relying on actual file system state
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import { existsSync, readFileSync } from 'fs';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaults when no config file exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const config = loadConfig();
    expect(config.model).toBe('claude-haiku-4-5-20251001');
    expect(config.delay).toBe(10);
    expect(config.timeout).toBe(30000);
    expect(config.retries).toBe(1);
    expect(config.outputDir).toBe('./reports');
    expect(config.headed).toBe(false);
  });

  it('merges file values into defaults', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('model: claude-sonnet-4-5-20250929\ndelay: 5\nheaded: true');
    const config = loadConfig();
    expect(config.model).toBe('claude-sonnet-4-5-20250929');
    expect(config.delay).toBe(5);
    expect(config.headed).toBe(true);
    // Defaults should still be there for unset values
    expect(config.timeout).toBe(30000);
  });

  it('ignores malformed config file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('this is not valid yaml: [[[');
    const config = loadConfig();
    // Should still return defaults
    expect(config.model).toBe('claude-haiku-4-5-20251001');
  });

  it('ignores config values with wrong types', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('model: 123\ndelay: "not a number"');
    const config = loadConfig();
    // model should stay default because 123 is not a string
    expect(config.model).toBe('claude-haiku-4-5-20251001');
    expect(config.delay).toBe(10);
  });
});
