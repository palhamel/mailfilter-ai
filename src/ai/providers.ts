import { Mistral } from '@mistralai/mistralai';
import type { AIClient, EnvConfig } from '../types/index.js';

const BERGET_BASE_URL = 'https://api.berget.ai/v1';

const createMistralProvider = (apiKey: string, model: string): AIClient => {
  const client = new Mistral({ apiKey });

  return {
    provider: 'mistral',
    model,
    async complete(messages) {
      const response = await client.chat.complete({
        model,
        messages,
        temperature: 0,
        responseFormat: { type: 'json_object' },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Empty response from Mistral API');
      }
      return content;
    },
  };
};

const createBergetProvider = (apiKey: string, model: string): AIClient => ({
  provider: 'berget',
  model,
  async complete(messages) {
    const response = await fetch(`${BERGET_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`Berget API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Empty response from Berget API');
    }
    return content;
  },
});

export const createAIClient = (env: EnvConfig): AIClient => {
  switch (env.AI_PROVIDER) {
    case 'berget': {
      if (!env.BERGET_API_KEY) {
        throw new Error('BERGET_API_KEY is required when AI_PROVIDER=berget');
      }
      return createBergetProvider(env.BERGET_API_KEY, env.BERGET_MODEL);
    }
    case 'mistral':
    default:
      return createMistralProvider(env.MISTRAL_API_KEY, env.MISTRAL_MODEL);
  }
};
