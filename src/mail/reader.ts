import Imap from 'imap';
import { simpleParser } from 'mailparser';
import type { EnvConfig, JobEmail } from '../types/index.js';
import { extractLinks } from '../utils/links.js';

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

const IMAP_TIMEOUT_MS = 60_000;

export const fetchUnreadEmails = (env: EnvConfig): Promise<JobEmail[]> => {
  let imapRef: Imap | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const imapPromise = new Promise<JobEmail[]>((resolve, reject) => {
    const imap = new Imap(createImapConfig(env));
    imapRef = imap;
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

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (imapRef) {
        try {
          // Remove the once('error') listener before destroy() so the error
          // event it emits doesn't become unhandled (which would throw and
          // trigger uncaughtException → process.exit).
          imapRef.removeAllListeners('error');
          imapRef.on('error', () => {});
          imapRef.destroy();
        } catch { /* ignore */ }
      }
      reject(new Error(`IMAP timeout after ${IMAP_TIMEOUT_MS / 1000}s`));
    }, IMAP_TIMEOUT_MS);
  });

  // Attach finally to the race result so the timer is always cleared and
  // the cleanup promise is properly chained (avoids unhandled rejection).
  return Promise.race([imapPromise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
};

export const deleteOldEmails = (env: EnvConfig, retentionDays: number): Promise<number> => {
  let imapRef: Imap | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const imapPromise = new Promise<number>((resolve, reject) => {
    const imap = new Imap(createImapConfig(env));
    imapRef = imap;

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);

        imap.search([['BEFORE', cutoff]], (searchErr, results) => {
          if (searchErr) {
            imap.end();
            return reject(searchErr);
          }

          if (!results.length) {
            imap.end();
            return resolve(0);
          }

          imap.addFlags(results, '\\Deleted', (flagErr) => {
            if (flagErr) {
              imap.end();
              return reject(flagErr);
            }

            imap.expunge((expungeErr) => {
              imap.end();
              if (expungeErr) return reject(expungeErr);
              resolve(results.length);
            });
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (imapRef) {
        try {
          imapRef.removeAllListeners('error');
          imapRef.on('error', () => {});
          imapRef.destroy();
        } catch { /* ignore */ }
      }
      reject(new Error(`IMAP cleanup timeout after ${IMAP_TIMEOUT_MS / 1000}s`));
    }, IMAP_TIMEOUT_MS);
  });

  return Promise.race([imapPromise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
};
