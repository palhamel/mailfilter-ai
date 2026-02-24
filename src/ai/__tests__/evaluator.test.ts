import { describe, it, expect } from 'vitest';
import { parseEvaluationResponse } from '../evaluator.js';

describe('parseEvaluationResponse', () => {
  it('should parse valid JSON response', () => {
    const response = JSON.stringify({
      score: 4,
      category: '🟢',
      title: 'Fullstack Developer',
      company: 'ClimateView',
      reasoning: 'Strong match with climate-tech focus and TypeScript stack.',
    });

    const result = parseEvaluationResponse(response);

    expect(result.score).toBe(4);
    expect(result.category).toBe('🟢');
    expect(result.title).toBe('Fullstack Developer');
    expect(result.company).toBe('ClimateView');
    expect(result.reasoning).toContain('climate-tech');
  });

  it('should handle markdown code fences', () => {
    const response = '```json\n{"score":3,"category":"🟡","title":"Backend Dev","company":"Acme","reasoning":"Partial match."}\n```';

    const result = parseEvaluationResponse(response);

    expect(result.score).toBe(3);
    expect(result.title).toBe('Backend Dev');
  });

  it('should reject score outside 1-5 range', () => {
    const response = JSON.stringify({
      score: 6,
      category: '🟢',
      title: 'Dev',
      company: 'Corp',
      reasoning: 'test',
    });

    expect(() => parseEvaluationResponse(response)).toThrow();
  });

  it('should reject score of 0', () => {
    const response = JSON.stringify({
      score: 0,
      category: '🔴',
      title: 'Dev',
      company: 'Corp',
      reasoning: 'test',
    });

    expect(() => parseEvaluationResponse(response)).toThrow();
  });

  it('should reject missing required fields', () => {
    const response = JSON.stringify({
      score: 4,
      category: '🟢',
    });

    expect(() => parseEvaluationResponse(response)).toThrow();
  });

  it('should reject invalid JSON', () => {
    expect(() => parseEvaluationResponse('not json')).toThrow();
  });
});
