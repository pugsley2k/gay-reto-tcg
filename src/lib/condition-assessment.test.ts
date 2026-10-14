import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConditionAssessment } from './condition-assessment';
const suggestion = { condition: 'Lightly Played', confidence: 'medium', observations: ['Minor whitening on the back edge.'], limitations: ['Fine surface scratches may not be visible.'], retake_reason: null };
test('a supported photo-based suggestion keeps its evidence and uncertainties', () => {
  assert.deepEqual(parseConditionAssessment(suggestion), suggestion);
});
test('low confidence or a retake request cannot produce an applicable condition', () => {
  assert.equal(parseConditionAssessment({ ...suggestion, confidence: 'low' }).condition, null);
  assert.equal(parseConditionAssessment({ ...suggestion, retake_reason: 'Both images show the front.' }).condition, null);
  assert.equal(parseConditionAssessment({ ...suggestion, condition: null }).condition, null);
});
test('malformed responses and professional or unsupported grades are rejected', () => {
  for (const value of [null, {}, { ...suggestion, condition: 'PSA 10' }, { ...suggestion, confidence: '100%' }, { ...suggestion, observations: 'Mint' }, { ...suggestion, limitations: [null] }]) assert.throws(() => parseConditionAssessment(value));
});
test('model notes are bounded before they reach the review interface', () => {
  const result = parseConditionAssessment({ ...suggestion, observations: Array(20).fill('x'.repeat(1000)) });
  assert.equal(result.observations.length, 6);
  assert.equal(result.observations[0].length, 300);
});
