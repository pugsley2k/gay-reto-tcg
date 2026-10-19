import {listingArtwork} from '@/lib/card-artwork';
import {completeGrading,gradingLabel,type Grading} from '@/lib/card-grading';
import styles from './CardArtwork.module.css';

export default function CardArtwork({card,compact=false,lazy=false}:{card:{name:string;image_url?:string|null;grading?:Grading|null};compact?:boolean;lazy?:boolean}) {
  const grading=card.grading;
  const matchedHeader=grading?.company==='GetGraded'&&grading.cert_number==='00744256';
  if(!grading?.confirmed||!completeGrading(grading))return <img src={listingArtwork(card)} alt={`${card.name} — catalogue artwork`} loading={lazy?'lazy':undefined}/>;
  return <span className={`${styles.slab} ${compact?styles.compact:''}`} aria-label={`${card.name}, slabbed card, ${gradingLabel(grading)}. Illustrative holder; view photos for the actual slab.`}>
    <span className={`${styles.label} ${matchedHeader?styles.photoMatchedLabel:''}`}><span><small>GRADED CARD</small><strong>{grading.company}</strong></span><span className={styles.grade}>{grading.grade}</span></span>
    <img className={styles.image} src={listingArtwork(card)} alt={`${card.name} — catalogue artwork inside an illustrative slab frame`} loading={lazy?'lazy':undefined}/>
    <small className={styles.disclaimer}>Illustrative holder · view photos</small>
  </span>;
}
