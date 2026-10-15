'use client';
import {useEffect,useState} from 'react';
export type ScannerPreset={language:string;finish:string};
export function readScannerPreset():ScannerPreset{try{const value=JSON.parse(localStorage.getItem('gayretro-scanner-defaults')||'{}');return{language:['English','Japanese','Korean'].includes(value.language)?value.language:'English',finish:['Normal','Holo Rare','Reverse Holo'].includes(value.finish)?value.finish:''};}catch{return{language:'English',finish:''};}}
export default function ScannerDefaults(){
 const [preset,setPreset]=useState<ScannerPreset>({language:'English',finish:''});useEffect(()=>setPreset(readScannerPreset()),[]);
 function update(patch:Partial<ScannerPreset>){const value={...preset,...patch};setPreset(value);try{localStorage.setItem('gayretro-scanner-defaults',JSON.stringify(value));}catch{}}
 return <details style={{margin:'24px 0'}}><summary>Remember scan defaults on this phone</summary><p>Used only when a scan does not supply a language or finish. Condition and edition always need checking.</p><label>Default language<select value={preset.language} onChange={event=>update({language:event.target.value})}>{['English','Japanese','Korean'].map(value=><option key={value}>{value}</option>)}</select></label><label>Default finish<select value={preset.finish} onChange={event=>update({finish:event.target.value})}><option value="">Always check</option>{['Normal','Holo Rare','Reverse Holo'].map(value=><option key={value}>{value}</option>)}</select></label></details>;
}
