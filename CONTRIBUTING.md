# Contributing to MailFilter AI

Thanks for your interest in contributing. Here's how to get started.

## Setup

```bash
git clone https://github.com/palhamel/mailfilter-ai.git
cd mailfilter-ai
npm install
cp .env.example .env
cp profile.example.md profile.md
```

Fill in `.env` with your credentials and run `npm run dev` to start the server locally.

## Development workflow

1. Fork the repo and create a feature branch (`git checkout -b feature/my-feature`)
2. Make your changes
3. Run the full check suite before committing:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

4. Commit using [conventional commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `docs:`)
5. Open a pull request against `main`

## Adding a new email provider

1. Create `src/mail/parsers/provider-name.ts` exporting a parse function
2. Add detection rule in `detectProvider()` in `src/mail/parser.ts`
3. Add routing in `parseJobDigest()` in `src/mail/parser.ts`
4. Add tests in `src/mail/__tests__/parser.test.ts`

## Adding a new AI provider

Any OpenAI-compatible provider can be added with a small adapter in `src/ai/providers.ts`. The adapter implements the `AIClient` interface (defined in `src/types/index.ts`) and returns a string from `complete(messages)`.

## Code style

- TypeScript strict mode, ESM imports
- Arrow functions, `const` by default
- 2-space indentation
- No emojis in source code

## Tests

Tests use [Vitest](https://vitest.dev/). Run `npm test` to execute the full suite. New features should include tests.

## Issues and questions

Open an issue on GitHub for bugs, feature requests, or questions.
