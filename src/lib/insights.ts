export type Stock = {id:string;name:string;price:number;available:boolean;createdAt:string;sold_at?:string|null};
export type Cost = {card_id:string;cost_pence:number|null};
export type Sale = {id:string;paid_at?:string|null;items:{id:string;name:string;quantity:number;cost_pence?:number|null}[];shipping?:{total:number;price:number};payment_fee_pence?:number|null;carrier_cost_pence?:number|null};
export function collectionInsights(cards:Stock[],costs:Cost[],orders:Sale[],now=Date.now()){
 const costMap=new Map(costs.map(cost=>[cost.card_id,cost.cost_pence]));
 const sales=orders.filter(order=>order.paid_at);
 const popular=new Map<string,number>();let knownProfit=0,completeOrders=0;
 const orderMargins=sales.map(order=>{let acquisition=0,missing=false;for(const item of order.items){popular.set(item.name,(popular.get(item.name)||0)+item.quantity);const cost=item.cost_pence??costMap.get(item.id);if(cost==null)missing=true;else acquisition+=cost*item.quantity;}
  const complete=!missing&&order.payment_fee_pence!=null&&order.carrier_cost_pence!=null&&order.shipping!=null;
  const profit=complete?order.shipping!.total-acquisition-order.payment_fee_pence!-order.carrier_cost_pence!:null;
  if(profit!==null){knownProfit+=profit;completeOrders++;}return{id:order.id,revenue:order.shipping?.total??null,acquisition:missing?null:acquisition,fee:order.payment_fee_pence??null,postage:order.carrier_cost_pence??null,profit};
 });
 const inventory=cards.map(card=>({...card,cost_pence:costMap.get(card.id)??null,ageDays:Math.max(0,Math.floor((now-new Date(card.createdAt).getTime())/86400000))}));
 return {inventory,paidOrders:sales.length,revenue:sales.reduce((sum,order)=>sum+(order.shipping?.total||0),0),stockValue:cards.filter(card=>card.available).reduce((sum,card)=>sum+card.price,0),knownProfit,completeOrders,orderMargins,popular:[...popular].map(([name,sold])=>({name,sold})).sort((a,b)=>b.sold-a.sold).slice(0,10),ageing:inventory.filter(card=>card.available&&card.ageDays>=90).sort((a,b)=>b.ageDays-a.ageDays)};
}
