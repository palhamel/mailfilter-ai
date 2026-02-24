import * as cheerio from 'cheerio';
import type { ParsedJob } from '../../types/index.js';

// Structure: <div style="border:1px solid #dddddd"> wraps each job
// Company in first <h3><a>, title in <h3 class="title"><a>
// Location in <p> after pin icon

export const parseDemandoHtml = (html: string, provider: string): ParsedJob[] => {
  const $ = cheerio.load(html);
  const jobs: ParsedJob[] = [];
  const seen = new Set<string>();

  $('h3.title').each((_, el) => {
    const $title = $(el);
    const title = $title.find('a').text().trim() || $title.text().trim();
    if (!title || title.length < 3) return;

    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const href = $title.find('a').attr('href') || '';

    const $container = $title.closest('table, .content-item');
    let company = '';
    let location = '';

    // Find company: an h3 without .title class, before the title h3
    $container.find('h3').each((_, h3) => {
      const $h3 = $(h3);
      if (!$h3.hasClass('title') && !company) {
        company = $h3.find('a').text().trim() || $h3.text().trim();
      }
    });

    // Location is in a <p> that contains the pin icon
    $container.find('p').each((_, p) => {
      const $p = $(p);
      const hasPin = $p.find('img[src*="icon-pin"]').length > 0;
      if (hasPin) {
        location = $p.text().replace(/\s+/g, ' ').trim();
      }
    });

    const details = [title, company, location].filter(Boolean).join(' - ');

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
