import type { JobEmail, ParsedJob } from '../types/index.js';
import { parseLinkedInHtml } from './parsers/linkedin.js';
import { parseWebbjobbHtml, parseWebbjobbText } from './parsers/webbjobb.js';
import { parseIndeedHtml } from './parsers/indeed.js';
import { parseDemandoHtml } from './parsers/demando.js';
import { extractLinks } from '../utils/links.js';

export { extractLinks };

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
 * Check if a string contains a URL with the given domain.
 * Matches the domain exactly (not as a substring of a larger domain).
 * Handles patterns like: https://example.com, //example.com, .example.com
 */
const containsDomain = (text: string, domain: string): boolean => {
  const escaped = domain.replace(/\./g, '\\.');
  const pattern = new RegExp(`(?:^|[/.]|@)${escaped}(?:[/\\s:?#]|$)`);
  return pattern.test(text);
};

/**
 * Check if the sender address is from a specific domain.
 * Matches @domain.com or @subdomain.domain.com patterns.
 */
const senderMatchesDomain = (from: string, domain: string): boolean => {
  const escaped = domain.replace(/\./g, '\\.');
  const pattern = new RegExp(`@(?:[\\w.-]+\\.)?${escaped}\\b`);
  return pattern.test(from);
};

/**
 * Detect which job platform sent the email based on sender and HTML content.
 */
export const detectProvider = (email: JobEmail): string => {
  const from = email.from.toLowerCase();
  const html = email.html.toLowerCase();
  const body = email.body.toLowerCase();

  if (senderMatchesDomain(from, 'linkedin.com') || containsDomain(html, 'linkedin.com')) return 'LinkedIn';
  if (senderMatchesDomain(from, 'indeed.com') || containsDomain(html, 'indeed.com')) return 'Indeed';
  if (senderMatchesDomain(from, 'demando.io') || containsDomain(html, 'demando.io') || containsDomain(html, 'demando.se')) return 'Demando';
  if (senderMatchesDomain(from, 'webbjobb.io') || containsDomain(html, 'webbjobb.io') || containsDomain(body, 'webbjobb.io')) return 'Webbjobb';
  if (senderMatchesDomain(from, 'arbetsformedlingen.se') || containsDomain(html, 'arbetsformedlingen.se')) return 'Arbetsformedlingen';
  if (senderMatchesDomain(from, 'glassdoor.com') || containsDomain(html, 'glassdoor.com')) return 'Glassdoor';

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
