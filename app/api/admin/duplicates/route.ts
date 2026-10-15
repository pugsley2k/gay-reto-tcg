import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '@/lib/admin';
import {serverDb} from '@/lib/server-db';
export async function POST(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Admin access required.'},{status:403});
 const body=await req.json();if(typeof body.name!=='string'||typeof body.number!=='string'||!body.name.trim()||!body.number.trim()||body.name.length>200||body.number.length>40)return NextResponse.json({matches:[]});
 let query=serverDb().from('Card').select('id,name,set,number,language,edition,holo_type').eq('available',true).eq('number',body.number.trim()).ilike('name',body.name.trim().replace(/[%_]/g,''));
 if(typeof body.set==='string'&&body.set)query=query.eq('set',body.set);
 if(typeof body.language==='string'&&body.language)query=query.eq('language',body.language);
 const {data,error}=await query.limit(10);if(error)return NextResponse.json({error:'Duplicate check unavailable.'},{status:503});return NextResponse.json({matches:data},{headers:{'Cache-Control':'no-store'}});
}
