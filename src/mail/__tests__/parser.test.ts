import { describe, it, expect } from 'vitest';
import { extractLinks, parseEmailContent, parseJobDigest, detectProvider } from '../parser.js';
import type { JobEmail } from '../../types/index.js';

describe('extractLinks', () => {
  it('should extract URLs from text', () => {
    const text = 'Check out https://example.com and http://test.org/path?q=1';
    const links = extractLinks(text);

    expect(links).toEqual([
      'https://example.com',
      'http://test.org/path?q=1',
    ]);
  });

  it('should return empty array when no URLs found', () => {
    const links = extractLinks('No links here');
    expect(links).toEqual([]);
  });

  it('should deduplicate URLs', () => {
    const text = 'Visit https://example.com and https://example.com again';
    const links = extractLinks(text);

    expect(links).toEqual(['https://example.com']);
  });

  it('should handle empty string', () => {
    expect(extractLinks('')).toEqual([]);
  });
});

describe('parseEmailContent', () => {
  it('should parse complete email data', () => {
    const date = new Date('2026-02-20T10:00:00Z');
    const result = parseEmailContent({
      messageId: 'msg-123',
      from: 'recruiter@company.com',
      subject: 'Fullstack Developer Position',
      body: 'We have an opening at https://jobs.company.com/123',
      html: '<p>We have an opening</p>',
      date,
    });

    expect(result.messageId).toBe('msg-123');
    expect(result.from).toBe('recruiter@company.com');
    expect(result.subject).toBe('Fullstack Developer Position');
    expect(result.body).toContain('We have an opening');
    expect(result.html).toContain('<p>');
    expect(result.receivedAt).toEqual(date);
    expect(result.links).toEqual(['https://jobs.company.com/123']);
  });

  it('should use defaults for missing fields', () => {
    const result = parseEmailContent({});

    expect(result.messageId).toMatch(/^unknown-/);
    expect(result.from).toBe('unknown');
    expect(result.subject).toBe('(no subject)');
    expect(result.body).toBe('');
    expect(result.html).toBe('');
    expect(result.links).toEqual([]);
    expect(result.receivedAt).toBeInstanceOf(Date);
  });
});

describe('detectProvider', () => {
  const makeEmail = (from: string, html = '', body = ''): JobEmail => ({
    messageId: 'msg-1',
    from,
    subject: '',
    body,
    html,
    receivedAt: new Date(),
    links: [],
  });

  it('should detect LinkedIn', () => {
    expect(detectProvider(makeEmail('jobs-noreply@linkedin.com'))).toBe('LinkedIn');
  });

  it('should detect Indeed from sender', () => {
    expect(detectProvider(makeEmail('donotreply@jobalert.indeed.com'))).toBe('Indeed');
  });

  it('should detect Webbjobb from sender', () => {
    expect(detectProvider(makeEmail('robot@mail.webbjobb.io'))).toBe('Webbjobb');
  });

  it('should detect Webbjobb from HTML', () => {
    expect(detectProvider(makeEmail('noreply@mail.com', '<a href="https://webbjobb.io/jobb/123">Job</a>'))).toBe('Webbjobb');
  });

  it('should detect Demando from sender', () => {
    expect(detectProvider(makeEmail('reply@demando.io'))).toBe('Demando');
  });

  it('should detect Demando from HTML', () => {
    expect(detectProvider(makeEmail('noreply@mail.com', '<a href="https://demando.se/jobs">Job</a>'))).toBe('Demando');
  });

  it('should return Unknown for unrecognized sender', () => {
    expect(detectProvider(makeEmail('random@company.com'))).toBe('Unknown');
  });
});

describe('parseJobDigest - LinkedIn', () => {
  const createEmail = (html: string): JobEmail => ({
    messageId: 'msg-digest-1',
    from: 'LinkedIn <jobs-noreply@linkedin.com>',
    subject: 'Your job alert for Back End-utvecklare',
    body: '',
    html,
    receivedAt: new Date('2026-02-20T10:00:00Z'),
    links: [],
  });

  it('should parse LinkedIn job links from HTML', () => {
    const html = `
      <table>
        <tr>
          <td>
            <a href="https://www.linkedin.com/comm/jobs/view/1234567/?trackingId=abc">Backend Developer</a>
            <span>AVTECH Sweden &middot; Stockholm (Hybrid)</span>
          </td>
        </tr>
        <tr>
          <td>
            <a href="https://www.linkedin.com/comm/jobs/view/7654321/?trackingId=xyz">Senior Backend Engineer</a>
            <span>Spotify &middot; Stockholm</span>
          </td>
        </tr>
      </table>
    `;

    const jobs = parseJobDigest(createEmail(html));

    expect(jobs.length).toBe(2);
    expect(jobs[0].title).toBe('Backend Developer');
    expect(jobs[0].links[0]).toBe('https://www.linkedin.com/jobs/view/1234567/');
    expect(jobs[1].title).toBe('Senior Backend Engineer');
    expect(jobs[1].links[0]).toBe('https://www.linkedin.com/jobs/view/7654321/');
  });

  it('should deduplicate jobs by job ID', () => {
    const html = `
      <div>
        <a href="https://www.linkedin.com/comm/jobs/view/1234567/?trackingId=logo">Backend Developer</a>
        <a href="https://www.linkedin.com/comm/jobs/view/1234567/?trackingId=title">Backend Developer</a>
      </div>
    `;

    const jobs = parseJobDigest(createEmail(html));
    expect(jobs.length).toBe(1);
  });

  it('should skip non-job links like See all jobs', () => {
    const html = `
      <div>
        <a href="https://www.linkedin.com/comm/jobs/view/1234567/">Backend Developer</a>
        <a href="https://www.linkedin.com/comm/jobs/search">See all jobs</a>
      </div>
    `;

    const jobs = parseJobDigest(createEmail(html));
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('Backend Developer');
  });

  it('should generate clean LinkedIn job URLs', () => {
    const html = `
      <a href="https://www.linkedin.com/comm/jobs/view/9999999/?trackingId=abc123&refId=xyz&trk=eml-some-tracking">Cool Job</a>
    `;

    const jobs = parseJobDigest(createEmail(html));
    expect(jobs[0].links[0]).toBe('https://www.linkedin.com/jobs/view/9999999/');
  });

  it('should fall back to whole email when no HTML', () => {
    const email: JobEmail = {
      messageId: 'msg-1',
      from: 'test@test.com',
      subject: 'Single job email',
      body: 'We have a role for you',
      html: '',
      receivedAt: new Date(),
      links: ['https://example.com/job'],
    };

    const jobs = parseJobDigest(email);
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('Single job email');
  });
});

describe('parseJobDigest - Webbjobb HTML', () => {
  const createEmail = (html: string): JobEmail => ({
    messageId: 'msg-wj-html',
    from: 'Webbjobb.io <robot@mail.webbjobb.io>',
    subject: 'Veckans jobb',
    body: '',
    html,
    receivedAt: new Date('2026-02-20T10:00:00Z'),
    links: [],
  });

  it('should parse Webbjobb HTML with div.link containers', () => {
    const html = `
      <div class="link even" style="background-color: #f8f8f8;">
        <p>
          <strong>
            <a href="http://tracking.webbjobb.io/f/a/abc123">Senior Backend Developer \u2192</a>
          </strong>
          <br/>
          Avaron AB, <em style="color: #919093;">Stockholm</em>
          <br/>
          <span class="tag tag-tech">C#</span>
          <span class="tag tag-tech">Javascript</span>
        </p>
      </div>
      <div class="link" style="background-color: #fff;">
        <p>
          <strong>
            <a href="http://tracking.webbjobb.io/f/a/def456">ServiceNow Developer \u2192</a>
          </strong>
          <br/>
          Avaron AB, <em style="color: #919093;">Stockholm</em>
          <br/>
          <span class="tag tag-tech">CSS</span>
          <span class="tag tag-tech">HTML</span>
        </p>
      </div>
    `;

    const jobs = parseJobDigest(createEmail(html));

    expect(jobs.length).toBe(2);
    expect(jobs[0].title).toBe('Senior Backend Developer');
    expect(jobs[0].company).toBe('Avaron AB');
    expect(jobs[0].location).toBe('Stockholm');
    expect(jobs[0].provider).toBe('Webbjobb');
    expect(jobs[0].links[0]).toContain('tracking.webbjobb.io');
    expect(jobs[1].title).toBe('ServiceNow Developer');
  });

  it('should extract tech tags into details', () => {
    const html = `
      <div class="link">
        <p>
          <strong><a href="http://tracking.webbjobb.io/f/a/x">Fullstack Dev \u2192</a></strong>
          <br/>
          Acme, <em>Stockholm</em>
          <br/>
          <span class="tag tag-tech">React.js</span>
          <span class="tag tag-tech">Node.js</span>
        </p>
      </div>
    `;

    const jobs = parseJobDigest(createEmail(html));
    expect(jobs[0].details).toContain('React.js');
    expect(jobs[0].details).toContain('Node.js');
  });
});

describe('parseJobDigest - Webbjobb text fallback', () => {
  it('should parse Webbjobb text format with arrow pattern', () => {
    const email: JobEmail = {
      messageId: 'msg-wj-1',
      from: 'Webbjobb.io <info@webbjobb.io>',
      subject: 'Veckans jobb',
      body: [
        'Hej!',
        'Vi har hittat nya jobb.',
        'Veckans jobb',
        'Senior Dynamics 365 CE och Power Platform Developer \u2192',
        'Avaron AB, Stockholm',
        'C# Javascript React.js Azure',
        '',
        'ServiceNow Developer \u2192',
        'Avaron AB, Stockholm',
        'CSS Javascript HTML UI',
        '',
        'Fullstackutvecklare med fokus p\u00e5 Java backend \u2192',
        'Avaron AB, Stockholm',
        'Java React.js Vue.js',
        '',
        'Senast fr\u00e5n bloggen',
        'Nytt betalningsystem \u2013 och nu med Apple Pay! \u2192',
      ].join('\n'),
      html: '',
      receivedAt: new Date('2026-02-20T10:00:00Z'),
      links: [],
    };

    const jobs = parseJobDigest(email);

    expect(jobs.length).toBe(3);
    expect(jobs[0].title).toBe('Senior Dynamics 365 CE och Power Platform Developer');
    expect(jobs[0].company).toBe('Avaron AB');
    expect(jobs[0].location).toBe('Stockholm');
    expect(jobs[0].provider).toBe('Webbjobb');
    expect(jobs[1].title).toBe('ServiceNow Developer');
    expect(jobs[2].title).toContain('Fullstackutvecklare');
  });

  it('should skip non-job arrow lines like blog posts', () => {
    const email: JobEmail = {
      messageId: 'msg-wj-2',
      from: 'Webbjobb.io <info@webbjobb.io>',
      subject: 'Veckans jobb',
      body: [
        'Backend Developer \u2192',
        'Acme Corp, Stockholm',
        'Node.js TypeScript',
        '',
        'Nytt betalningsystem \u2013 och nu med Apple Pay! \u2192',
        '\u00c4ndra inst\u00e4llningar \u2192',
      ].join('\n'),
      html: '',
      receivedAt: new Date(),
      links: [],
    };

    const jobs = parseJobDigest(email);
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('Backend Developer');
  });
});

describe('parseJobDigest - Indeed', () => {
  const createEmail = (html: string): JobEmail => ({
    messageId: 'msg-indeed-1',
    from: 'Indeed <donotreply@jobalert.indeed.com>',
    subject: 'Junior Frontend Developer + 7 nya jobb',
    body: '',
    html,
    receivedAt: new Date('2026-02-20T10:00:00Z'),
    links: [],
  });

  it('should parse Indeed job cards from HTML', () => {
    const html = `
      <table>
        <tr>
          <td class="pb-24" style="padding:0 0 32px">
            <a href="https://se.indeed.com/rc/clk/dl?jk=da7a0ace1767a198&from=ja" style="display:block;text-decoration:none">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <h2><a href="https://se.indeed.com/rc/clk/dl?jk=da7a0ace1767a198" class="strong-text-link">Junior Frontend Developer</a></h2>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation">
                      <tr>
                        <td style="padding:0 12px 0 0;color:#2d2d2d;font-size:14px;line-height:21px">GRIXX FOOD AB</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="color:#2d2d2d;font-size:14px;line-height:21px">Stockholm</td>
                </tr>
                <tr>
                  <td style="padding:0;color:#767676;font-size:14px;line-height:21px">Som Junior Frontend Developer kommer du att arbeta med utveckling.</td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
        <tr>
          <td class="pb-24" style="padding:0 0 32px">
            <a href="https://se.indeed.com/rc/clk/dl?jk=fb5a69847449c067&from=ja" style="display:block;text-decoration:none">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <h2><a href="https://se.indeed.com/rc/clk/dl?jk=fb5a69847449c067" class="strong-text-link">Frontend utvecklare till Svea Banks designsystem</a></h2>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation">
                      <tr>
                        <td style="padding:0 12px 0 0;color:#2d2d2d;font-size:14px;line-height:21px">Svea Bank</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="color:#2d2d2d;font-size:14px;line-height:21px">Solna</td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
      </table>
    `;

    const jobs = parseJobDigest(createEmail(html));

    expect(jobs.length).toBe(2);
    expect(jobs[0].title).toBe('Junior Frontend Developer');
    expect(jobs[0].company).toBe('GRIXX FOOD AB');
    expect(jobs[0].location).toBe('Stockholm');
    expect(jobs[0].provider).toBe('Indeed');
    expect(jobs[1].title).toBe('Frontend utvecklare till Svea Banks designsystem');
    expect(jobs[1].company).toBe('Svea Bank');
    expect(jobs[1].location).toBe('Solna');
  });
});

describe('parseJobDigest - Demando', () => {
  const createEmail = (html: string): JobEmail => ({
    messageId: 'msg-demando-1',
    from: 'Demando <reply@demando.io>',
    subject: 'New jobs matching your preferences',
    body: '',
    html,
    receivedAt: new Date('2026-02-20T10:00:00Z'),
    links: [],
  });

  it('should parse Demando job cards from HTML', () => {
    const html = `
      <div style="border:1px solid #dddddd; border-radius: 8px;">
        <table role="presentation" width="100%">
          <tr>
            <td class="content-item" style="padding: 32px 16px">
              <table role="presentation" width="100%">
                <tr><td><img src="https://demando.imgix.net/company/abc" width="50" /></td></tr>
                <tr>
                  <td>
                    <h3><a href="http://url1441.demando.io/ls/click?upn=abc123">Exopen</a></h3>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h3 class="title"><a href="http://url1441.demando.io/ls/click?upn=def456">Full Stack Engineer</a></h3>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>
                      <img src="https://demando.se/assets/images/icon-pin.png" width="16" />
                      &nbsp;Fully remote, Stockholm (Full-time)
                    </p>
                    <p>
                      <img src="https://demando.se/assets/images/icon-money.png" width="16" />
                      &nbsp;50 000 - 80 000 SEK per month
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const jobs = parseJobDigest(createEmail(html));

    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('Full Stack Engineer');
    expect(jobs[0].company).toBe('Exopen');
    expect(jobs[0].provider).toBe('Demando');
    expect(jobs[0].location).toContain('Stockholm');
    expect(jobs[0].links[0]).toContain('demando.io');
  });
});
