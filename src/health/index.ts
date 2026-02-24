import fs from 'node:fs';
import path from 'node:path';

interface HealthStatus {
  status: 'ok' | 'error';
  updatedAt: string;
  totalCycles: number;
  totalErrors: number;
  lastCycleDurationMs: number | null;
}

interface StatsSnapshot {
  totalCycles: number;
  totalErrors: number;
  lastCycleDurationMs: number | null;
}

const HEALTH_FILE = 'health.json';

// Max age in ms before health is considered stale
// Must be longer than the longest possible check interval + cycle duration
const MAX_STALE_MS = 90 * 60 * 1000; // 90 min

export const writeHealthFile = (logDir: string, stats: StatsSnapshot): void => {
  const parentDir = path.dirname(logDir);
  const filePath = path.join(parentDir, HEALTH_FILE);

  const health: HealthStatus = {
    status: 'ok',
    updatedAt: new Date().toISOString(),
    totalCycles: stats.totalCycles,
    totalErrors: stats.totalErrors,
    lastCycleDurationMs: stats.lastCycleDurationMs,
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(health, null, 2), 'utf-8');
  } catch {
    console.error('[health] Failed to write health file');
  }
};

export const checkHealth = (logDir: string): boolean => {
  const parentDir = path.dirname(logDir);
  const filePath = path.join(parentDir, HEALTH_FILE);

  try {
    if (!fs.existsSync(filePath)) return false;

    const content = fs.readFileSync(filePath, 'utf-8');
    const health = JSON.parse(content) as HealthStatus;

    const age = Date.now() - new Date(health.updatedAt).getTime();
    return health.status === 'ok' && age < MAX_STALE_MS;
  } catch {
    return false;
  }
};
