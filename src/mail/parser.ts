import type { JobEmail, ParsedJob } from '../types/index.js';
import { parseLinkedInHtml } from './parsers/linkedin.js';
import { parseWebbjobbHtml, parseWebbjobbText } from './parsers/webbjobb.js';
import { parseIndeedHtml } from './parsers/indeed.js';
import { parseDemandoHtml } from './parsers/demando.js';

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

export const extractLinks = (text: string): string[] => {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return [...new Set(matches)];
};

export const parseEmailContent = (raw: {
  messageId?: string;
  from?: string;
  subject?: string;
  body?: string;
  html?: string;
  date?: Date;
}): JobEmail => {
  const body = raw.body || '';

  return {
    messageId: raw.messageId || `unknown-${Date.now()}`,
    from: raw.from || 'unknown',
    subject: raw.subject || '(no subject)',
    body,
    html: raw.html || '',
    receivedAt: raw.date || new Date(),
    links: extractLinks(body),
  };
};

/**
 * Detect which job platform sent the email based on sender and HTML content.
 */
export const detectProvider = (email: JobEmail): string => {
  const from = email.from.toLowerCase();
  const html = email.html.toLowerCase();
  const body = email.body.toLowerCase();

  if (from.includes('linkedin') || html.includes('linkedin.com/comm/jobs')) return 'LinkedIn';
  if (from.includes('indeed') || from.includes('jobalert.indeed') || html.includes('indeed.com')) return 'Indeed';
  if (from.includes('demando') || html.includes('demando.io') || html.includes('demando.se')) return 'Demando';
  if (from.includes('webbjobb') || html.includes('webbjobb.io') || body.includes('webbjobb.io')) return 'Webbjobb';
  if (from.includes('arbetsformedlingen') || html.includes('arbetsformedlingen.se')) return 'Arbetsformedlingen';
  if (from.includes('glassdoor') || html.includes('glassdoor.com')) return 'Glassdoor';

  return 'Unknown';
};

/**
 * Parse a job digest email into individual job entries.
 * Routes to provider-specific parsers based on detected provider.
 */
export const parseJobDigest = (email: JobEmail): ParsedJob[] => {
  const provider = detectProvider(email);

  console.log(`  [parser] provider=${provider} from="${email.from}" subject="${email.subject}"`);

  if (email.html) {
    let jobs: ParsedJob[] = [];

    if (provider === 'LinkedIn') {
      jobs = parseLinkedInHtml(email.html, provider);
    } else if (provider === 'Webbjobb') {
      jobs = parseWebbjobbHtml(email.html, provider);
    } else if (provider === 'Indeed') {
      jobs = parseIndeedHtml(email.html, provider);
    } else if (provider === 'Demando') {
      jobs = parseDemandoHtml(email.html, provider);
    }

    console.log(`  [parser] HTML parse -> ${jobs.length} job(s)`);
    if (jobs.length > 0) return jobs;
  }

  // Text-based fallback for Webbjobb
  if (provider === 'Webbjobb' && email.body) {
    const jobs = parseWebbjobbText(email.body, provider);
    console.log(`  [parser] text fallback -> ${jobs.length} job(s)`);
    if (jobs.length > 0) return jobs;
  }

  console.log(`  [parser] fallback -> single job`);

  // Final fallback: treat the whole email as one job
  return [{
    title: email.subject,
    company: 'unknown',
    location: '',
    provider,
    details: email.body,
    links: email.links,
  }];
};
