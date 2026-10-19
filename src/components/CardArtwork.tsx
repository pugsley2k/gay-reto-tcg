import {listingArtwork} from '@/lib/card-artwork';
import {completeGrading,gradingLabel,type Grading} from '@/lib/card-grading';
import styles from './CardArtwork.module.css';
import {slabPresentation} from '@/lib/slab-presentation';

export default function CardArtwork({card,compact=false,lazy=false}:{card:{name:string;image_url?:string|null;grading?:Grading|null};compact?:boolean;lazy?:boolean}) {
  const grading=card.grading;
  const header=slabPresentation(grading)?.header;
  if(!grading?.confirmed||!completeGrading(grading))return <img src={listingArtwork(card)} alt={`${card.name} — catalogue artwork`} loading={lazy?'lazy':undefined}/>;
  return <span className={`${styles.slab} ${compact?styles.compact:''}`} aria-label={`${card.name}, slabbed card, ${gradingLabel(grading)}. Illustrative holder; view photos for the actual slab.`}>
    <span className={styles.label} style={header?{background:`linear-gradient(180deg,${header.background} 0%,${header.background} 65%,${header.accent} 100%)`,color:header.text}:undefined}><span><small>GRADED CARD</small><strong>{grading.company}</strong></span><span className={styles.grade}>{grading.grade}</span></span>
    <img className={styles.image} src={listingArtwork(card)} alt={`${card.name} — catalogue artwork inside an illustrative slab frame`} loading={lazy?'lazy':undefined}/>
    <small className={styles.disclaimer}>Illustrative holder · view photos</small>
  </span>;
}
