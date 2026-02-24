import { z } from 'zod';
import type { AIClient, ParsedJob, JobEvaluation } from '../types/index.js';
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
  client: AIClient,
  job: ParsedJob,
  messageId: string,
  systemPrompt: string
): Promise<JobEvaluation> => {
  const content = await client.complete([
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
  ]);

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
