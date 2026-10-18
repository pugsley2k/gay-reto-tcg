import {readGrading} from './card-grading';
export type ScanNotes={release_year:string|null;label_set:string|null;observations:string[];warnings:string[]};
export function safeScanGrading(input:Record<string,unknown>){const grading=readGrading(input.grading);if(grading){grading.confirmed=false;if(input.cert_readable!==true)grading.cert_number='';}return grading;}
export function scanNotes(input:Record<string,unknown>,slab:boolean):ScanNotes{
 const list=(value:unknown)=>Array.isArray(value)?value.filter((v):v is string=>typeof v==='string').slice(0,4).map(v=>v.trim().slice(0,280)).filter(Boolean):[];
 const warnings=list(input.warnings);
 if(slab&&input.cert_readable!==true)warnings.unshift('The complete certificate number could not be read confidently. Enter it from the slab or its QR code before checking the official record.');
 const year=String(input.release_year??'');
 return{release_year:/^(19|20)\d{2}$/.test(year)?year:null,label_set:typeof input.label_set==='string'?input.label_set.trim().slice(0,160):null,observations:list(input.observations),warnings:[...new Set(warnings)].slice(0,5)};
}
export function printedCardNumber(number:unknown,total:unknown){
 const value=typeof number==='string'?number.trim():'';
 return value&&!value.includes('/')&&typeof total==='string'&&total.trim()?`${value}/${total.trim()}`:value;
}
