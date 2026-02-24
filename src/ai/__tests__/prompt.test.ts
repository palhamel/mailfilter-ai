import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadSystemPrompt } from '../prompt.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

import { readFileSync } from 'node:fs';
const mockedReadFileSync = vi.mocked(readFileSync);

describe('loadSystemPrompt', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load profile and wrap with system instructions', () => {
    const profileContent = '## My Profile\n\nI am a fullstack developer.';
    mockedReadFileSync.mockReturnValue(profileContent);

    const result = loadSystemPrompt('./profile.md');

    expect(mockedReadFileSync).toHaveBeenCalledWith('./profile.md', 'utf-8');
    expect(result).toContain('expert at matching job opportunities');
    expect(result).toContain('## Candidate Profile');
    expect(result).toContain(profileContent);
  });

  it('should throw on missing file', () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(() => loadSystemPrompt('./missing.md')).toThrow(
      'Failed to read profile file: ./missing.md'
    );
  });

  it('should throw on empty file', () => {
    mockedReadFileSync.mockReturnValue('   \n  ');

    expect(() => loadSystemPrompt('./empty.md')).toThrow(
      'Profile file is empty: ./empty.md'
    );
  });
});
