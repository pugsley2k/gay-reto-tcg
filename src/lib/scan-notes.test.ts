import test from 'node:test';
import assert from 'node:assert/strict';
import {printedCardNumber,scanNotes,safeScanGrading} from './scan-notes';
test('review retains the entire collector number including holo prefixes',()=>{
 assert.equal(printedCardNumber('H26','H32'),'H26/H32');assert.equal(printedCardNumber('4','102'),'4/102');assert.equal(printedCardNumber('H26/H32','H32'),'H26/H32');assert.equal(printedCardNumber(null,'102'),'');
});
test('obscured or missing readability evidence clears guessed certs and never confirms a slab',()=>{
 for(const cert_readable of [undefined,false,'true'])assert.equal(safeScanGrading({grading:{company:'GetGraded',grade:'7',cert_number:'00744356',confirmed:true},cert_readable})?.cert_number,'');
 const grading=safeScanGrading({grading:{company:'GetGraded',grade:'7',cert_number:'00123456',confirmed:true},cert_readable:true});assert.equal(grading?.cert_number,'00123456');assert.equal(grading?.confirmed,false);
});
test('review shows year and set separately from catalogue facts and caps untrusted notes',()=>{
 const notes=scanNotes({release_year:2003,label_set:'Aquapolis',observations:['e-reader layout',12],warnings:[],cert_readable:false},true);
 assert.equal(notes.release_year,'2003');assert.deepEqual(notes.observations,['e-reader layout']);assert.match(notes.warnings[0],/certificate/);
 assert.equal(scanNotes({release_year:'unknown'},false).release_year,null);
});
