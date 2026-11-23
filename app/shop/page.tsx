import {redirect} from 'next/navigation';
/** The shop now lives on the home page. Old links and bookmarks keep their search and filters. */
export default async function ShopPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(await searchParams))for(const item of [value].flat())if(typeof item==='string')params.append(key,item);
  const query=params.toString();
  redirect(`/${query?'?'+query:''}#shop`);
}
