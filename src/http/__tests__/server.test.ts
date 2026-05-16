import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { startHealthServer, stopHealthServer } from '../server.js';

const TEST_PORT = 19876;

describe('health HTTP server', () => {
  afterEach(async () => {
    await stopHealthServer();
  });

  it('should return 200 with status ok on GET /health', async () => {
    startHealthServer(TEST_PORT);
    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 50));

    const res = await fetch(`http://localhost:${TEST_PORT}/health`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect('cycleAgeSec' in body).toBe(true);
    expect(typeof body.stale).toBe('boolean');
  });

  it('should return 404 on unknown routes', async () => {
    startHealthServer(TEST_PORT);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const res = await fetch(`http://localhost:${TEST_PORT}/unknown`);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Not found' });
  });

  it('should return 404 on POST /health', async () => {
    startHealthServer(TEST_PORT);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const res = await fetch(`http://localhost:${TEST_PORT}/health`, { method: 'POST' });

    expect(res.status).toBe(404);
  });

  it('should stop cleanly', async () => {
    startHealthServer(TEST_PORT);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await stopHealthServer();

    await expect(
      fetch(`http://localhost:${TEST_PORT}/health`)
    ).rejects.toThrow();
  });

  it('should resolve immediately if no server is running', async () => {
    // stopHealthServer called without startHealthServer should not throw
    await expect(stopHealthServer()).resolves.toBeUndefined();
  });

  it('should return cycleAgeSec as a number read from health.json', async () => {
    // Create a temp dir: tmpDir/logs/ is logDir, tmpDir/health.json is the file
    const tmpDir = mkdtempSync(join(tmpdir(), 'health-server-test-'));
    const logsDir = join(tmpDir, 'logs');
    const healthFile = join(tmpDir, 'health.json');
    const updatedAt = new Date(Date.now() - 5_000).toISOString(); // 5 seconds ago
    writeFileSync(healthFile, JSON.stringify({ status: 'ok', updatedAt }));

    try {
      startHealthServer(TEST_PORT, logsDir);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const res = await fetch(`http://localhost:${TEST_PORT}/health`);
      const body = await res.json() as { status: string; cycleAgeSec: number; stale: boolean };

      expect(res.status).toBe(200);
      expect(typeof body.cycleAgeSec).toBe('number');
      expect(body.cycleAgeSec).toBeGreaterThanOrEqual(4);
      expect(body.cycleAgeSec).toBeLessThan(15);
      expect(body.stale).toBe(false); // 5 s is well within the 7-hour threshold
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
