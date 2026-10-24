import test from 'node:test';
import assert from 'node:assert/strict';
import {findArtCandidates,selectArtCandidate} from './artwork-matching';
const candidates=[{id:'swsh8-251',name:'Mew V',number:'251',image_url:'https://assets.tcgdex.net/en/swsh/swsh8/251/high.webp'}];
test('only a high-confidence, non-conflicting visual selection from the actual shortlist is accepted',()=>{
 assert.equal(selectArtCandidate({id:'swsh8-251',confidence:'high',conflict:false},candidates)?.id,'swsh8-251');
 for(const value of [null,{id:'invented',confidence:'high',conflict:false},{id:'swsh8-251',confidence:'uncertain',conflict:false},{id:'swsh8-251',confidence:'high',conflict:true},{id:'swsh8-251',confidence:'high'}])assert.equal(selectArtCandidate(value,candidates),null);
});
test('artwork search works without OCR numbers and refuses oversized or untrusted image shortlists',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify([{id:'swsh8-251',name:'Mew V',localId:'251',image:'https://assets.tcgdex.net/en/swsh/swsh8/251'},{id:'bad',name:'Mew V',localId:'2',image:'https://evil.example/asset'}]),{status:200});
  const identity={name:'Mew V',number:'',language:'English'};
  assert.deepEqual(await findArtCandidates(identity),candidates);
  globalThis.fetch=async()=>new Response(JSON.stringify(Array.from({length:17},(_,i)=>({id:`s-${i}`,name:'Mew V',localId:String(i),image:`https://assets.tcgdex.net/en/swsh/swsh8/${i}`}))),{status:200});
  assert.deepEqual(await findArtCandidates(identity),[]);
  assert.equal((await findArtCandidates({...identity,number:'001'})).length,1);
 }finally{globalThis.fetch=original;}
});

