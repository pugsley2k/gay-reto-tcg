import {cropPixelBox,type CardBox} from './group-card-detection';
export async function cropGroupPhoto(source:File,boxes:CardBox[]):Promise<File[]>{
 const bitmap=await createImageBitmap(source);
 try{
  const files:File[]=[];
  for(const [index,box] of boxes.entries()){
   const pixels=cropPixelBox(box,bitmap.width,bitmap.height);
   if(Math.min(pixels.width,pixels.height)<120)throw new Error(`Crop ${index+1} is too small to read. Use a higher-resolution photo or photograph fewer cards.`);
   const scale=Math.min(1,1800/Math.max(pixels.width,pixels.height));const canvas=document.createElement('canvas');
   canvas.width=Math.round(pixels.width*scale);canvas.height=Math.round(pixels.height*scale);
   const context=canvas.getContext('2d');if(!context)throw new Error('Could not prepare the card crops.');
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,pixels.x,pixels.y,pixels.width,pixels.height,0,0,canvas.width,canvas.height);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not create a card crop.')),'image/jpeg',.9));
   if(blob.size>4*1024*1024)throw new Error(`Crop ${index+1} is too large. Use a smaller group photo.`);
   files.push(new File([blob],`group-card-${index+1}.jpg`,{type:'image/jpeg'}));
  }
  return files;
 }finally{bitmap.close();}
}
