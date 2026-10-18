import Link from 'next/link';
import {listingArtwork} from '@/lib/card-artwork';
import {cache} from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_CARD_FIELDS, type ProductCard } from '@/lib/products';
import ProductDetail from '@/components/ProductDetail';
import SiteFooter from '@/components/SiteFooter';
import styles from '../../styles/InformationPage.module.css';
export const dynamic='force-dynamic';
const getCard=cache(async (id:string) => {
  const {data,error}=await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).from('Card').select(PUBLIC_CARD_FIELDS).eq('id',id).maybeSingle();
  if(error)throw new Error('Could not load this card. Please try again.');
  if(!data||(!data.available&&!data.sold_at))notFound();
  return data as ProductCard;
});
export async function generateMetadata({params}:{params:Promise<{id:string}>}) {
  const card=await getCard((await params).id);
  return {title:`${card.name} | Gay Retro TCG`,description:`${card.name}, ${card.set||'Pokémon TCG'}${card.condition?`, ${card.condition}`:''}. £${(card.price/100).toFixed(2)}.`,alternates:{canonical:`/cards/${encodeURIComponent(card.id)}`},openGraph:{title:card.name,images:[listingArtwork(card)]}};
}
export default async function CardPage({params}:{params:Promise<{id:string}>}) {
  const card=await getCard((await params).id);
  return <main id="main-content" className={styles.page}><Link href="/shop" style={{color:'#faeac4'}}>← Browse cards</Link><ProductDetail card={card}/><SiteFooter/></main>;
}
