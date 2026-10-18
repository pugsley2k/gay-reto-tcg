export const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC', 'ACE', 'TAG', 'GetGraded', 'Other'] as const;
export type Grading = { company: string; grade: string; cert_number: string; confirmed: boolean };
export const emptyGrading = (): Grading => ({ company: '', grade: '', cert_number: '', confirmed: false });
export function readGrading(input: unknown): Grading | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const text = (key: string, limit: number) => typeof value[key] === 'string' ? (value[key] as string).trim().slice(0, limit) : '';
  return { company: text('company', 40), grade: text('grade', 80), cert_number: text('cert_number', 80), confirmed: value.confirmed === true };
}
export function completeGrading(value: Grading | null) {
  return !!value && !!value.company && !!value.grade && /^[A-Za-z0-9 -]{3,80}$/.test(value.cert_number);
}
export function gradingLabel(value: Grading | null | undefined) { return value ? `${value.company} ${value.grade}`.trim() : ''; }
// Descriptive condition words do not change a numeric grade. Preserve special
// designations and qualifiers (Pristine, Black Label, OC, +, etc.).
export function pricingGrade(value:string){return value.normalize('NFKC').toLowerCase().replace(/\b(?:excellent|very good|good|poor|fair|near mint|gem mint|mint|gem|nm|ex|vg)\b/g,'').replace(/\s+/g,'').trim();}
