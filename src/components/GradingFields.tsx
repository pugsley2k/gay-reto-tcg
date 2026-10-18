'use client';
import {useId} from 'react';
import { GRADERS, emptyGrading, completeGrading, type Grading } from '@/lib/card-grading';
import styles from './GradingFields.module.css';
export default function GradingFields({value,onChange}:{value:Grading|null;onChange:(value:Grading|null)=>void}) {
 const listId=useId();
 const edit=(key:'company'|'grade'|'cert_number',text:string)=>onChange({...value!,[key]:text,confirmed:false});
 return <section className={styles.panel}><label className={styles.check}><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked?emptyGrading():null)}/> Professionally graded / slabbed card</label>{value&&<>
 <p>Photograph the whole slab with the label in focus. These details are read from the label; the scanner does not authenticate the slab or verify its certificate.</p>
 <label>Grading company<input list={listId} maxLength={40} value={value.company} onChange={e=>edit('company',e.target.value)}/></label><datalist id={listId}>{GRADERS.map(company=><option key={company} value={company}/>)}</datalist>
 <label>Printed grade and designation<input maxLength={80} placeholder="e.g. 9, 10 Pristine, 10 Black Label" value={value.grade} onChange={e=>edit('grade',e.target.value)}/></label>
 <label>Certification number<input maxLength={80} autoComplete="off" value={value.cert_number} onChange={e=>edit('cert_number',e.target.value)}/></label>
 <label className={styles.check}><input type="checkbox" checked={value.confirmed} disabled={!completeGrading(value)} onChange={e=>onChange({...value,confirmed:e.target.checked})}/> I checked the company, full grade and certificate number against the slab label and confirmed the listing price</label>
 <p>Your slab photo will be the listing image. Slab grades stay separate from ungraded card condition.</p>
 </>}</section>;
}
