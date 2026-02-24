import { fetchUnreadEmails } from './mail/reader.js';
import { detectProvider, parseJobDigest } from './mail/parser.js';
import { evaluateJob } from './ai/evaluator.js';
import { sendDigestResultEmail } from './mail/sender.js';
import { logEvaluation, logError } from './logger/index.js';
import { withRetry } from './utils/retry.js';
import { delay } from './utils/delay.js';
import { writeHealthFile } from './health/index.js';
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
  notifyCritical,
  bufferError,
  flushErrorBuffer,
} from './notifications/index.js';
import type { AIClient, EnvConfig, JobEvaluation } from './types/index.js';

const isRetryableAIError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message;
    return msg.includes('429') || msg.includes('500') || msg.includes('503');
  }
  return false;
};

export const processEmails = async (
  env: EnvConfig,
  aiClient: AIClient,
  systemPrompt: string,
  isShuttingDown: () => boolean
): Promise<void> => {
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
    return;
  }

  if (!emails.length) {
    console.log('  No new emails.');
    setCycleDuration(Date.now() - cycleStart);
    console.log(formatStatsLog());
    writeHealthFile(env.LOG_DIR, getStats());
    return;
  }

  console.log(`  Found ${emails.length} email(s).`);

  for (const email of emails) {
    if (isShuttingDown()) break;

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
        if (isShuttingDown()) break;

        const job = jobs[i];

        if (i > 0) {
          await delay(750);
        }

        try {
          const evaluation = await withRetry(
            () => evaluateJob(aiClient, job, email.messageId, systemPrompt),
            {
              maxAttempts: 2,
              baseDelayMs: 2000,
              shouldRetry: isRetryableAIError,
              onRetry: (err, attempt) => {
                console.warn(`    [retry] AI (${aiClient.provider}) attempt ${attempt} for "${job.title}":`, err instanceof Error ? err.message : err);
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
          logError(env.LOG_DIR, `ai-eval:${job.title}`, err);
          incrementErrors();
          bufferError(`AI (${aiClient.provider}): ${job.title}`, message);
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
};
