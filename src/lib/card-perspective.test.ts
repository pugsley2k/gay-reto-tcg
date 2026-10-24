import test from 'node:test';
import assert from 'node:assert/strict';
import {perspectiveMap,straightenPixels} from './card-perspective';
import {validCardCorners,type CardCorners} from './group-card-detection';
test('perspective mapping anchors every corner and an interior point',()=>{
 const corners:CardCorners=[{x:120,y:100},{x:800,y:170},{x:850,y:910},{x:80,y:860}];
 const map=perspectiveMap(corners);
 for(const [i,[u,v]]of [[0,0],[1,0],[1,1],[0,1]].entries()){
  const p=map(u,v);assert.ok(Math.abs(p.x-corners[i].x)<1e-7);assert.ok(Math.abs(p.y-corners[i].y)<1e-7);
 }
 assert.ok(map(.5,.5).x>120&&map(.5,.5).x<800);
});
test('invalid, crossed and degenerate corners cannot produce misleading photos',()=>{
 const corners:CardCorners=[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}];
 assert.equal(validCardCorners(corners),true);
 assert.equal(validCardCorners([corners[0],corners[2],corners[1],corners[3]]),false);
 assert.equal(validCardCorners(corners.map(p=>({...p,x:NaN}))),false);
 assert.throws(()=>perspectiveMap(corners.map(()=>({x:0,y:0})) as CardCorners));
});
test('pixel processing preserves original colours and all four edges without inventing detail',()=>{
 const width=160,height=240,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const offset=(y*width+x)*4;data.set([x,y,42,255],offset);}
 const out=straightenPixels(data,width,height,[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}]);
 assert.equal(out.width,159);assert.equal(out.height,239);
 assert.deepEqual(Array.from(out.pixels.slice(0,4)),[0,0,42,255]);
 assert.deepEqual(Array.from(out.pixels.slice(-4)),[159,239,42,255]);
 assert.throws(()=>straightenPixels(data,50,50,[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}]),/too small/);
});
