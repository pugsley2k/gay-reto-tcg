"use client";
import CardArtwork from '@/components/CardArtwork';
import {listingArtwork} from '@/lib/card-artwork';
import {gradingLabel} from '@/lib/card-grading';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import {useCart} from '@/components/CartProvider';
import SiteFooter from '@/components/SiteFooter';
import {EXAMPLE_CARD_ID} from '@/lib/example-listing';
import {PUBLIC_CARD_FIELDS,productPath,type ProductCard} from '@/lib/products';
import {EMPTY_QUERY,parseShopQuery,shopQueryString,priceRange,type ShopQuery} from '@/lib/shop-query';
import type {FilterOption} from '@/lib/shop-filters';
import styles from '../styles/ShopPage.module.css';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Facets={sets:FilterOption[];rarities:FilterOption[];finishes:FilterOption[];languages:FilterOption[];conditions:FilterOption[];editions:FilterOption[]};
const emptyFacets:Facets={sets:[],rarities:[],finishes:[],languages:[],conditions:[],editions:[]};
export default function ShopPage(){
 const [query,setQuery]=useState<ShopQuery>(EMPTY_QUERY),[ready,setReady]=useState(false),[cards,setCards]=useState<ProductCard[]>([]),[facets,setFacets]=useState<Facets>(emptyFacets),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filterError,setFilterError]=useState(''),[notice,setNotice]=useState(''),[total,setTotal]=useState(0),[filtersOpen,setFiltersOpen]=useState(false),[retry,setRetry]=useState(0);
 const {addToCart,cart,isReady:cartReady}=useCart();
 useEffect(()=>{const load=()=>setQuery(parseShopQuery(new URLSearchParams(location.search)));load();setReady(true);addEventListener('popstate',load);return()=>removeEventListener('popstate',load);},[]);
 useEffect(()=>{fetch('/api/shop-filters').then(async res=>{if(!res.ok)throw Error();setFacets({...emptyFacets,...await res.json()});}).catch(()=>setFilterError('Filters are unavailable. Search by Pokémon or card name instead.'));},[]);
 useEffect(()=>{
  if(!ready)return;
  const params=shopQueryString(query);history.replaceState(null,'',`/shop${params?'?'+params:''}`);
  const controller=new AbortController();let active=true;
  async function load(){
   setLoading(true);setError('');
   try{
    const range=priceRange(query);let request=db.from('Card').select(PUBLIC_CARD_FIELDS,{count:'exact'}).eq('available',true);
    if(query.search)request=request.ilike('name',`%${query.search}%`);
    for(const [key,column,group] of [['set','set','sets'],['rarity','rarity','rarities'],['finish','holo_type','finishes'],['language','language','languages'],['condition','condition','conditions'],['edition','edition','editions']] as const){if(query[key])request=request.in(column,facets[group].find(option=>option.label===query[key])?.values||[query[key]]);}
    if(range.min!==null)request=request.gte('price',range.min);if(range.max!==null)request=request.lte('price',range.max);
    const column=query.sort.startsWith('price')?'price':query.sort.startsWith('name')?'name':'createdAt';
    const {data,error,count}=await request.order(column,{ascending:query.sort.endsWith('asc')}).order('id').range((query.page-1)*20,query.page*20-1).abortSignal(controller.signal);
    if(!active)return;if(error)throw Error('Could not load cards. Please try again.');setCards((data||[]) as ProductCard[]);setTotal(count||0);
   }catch(error){if(active){setCards([]);setTotal(0);setError(error instanceof Error?error.message:'Could not load cards.');}}finally{if(active)setLoading(false);}
  }
  void load();return()=>{active=false;controller.abort();};
 },[query,ready,facets,retry]);
 function change(key:keyof ShopQuery,value:string){setQuery(prev=>({...prev,[key]:value,page:1}));}
 const activeFilters=Object.entries(query).filter(([key,value])=>!['sort','page','search'].includes(key)&&value).length;
 const select=(key:keyof ShopQuery,label:string,options:FilterOption[])=> <label key={key} htmlFor={`filter-${key}`}>{label}<select id={`filter-${key}`} value={String(query[key])} onChange={event=>change(key,event.target.value)}><option value="">All {label.toLowerCase()}</option>{query[key]&&!options.some(option=>option.label===query[key])&&<option value={String(query[key])}>{query[key]}</option>}{options.map(option=><option key={option.label} value={option.label}>{option.label}</option>)}</select></label>;
 return <main id="main-content" className={styles.page}><header className={styles.hero}><p>GAY RETRO TCG</p><h1>Browse cards</h1><span>English, Japanese and Korean Pokémon singles.</span></header><div className={styles.body}>
  <section className={styles.filters} aria-label="Find cards"><div className={styles.searchRow}><label htmlFor="card-search">Pokémon or card name<input type="search" id="card-search" placeholder="Search Charizard, Pikachu…" value={query.search} onChange={event=>change('search',event.target.value)}/></label><label htmlFor="card-sort">Sort by<select id="card-sort" value={query.sort} onChange={event=>change('sort',event.target.value)}>{[['newest','Newest first'],['price-asc','Price: low to high'],['price-desc','Price: high to low'],['name-asc','Name: A–Z'],['name-desc','Name: Z–A']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button onClick={()=>setFiltersOpen(value=>!value)} aria-expanded={filtersOpen} aria-controls="card-filters">Filters{activeFilters?` (${activeFilters})`:''} {filtersOpen?'−':'+'}</button></div>
  {filtersOpen&&<div id="card-filters" className={styles.filterGrid}>{select('set','Sets',facets.sets)}{select('rarity','Rarities',facets.rarities)}{select('finish','Finishes',facets.finishes)}{select('language','Languages',facets.languages)}{select('condition','Conditions',facets.conditions)}{select('edition','Editions',facets.editions)}<label htmlFor="price-min">Minimum price (£)<input id="price-min" inputMode="decimal" value={query.min} onChange={event=>change('min',event.target.value)}/></label><label htmlFor="price-max">Maximum price (£)<input id="price-max" inputMode="decimal" value={query.max} onChange={event=>change('max',event.target.value)}/></label></div>}
  {(activeFilters>0||query.search)&&<button className={styles.clear} onClick={()=>setQuery({...EMPTY_QUERY,sort:query.sort})}>Clear filters</button>}{filterError&&<p role="status">{filterError}</p>}
  </section><p role="status" className={styles.result}>{loading?'Finding cards…':`${total} ${total===1?'card':'cards'}${activeFilters||query.search?' matching your search':' available'}`}</p>{notice&&<p role="status">{notice} <Link href="/cart">View cart →</Link></p>}
  {error&&<p role="alert">{error} <button onClick={()=>setRetry(value=>value+1)}>Try again</button></p>}
  {!loading&&!error&&!cards.length&&<div className={styles.empty}><h2>No cards found</h2><p>Try a different Pokémon or remove a filter.</p><button onClick={()=>setQuery(EMPTY_QUERY)}>Show all cards</button></div>}
  <div className={styles.grid} aria-busy={loading}>{cards.map(card=><article className={styles.card} key={card.id}><Link href={productPath(card.id)} className={styles.art} aria-label={`View ${card.name}`}><CardArtwork card={card} compact lazy/></Link><div className={styles.cardBody}><p>{card.set||'Pokémon TCG'}{card.number?` · #${card.number}`:''}</p><h2><Link href={productPath(card.id)}>{card.name}</Link></h2><span>{card.language||'Language not specified'} · {gradingLabel(card.grading)||card.condition||'Condition not specified'}</span>{card.edition&&card.edition!=='Not applicable'&&<span>{card.edition}</span>}<strong>£{(card.price/100).toFixed(2)}</strong><button disabled={!cartReady||card.id===EXAMPLE_CARD_ID||cart.some(item=>item.id===card.id)} onClick={()=>{addToCart({id:card.id,name:card.name,price:card.price,imageUrl:listingArtwork(card),condition:card.condition,edition:card.edition});setNotice(`${card.name} added to your cart.`);}}>{card.id===EXAMPLE_CARD_ID?'Example — not for sale':cart.some(item=>item.id===card.id)?'In your cart':'Add to cart'}</button></div></article>)}</div>
  {total>20&&<nav className={styles.pagination} aria-label="Shop pages"><button disabled={query.page<=1||loading} onClick={()=>setQuery(prev=>({...prev,page:prev.page-1}))}>Previous</button><span>Page {query.page} of {Math.ceil(total/20)}</span><button disabled={query.page>=Math.ceil(total/20)||loading} onClick={()=>setQuery(prev=>({...prev,page:prev.page+1}))}>Next</button></nav>}
  <SiteFooter/>
 </div></main>;
}
