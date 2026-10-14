import { isCardCondition } from './card-condition';

export type ConditionAssessment = {
  condition: string | null;
  confidence: 'low' | 'medium' | 'high';
  observations: string[];
  limitations: string[];
  retake_reason: string | null;
};
export function parseConditionAssessment(value: unknown): ConditionAssessment {
  if (!value || typeof value !== 'object') throw new Error('Invalid condition response.');
  const data = value as Record<string, unknown>;
  if (data.condition !== null && !isCardCondition(data.condition)) throw new Error('Invalid condition response.');
  if (!['low', 'medium', 'high'].includes(String(data.confidence))) throw new Error('Invalid condition response.');
  function notes(key: string) {
    const values = data[key];
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) throw new Error('Invalid condition response.');
    return values.slice(0, 6).map(v => v.trim().slice(0, 300)).filter(Boolean);
  }
  if (data.retake_reason !== null && typeof data.retake_reason !== 'string') throw new Error('Invalid condition response.');
  const retake = typeof data.retake_reason === 'string' ? data.retake_reason.trim().slice(0, 300) || null : null;
  return {
    condition: data.confidence === 'low' || retake ? null : data.condition as string | null,
    confidence: data.confidence as ConditionAssessment['confidence'],
    observations: notes('observations'), limitations: notes('limitations'), retake_reason: retake,
  };
}
