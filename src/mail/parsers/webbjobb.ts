import * as cheerio from 'cheerio';
import type { ParsedJob } from '../../types/index.js';
import { extractLinks } from '../../utils/links.js';

// Real structure: <div class="link [even]"> containing <strong><a href="tracking.webbjobb.io/...">Title →</a></strong>
// Company is plain text, location in <em>, tags in <span class="tag tag-tech">

export const parseWebbjobbHtml = (html: string, provider: string): ParsedJob[] => {
  const $ = cheerio.load(html);
  const jobs: ParsedJob[] = [];
  const seen = new Set<string>();

  $('div.link').each((_, el) => {
    const $job = $(el);

    const $titleLink = $job.find('strong a').first();
    if (!$titleLink.length) return;

    const title = $titleLink.text().trim().replace(/\s*→\s*$/, '');
    if (!title || title.length < 3) return;

    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const href = $titleLink.attr('href') || '';

    // Location is in <em> tag
    const location = $job.find('em').first().text().trim();

    // Company is text before the <em> tag, after the title
    const $p = $job.find('p').first();
    let company = '';

    if ($p.length) {
      const fullText = $p.text();
      const afterTitle = fullText.substring(fullText.indexOf(title) + title.length);
      const cleaned = afterTitle.replace(/^[\s\u2192→]+/, '');
      const commaMatch = cleaned.match(/^([^,]+),/);
      if (commaMatch) {
        company = commaMatch[1].trim();
      }
    }

    // Tech tags
    const tags: string[] = [];
    $job.find('span.tag-tech, span.tag').each((_, tag) => {
      tags.push($(tag).text().trim());
    });

    const details = [title, company, location, tags.join(', ')].filter(Boolean).join(' - ');

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

// Text-based fallback for when HTML parsing fails
// Format: "Title →\nCompany, City\nTag1 Tag2 Tag3"

export const parseWebbjobbText = (body: string, provider: string): ParsedJob[] => {
  const jobs: ParsedJob[] = [];
  const lines = body.split('\n').map((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].endsWith('→')) continue;

    const title = lines[i].replace(/\s*→\s*$/, '').trim();
    if (!title || title.length < 3) continue;

    const lower = title.toLowerCase();
    if (
      lower.includes('bloggen') ||
      lower.includes('inställningar') ||
      lower.includes('betalnings')
    ) continue;

    let company = '';
    let location = '';
    let tags = '';

    if (i + 1 < lines.length) {
      const companyLine = lines[i + 1];
      const parts = companyLine.split(',');
      if (parts.length >= 2) {
        company = parts[0].trim();
        location = parts.slice(1).join(',').trim();
      }
    }

    if (i + 2 < lines.length) {
      const tagLine = lines[i + 2];
      if (tagLine && !tagLine.endsWith('→') && !tagLine.includes(',')) {
        tags = tagLine;
      }
    }

    const details = [title, company, location, tags].filter(Boolean).join(' - ');
    const links = extractLinks(lines.slice(i, i + 3).join(' '));

    jobs.push({
      title,
      company,
      location,
      provider,
      details,
      links,
    });
  }

  return jobs;
};
