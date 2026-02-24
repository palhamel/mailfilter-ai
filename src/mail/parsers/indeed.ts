import * as cheerio from 'cheerio';
import type { ParsedJob } from '../../types/index.js';

// Structure: <td class="pb-24"> wraps each job
// Title in <h2><a class="strong-text-link">
// Company in first <td> after title row (first td only, avoids rating numbers)
// Location in next <td>

export const parseIndeedHtml = (html: string, provider: string): ParsedJob[] => {
  const $ = cheerio.load(html);
  const jobs: ParsedJob[] = [];
  const seen = new Set<string>();

  $('td.pb-24').each((_, el) => {
    const $job = $(el);

    const $titleLink = $job.find('h2 a').first();
    if (!$titleLink.length) return;

    const title = $titleLink.text().trim();
    if (!title || title.length < 3) return;

    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const href = $job.find('a').first().attr('href') || '';

    const rows = $job.find('table[role="presentation"] > tbody > tr, table[role="presentation"] tr');
    let company = '';
    let location = '';
    let description = '';

    rows.each((_, row) => {
      const $row = $(row);
      const $firstTd = $row.find('td').first();
      const style = $firstTd.attr('style') || '';
      const text = $firstTd.text().trim();

      if (!company && !$row.find('h2').length && style.includes('font-size:14px') && !style.includes('color:#767676')) {
        if (text && text.length > 1 && text.length < 100) {
          company = text;
        }
      } else if (company && !location && style.includes('font-size:14px') && !style.includes('color:#767676')) {
        location = text;
      } else if (style.includes('color:#767676') && style.includes('font-size:14px')) {
        description = text;
      }
    });

    const details = [title, company, location, description].filter(Boolean).join(' - ');

    jobs.push({
      title,
      company,
      location,
      provider,
      details,
      links: href ? [href] : [],
    });
  });

  return jobs;
};
