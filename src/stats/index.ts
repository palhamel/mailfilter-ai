interface RunStats {
  startedAt: string;
  totalCycles: number;
  totalEmailsProcessed: number;
  totalJobsEvaluated: number;
  totalSkipped: number;
  totalErrors: number;
  lastCycleAt: string | null;
  lastCycleDurationMs: number | null;
}

const stats: RunStats = {
  startedAt: new Date().toISOString(),
  totalCycles: 0,
  totalEmailsProcessed: 0,
  totalJobsEvaluated: 0,
  totalSkipped: 0,
  totalErrors: 0,
  lastCycleAt: null,
  lastCycleDurationMs: null,
};

export const incrementCycles = (): void => {
  stats.totalCycles++;
  stats.lastCycleAt = new Date().toISOString();
};

export const setCycleDuration = (ms: number): void => {
  stats.lastCycleDurationMs = ms;
};

export const incrementEmailsProcessed = (count: number = 1): void => {
  stats.totalEmailsProcessed += count;
};

export const incrementJobsEvaluated = (count: number = 1): void => {
  stats.totalJobsEvaluated += count;
};

export const incrementSkipped = (count: number = 1): void => {
  stats.totalSkipped += count;
};

export const incrementErrors = (count: number = 1): void => {
  stats.totalErrors += count;
};

export const getStats = (): Readonly<RunStats> => stats;

export const resetStats = (): void => {
  stats.startedAt = new Date().toISOString();
  stats.totalCycles = 0;
  stats.totalEmailsProcessed = 0;
  stats.totalJobsEvaluated = 0;
  stats.totalSkipped = 0;
  stats.totalErrors = 0;
  stats.lastCycleAt = null;
  stats.lastCycleDurationMs = null;
};

export const formatStatsLog = (): string => {
  const durationStr = stats.lastCycleDurationMs !== null
    ? `${(stats.lastCycleDurationMs / 1000).toFixed(1)}s`
    : 'n/a';

  return [
    `[stats] cycle=${stats.totalCycles}`,
    `emails=${stats.totalEmailsProcessed}`,
    `evaluated=${stats.totalJobsEvaluated}`,
    `skipped=${stats.totalSkipped}`,
    `errors=${stats.totalErrors}`,
    `duration=${durationStr}`,
  ].join(' ');
};
