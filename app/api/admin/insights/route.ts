import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '@/lib/admin';
import {serverDb} from '@/lib/server-db';
import {collectionInsights,type Stock,type Cost,type Sale} from '@/lib/insights';
export const dynamic='force-dynamic';
export async function GET(){
 if(!await isAdmin())return NextResponse.json({error:'Admin access required.'},{status:403});
 const db=serverDb();
 async function all(table:string,columns:string){const rows=[];for(let from=0;;from+=1000){const{data,error}=await db.from(table).select(columns).order(table==='card_economics'?'card_id':'id').range(from,from+999);if(error)throw Error('Could not load collection data.');rows.push(...data);if(data.length<1000)break;}return rows;}
 try{const[cards,costs,orders]=await Promise.all([all('Card','id,name,price,available,createdAt,sold_at'),all('card_economics','card_id,cost_pence'),all('orders','id,paid_at,items,shipping,payment_fee_pence,carrier_cost_pence')]);return NextResponse.json(collectionInsights(cards as unknown as Stock[],costs as unknown as Cost[],orders as unknown as Sale[]),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Could not load insights.'},{status:503});}
}
export async function PATCH(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Admin access required.'},{status:403});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Invalid origin.'},{status:403});
 const body=await req.json();
 if(typeof body.card_id!=='string'||body.card_id.length>200||!(body.cost_pence===null||(Number.isSafeInteger(body.cost_pence)&&body.cost_pence>=0&&body.cost_pence<=10000000)))return NextResponse.json({error:'Enter a valid cost in whole pence.'},{status:400});
 const {error}=await serverDb().from('card_economics').upsert({card_id:body.card_id,cost_pence:body.cost_pence,updated_at:new Date().toISOString()});return error?NextResponse.json({error:'Could not save cost.'},{status:503}):NextResponse.json({message:'Acquisition cost saved.'});
}
