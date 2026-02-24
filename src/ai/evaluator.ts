import { Mistral } from '@mistralai/mistralai';
import { z } from 'zod';
import type { EnvConfig, ParsedJob, JobEvaluation } from '../types/index.js';
import { buildJobPrompt } from './prompt.js';

const evaluationSchema = z.object({
  score: z.number().int().min(1).max(5),
  category: z.string(),
  title: z.string(),
  company: z.string(),
  reasoning: z.string(),
});

export const parseEvaluationResponse = (
  content: string
): z.infer<typeof evaluationSchema> => {
  // Strip markdown code fences if present
  const cleaned = content
    .replace(/^```json?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  return evaluationSchema.parse(parsed);
};

export const evaluateJob = async (
  env: EnvConfig,
  job: ParsedJob,
  messageId: string,
  systemPrompt: string
): Promise<JobEvaluation> => {
  const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });

  const response = await client.chat.complete({
    model: env.MISTRAL_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: buildJobPrompt({
          title: job.title,
          company: job.company,
          location: job.location,
          details: job.details,
        }),
      },
    ],
    temperature: 0,
    responseFormat: { type: 'json_object' },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Empty response from Mistral API');
  }

  const result = parseEvaluationResponse(content);

  return {
    messageId,
    score: result.score as JobEvaluation['score'],
    category: result.category,
    title: result.title,
    company: result.company,
    location: job.location,
    provider: job.provider,
    reasoning: result.reasoning,
    links: job.links,
    evaluatedAt: new Date(),
  };
};
