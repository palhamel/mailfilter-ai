import cron from 'node-cron';
import { loadEnv } from './config/env.js';
import { createAIClient } from './ai/providers.js';
import { loadSystemPrompt } from './ai/prompt.js';
import { rotateLogs } from './logger/index.js';
import { logError } from './logger/index.js';
import { writeHealthFile } from './health/index.js';
import { startHealthServer, stopHealthServer } from './http/server.js';
import { getStats } from './stats/index.js';
import { notifyStartup, notifyCritical, notify } from './notifications/index.js';
import { delay } from './utils/delay.js';
import { processEmails } from './pipeline.js';

const env = loadEnv();
const systemPrompt = loadSystemPrompt(env.PROFILE_PATH);
const aiClient = createAIClient(env);

let processing = false;
let shuttingDown = false;

const runCycle = async (): Promise<void> => {
  if (shuttingDown) return;

  processing = true;
  await processEmails(env, aiClient, systemPrompt, () => shuttingDown);
  processing = false;
};

// Graceful shutdown
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[${new Date().toISOString()}] ${signal} received. Shutting down gracefully...`);

  cronTask.stop();
  console.log('  Cron stopped.');

  await stopHealthServer();
  console.log('  Health server stopped.');

  // Wait for in-flight cycle to finish (max 60s)
  if (processing) {
    console.log('  Waiting for current cycle to finish...');
    const deadline = Date.now() + 60_000;
    while (processing && Date.now() < deadline) {
      await delay(500);
    }
    if (processing) {
      console.warn('  Cycle did not finish within 60s, forcing exit.');
    }
  }

  await notify(env, 'JobFilter AI Stopped', `Received ${signal}. Graceful shutdown complete.`, { color: 0xd97706 });
  console.log('  Shutdown complete.');
  process.exit(0);
};

// Crash handlers
process.on('uncaughtException', async (err) => {
  console.error('[FATAL] uncaughtException:', err);
  logError(env.LOG_DIR, 'uncaughtException', err);
  await notifyCritical(env, 'FATAL: Uncaught Exception', err.message);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
  logError(env.LOG_DIR, 'unhandledRejection', reason);
  const message = reason instanceof Error ? reason.message : String(reason);
  await notifyCritical(env, 'FATAL: Unhandled Rejection', message);
  process.exit(1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Startup
const interval = env.MAILBOX_CHECK_INTERVAL_MINUTES;
console.log(`Job Filter AI started. AI: ${aiClient.provider} (${aiClient.model}). Checking every ${interval} minutes.\n`);
await notifyStartup(env);

// Rotate old logs on startup
rotateLogs(env.LOG_DIR, 30);

// Write initial health file so Docker HEALTHCHECK passes during start-period
writeHealthFile(env.LOG_DIR, getStats());

// Start HTTP health endpoint for external monitoring (Uptime Kuma)
startHealthServer(env.HEALTH_PORT);

// Run immediately on start
runCycle();

// Then on configured interval
const cronTask = cron.schedule(`*/${interval} * * * *`, runCycle);
