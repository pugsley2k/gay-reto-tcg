'use client';
import {gradingLabel} from '@/lib/card-grading';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { EXAMPLE_CARD_ID } from '@/lib/example-listing';
import type { ProductCard } from '@/lib/products';
import styles from './ProductDetail.module.css';
export default function ProductDetail({card}:{card:ProductCard}) {
  const {addToCart,cart}=useCart();
  const photos=[{label:card.image_url===card.front_image_url?'Actual card — front':'Listing image',url:card.image_url}, {label:'Actual card — front',url:card.front_image_url},{label:'Actual card — back',url:card.back_image_url}].filter((value,index,all)=>value.url&&all.findIndex(other=>other.url===value.url)===index);
  const [selected,setSelected]=useState(0);
  const [added,setAdded]=useState(false);
  const [shared,setShared]=useState(false);
  const [zoom,setZoom]=useState(false);
  const inCart=cart.some(item=>item.id===card.id);
  async function share(){try{await navigator.clipboard.writeText(location.href);setShared(true);}catch{setShared(false);}}
  return <div className={styles.product}>
    <section className={styles.gallery} aria-label="Card photos"><button className={`${styles.art} ${zoom?styles.zoom:''}`} aria-label={zoom?'Reduce photo size':'Enlarge card photo'} aria-pressed={zoom} onClick={()=>setZoom(value=>!value)}>{photos[selected]?.url?<img src={photos[selected].url!} alt={`${card.name} — ${photos[selected].label}`} />:<span>No image available</span>}</button><p>{photos[selected]?.label}. Tap the image to enlarge.</p><div className={styles.thumbs}>{photos.map((photo,index)=><button key={photo.label} onClick={()=>{setSelected(index);setZoom(false);}} aria-pressed={selected===index}>{photo.label}</button>)}</div></section>
    <section className={styles.info}><p className={styles.eyebrow}>{card.set||'Pokémon TCG'}{card.number?` · #${card.number}`:''}</p><h1>{card.name}</h1><p className={styles.price}>£{(card.price/100).toFixed(2)}</p>
      <dl>{[['Language',card.language],['Rarity',card.rarity],['Finish',card.holo_type],['Edition',card.edition==='Not applicable'?null:card.edition],['Grading',gradingLabel(card.grading)],['Certification number',card.grading?.cert_number],['Condition',card.grading?null:card.condition||'Not specified']].filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {!card.front_image_url&&<p className={styles.note}>Actual-card photos are not available for this listing. <Link href="/contact">Ask us for photos</Link> before buying if you need a closer look.</p>}
      <button className={styles.buy} disabled={!card.available||card.id===EXAMPLE_CARD_ID||inCart} onClick={()=>{addToCart({id:card.id,name:card.name,price:card.price,imageUrl:card.image_url||'/placeholder.png',condition:card.condition,edition:card.edition});setAdded(true);}}>{card.id===EXAMPLE_CARD_ID?'Example — not for sale':!card.available?'Sold':inCart?'In your cart':'Add to cart'}</button>
      {added&&<p role="status">Added to your cart. <Link href="/cart">View cart →</Link></p>}
      <p className={styles.note}>UK delivery from £4.50. Dispatch within 3–5 working days. The cart selects the delivery options for your order value.</p><nav aria-label="Purchase information"><Link href="/delivery">Delivery</Link><Link href="/returns">Returns</Link><button onClick={share}>{shared?'Link copied':'Copy card link'}</button></nav>
    </section>
  </div>;
}
