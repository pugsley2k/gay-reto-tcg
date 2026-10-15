export const PUBLIC_CARD_FIELDS = 'id,name,price,set,number,rarity,image_url,front_image_url,back_image_url,language,holo_type,condition,edition,available,sold_at';
export type ProductCard = { id:string;name:string;price:number;set:string|null;number:string|null;rarity:string|null;image_url:string|null;front_image_url:string|null;back_image_url:string|null;language:string|null;holo_type:string|null;condition:string|null;edition:string|null;available:boolean;sold_at:string|null };
export const productPath = (id:string) => `/cards/${encodeURIComponent(id)}`;
