import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

// Alert if no cycle has run within this window (6h cron + 1h buffer)
const STALE_THRESHOLD_SEC = 7 * 3600;

let server: Server | null = null;
let logDir = './data/logs';

const readCycleAge = (): number | null => {
  try {
    const filePath = join(dirname(logDir), 'health.json');
    const health = JSON.parse(readFileSync(filePath, 'utf-8')) as { updatedAt?: string };
    if (!health.updatedAt) return null;
    return Math.floor((Date.now() - new Date(health.updatedAt).getTime()) / 1000);
  } catch {
    return null;
  }
};

export const startHealthServer = (port: number, configuredLogDir?: string): void => {
  if (configuredLogDir) logDir = configuredLogDir;

  server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const cycleAgeSec = readCycleAge();
      const stale = cycleAgeSec === null || cycleAgeSec > STALE_THRESHOLD_SEC;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', cycleAgeSec, stale }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`  Health endpoint listening on port ${port}`);
  });
};

export const stopHealthServer = (): Promise<void> => {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    server.close(() => {
      server = null;
      resolve();
    });
  });
};
