import test from 'node:test';import assert from 'node:assert/strict';
import {detectSlabHeader,validHeaderStyle,headerTextColour} from './slab-header-colour';
import {readGrading} from './card-grading';
import {validateListing} from './card-listing';
function photo(main:number[],band:number[]){const width=100,height=200;const data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const colour=y>=24&&y<36?main:y>=36&&y<44?band:[130,72,35];const i=(y*width+x)*4;data.set([...colour,255],i);}return{data,width,height};}
test('samples dark/blue and white/red labels without taking the wooden background',()=>{
 for(const [main,band] of [[[52,54,61],[49,91,150]],[[240,240,240],[190,30,40]]]){const p=photo(main,band);const result=detectSlabHeader(p.data,p.width,p.height,.12);assert.equal(result.style.background,'#'+main.map(v=>v.toString(16).padStart(2,'0')).join(''));assert.equal(result.style.accent,'#'+band.map(v=>v.toString(16).padStart(2,'0')).join(''));assert.equal(validHeaderStyle(result.style),true);}
 const p=photo([52,54,61],[49,91,150]);assert.equal(detectSlabHeader(p.data,p.width,p.height).style.background,'#34363d');
});
test('chooses contrasting text and only preserves safe colour values through grading saves',()=>{
 assert.equal(headerTextColour('#ffffff'),'#17191d');assert.equal(headerTextColour('#34363d'),'#ffffff');
 const grading={company:'PSA',grade:'9',cert_number:'001234',confirmed:true,header_style:{background:'#ffffff',accent:'#aa2222',text:'#17191d'}};
 assert.deepEqual(readGrading(grading)?.header_style,grading.header_style);
 assert.deepEqual(validateListing({name:'Test card',number:'4',language:'English',price:1000,available:true,image_url:'https://images.pokemontcg.io/base1/4.png',front_image_url:'https://example.com/slab.jpg',grading}).grading?.header_style,grading.header_style);
 assert.equal(readGrading({...grading,header_style:{...grading.header_style,accent:'url(https://evil.test)'}})?.header_style,undefined);
 assert.throws(()=>detectSlabHeader(new Uint8ClampedArray(4),1,1));
});
