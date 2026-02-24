import { describe, it, expect } from 'vitest';
import { formatDigestEmail } from '../sender.js';
import type { JobEmail, JobEvaluation } from '../../types/index.js';

describe('formatDigestEmail', () => {
  const mockEmail: JobEmail = {
    messageId: 'msg-123',
    from: 'LinkedIn <jobs-noreply@linkedin.com>',
    subject: 'Your job alert for Back End-utvecklare',
    body: 'Multiple jobs...',
    html: '',
    receivedAt: new Date('2026-02-20T09:00:00Z'),
    links: [],
  };

  const mockEvaluations: JobEvaluation[] = [
    {
      messageId: 'msg-123',
      score: 4,
      category: '🟢',
      title: 'Fullstack Developer',
      company: 'ClimateView',
      location: 'Stockholm (Hybrid)',
      provider: 'LinkedIn',
      reasoning: 'Climate-tech with AI focus, small team.',
      links: ['https://linkedin.com/jobs/123'],
      evaluatedAt: new Date('2026-02-20T10:00:00Z'),
    },
    {
      messageId: 'msg-123',
      score: 2,
      category: '',
      title: 'Backend Developer',
      company: 'BigCorp',
      location: 'Stockholm (On-site)',
      provider: 'LinkedIn',
      reasoning: 'Large org, no autonomy.',
      links: ['https://linkedin.com/jobs/456'],
      evaluatedAt: new Date('2026-02-20T10:01:00Z'),
    },
    {
      messageId: 'msg-123',
      score: 3,
      category: '🟡',
      title: 'Senior Engineer',
      company: 'Spotify',
      location: 'Stockholm',
      provider: 'LinkedIn',
      reasoning: 'Interesting but large org.',
      links: [],
      evaluatedAt: new Date('2026-02-20T10:02:00Z'),
    },
  ];

  it('should sort jobs by score (highest first)', () => {
    const { html } = formatDigestEmail(mockEvaluations, mockEmail);
    const climatePos = html.indexOf('ClimateView');
    const spotifyPos = html.indexOf('Spotify');
    const bigcorpPos = html.indexOf('BigCorp');

    expect(climatePos).toBeLessThan(spotifyPos);
    expect(spotifyPos).toBeLessThan(bigcorpPos);
  });

  it('should separate highlighted jobs from the rest', () => {
    const { html } = formatDigestEmail(mockEvaluations, mockEmail);

    expect(html).toContain('Worth checking out');
    expect(html).toContain('Skipped');
  });

  it('should include job count in subject', () => {
    const { subject } = formatDigestEmail(mockEvaluations, mockEmail);

    expect(subject).toContain('3 jobs');
  });

  it('should not include emojis in subject', () => {
    const { subject } = formatDigestEmail(mockEvaluations, mockEmail);

    expect(subject).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
    expect(subject).toMatch(/^JobFilter/);
  });

  it('should include top score in subject', () => {
    const { subject } = formatDigestEmail(mockEvaluations, mockEmail);

    expect(subject).toContain('top match 4/5');
  });

  it('should format single job subject with title and company', () => {
    const singleEval = [mockEvaluations[0]];
    const { subject } = formatDigestEmail(singleEval, mockEmail);

    expect(subject).toContain('Fullstack Developer');
    expect(subject).toContain('ClimateView');
    expect(subject).toContain('4/5');
    expect(subject).not.toContain('jobs');
  });

  it('should render highlighted job links as clickable HTML', () => {
    const { html } = formatDigestEmail(mockEvaluations, mockEmail);

    expect(html).toContain('href="https://linkedin.com/jobs/123"');
    expect(html).toContain('>Fullstack Developer</a>');
  });

  it('should render low-rated job links as clickable HTML', () => {
    const { html } = formatDigestEmail(mockEvaluations, mockEmail);

    const skippedSection = html.split('Skipped')[1];
    expect(skippedSection).toContain('href="https://linkedin.com/jobs/456"');
    expect(skippedSection).toContain('>Backend Developer</a>');
    expect(skippedSection).toContain('BigCorp');
    expect(skippedSection).toContain('Large org, no autonomy.');
  });

  it('should link provider name to root URL', () => {
    const { html } = formatDigestEmail(mockEvaluations, mockEmail);

    expect(html).toContain('href="https://www.linkedin.com/jobs/"');
    expect(html).toContain('>LinkedIn</a>');
  });

  it('should hide company when it is unknown', () => {
    const evalsWithUnknown: JobEvaluation[] = [{
      ...mockEvaluations[0],
      company: 'unknown',
    }];

    const { html } = formatDigestEmail(evalsWithUnknown, mockEmail);
    expect(html).not.toContain('>unknown<');
    expect(html).not.toContain('(unknown)');
  });

  it('should show source in footer', () => {
    const { html } = formatDigestEmail(mockEvaluations, mockEmail);

    expect(html).toContain('Source: LinkedIn');
  });

  it('should not contain emoji categories in email body', () => {
    const { html } = formatDigestEmail(mockEvaluations, mockEmail);

    expect(html).not.toContain('🟢');
    expect(html).not.toContain('🟡');
  });

  it('should color-code scores in highlighted section', () => {
    const { html } = formatDigestEmail(mockEvaluations, mockEmail);

    // Score 4 should be green
    expect(html).toContain('color:#16a34a');
    // Score 3 should be yellow
    expect(html).toContain('color:#eab308');
  });
});
