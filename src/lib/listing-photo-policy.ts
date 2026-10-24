export function catalogueOnlyAllowed(pricePence:number,graded:boolean,matchedArtwork:boolean){
 return Number.isSafeInteger(pricePence)&&pricePence>0&&pricePence<2000&&!graded&&matchedArtwork;
}
export function listingPhotoIssue(pricePence:number,graded:boolean,hasPhoto:boolean,matchedArtwork:boolean){
 if(hasPhoto)return '';
 if(graded)return 'Add an individual photo of the actual slab and label.';
 if(pricePence>=2000)return 'Cards priced at £20 or more need an individual photo.';
 if(!catalogueOnlyAllowed(pricePence,false,matchedArtwork))return 'Confirm matching catalogue artwork or add an individual photo.';
 return '';
}
