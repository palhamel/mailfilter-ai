import type { EnvConfig } from '../types/index.js';
import { sendDiscordMessage, type DiscordEmbed } from './discord.js';

// Discord embed colors
const COLOR_GREEN = 0x059669;
const COLOR_RED = 0xdc2626;
const COLOR_YELLOW = 0xd97706;

interface BufferedError {
  context: string;
  message: string;
}

let errorBuffer: BufferedError[] = [];

export const notify = async (
  env: EnvConfig,
  subject: string,
  message: string,
  options?: { color?: number }
): Promise<void> => {
  if (!env.DISCORD_WEBHOOK_URL) return;

  const embed: DiscordEmbed = {
    title: subject,
    description: message,
    color: options?.color ?? COLOR_GREEN,
    timestamp: new Date().toISOString(),
  };

  await sendDiscordMessage(env.DISCORD_WEBHOOK_URL, undefined, [embed]);
};

export const notifyStartup = async (env: EnvConfig): Promise<void> => {
  const model = env.AI_PROVIDER === 'berget' ? env.BERGET_MODEL : env.MISTRAL_MODEL;
  await notify(env, 'JobFilter AI Started', [
    `Provider: ${env.AI_PROVIDER}`,
    `Model: ${model}`,
    `Schedule: every ${env.MAILBOX_CHECK_INTERVAL_MINUTES} minutes`,
    `Notify: ${env.NOTIFY_EMAIL}`,
  ].join('\n'), { color: COLOR_GREEN });
};

export const notifyCritical = async (
  env: EnvConfig,
  subject: string,
  message: string
): Promise<void> => {
  await notify(env, subject, message, { color: COLOR_RED });
};

export const bufferError = (context: string, message: string): void => {
  errorBuffer.push({ context, message });
};

export const flushErrorBuffer = async (env: EnvConfig): Promise<void> => {
  if (errorBuffer.length === 0) return;

  const lines = errorBuffer.map(
    (e) => `**${e.context}**: ${e.message}`
  );

  const message = [
    `${errorBuffer.length} error(s) in this cycle:`,
    '',
    ...lines,
  ].join('\n');

  await notify(env, 'Cycle Errors', message, { color: COLOR_YELLOW });

  errorBuffer = [];
};

export const getErrorBufferLength = (): number => errorBuffer.length;

export const clearErrorBuffer = (): void => {
  errorBuffer = [];
};
