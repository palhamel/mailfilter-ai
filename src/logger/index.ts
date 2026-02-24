import fs from 'node:fs';
import path from 'node:path';
import type { JobEvaluation, ErrorLogEntry } from '../types/index.js';

export const ensureLogDir = (logDir: string): void => {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

export const getLogFilePath = (logDir: string): string => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `${date}.json`);
};

export const readLogFile = (filePath: string): JobEvaluation[] => {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as JobEvaluation[];
};

export const logEvaluation = (
  logDir: string,
  evaluation: JobEvaluation
): void => {
  ensureLogDir(logDir);

  const filePath = getLogFilePath(logDir);
  const existing = readLogFile(filePath);
  existing.push(evaluation);

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
};

export const getErrorLogFilePath = (logDir: string): string => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `errors-${date}.json`);
};

export const readErrorLogFile = (filePath: string): ErrorLogEntry[] => {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as ErrorLogEntry[];
};

export const logError = (
  logDir: string,
  context: string,
  error: unknown
): void => {
  ensureLogDir(logDir);

  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };

  const filePath = getErrorLogFilePath(logDir);
  const existing = readErrorLogFile(filePath);
  existing.push(entry);

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
};

/**
 * Delete log files older than maxAgeDays.
 * Matches YYYY-MM-DD.json and errors-YYYY-MM-DD.json patterns.
 */
export const rotateLogs = (logDir: string, maxAgeDays: number): void => {
  if (!fs.existsSync(logDir)) return;

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const datePattern = /^(?:errors-)?(\d{4}-\d{2}-\d{2})\.json$/;
  let deleted = 0;

  for (const file of fs.readdirSync(logDir)) {
    const match = file.match(datePattern);
    if (!match) continue;

    const fileDate = new Date(match[1]).getTime();
    if (isNaN(fileDate)) continue;

    if (fileDate < cutoff) {
      fs.unlinkSync(path.join(logDir, file));
      deleted++;
    }
  }

  if (deleted > 0) {
    console.log(`[log-rotation] Deleted ${deleted} log file(s) older than ${maxAgeDays} days.`);
  }
};
