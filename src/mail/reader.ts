import Imap from 'imap';
import { simpleParser } from 'mailparser';
import type { EnvConfig, JobEmail } from '../types/index.js';
import { extractLinks } from './parser.js';

export const createImapConfig = (env: EnvConfig): Imap.Config => ({
  user: env.MAIL_USER,
  password: env.MAIL_PASSWORD,
  host: env.IMAP_HOST,
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  authTimeout: 15000,
  connTimeout: 15000,
});

export const fetchUnreadEmails = (env: EnvConfig): Promise<JobEmail[]> => {
  return new Promise((resolve, reject) => {
    const imap = new Imap(createImapConfig(env));
    const emails: JobEmail[] = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.search(['UNSEEN'], (searchErr, results) => {
          if (searchErr) {
            imap.end();
            return reject(searchErr);
          }

          if (!results.length) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results, { bodies: '', markSeen: true });
          const parsePromises: Promise<void>[] = [];

          fetch.on('message', (msg) => {
            let buffer = '';

            msg.on('body', (stream) => {
              stream.on('data', (chunk: Buffer) => {
                buffer += chunk.toString('utf8');
              });
            });

            msg.once('end', () => {
              const p = simpleParser(buffer)
                .then((parsed) => {
                  const body = parsed.text || '';
                  const html = typeof parsed.html === 'string' ? parsed.html : '';
                  emails.push({
                    messageId: parsed.messageId || `unknown-${Date.now()}`,
                    from: parsed.from?.text || 'unknown',
                    subject: parsed.subject || '(no subject)',
                    body,
                    html,
                    receivedAt: parsed.date || new Date(),
                    links: extractLinks(body),
                  });
                })
                .catch((parseErr) => {
                  console.error('Failed to parse email:', parseErr);
                });
              parsePromises.push(p);
            });
          });

          fetch.once('error', (fetchErr) => {
            imap.end();
            reject(fetchErr);
          });

          fetch.once('end', () => {
            // Wait for all simpleParser calls to finish before resolving.
            // Resolve before imap.end() since some servers (Dovecot)
            // don't reliably fire the imap 'end' event after LOGOUT.
            Promise.all(parsePromises).then(() => {
              resolve(emails);
              imap.end();
            });
          });
        });
      });
    });

    imap.once('error', reject);

    imap.connect();
  });
};
