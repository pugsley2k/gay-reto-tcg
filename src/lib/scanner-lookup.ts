type Identity={name:string;number:string;language:string;holo_type:string;edition:string;set:string};
export function scannerLookupPayload(details:Identity,originalName:string,printedTotal:string,catalogId?:string){
 const parts=details.number.trim().split('/');
 return{...details,number:parts[0],total:parts[1]?.trim()||printedTotal||undefined,original_name:originalName||details.name,finish:details.holo_type,catalog_id:catalogId||undefined};
}
export function scannerPriceAfterLookup(current:string,matched:boolean,quote?:{gbp:string}|null){return matched&&quote?.gbp?quote.gbp:current;}
