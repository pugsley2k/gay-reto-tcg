import {validCardCorners,type CardCorners} from './group-card-detection';

// Maps the unit rectangle to the photographed quadrilateral. Sampling the
// original image avoids accumulating interpolation loss through intermediate crops.
export function perspectiveMap(corners:CardCorners){
 if(!validCardCorners(corners))throw new Error('Corners must outline a complete card without crossing.');
 const [a,b,c,d]=corners;
 const dx=b.x-c.x,dy=b.y-c.y,ex=d.x-c.x,ey=d.y-c.y;
 const sx=a.x-b.x+c.x-d.x,sy=a.y-b.y+c.y-d.y;
 const denominator=dx*ey-ex*dy;
 if(Math.abs(denominator)<1e-8)throw new Error('Card corners are too close together.');
 const g=(sx*ey-ex*sy)/denominator,h=(dx*sy-sx*dy)/denominator;
 return(u:number,v:number)=>{const z=g*u+h*v+1;return{x:((b.x-a.x+g*b.x)*u+(d.x-a.x+h*d.x)*v+a.x)/z,y:((b.y-a.y+g*b.y)*u+(d.y-a.y+h*d.y)*v+a.y)/z};};
}
export function straightenPixels(source:Uint8ClampedArray,width:number,height:number,corners:CardCorners){
 const pixelCorners=corners.map(p=>({x:p.x/1000*(width-1),y:p.y/1000*(height-1)})) as CardCorners;
 const distance=(a:number,b:number)=>Math.hypot(pixelCorners[a].x-pixelCorners[b].x,pixelCorners[a].y-pixelCorners[b].y);
 const w=(distance(0,1)+distance(3,2))/2,h=(distance(0,3)+distance(1,2))/2;
 if(Math.min(w,h)<120)throw new Error('This crop is too small for a useful listing photo. Photograph fewer cards or use a higher-resolution image.');
 const scale=Math.min(1,1600/Math.max(w,h)),outWidth=Math.round(w*scale),outHeight=Math.round(h*scale);
 // Validate in normalized coordinates, then map those coordinates to pixels.
 const map=perspectiveMap(corners),pixels=new Uint8ClampedArray(outWidth*outHeight*4);
 for(let y=0;y<outHeight;y++)for(let x=0;x<outWidth;x++){
  const p=map(x/(outWidth-1),y/(outHeight-1));
  const px=Math.max(0,Math.min(width-1,p.x/1000*(width-1))),py=Math.max(0,Math.min(height-1,p.y/1000*(height-1)));
  const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=px-x0,fy=py-y0;
  for(let channel=0;channel<4;channel++)pixels[(y*outWidth+x)*4+channel]=source[(y0*width+x0)*4+channel]*(1-fx)*(1-fy)+source[(y0*width+x1)*4+channel]*fx*(1-fy)+source[(y1*width+x0)*4+channel]*(1-fx)*fy+source[(y1*width+x1)*4+channel]*fx*fy;
 }
 return{pixels,width:outWidth,height:outHeight};
}
