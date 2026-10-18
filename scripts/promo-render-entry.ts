import {drawCardPromo,loadPromoImage,recordCardPromo} from '../src/lib/card-promo-renderer';
import type {CardPromo} from '../src/lib/card-promo';
declare global {interface Window {renderPromo:(input:{promo:CardPromo;artwork:string;logo:string})=>Promise<number[]>}}
window.renderPromo=async({promo,artwork,logo})=>{
 const canvas=document.querySelector('canvas')!;
 const [art,brand]=await Promise.all([loadPromoImage(artwork),loadPromoImage(logo)]);
 drawCardPromo(canvas,promo,art,brand,0,promo.style);
 const blob=await recordCardPromo(canvas,promo,art,brand,promo.style,()=>{},new AbortController().signal);
 return Array.from(new Uint8Array(await blob.arrayBuffer()));
};
