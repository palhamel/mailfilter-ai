import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadEnv } from '../env.js';

describe('loadEnv', () => {
  const originalEnv = process.env;

  const validEnv = {
    MAIL_USER: 'test@example.com',
    MAIL_PASSWORD: 'test-dummy-password-not-real',
    IMAP_HOST: 'imap.example.com',
    SMTP_HOST: 'smtp.example.com',
    NOTIFY_EMAIL: 'notify@example.com',
    MISTRAL_API_KEY: 'test-dummy-key-not-real',
    LOG_DIR: './data/logs',
    PROFILE_PATH: './profile.example.md',
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return valid config when all env vars are set', () => {
    Object.assign(process.env, validEnv);

    const config = loadEnv();

    expect(config.MAIL_USER).toBe('test@example.com');
    expect(config.MAIL_PASSWORD).toBe('test-dummy-password-not-real');
    expect(config.IMAP_HOST).toBe('imap.example.com');
    expect(config.SMTP_HOST).toBe('smtp.example.com');
    expect(config.NOTIFY_EMAIL).toBe('notify@example.com');
    expect(config.MISTRAL_API_KEY).toBe('test-dummy-key-not-real');
    expect(config.LOG_DIR).toBe('./data/logs');
  });

  it('should exit process when MAIL_USER is missing', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const { MAIL_USER: _removed, ...partial } = validEnv;
    Object.assign(process.env, partial);

    expect(() => loadEnv()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should exit process when MAIL_USER is not a valid email', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    Object.assign(process.env, { ...validEnv, MAIL_USER: 'not-an-email' });

    expect(() => loadEnv()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should exit process when MISTRAL_API_KEY is empty', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    Object.assign(process.env, { ...validEnv, MISTRAL_API_KEY: '' });

    expect(() => loadEnv()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
