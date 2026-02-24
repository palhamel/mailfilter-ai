import { readFileSync } from 'node:fs';

const SYSTEM_INSTRUCTIONS = `You are an expert at matching job opportunities against a candidate profile.

The candidate's full profile is provided below. Use it to evaluate job listings.

## Instructions

You receive ONE job listing at a time. Evaluate it against the profile.

IMPORTANT:
- A fullstack role with TypeScript/React/Node.js is ALWAYS at least 3 points, unless it violates deal-breakers or blacklisted industries.
- If the role REQUIRES a tech stack the candidate explicitly marks as "NOT my tech stack" = automatic 1 point.
- If the role REQUIRES Python as primary language and the candidate lists it as limited = max 2 points. If Python is secondary, evaluate normally.
- Blacklisted industries listed in the profile = always 1 point.
- NEVER guess a company's industry from its name. Evaluate based on what the company actually does.
- Use the matching keywords from the profile to identify relevant roles.

Respond ONLY with JSON, nothing else.`;

export const loadSystemPrompt = (profilePath: string): string => {
  let content: string;

  try {
    content = readFileSync(profilePath, 'utf-8');
  } catch {
    throw new Error(`Failed to read profile file: ${profilePath}`);
  }

  if (!content.trim()) {
    throw new Error(`Profile file is empty: ${profilePath}`);
  }

  return `${SYSTEM_INSTRUCTIONS}\n\n## Candidate Profile\n\n${content}`;
};

export const buildJobPrompt = (job: {
  title: string;
  company: string;
  location: string;
  details: string;
}): string => {
  return `Evaluate this job listing. Respond ONLY with JSON.

Role: ${job.title}
Company: ${job.company}
Location: ${job.location}
Details: ${job.details}

Respond with:
{
  "score": 1-5,
  "category": "🟢" or "🟡" or "",
  "title": "job title",
  "company": "company name",
  "reasoning": "1-2 sentences explaining the score"
}

Scoring:
5 = Perfect match - apply immediately
4 = Strong match - worth checking out
3 = Interesting but missing something
2 = Weak match
1 = Irrelevant or wrong tech stack or blacklisted industry

Category:
🟢 = score 4-5
🟡 = score 3
"" (empty string) = score 1-2`;
};
