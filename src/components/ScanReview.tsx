import type {ScanNotes} from '@/lib/scan-notes';
import styles from './ScanReview.module.css';
export default function ScanReview({notes,illustrator}:{notes:ScanNotes|null;illustrator?:string|null}){
 if(!notes&&!illustrator)return null;
 return <section className={styles.review} aria-label="What the scan found"><h3>What the scan found</h3>
 <dl>{notes?.release_year&&<div><dt>Year on slab label</dt><dd>{notes.release_year}</dd></div>}{notes?.label_set&&<div><dt>Set on slab label</dt><dd>{notes.label_set}</dd></div>}{illustrator&&<div><dt>Illustrator · catalogue</dt><dd>{illustrator}</dd></div>}</dl>
 {!!notes?.observations.length&&<ul>{notes.observations.map(note=><li key={note}>{note}</li>)}</ul>}
 {!!notes?.warnings.length&&<div className={styles.warning}><strong>Needs checking</strong><ul>{notes.warnings.map(note=><li key={note}>{note}</li>)}</ul></div>}
 </section>;
}
