export type ShopQuery = {search:string;set:string;rarity:string;finish:string;language:string;condition:string;edition:string;min:string;max:string;sort:string;page:number};
export const EMPTY_QUERY:ShopQuery={search:'',set:'',rarity:'',finish:'',language:'',condition:'',edition:'',min:'',max:'',sort:'newest',page:1};
export function parseShopQuery(params:URLSearchParams):ShopQuery {
  const result={...EMPTY_QUERY};
  for(const key of ['search','set','rarity','finish','language','condition','edition','min','max'] as const)result[key]=(params.get(key)||'').slice(0,200);
  const sort=params.get('sort');if(sort&&['newest','price-asc','price-desc','name-asc','name-desc'].includes(sort))result.sort=sort;
  const page=Number(params.get('page'));if(Number.isSafeInteger(page)&&page>0&&page<=10000)result.page=page;
  return result;
}
export function shopQueryString(query:ShopQuery){const params=new URLSearchParams();for(const [key,value]of Object.entries(query))if(value!==EMPTY_QUERY[key as keyof ShopQuery]&&value!=='')params.set(key,String(value));return params.toString();}
export function priceRange(query:Pick<ShopQuery,'min'|'max'>){
  function pence(value:string){if(!value)return null;if(!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)>100000)throw new Error('Enter prices between £0 and £100,000, with up to two decimal places.');return Math.round(Number(value)*100);}
  const min=pence(query.min),max=pence(query.max);if(min!==null&&max!==null&&min>max)throw new Error('Minimum price must not exceed maximum price.');return{min,max};
}
