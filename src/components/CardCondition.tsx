'use client';
import { useId } from 'react';
import { CARD_CONDITIONS } from '@/lib/card-condition';
import styles from './CardCondition.module.css';

export default function CardCondition({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  return <fieldset className={styles.group} disabled={disabled} aria-describedby={`${id}-help`}>
    <legend>Card condition</legend>
    <p id={`${id}-help`}>Check the front, back, edges and surface in good light. Catalogue artwork does not show your card’s wear. These are selling descriptions, not a professional grade.</p>
    <div className={styles.options}>{CARD_CONDITIONS.map(condition => <label className={styles.option} key={condition.value}>
      <input type="radio" name={id} value={condition.value} checked={value === condition.value} required onChange={() => onChange(condition.value)} />
      <span><strong>{condition.value}</strong><small>{condition.description}</small></span>
    </label>)}</div>
  </fieldset>;
}
