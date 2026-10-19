export type SlabHeaderStyle={background:string;accent:string;text:string};
export const validHeaderStyle=(value:unknown):value is SlabHeaderStyle=>!!value&&typeof value==='object'&&['background','accent','text'].every(key=>/^#[a-f0-9]{6}$/i.test(String((value as Record<string,unknown>)[key])));
export function headerTextColour(hex:string){
  const channels=[1,3,5].map(start=>{const c=parseInt(hex.slice(start,start+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
  const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  return luminance>.179?'#17191d':'#ffffff';
}
/** Deterministic pixel sampling only; no network or model calls. */
export function detectSlabHeader(pixels:Uint8ClampedArray,width:number,height:number,position?:number){
  if(width<20||height<40||pixels.length!==width*height*4)throw new Error('Use a clear front photo of the full slab.');
  function dominant(top:number,bottom:number){
    const buckets=new Map<string,{r:number;g:number;b:number;n:number}>();let total=0;
    for(let y=Math.floor(top*height);y<Math.ceil(bottom*height);y++)for(let x=Math.floor(width*.24);x<width*.76;x++){
      const i=(y*width+x)*4;if(pixels[i+3]<240)continue;
      const [r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]];const key=[r,g,b].map(c=>Math.floor(c/32)).join(',');const bin=buckets.get(key)||{r:0,g:0,b:0,n:0};bin.r+=r;bin.g+=g;bin.b+=b;bin.n++;buckets.set(key,bin);total++;
    }
    const best=[...buckets.values()].sort((a,b)=>b.n-a.n)[0];if(!best)throw new Error('No visible header colours found.');
    const rgb=[best.r,best.g,best.b].map(c=>Math.round(c/best.n));
    return{hex:'#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join(''),support:best.n/total,chroma:(Math.max(...rgb)-Math.min(...rgb))/255};
  }
  let top=position??.12;let score=-Infinity;
  if(position===undefined)for(let y=.06;y<=.30;y+=.02){const colour=dominant(y,y+.06);const candidate=colour.support-1.2*colour.chroma-.15*Math.abs(y-.16);if(candidate>score){score=candidate;top=y;}}
  top=Math.max(.02,Math.min(.40,top));
  const main=dominant(top,top+.06),band=dominant(top+.06,top+.10);
  return {style:{background:main.hex,accent:band.hex,text:headerTextColour(main.hex)},position:top,confidence:main.support};
}
