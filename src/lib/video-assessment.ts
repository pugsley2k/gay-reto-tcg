import {isCardCondition} from './card-condition';
export type CardSide='front'|'back';
export type FrameMeta={side:CardSide;seconds:number};
export type Coverage={overview:boolean;corners:boolean;edges:boolean;surface:boolean};
export type VideoAssessment={
 condition:string|null;confidence:'low'|'medium'|'high';summary:string;
 grade:{min:number;max:number;reason:string}|null;
 coverage:{front:Coverage;back:Coverage};
 observations:{area:'corners'|'edges'|'surface'|'centering'|'other';side:CardSide;frame:number;severity:'minor'|'moderate'|'major'|'uncertain';description:string}[];
 limitations:string[];retake:string[];
};
export const MAX_FRAME_BYTES=220*1024;
export const MAX_VIDEO_SECONDS=120;
export function frameSampleTimes(start:number,end:number){if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end-start<2||end>MAX_VIDEO_SECONDS)throw new Error('Choose a time window of at least 2 seconds, within the first 120 seconds.');return Array.from({length:6},(_,index)=>start+(end-start)*(.07+index*.172));}
export function validateFrameMeta(value:unknown):FrameMeta[]{
 if(!Array.isArray(value)||value.length<6||value.length>12)throw new Error('Include 3–6 frames from each side.');
 const frames=value.map(item=>{if(!item||!['front','back'].includes(item.side)||typeof item.seconds!=='number'||!Number.isFinite(item.seconds)||item.seconds<0||item.seconds>MAX_VIDEO_SECONDS)throw new Error('Invalid frame details.');return{side:item.side as CardSide,seconds:item.seconds};});
 for(const side of ['front','back']){const count=frames.filter(frame=>frame.side===side).length;if(count<3||count>6)throw new Error('Include 3–6 frames from each side.');}
 return frames;
}
const text=(value:unknown,max=400)=>{if(typeof value!=='string'||!value.trim())throw new Error('The assessment response was incomplete.');return value.trim().slice(0,max);};
export function parseVideoAssessment(value:unknown,frames:FrameMeta[]):VideoAssessment{
 if(!value||typeof value!=='object')throw new Error('Invalid assessment response.');
 const data=value as Record<string,any>;
 if(data.condition!==null&&!isCardCondition(data.condition))throw new Error('Invalid suggested condition.');
 if(!['low','medium','high'].includes(data.confidence))throw new Error('Invalid assessment confidence.');
 const coverage={} as VideoAssessment['coverage'];
 for(const side of ['front','back'] as const){const sideCoverage=data.coverage?.[side];if(!sideCoverage||['overview','corners','edges','surface'].some(key=>typeof sideCoverage[key]!=='boolean'))throw new Error('Missing coverage assessment.');coverage[side]={overview:sideCoverage.overview,corners:sideCoverage.corners,edges:sideCoverage.edges,surface:sideCoverage.surface};}
 function notes(key:string){if(!Array.isArray(data[key])||data[key].length>10)throw new Error('Invalid assessment notes.');return data[key].map((note:unknown)=>text(note));}
 const limitations=notes('limitations'),retake=notes('retake');
 if(!Array.isArray(data.observations)||data.observations.length>12)throw new Error('Invalid observations.');
 const observations=data.observations.map((note:any)=>{if(!['corners','edges','surface','centering','other'].includes(note.area)||!['front','back'].includes(note.side)||!['minor','moderate','major','uncertain'].includes(note.severity)||!Number.isInteger(note.frame)||!frames[note.frame-1]||frames[note.frame-1].side!==note.side)throw new Error('Observation references an invalid frame.');return{area:note.area,side:note.side,frame:note.frame,severity:note.severity,description:text(note.description)};});
 let grade:VideoAssessment['grade']=null;
 if(data.grade!==null){const g=data.grade;if(!g||!Number.isInteger(g.min)||!Number.isInteger(g.max)||g.min<1||g.max>10||g.min>=g.max)throw new Error('Invalid experimental grade range.');grade={min:g.min,max:g.max,reason:text(g.reason,600)};}
 const complete=Object.values(coverage).every(side=>Object.values(side).every(Boolean));
 if(!complete&&!retake.length)retake.push('Add clear overview, corner, edge and tilted-surface footage of both sides.');
 const sufficient=complete&&data.confidence!=='low'&&retake.length===0;
 return{condition:sufficient?data.condition:null,grade:sufficient?grade:null,confidence:sufficient?data.confidence:'low',summary:text(data.summary,900),coverage,observations,limitations:[...limitations,'Experimental assessment of selected frames, not a professional grade or authenticity check. Hidden scratches, dents and other defects may be missed.'].slice(0,11),retake};
}
