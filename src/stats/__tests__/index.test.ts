import { describe, it, expect, beforeEach } from 'vitest';
import {
  incrementCycles,
  setCycleDuration,
  incrementEmailsProcessed,
  incrementJobsEvaluated,
  incrementSkipped,
  incrementErrors,
  getStats,
  resetStats,
  formatStatsLog,
} from '../index.js';

describe('stats', () => {
  beforeEach(() => {
    resetStats();
  });

  it('should start with zero counters', () => {
    const stats = getStats();
    expect(stats.totalCycles).toBe(0);
    expect(stats.totalEmailsProcessed).toBe(0);
    expect(stats.totalJobsEvaluated).toBe(0);
    expect(stats.totalSkipped).toBe(0);
    expect(stats.totalErrors).toBe(0);
    expect(stats.lastCycleAt).toBeNull();
    expect(stats.lastCycleDurationMs).toBeNull();
  });

  it('should increment counters', () => {
    incrementCycles();
    incrementEmailsProcessed(3);
    incrementJobsEvaluated(5);
    incrementSkipped(2);
    incrementErrors();

    const stats = getStats();
    expect(stats.totalCycles).toBe(1);
    expect(stats.totalEmailsProcessed).toBe(3);
    expect(stats.totalJobsEvaluated).toBe(5);
    expect(stats.totalSkipped).toBe(2);
    expect(stats.totalErrors).toBe(1);
    expect(stats.lastCycleAt).toBeTruthy();
  });

  it('should set cycle duration', () => {
    setCycleDuration(1234);
    const stats = getStats();
    expect(stats.lastCycleDurationMs).toBe(1234);
  });

  it('should format stats log', () => {
    incrementCycles();
    incrementEmailsProcessed(2);
    incrementJobsEvaluated(4);
    incrementSkipped(1);
    incrementErrors();
    setCycleDuration(3500);

    const log = formatStatsLog();
    expect(log).toContain('cycle=1');
    expect(log).toContain('emails=2');
    expect(log).toContain('evaluated=4');
    expect(log).toContain('skipped=1');
    expect(log).toContain('errors=1');
    expect(log).toContain('duration=3.5s');
  });

  it('should show n/a for duration when not set', () => {
    incrementCycles();
    const log = formatStatsLog();
    expect(log).toContain('duration=n/a');
  });

  it('should reset all stats', () => {
    incrementCycles();
    incrementEmailsProcessed(5);
    incrementErrors(3);
    setCycleDuration(1000);

    resetStats();

    const stats = getStats();
    expect(stats.totalCycles).toBe(0);
    expect(stats.totalEmailsProcessed).toBe(0);
    expect(stats.totalErrors).toBe(0);
    expect(stats.lastCycleDurationMs).toBeNull();
  });
});
