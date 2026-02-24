import { delay } from './delay.js';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  const { maxAttempts, baseDelayMs, shouldRetry, onRetry } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt) {
        throw error;
      }

      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      onRetry?.(error, attempt);

      const backoffMs = baseDelayMs * Math.pow(2, attempt - 1);
      await delay(backoffMs);
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error('withRetry: unexpected state');
};
