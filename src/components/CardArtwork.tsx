import {listingArtwork} from '@/lib/card-artwork';
import type {Grading} from '@/lib/card-grading';

export default function CardArtwork({card,lazy=false}:{card:{name:string;image_url?:string|null;grading?:Grading|null};lazy?:boolean}) {
  return <img src={listingArtwork(card)} alt={`${card.name} — catalogue artwork, not a photograph of the item for sale`} loading={lazy?'lazy':undefined}/>;
}
