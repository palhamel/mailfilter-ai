import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendDiscordMessage } from '../discord.js';

describe('sendDiscordMessage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should POST to webhook URL with content', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 204 })
    );

    await sendDiscordMessage('https://discord.com/api/webhooks/test', 'hello');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.content).toBe('hello');
  });

  it('should POST with embeds', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const embeds = [{
      title: 'Test',
      description: 'A test embed',
      color: 0x00ff00,
      timestamp: '2026-01-01T00:00:00Z',
    }];

    await sendDiscordMessage('https://discord.com/api/webhooks/test', undefined, embeds);

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.content).toBeUndefined();
    expect(body.embeds).toHaveLength(1);
    expect(body.embeds[0].title).toBe('Test');
  });

  it('should not throw on fetch failure', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('network error'));

    await expect(
      sendDiscordMessage('https://discord.com/api/webhooks/test', 'hello')
    ).resolves.toBeUndefined();
  });

  it('should not throw on non-ok response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, { status: 400, statusText: 'Bad Request' })
    );

    await expect(
      sendDiscordMessage('https://discord.com/api/webhooks/test', 'hello')
    ).resolves.toBeUndefined();
  });
});
