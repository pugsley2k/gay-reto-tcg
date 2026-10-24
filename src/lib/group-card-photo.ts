import {cropPixelBox,type CardBox,type CardCorners} from './group-card-detection';
import {straightenPixels} from './card-perspective';
export async function cropGroupPhoto(source:File,boxes:CardBox[],corners:(CardCorners|undefined)[]=[],straighten=true):Promise<File[]>{
 const bitmap=await createImageBitmap(source);
 try{
  const files:File[]=[];
  let original:ImageData|undefined;
  if(straighten&&corners.some(Boolean)){
   const originalCanvas=document.createElement('canvas');originalCanvas.width=bitmap.width;originalCanvas.height=bitmap.height;
   const ctx=originalCanvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Could not read the original photo.');
   ctx.drawImage(bitmap,0,0);original=ctx.getImageData(0,0,bitmap.width,bitmap.height);
  }
  for(const [index,box] of boxes.entries()){
   const pixels=cropPixelBox(box,bitmap.width,bitmap.height);
   if(Math.min(pixels.width,pixels.height)<120)throw new Error(`Crop ${index+1} is too small to read. Use a higher-resolution photo or photograph fewer cards.`);
   const scale=Math.min(1,1800/Math.max(pixels.width,pixels.height));const canvas=document.createElement('canvas');
   canvas.width=Math.round(pixels.width*scale);canvas.height=Math.round(pixels.height*scale);
   const context=canvas.getContext('2d');if(!context)throw new Error('Could not prepare the card crops.');
   if(straighten&&corners[index]&&original){
    const result=straightenPixels(original.data,bitmap.width,bitmap.height,corners[index]!);
    const card=document.createElement('canvas');card.width=result.width;card.height=result.height;
    card.getContext('2d')!.putImageData(new ImageData(result.pixels,result.width,result.height),0,0);
    const margin=Math.max(8,Math.round(Math.max(result.width,result.height)*.025));
    canvas.width=result.width+margin*2;canvas.height=result.height+margin*2;
    context.fillStyle='#f4f2ed';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(card,margin,margin);
   }else{context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,pixels.x,pixels.y,pixels.width,pixels.height,0,0,canvas.width,canvas.height);}
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not create a card crop.')),'image/jpeg',.9));
   if(blob.size>4*1024*1024)throw new Error(`Crop ${index+1} is too large. Use a smaller group photo.`);
   files.push(new File([blob],`group-card-${index+1}.jpg`,{type:'image/jpeg'}));
  }
  return files;
 }finally{bitmap.close();}
}
