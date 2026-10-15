'use client';
import { useEffect, useRef, useState } from 'react';
import { prepareCardPhoto } from '@/lib/card-photo';
import { parseConditionAssessment, type ConditionAssessment } from '@/lib/condition-assessment';
import styles from './ConditionSuggestion.module.css';

export default function ConditionSuggestion({ front, disabled, onConfirm, onInvalidate, onBusy, onBackPhoto }: {
  front: File; disabled: boolean; onConfirm: (condition: string) => void; onInvalidate: () => void; onBusy: (busy: boolean) => void;
  onBackPhoto?: (photo:File|null)=>void;
}) {
  const [back, setBack] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [assessment, setAssessment] = useState<ConditionAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const gallery = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const working = useRef(false);
  useEffect(() => {
    if (!back) { setPreview(''); return; }
    const url = URL.createObjectURL(back); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [back]);
  useEffect(() => () => request.current?.abort(), []);
  async function choose(photo?: File) {
    if (!photo || disabled || working.current) return;
    working.current = true; setLoading(true); onBusy(true);
    setBack(null); onBackPhoto?.(null); setAssessment(null); setConfirmed(false); setError(''); onInvalidate();
    try { const prepared=await prepareCardPhoto(photo, 2 * 1024 * 1024);setBack(prepared);onBackPhoto?.(prepared); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not prepare the back photo.'); }
    finally { working.current = false; setLoading(false); onBusy(false); }
  }
  async function assess() {
    if (!back || disabled || working.current) return;
    working.current = true; setLoading(true); onBusy(true); onInvalidate();
    setAssessment(null); setConfirmed(false); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const body = new FormData(); body.append('front', await prepareCardPhoto(front, 2 * 1024 * 1024)); body.append('back', back);
      const response = await fetch('/api/card-condition', { method: 'POST', body, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not suggest a condition. Choose one manually or retry.');
      setAssessment(parseConditionAssessment(data));
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Condition assessment failed.'); }
    finally { working.current = false; setLoading(false); onBusy(false); }
  }
  return <section className={styles.panel} aria-label="AI condition suggestion">
    <h3>Suggest condition from both sides</h3>
    <p>Add the back of this same card. Remove sleeves and show all four corners in good light. Your front scan and back photo go to OpenAI for assessment. When you save, both actual-card photos are included for buyers to inspect.</p>
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
    <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
    {preview && <img src={preview} alt="Back photo for condition review" width={90} height={126} />}
    <div className={styles.actions}>
      <button type="button" disabled={disabled || loading} onClick={() => camera.current?.click()}>{back ? 'Retake back photo' : 'Photograph the back'}</button>
      <button type="button" disabled={disabled || loading} onClick={() => gallery.current?.click()}>{back ? 'Replace back photo' : 'Choose back photo'}</button>
      {back && <button type="button" disabled={disabled || loading} onClick={() => void assess()}>{loading ? 'Checking both sides…' : 'Suggest condition'}</button>}
    </div>
    {loading && <p role="status">Preparing photos or checking visible wear…</p>}
    {error && <p role="alert">{error}</p>}
    {assessment && <div className={styles.result} aria-live="polite">
      <h4>{assessment.condition ? `Suggested: ${assessment.condition}` : 'No reliable suggestion'}</h4>
      <p>Photo confidence: {assessment.confidence}. This is a suggestion, not a professional grade. Inspect the physical card before confirming.</p>
      {assessment.observations.length > 0 && <><strong>Visible wear</strong><ul>{assessment.observations.map((note, i) => <li key={i}>{note}</li>)}</ul></>}
      {assessment.limitations.length > 0 && <><strong>Uncertainty</strong><ul>{assessment.limitations.map((note, i) => <li key={i}>{note}</li>)}</ul></>}
      {assessment.retake_reason && <p>{assessment.retake_reason}</p>}
      {assessment.condition && <button type="button" disabled={disabled || loading} onClick={() => { onConfirm(assessment.condition!); setConfirmed(true); }}>Confirm suggested condition</button>}
      {confirmed && <p role="status">Suggestion applied below. You can change it before saving.</p>}
    </div>}
  </section>;
}
