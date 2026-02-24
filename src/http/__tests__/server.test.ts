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
    expect(body).toEqual({ status: 'ok' });
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
});
