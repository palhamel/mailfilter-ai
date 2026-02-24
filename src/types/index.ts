export interface JobEmail {
  messageId: string;
  from: string;
  subject: string;
  body: string;
  html: string;
  receivedAt: Date;
  links: string[];
}

export interface ParsedJob {
  title: string;
  company: string;
  location: string;
  provider: string;
  details: string;
  links: string[];
}

export interface JobEvaluation {
  messageId: string;
  score: 1 | 2 | 3 | 4 | 5;
  category: string;
  title: string;
  company: string;
  location: string;
  provider: string;
  reasoning: string;
  links: string[];
  evaluatedAt: Date;
}

export interface ErrorLogEntry {
  timestamp: string;
  context: string;
  message: string;
  stack?: string;
}

export interface EnvConfig {
  MAIL_USER: string;
  MAIL_PASSWORD: string;
  IMAP_HOST: string;
  SMTP_HOST: string;
  NOTIFY_EMAIL: string;
  MISTRAL_API_KEY: string;
  MISTRAL_MODEL: string;
  MAILBOX_CHECK_INTERVAL_MINUTES: number;
  LOG_DIR: string;
  DISCORD_WEBHOOK_URL?: string;
  HEALTH_PORT: number;
  PROFILE_PATH: string;
}
