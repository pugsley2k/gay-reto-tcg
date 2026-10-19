import {validHeaderStyle,type SlabHeaderStyle} from './slab-header-colour';
export type SlabDetails={company?:string;grade?:string;cert_number?:string;confirmed?:boolean;header_style?:SlabHeaderStyle};
export function slabPresentation(grading?:SlabDetails|null){
 if(!grading?.confirmed||!grading.company?.trim()||!grading.grade?.trim())return null;
 const legacy=grading.company==='GetGraded'&&grading.cert_number==='00744256';
 const header=validHeaderStyle(grading.header_style)?grading.header_style:legacy?{background:'#34363d',accent:'#315b96',text:'#ffffff'}:{background:'#34363d',accent:'#34363d',text:'#ffffff'};
 return {company:grading.company,grade:grading.grade,header};
}
