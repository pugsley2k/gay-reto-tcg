import test from 'node:test';import assert from 'node:assert/strict';
import {slabPresentation} from './slab-presentation';import {makeCardPromo} from './card-promo';
test('every grader uses the saved photo palette in both listing and promo presentation',()=>{
 const header={background:'#20252a',accent:'#2655b0',text:'#ffffff'};
 for(const company of ['PSA','CGC','BGS','GetGraded','Other']){
  const grading={company,grade:'9 Mint',confirmed:true,header_style:header};
  assert.deepEqual(slabPresentation(grading)?.header,header);
  const promo=makeCardPromo({id:'card',name:'Test',price:1000,available:true,sold_at:null,image_url:'https://images.pokemontcg.io/base1/4.png',front_image_url:null,back_image_url:null,set:'Base',number:'4',condition:null,grading},1);
  assert.deepEqual(promo.slab,slabPresentation(grading));
 }
 assert.equal(slabPresentation({company:'PSA',grade:'9',confirmed:false}),null);
 assert.equal(slabPresentation(null),null);
 assert.equal(slabPresentation({company:'PSA',grade:'9',confirmed:true})?.header.background,'#34363d');
});
