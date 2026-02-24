import { z } from 'zod';
import type { EnvConfig } from '../types/index.js';

const envSchema = z.object({
  MAIL_USER: z.email({ error: 'MAIL_USER must be a valid email' }),
  MAIL_PASSWORD: z.string().min(1, { error: 'MAIL_PASSWORD is required' }),
  IMAP_HOST: z.string().min(1, { error: 'IMAP_HOST is required' }),
  SMTP_HOST: z.string().min(1, { error: 'SMTP_HOST is required' }),
  NOTIFY_EMAIL: z.email({ error: 'NOTIFY_EMAIL must be a valid email' }),
  MISTRAL_API_KEY: z.string().min(1, { error: 'MISTRAL_API_KEY is required' }),
  MISTRAL_MODEL: z.string().min(1).default('mistral-small-latest'),
  MAILBOX_CHECK_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(15),
  LOG_DIR: z.string().min(1, { error: 'LOG_DIR is required' }).default('./data/logs'),
  DISCORD_WEBHOOK_URL: z.url().optional(),
  HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PROFILE_PATH: z.string().min(1, { error: 'PROFILE_PATH is required' }),
});

export const loadEnv = (): EnvConfig => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Environment validation failed:\n${errors}`);
    process.exit(1);
  }

  return result.data;
};
