import cron from 'node-cron';
import { loadEnv } from './config/env.js';
import { fetchUnreadEmails } from './mail/reader.js';
import { detectProvider, parseJobDigest } from './mail/parser.js';
import { evaluateJob } from './ai/evaluator.js';
import { loadSystemPrompt } from './ai/prompt.js';
import { sendDigestResultEmail } from './mail/sender.js';
import { logEvaluation, logError, rotateLogs } from './logger/index.js';
import { withRetry } from './utils/retry.js';
import { delay } from './utils/delay.js';
import { writeHealthFile } from './health/index.js';
import { startHealthServer, stopHealthServer } from './http/server.js';
import {
  incrementCycles,
  setCycleDuration,
  incrementEmailsProcessed,
  incrementJobsEvaluated,
  incrementSkipped,
  incrementErrors,
  formatStatsLog,
  getStats,
} from './stats/index.js';
import {
  notifyStartup,
  notifyCritical,
  notify,
  bufferError,
  flushErrorBuffer,
} from './notifications/index.js';
import type { JobEvaluation } from './types/index.js';

const env = loadEnv();
const systemPrompt = loadSystemPrompt(env.PROFILE_PATH);

let processing = false;
let shuttingDown = false;

const isMistralRetryable = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message;
    return msg.includes('429') || msg.includes('500') || msg.includes('503');
  }
  return false;
};

const processEmails = async (): Promise<void> => {
  if (shuttingDown) return;

  processing = true;
  const cycleStart = Date.now();
  incrementCycles();
  console.log(`\n[${new Date().toISOString()}] Checking for new emails...`);

  let emails;
  try {
    emails = await withRetry(() => fetchUnreadEmails(env), {
      maxAttempts: 3,
      baseDelayMs: 2000,
      onRetry: (err, attempt) => {
        console.warn(`  [retry] IMAP attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('  IMAP failed after 3 attempts:', message);
    logError(env.LOG_DIR, 'imap-fetch', err);
    incrementErrors();
    await notifyCritical(env, 'IMAP Failure', `Failed to fetch emails after 3 attempts:\n${message}`);
    setCycleDuration(Date.now() - cycleStart);
    console.log(formatStatsLog());
    writeHealthFile(env.LOG_DIR, getStats());
    processing = false;
    return;
  }

  if (!emails.length) {
    console.log('  No new emails.');
    setCycleDuration(Date.now() - cycleStart);
    console.log(formatStatsLog());
    writeHealthFile(env.LOG_DIR, getStats());
    processing = false;
    return;
  }

  console.log(`  Found ${emails.length} email(s).`);

  for (const email of emails) {
    if (shuttingDown) break;

    try {
      const provider = detectProvider(email);

      if (provider === 'Unknown') {
        console.log(`  SKIP "${email.subject}" (unknown provider, from: ${email.from})`);
        incrementSkipped();
        continue;
      }

      incrementEmailsProcessed();
      const jobs = parseJobDigest(email);
      console.log(`  "${email.subject}" -> ${jobs.length} job(s) parsed`);

      const evaluations: JobEvaluation[] = [];

      for (let i = 0; i < jobs.length; i++) {
        if (shuttingDown) break;

        const job = jobs[i];

        // Rate limit protection between evaluations
        if (i > 0) {
          await delay(750);
        }

        try {
          const evaluation = await withRetry(
            () => evaluateJob(env, job, email.messageId, systemPrompt),
            {
              maxAttempts: 2,
              baseDelayMs: 2000,
              shouldRetry: isMistralRetryable,
              onRetry: (err, attempt) => {
                console.warn(`    [retry] Mistral attempt ${attempt} for "${job.title}":`, err instanceof Error ? err.message : err);
              },
            }
          );
          evaluations.push(evaluation);
          incrementJobsEvaluated();
          logEvaluation(env.LOG_DIR, evaluation);
          console.log(`    [${i + 1}/${jobs.length}] ${evaluation.category} ${evaluation.score}/5 ${evaluation.title} (${evaluation.company})`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`    [${i + 1}/${jobs.length}] FAILED: ${job.title} (${job.company})`);
          logError(env.LOG_DIR, `mistral-eval:${job.title}`, err);
          incrementErrors();
          bufferError(`Mistral: ${job.title}`, message);
        }
      }

      if (evaluations.length > 0) {
        try {
          await withRetry(() => sendDigestResultEmail(env, evaluations, email), {
            maxAttempts: 2,
            baseDelayMs: 3000,
            onRetry: (err, attempt) => {
              console.warn(`  [retry] SMTP attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
            },
          });
          console.log(`  -> Digest email sent (${evaluations.length} jobs)`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`  SMTP FAILED for "${email.subject}":`, message);
          logError(env.LOG_DIR, `smtp-send:${email.subject}`, err);
          incrementErrors();
          bufferError(`SMTP: ${email.subject}`, message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: "${email.subject}":`, message);
      logError(env.LOG_DIR, `process-email:${email.subject}`, err);
      incrementErrors();
      bufferError(`Email: ${email.subject}`, message);
    }
  }

  await flushErrorBuffer(env);
  setCycleDuration(Date.now() - cycleStart);
  console.log(formatStatsLog());
  writeHealthFile(env.LOG_DIR, getStats());
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
console.log(`Job Filter AI started. AI: Mistral (${env.MISTRAL_MODEL}). Checking every ${interval} minutes.\n`);
await notifyStartup(env);

// Rotate old logs on startup
rotateLogs(env.LOG_DIR, 30);

// Write initial health file so Docker HEALTHCHECK passes during start-period
writeHealthFile(env.LOG_DIR, getStats());

// Start HTTP health endpoint for external monitoring (Uptime Kuma)
startHealthServer(env.HEALTH_PORT);

// Run immediately on start
processEmails();

// Then on configured interval
const cronTask = cron.schedule(`*/${interval} * * * *`, processEmails);
