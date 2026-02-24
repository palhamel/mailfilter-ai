# MailFilter AI

AI-powered email filter. Reads digest emails from multiple platforms via IMAP, scores each listing against your personal profile using Mistral AI, and sends you a sorted summary email with the best matches on top.

## How it works

```
Incoming digest emails (LinkedIn, Indeed, etc.)
    |
    v
IMAP: fetch unread emails
    |
    v
Detect provider -> route to HTML parser
    |
    v
Extract individual listings
    |
    v
Mistral AI: score each listing (1-5) against your profile
    |
    v
SMTP: send sorted result email
    |
    v
Log to JSON, repeat on cron schedule
```

1. **Read** - Connects to your mail server via IMAP and fetches unread emails
2. **Detect** - Identifies the email provider (LinkedIn, Indeed, etc.); skips unknown senders
3. **Parse** - Routes to provider-specific HTML parsers to extract individual listings
4. **Evaluate** - Sends each listing to Mistral AI for scoring against your profile
5. **Send** - Sends a result email with listings sorted by score (best matches first)
6. **Log** - Writes evaluations and errors to daily JSON log files
7. **Repeat** - Runs on a configurable cron schedule (default: every 15 minutes)

## Prerequisites

- **Node.js 24** or later
- **Mistral AI API key** ([console.mistral.ai](https://console.mistral.ai))
- **IMAP/SMTP email account** (any provider that supports password auth)
- Digest emails forwarded to that account

## Quick start

```bash
# Clone
git clone https://github.com/palhamel/mailfilter-ai.git
cd mailfilter-ai

# Install
npm install

# Configure
cp .env.example .env
cp profile.example.md profile.md

# Edit .env with your mail credentials and Mistral API key
# Edit profile.md with your preferences

# Run
npm run dev
```

## Profile

The profile is a markdown file that defines what you're looking for. It's loaded at startup and used as the AI system prompt for scoring. See [`profile.example.md`](profile.example.md) for the expected format.

Your profile should include:
- **Tech stack** - Languages, frameworks, and tools you work with
- **Interesting listings** - Types of opportunities you're looking for
- **Deal-breakers** - Things that make a listing irrelevant (automatic low score)
- **Blacklisted industries** - Industries you're not interested in (automatic 1 point)
- **Preferences** - Work format, team size, location preferences
- **Matching keywords** - Terms that commonly appear in relevant listings

Set `PROFILE_PATH` in your `.env` to point to your profile file (e.g. `./profile.md`).

## Scoring system

| Score | Category | Meaning |
|-------|----------|---------|
| 5 | Green | Perfect match - act immediately |
| 4 | Green | Strong match - worth checking out |
| 3 | Yellow | Interesting but missing something |
| 2 | *(none)* | Weak match |
| 1 | *(none)* | Irrelevant or wrong fit |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAIL_USER` | Yes | - | Email address for IMAP/SMTP auth |
| `MAIL_PASSWORD` | Yes | - | Password for IMAP/SMTP auth |
| `IMAP_HOST` | Yes | - | IMAP server hostname (e.g. `mail.provider.com`) |
| `SMTP_HOST` | Yes | - | SMTP server hostname (e.g. `mail.provider.com`) |
| `NOTIFY_EMAIL` | Yes | - | Email address to receive result digests |
| `PROFILE_PATH` | Yes | - | Path to your profile markdown file |
| `MISTRAL_API_KEY` | Yes | - | Mistral AI API key |
| `MISTRAL_MODEL` | No | `mistral-small-latest` | Mistral model to use |
| `MAILBOX_CHECK_INTERVAL_MINUTES` | No | `15` | Minutes between mailbox checks |
| `LOG_DIR` | No | `./data/logs` | Directory for JSON log files |
| `DISCORD_WEBHOOK_URL` | No | - | Discord webhook for error/status notifications |
| `HEALTH_PORT` | No | `3000` | HTTP health endpoint port |

## Supported email providers

Each provider has a dedicated HTML parser in `src/mail/parsers/`:

| Provider | Detection |
|----------|-----------|
| **LinkedIn** | Sender contains `linkedin` |
| **Webbjobb** | Sender contains `webbjobb` |
| **Indeed** | Sender contains `indeed` |
| **Demando** | Sender contains `demando` |

Emails from unrecognized providers are skipped and logged.

### Adding a new provider

1. Create `src/mail/parsers/provider-name.ts` exporting a parse function
2. Add detection rule in `detectProvider()` in `parser.ts`
3. Add routing in the digest parser in `parser.ts`
4. Add tests in `src/mail/__tests__/parser.test.ts`

## Docker

```bash
docker build -t mailfilter-ai .
docker run \
  --env-file .env \
  -v ./profile.md:/app/profile.md:ro \
  --restart unless-stopped \
  mailfilter-ai
```

The image uses a multi-stage build with non-root user and a built-in HEALTHCHECK. Mount your profile file into the container with `-v`.

## Scripts

```bash
npm run dev         # Run with tsx (loads .env automatically)
npm run build       # Compile TypeScript
npm start           # Run compiled output
npm test            # Run tests (vitest)
npm run lint        # ESLint with TypeScript rules
npm run typecheck   # Type check without emitting
```

## Project structure

```
src/
  index.ts              # Entry point, cron scheduler, pipeline orchestration
  config/
    env.ts              # Zod environment validation
  ai/
    evaluator.ts        # Mistral API integration
    prompt.ts           # System prompt builder (loads profile from PROFILE_PATH)
  mail/
    reader.ts           # IMAP: fetch unread emails
    parser.ts           # Provider detection, routing to parsers
    sender.ts           # SMTP: send result digest emails
    parsers/            # Provider-specific HTML parsers
  logger/
    index.ts            # JSON file logging (evaluations + errors + rotation)
  health/
    index.ts            # Health file writer
    check.ts            # Docker HEALTHCHECK script
  http/
    server.ts           # HTTP health endpoint (native node:http)
  notifications/
    discord.ts          # Discord webhook (native fetch)
    index.ts            # Error buffering and flush
  stats/
    index.ts            # In-memory run statistics
  utils/
    retry.ts            # Generic retry with exponential backoff
    delay.ts            # Simple sleep utility
  types/
    index.ts            # Shared TypeScript interfaces
```

## Robustness

- **IMAP retry** - 3 attempts with exponential backoff
- **Mistral retry** - 2 attempts per evaluation, retries on 429/500/503
- **Rate limiting** - 750ms delay between AI evaluations
- **Graceful shutdown** - SIGTERM/SIGINT stop cron, wait for in-flight work, notify Discord
- **Error logging** - Errors written to daily JSON log files
- **Log rotation** - Logs older than 30 days deleted on startup
- **Discord notifications** - Startup, shutdown, critical failures, batched errors
- **Health check** - Docker HEALTHCHECK + HTTP endpoint for external monitoring
- **Crash handlers** - uncaughtException/unhandledRejection logged and notified

## Tech stack

- **Runtime:** Node.js 24 LTS, TypeScript (strict, ESM)
- **Email:** IMAP (`imap` + `mailparser`), SMTP (`nodemailer`)
- **AI:** Mistral AI (`@mistralai/mistralai`), deterministic scoring (`temperature: 0`)
- **Parsing:** Cheerio for HTML email parsing
- **Validation:** Zod for environment config
- **Scheduling:** node-cron
- **Testing:** Vitest
- **CI:** GitHub Actions (lint, typecheck, test, build, audit)

## License

MIT
