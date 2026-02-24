import nodemailer from 'nodemailer';
import type { EnvConfig, JobEmail, JobEvaluation } from '../types/index.js';

export const createTransport = (env: EnvConfig) => {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
      user: env.MAIL_USER,
      pass: env.MAIL_PASSWORD,
    },
    connectionTimeout: 30_000,
    socketTimeout: 30_000,
  });
};

const HIGHLIGHT_THRESHOLD = 3;

const PROVIDER_URLS: Record<string, string> = {
  LinkedIn: 'https://www.linkedin.com/jobs/',
  Indeed: 'https://se.indeed.com/',
  Webbjobb: 'https://webbjobb.io/',
  Demando: 'https://demando.se/',
  Arbetsformedlingen: 'https://arbetsformedlingen.se/',
  Glassdoor: 'https://www.glassdoor.com/',
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const formatJobLink = (title: string, links: string[]): string => {
  if (links.length > 0) {
    return `<a href="${escapeHtml(links[0])}" style="color:#1a73e8;text-decoration:none;">${escapeHtml(title)}</a>`;
  }
  return escapeHtml(title);
};

const formatProviderLink = (provider: string): string => {
  const url = PROVIDER_URLS[provider];
  if (url) {
    return `<a href="${url}" style="color:#1a73e8;text-decoration:none;">${escapeHtml(provider)}</a>`;
  }
  return escapeHtml(provider);
};

const formatDate = (date: Date): string => {
  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCompanyLine = (ev: JobEvaluation): string => {
  const parts: string[] = [];
  if (ev.company && ev.company !== 'unknown') parts.push(escapeHtml(ev.company));
  if (ev.location) parts.push(escapeHtml(ev.location));
  return parts.join(' &middot; ');
};

const getScoreColor = (score: number): string => {
  if (score >= 4) return '#16a34a';
  if (score === 3) return '#eab308';
  return '#9ca3af';
};

export const formatDigestEmail = (
  evaluations: JobEvaluation[],
  original: JobEmail
): { subject: string; html: string } => {
  const sorted = [...evaluations].sort((a, b) => b.score - a.score);
  const highlighted = sorted.filter((e) => e.score >= HIGHLIGHT_THRESHOLD);
  const rest = sorted.filter((e) => e.score < HIGHLIGHT_THRESHOLD);

  const topScore = sorted[0]?.score || 0;
  const provider = evaluations[0]?.provider || 'Unknown';
  const jobCount = evaluations.length;

  const subject =
    jobCount === 1
      ? `JobFilter – ${sorted[0].title}${sorted[0].company && sorted[0].company !== 'unknown' ? ` at ${sorted[0].company}` : ''} – ${topScore}/5`
      : `JobFilter – ${jobCount} jobs – top match ${topScore}/5`;

  const parts: string[] = [];

  parts.push(`
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="padding:20px 0;border-bottom:2px solid #e5e7eb;">
        <div style="font-size:18px;font-weight:600;margin:0 0 8px;">Job Filter Results</div>
        <div style="font-size:13px;color:#6b7280;">
          ${jobCount} job${jobCount !== 1 ? 's' : ''} from ${formatProviderLink(provider)} &middot; ${formatDate(new Date())}
        </div>
        <div style="font-size:12px;color:#9ca3af;margin-top:4px;">
          Original: ${escapeHtml(original.subject)}
        </div>
      </div>
  `);

  if (highlighted.length > 0) {
    parts.push(`
      <div style="margin-top:20px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#374151;font-weight:600;margin-bottom:12px;">
          Worth checking out
        </div>
    `);

    for (const ev of highlighted) {
      const companyLine = formatCompanyLine(ev);
      const scoreColor = getScoreColor(ev.score);
      parts.push(`
        <div style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
          <div>
            <span style="font-size:14px;font-weight:700;color:${scoreColor};">${ev.score}/5</span>
            <span style="font-size:14px;font-weight:500;margin-left:8px;">${formatJobLink(ev.title, ev.links)}</span>
          </div>
          ${companyLine ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">${companyLine}</div>` : ''}
          <div style="font-size:13px;color:#4b5563;margin-top:4px;">
            ${escapeHtml(ev.reasoning)}
          </div>
        </div>
      `);
    }

    parts.push(`</div>`);
  }

  if (rest.length > 0) {
    parts.push(`
      <div style="margin-top:20px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;margin-bottom:12px;">
          Skipped
        </div>
        <div style="font-size:13px;color:#6b7280;">
    `);

    for (const ev of rest) {
      const company = ev.company && ev.company !== 'unknown' ? ev.company : '';
      parts.push(`
        <div style="padding:4px 0;">
          <span style="font-weight:600;">${ev.score}/5</span> – ${formatJobLink(ev.title, ev.links)}${company ? ` <span style="color:#9ca3af;">(${escapeHtml(company)})</span>` : ''} <span style="color:#9ca3af;font-style:italic;">– ${escapeHtml(ev.reasoning)}</span>
        </div>
      `);
    }

    parts.push(`</div></div>`);
  }

  parts.push(`
      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;">
        Processed ${formatDate(new Date())} &middot; Source: ${escapeHtml(provider)}
      </div>
    </div>
  `);

  return { subject, html: parts.join('\n') };
};

export const sendDigestResultEmail = async (
  env: EnvConfig,
  evaluations: JobEvaluation[],
  original: JobEmail
): Promise<void> => {
  const transport = createTransport(env);
  const { subject, html } = formatDigestEmail(evaluations, original);

  await transport.sendMail({
    from: env.MAIL_USER,
    to: env.NOTIFY_EMAIL,
    subject,
    html,
  });
};
