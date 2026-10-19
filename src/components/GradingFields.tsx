'use client';
import {useId,useState} from 'react';
import CertificateCheck from './CertificateCheck';
import SlabHeaderColours from './SlabHeaderColours';
import type {CertIdentity} from '@/lib/cert-record';
import { GRADERS, emptyGrading, completeGrading, type Grading } from '@/lib/card-grading';
import styles from './GradingFields.module.css';
export default function GradingFields({value,onChange,card,photo}:{value:Grading|null;onChange:(value:Grading|null)=>void;card:CertIdentity;photo?:File|null}) {
 const listId=useId();
 const identity=JSON.stringify([card.name,card.number,card.set,value?.company,value?.grade,value?.cert_number]);
 const [mismatch,setMismatch]=useState('');
 const edit=(key:'company'|'grade'|'cert_number',text:string)=>onChange({...value!,[key]:text,confirmed:false});
 return <section className={styles.panel}><label className={styles.check}><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked?emptyGrading():null)}/> Professionally graded / slabbed card</label>{value&&<>
 <p>Photograph the whole slab with the label in focus. Check its official certificate record below. A matching record does not authenticate the physical slab.</p>
 <label>Grading company<input list={listId} maxLength={40} value={value.company} onChange={e=>edit('company',e.target.value)}/></label><datalist id={listId}>{GRADERS.map(company=><option key={company} value={company}/>)}</datalist>
 <label>Printed grade and designation<input maxLength={80} placeholder="e.g. 9, 10 Pristine, 10 Black Label" value={value.grade} onChange={e=>edit('grade',e.target.value)}/></label>
 <label>Certification number<input maxLength={80} autoComplete="off" value={value.cert_number} onChange={e=>edit('cert_number',e.target.value)}/></label>
 <CertificateCheck key={identity} grading={value} card={card} onChecked={blocked=>{setMismatch(blocked?identity:'');if(blocked)onChange({...value,confirmed:false});}}/>
 <SlabHeaderColours photo={photo} value={value.header_style} onChange={header_style=>onChange({...value,header_style,confirmed:false})}/>
 <label className={styles.check}><input type="checkbox" checked={value.confirmed} disabled={!completeGrading(value)||mismatch===identity} onChange={e=>onChange({...value,confirmed:e.target.checked})}/> I checked the company, full grade and certificate number against the slab label and confirmed the listing price</label>
 {mismatch===identity&&<p role="alert">Resolve the certificate mismatch before confirming these details.</p>}
 <p>The illustrated holder uses these colours where catalogue artwork is available. View photos shows the actual slab. Slab grades stay separate from ungraded card condition.</p>
 </>}</section>;
}
