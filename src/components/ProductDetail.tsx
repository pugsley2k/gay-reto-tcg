'use client';
import {gradingLabel} from '@/lib/card-grading';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { EXAMPLE_CARD_ID } from '@/lib/example-listing';
import type { ProductCard } from '@/lib/products';
import styles from './ProductDetail.module.css';
import {listingArtwork} from '@/lib/card-artwork';
export default function ProductDetail({card}:{card:ProductCard}) {
  const {addToCart,cart,isReady}=useCart();
  const photos=[{label:'Actual card — front',url:card.front_image_url},{label:'Actual card — back',url:card.back_image_url}].filter(value=>value.url);
  const [showPhotos,setShowPhotos]=useState(false);
  const [selected,setSelected]=useState(0);
  const [added,setAdded]=useState(false);
  const [shared,setShared]=useState(false);
  const [zoom,setZoom]=useState(false);
  const inCart=cart.some(item=>item.id===card.id);
  async function share(){try{await navigator.clipboard.writeText(location.href);setShared(true);}catch{setShared(false);}}
  return <div className={styles.product}>
    <section className={styles.gallery} aria-label="Card artwork and photos"><button className={`${styles.art} ${zoom?styles.zoom:''}`} aria-label={zoom?'Reduce image size':'Enlarge card image'} aria-pressed={zoom} onClick={()=>setZoom(value=>!value)}><img src={showPhotos?photos[selected]?.url||'/placeholder.png':listingArtwork(card)} alt={`${card.name} — ${showPhotos?photos[selected]?.label:'catalogue artwork'}`} /></button><p>{showPhotos?'Photograph of the physical card. Tap to enlarge.':'Catalogue artwork for reference. View photos to inspect the card and any slab before buying.'}</p><div className={styles.thumbs}><button onClick={()=>{setShowPhotos(value=>!value);setZoom(false);}} aria-expanded={showPhotos} aria-controls="actual-card-photos" disabled={!photos.length}>{showPhotos?'Back to artwork':photos.length?'View photos':'Photos not available'}</button></div>{showPhotos&&<div id="actual-card-photos" className={styles.thumbs}>{photos.map((photo,index)=><button key={photo.label} onClick={()=>{setSelected(index);setZoom(false);}} aria-pressed={selected===index}>{photo.label}</button>)}</div>}<noscript><p>Enable JavaScript to view the actual-card photographs.</p></noscript></section>
    <section className={styles.info}><p className={styles.eyebrow}>{card.set||'Pokémon TCG'}{card.number?` · #${card.number}`:''}</p><h1>{card.name}</h1><p className={styles.price}>£{(card.price/100).toFixed(2)}</p>
      <dl>{[['Language',card.language],['Rarity',card.rarity],['Finish',card.holo_type],['Edition',card.edition==='Not applicable'?null:card.edition],['Grading',gradingLabel(card.grading)],['Certification number',card.grading?.cert_number],['Condition',card.grading?null:card.condition||'Not specified']].filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {!card.front_image_url&&<p className={styles.note}>Actual-card photos are not available for this listing. <Link href="/contact">Ask us for photos</Link> before buying if you need a closer look.</p>}
      <button className={styles.buy} disabled={!isReady||!card.available||card.id===EXAMPLE_CARD_ID||inCart} onClick={()=>{addToCart({id:card.id,name:card.name,price:card.price,imageUrl:listingArtwork(card),condition:card.condition,edition:card.edition});setAdded(true);}}>{card.id===EXAMPLE_CARD_ID?'Example — not for sale':!card.available?'Sold':!isReady?'Loading cart…':inCart?'In your cart':'Add to cart'}</button>
      {added&&<p role="status">Added to your cart. <Link href="/cart">View cart →</Link></p>}
      <p className={styles.note}>UK delivery from £4.50. Dispatch within 3–5 working days. The cart selects the delivery options for your order value.</p><nav aria-label="Purchase information"><Link href="/delivery">Delivery</Link><Link href="/returns">Returns</Link><button onClick={share}>{shared?'Link copied':'Copy card link'}</button></nav>
    </section>
  </div>;
}
