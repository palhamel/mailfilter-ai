import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ensureLogDir, logEvaluation, readLogFile, logError, readErrorLogFile, rotateLogs } from '../index.js';
import type { JobEvaluation } from '../../types/index.js';

describe('logger', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfilter-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const mockEvaluation: JobEvaluation = {
    messageId: 'msg-123',
    score: 4,
    category: '🟢',
    title: 'Fullstack Developer',
    company: 'ClimateView',
    location: 'Stockholm (Hybrid)',
    provider: 'LinkedIn',
    reasoning: 'Strong match.',
    links: ['https://linkedin.com/jobs/123'],
    evaluatedAt: new Date('2026-02-20T10:00:00Z'),
  };

  describe('ensureLogDir', () => {
    it('should create directory if it does not exist', () => {
      const logDir = path.join(tmpDir, 'logs');

      expect(fs.existsSync(logDir)).toBe(false);
      ensureLogDir(logDir);
      expect(fs.existsSync(logDir)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      ensureLogDir(tmpDir);
      expect(fs.existsSync(tmpDir)).toBe(true);
    });
  });

  describe('readLogFile', () => {
    it('should return empty array for non-existent file', () => {
      const result = readLogFile(path.join(tmpDir, 'nonexistent.json'));
      expect(result).toEqual([]);
    });

    it('should parse existing log file', () => {
      const filePath = path.join(tmpDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify([mockEvaluation]));

      const result = readLogFile(filePath);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Fullstack Developer');
    });
  });

  describe('logEvaluation', () => {
    it('should create log file and write evaluation', () => {
      const logDir = path.join(tmpDir, 'logs');
      logEvaluation(logDir, mockEvaluation);

      const files = fs.readdirSync(logDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.json$/);

      const content = JSON.parse(
        fs.readFileSync(path.join(logDir, files[0]), 'utf-8')
      );
      expect(content).toHaveLength(1);
      expect(content[0].title).toBe('Fullstack Developer');
    });

    it('should append to existing log file', () => {
      const logDir = path.join(tmpDir, 'logs');
      logEvaluation(logDir, mockEvaluation);
      logEvaluation(logDir, { ...mockEvaluation, messageId: 'msg-456' });

      const files = fs.readdirSync(logDir);
      const content = JSON.parse(
        fs.readFileSync(path.join(logDir, files[0]), 'utf-8')
      );
      expect(content).toHaveLength(2);
    });
  });

  describe('logError', () => {
    it('should create error log file with Error object', () => {
      const logDir = path.join(tmpDir, 'errors');
      const error = new Error('something broke');

      logError(logDir, 'test-context', error);

      const files = fs.readdirSync(logDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^errors-\d{4}-\d{2}-\d{2}\.json$/);

      const content = JSON.parse(
        fs.readFileSync(path.join(logDir, files[0]), 'utf-8')
      );
      expect(content).toHaveLength(1);
      expect(content[0].context).toBe('test-context');
      expect(content[0].message).toBe('something broke');
      expect(content[0].stack).toBeDefined();
      expect(content[0].timestamp).toBeDefined();
    });

    it('should handle non-Error values', () => {
      const logDir = path.join(tmpDir, 'errors');
      logError(logDir, 'string-error', 'plain string error');

      const files = fs.readdirSync(logDir);
      const content = JSON.parse(
        fs.readFileSync(path.join(logDir, files[0]), 'utf-8')
      );
      expect(content[0].message).toBe('plain string error');
      expect(content[0].stack).toBeUndefined();
    });

    it('should append to existing error log', () => {
      const logDir = path.join(tmpDir, 'errors');
      logError(logDir, 'first', new Error('error 1'));
      logError(logDir, 'second', new Error('error 2'));

      const files = fs.readdirSync(logDir);
      const content = JSON.parse(
        fs.readFileSync(path.join(logDir, files[0]), 'utf-8')
      );
      expect(content).toHaveLength(2);
    });
  });

  describe('readErrorLogFile', () => {
    it('should return empty array for non-existent file', () => {
      const result = readErrorLogFile(path.join(tmpDir, 'nonexistent.json'));
      expect(result).toEqual([]);
    });
  });

  describe('rotateLogs', () => {
    it('should delete log files older than maxAgeDays', () => {
      const logDir = path.join(tmpDir, 'logs');
      fs.mkdirSync(logDir, { recursive: true });

      // Create old files (40 days ago)
      fs.writeFileSync(path.join(logDir, '2025-01-01.json'), '[]');
      fs.writeFileSync(path.join(logDir, 'errors-2025-01-01.json'), '[]');

      // Create recent file (today)
      const today = new Date().toISOString().split('T')[0];
      fs.writeFileSync(path.join(logDir, `${today}.json`), '[]');

      rotateLogs(logDir, 30);

      const remaining = fs.readdirSync(logDir);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toBe(`${today}.json`);
    });

    it('should not delete files within retention period', () => {
      const logDir = path.join(tmpDir, 'logs');
      fs.mkdirSync(logDir, { recursive: true });

      const today = new Date().toISOString().split('T')[0];
      fs.writeFileSync(path.join(logDir, `${today}.json`), '[]');
      fs.writeFileSync(path.join(logDir, `errors-${today}.json`), '[]');

      rotateLogs(logDir, 30);

      const remaining = fs.readdirSync(logDir);
      expect(remaining).toHaveLength(2);
    });

    it('should not throw if logDir does not exist', () => {
      expect(() => rotateLogs(path.join(tmpDir, 'nonexistent'), 30)).not.toThrow();
    });

    it('should ignore non-log files', () => {
      const logDir = path.join(tmpDir, 'logs');
      fs.mkdirSync(logDir, { recursive: true });

      fs.writeFileSync(path.join(logDir, 'health.json'), '{}');
      fs.writeFileSync(path.join(logDir, 'README.txt'), 'test');

      rotateLogs(logDir, 30);

      const remaining = fs.readdirSync(logDir);
      expect(remaining).toHaveLength(2);
    });
  });
});
