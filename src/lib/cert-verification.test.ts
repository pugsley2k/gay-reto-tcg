import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGetGraded,compareCertificate,officialCertUrl} from './cert-record';
import {verifyCertificate} from './cert-verification';
import {matchesCard} from './card-catalog';
const grading={company:'GetGraded',grade:'7',cert_number:'00744256',confirmed:false};
const card={name:'Tentacruel',number:'H26/H32',set:'Aquapolis'};
const html=`<style>.values{}</style><!--<div class="card_name">Wrong</div>--><span class="cert_no">00744256</span><div class="card_name">Tentacruel &#8211; H26/H32 &#8211; 2003 &#8211; Aquapolis</div><div class="grading_info"><div class="g_title">EXCELLENT</div><div class="values">7</div></div><h3>Graders Notes</h3><div class="values">10</div>`;
test('GetGraded record parser retains leading zeros and reads grade separately from population',()=>{
 const record=parseGetGraded(html,grading.cert_number)!;
 assert.equal(record.grade,'7');assert.equal(record.name,'Tentacruel');assert.equal(record.cert_number,'00744256');
 assert.equal(parseGetGraded(html,'00744257'),null);assert.equal(parseGetGraded('<form>00744256</form>','00744256'),null);
 assert.equal(compareCertificate(record,grading,card).status,'matched');
 for(const patch of [{name:'Charizard'},{number:'H25/H32'},{set:'Skyridge'}])assert.equal(compareCertificate(record,grading,{...card,...patch}).status,'mismatch');
 assert.equal(compareCertificate(record,{...grading,grade:'8'},card).status,'mismatch');
 assert.equal(compareCertificate(record,{...grading,grade:'7 Excellent'},card).status,'matched');
 assert.equal(compareCertificate(record,{...grading,grade:'7 Pristine'},card).status,'mismatch');
});
test('blocked, unreadable and unsupported official sources never become verified',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('Blocked',{status:403}));
 assert.equal((await verifyCertificate(grading,card)).status,'unavailable');
 assert.equal((await verifyCertificate({...grading,company:'Other'},card)).status,'unavailable');
 assert.equal(officialCertUrl('Other','123'),null);
 assert.equal(officialCertUrl('GetGraded','00744256'),'https://www.getgraded.co.uk/cert-checker/?cert=00744256');
});
test('Aquapolis H26/H32 matches the separate holo subset without weakening other totals',()=>{
 const catalog={id:'ecard2-H26',name:'Tentacruel',localId:'H26',set:{name:'Aquapolis',cardCount:{official:147}}};
 assert.equal(matchesCard(catalog,{name:'Tentacruel',number:'H26',total:'H32',language:'English'}),true);
 for(const total of ['H33','33'])assert.equal(matchesCard(catalog,{name:'Tentacruel',number:'H26',total,language:'English'}),false);
 assert.equal(matchesCard({...catalog,id:'different-H26'},{name:'Tentacruel',number:'H26',total:'H32',language:'English'}),false);
});
