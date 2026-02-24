import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeHealthFile, checkHealth } from '../index.js';

describe('health', () => {
  let tmpDir: string;
  let logDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfilter-health-'));
    logDir = path.join(tmpDir, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const mockStats = {
    totalCycles: 5,
    totalErrors: 1,
    lastCycleDurationMs: 3400,
  };

  describe('writeHealthFile', () => {
    it('should write health.json to parent of logDir', () => {
      writeHealthFile(logDir, mockStats);

      const healthPath = path.join(tmpDir, 'health.json');
      expect(fs.existsSync(healthPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(healthPath, 'utf-8'));
      expect(content.status).toBe('ok');
      expect(content.totalCycles).toBe(5);
      expect(content.totalErrors).toBe(1);
      expect(content.lastCycleDurationMs).toBe(3400);
      expect(content.updatedAt).toBeDefined();
    });
  });

  describe('checkHealth', () => {
    it('should return true for fresh health file', () => {
      writeHealthFile(logDir, mockStats);

      const result = checkHealth(logDir);
      expect(result).toBe(true);
    });

    it('should return false when no health file exists', () => {
      const result = checkHealth(logDir);
      expect(result).toBe(false);
    });

    it('should return false for stale health file (>90 min old)', () => {
      const healthPath = path.join(tmpDir, 'health.json');
      const staleTime = new Date(Date.now() - 95 * 60 * 1000).toISOString();

      fs.writeFileSync(healthPath, JSON.stringify({
        status: 'ok',
        updatedAt: staleTime,
        totalCycles: 1,
        totalErrors: 0,
        lastCycleDurationMs: 1000,
      }));

      const result = checkHealth(logDir);
      expect(result).toBe(false);
    });
  });
});
