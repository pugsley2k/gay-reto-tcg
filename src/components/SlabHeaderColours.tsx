'use client';
import {useEffect,useRef,useState} from 'react';
import {detectSlabHeader,headerTextColour,type SlabHeaderStyle} from '@/lib/slab-header-colour';
export default function SlabHeaderColours({photo,value,onChange}:{photo?:File|null;value?:SlabHeaderStyle;onChange:(style:SlabHeaderStyle)=>void}){
  const [message,setMessage]=useState('');const [position,setPosition]=useState(.12);const [busy,setBusy]=useState(false);
  const raster=useRef<{pixels:Uint8ClampedArray;width:number;height:number}|null>(null);
  const latest=useRef({value,onChange});latest.current={value,onChange};
  useEffect(()=>{
    raster.current=null;if(!photo)return;let cancelled=false;setBusy(true);
    (async()=>{const bitmap=await createImageBitmap(photo);try{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=Math.round(160*bitmap.height/bitmap.width);const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Colour detection is unavailable in this browser.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const data={pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};if(cancelled)return;raster.current=data;const result=detectSlabHeader(data.pixels,data.width,data.height);setPosition(result.position);if(!latest.current.value)latest.current.onChange(result.style);setMessage('Header colours sampled on this device. Check the preview; adjust the sample position or colours if needed.');}finally{bitmap.close();}})().catch(()=>{if(!cancelled)setMessage('Could not detect the header. Choose its colours below.');}).finally(()=>{if(!cancelled)setBusy(false);});return()=>{cancelled=true;};
  },[photo]);
  function sample(y:number){setPosition(y);const data=raster.current;if(!data)return;try{onChange(detectSlabHeader(data.pixels,data.width,data.height,y).style);}catch{setMessage('Try a different sample position or choose the colours.');}}
  const colours=value||{background:'#34363d',accent:'#34363d',text:'#ffffff'};
  return <div><p><strong>Illustrated slab header colours</strong><br/>{busy?'Detecting header colours…':message||'Add a front photo to detect colours automatically. You can also choose them below.'} No paid API or AI call is used.</p>
    <div aria-label="Slab header colour preview" style={{background:`linear-gradient(${colours.background} 65%,${colours.accent})`,color:colours.text,padding:16,border:'1px solid #85877c',borderRadius:4}}>Grading company <strong style={{float:'right'}}>Grade</strong></div>
    {photo&&<label>Header sample position<input type="range" min="0.02" max="0.40" step="0.01" value={position} disabled={busy} onChange={e=>sample(Number(e.target.value))}/></label>}
    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{(['background','accent'] as const).map(key=><label key={key}>{key==='background'?'Header colour':'Lower band colour'}<input type="color" value={colours[key]} onChange={e=>onChange({...colours,[key]:e.target.value,...(key==='background'?{text:headerTextColour(e.target.value)}:{})})}/></label>)}</div>
  </div>;
}
