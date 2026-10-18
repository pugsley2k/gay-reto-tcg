import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '@/lib/admin';
import {readGrading,completeGrading} from '@/lib/card-grading';
import {verifyCertificate} from '@/lib/cert-verification';
export const maxDuration=30;
export async function POST(request:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Admin access required.'},{status:403});
 try{const body=await request.json();const grading=readGrading(body.grading);
 if(!completeGrading(grading)||!grading)return NextResponse.json({error:'Enter the company, grade and certificate number first.'},{status:400});
 for(const key of ['name','number','set'])if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>200)return NextResponse.json({error:'Add the card name, number and set before comparing the certificate.'},{status:400});
 return NextResponse.json(await verifyCertificate(grading,{name:body.name.trim(),number:body.number.trim(),set:body.set.trim()}));
 }catch{return NextResponse.json({error:'Could not check the certificate. Your details have been kept.'},{status:503});}
}
