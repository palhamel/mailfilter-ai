import * as cheerio from 'cheerio';
import type { ParsedJob } from '../../types/index.js';

const extractLinkedInJobUrl = (href: string): string | null => {
  const match = href.match(/linkedin\.com\/comm\/jobs\/view\/(\d+)/);
  if (match) {
    return `https://www.linkedin.com/jobs/view/${match[1]}/`;
  }
  return null;
};

export const parseLinkedInHtml = (html: string, provider: string): ParsedJob[] => {
  const $ = cheerio.load(html);
  const jobMap = new Map<string, ParsedJob>();

  $('a[href*="/jobs/view/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const jobUrl = extractLinkedInJobUrl(href);
    if (!jobUrl) return;

    const jobIdMatch = href.match(/jobs\/view\/(\d+)/);
    if (!jobIdMatch) return;
    const jobId = jobIdMatch[1];

    if (jobMap.has(jobId)) return;

    // Only use title links (font-bold class), skip wrapper links that contain everything
    const isTitleLink = $el.hasClass('font-bold') ||
      $el.closest('td').find('a').length <= 1;

    if (!isTitleLink) return;

    const linkText = $el.text().trim();

    if (!linkText || linkText.length < 3) return;

    const lower = linkText.toLowerCase();
    if (
      lower === 'see all jobs' ||
      lower === 'easy apply' ||
      lower.includes('view job') ||
      lower.includes('linkedin')
    ) return;

    // Go up to the job card container that holds both title and company info
    const jobCard = $el.closest('[data-test-id="job-card"]').length
      ? $el.closest('[data-test-id="job-card"]')
      : $el.closest('table').closest('td, div');
    let company = '';
    let location = '';

    // Find the paragraph with middot separator (company · location)
    jobCard.find('p').each((_, p) => {
      const pText = $(p).text().trim();
      const dotMatch = pText.match(/^([^·]+)\s*·\s*(.+)$/);
      if (dotMatch && !company) {
        company = dotMatch[1].trim();
        location = dotMatch[2].trim()
          .replace(/\s+(Easy Apply|Actively recruiting|\d+ school alum\w*|\d+ connection\w*|Fast growing).*/i, '')
          .trim();
      }
    });

    jobMap.set(jobId, {
      title: linkText,
      company,
      location,
      provider,
      details: [linkText, company, location].filter(Boolean).join(' - '),
      links: [jobUrl],
    });
  });

  return [...jobMap.values()];
};
