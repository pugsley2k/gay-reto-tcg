import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGroupDetection,validCardBox,cropPixelBox,MAX_GROUP_CARDS} from './group-card-detection';
const a={x:20,y:80,width:250,height:700};const b={x:360,y:80,width:250,height:700};
test('detections preserve separate physical copies and discard repeated boxes',()=>{
 const result=parseGroupDetection({cards:[{box:a,note:'First card'},{box:b,note:'Same artwork, separate card'},{box:a}],warnings:['Glare']});
 assert.equal(result.cards.length,2);assert.deepEqual(result.cards[1].box,b);assert.equal(result.warnings.length,2);
});
test('invalid model coordinates never reach canvas cropping',()=>{
 for(const box of [{...a,x:-1},{...a,width:1200},{...a,width:0},{...a,x:NaN},{...a,y:'80'},null])assert.equal(validCardBox(box),false);
 assert.equal(parseGroupDetection({cards:[{box:{...a,x:-1}},{box:b}]}).cards.length,1);
 assert.throws(()=>parseGroupDetection({cards:'not an array'}));
 assert.throws(()=>cropPixelBox({...a,x:1000},3000,2000));
});
test('normalised bounds map to original image pixels and keep the last image edge',()=>{
 assert.deepEqual(cropPixelBox({x:0,y:0,width:500,height:1000},3001,2001),{x:0,y:0,width:1501,height:2001});
 assert.deepEqual(cropPixelBox({x:500,y:0,width:500,height:1000},3001,2001),{x:1500,y:0,width:1501,height:2001});
 assert.deepEqual(cropPixelBox({x:0,y:0,width:1000,height:1000},3001,2001),{x:0,y:0,width:3001,height:2001});
});
test('overlap and partial cards retain explicit warnings; empty detections remain empty',()=>{
 const result=parseGroupDetection({cards:[{box:a,note:'Partly obscured; retake'}],warnings:['Another card is covered']});
 assert.match(result.cards[0].note,/retake/);assert.equal(result.warnings[0],'Another card is covered');
 assert.deepEqual(parseGroupDetection({cards:[],warnings:['No card fronts visible']}),{cards:[],warnings:['No card fronts visible']});
 const tooMany=parseGroupDetection({cards:Array.from({length:MAX_GROUP_CARDS+1},()=>({box:a}))});
 assert.match(tooMany.warnings.at(-1)!,/remaining cards/);
});
