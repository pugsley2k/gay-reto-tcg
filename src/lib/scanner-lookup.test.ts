import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerLookupPayload,scannerPriceAfterLookup} from './scanner-lookup';
const details={name:'Charizard V',number:'154',language:'English',holo_type:'Ultra Rare',edition:'Not applicable',set:'Brilliant Stars'};
test('single scan refresh retains the scanned total and chosen printing',()=>{const payload=scannerLookupPayload(details,'Charizard V','172','swsh9-154');assert.equal(payload.total,'172');assert.equal(payload.catalog_id,'swsh9-154');assert.equal(payload.finish,'Ultra Rare');});
test('manually entered slash numbers are split into catalogue number and total',()=>{const payload=scannerLookupPayload({...details,number:'154/172'},'','999');assert.equal(payload.number,'154');assert.equal(payload.total,'172');assert.equal(payload.catalog_id,undefined);});
test('a missing or ambiguous quote never silently clears a seller-entered price',()=>{assert.equal(scannerPriceAfterLookup('12.50',true,null),'12.50');assert.equal(scannerPriceAfterLookup('12.50',false,{gbp:'99.00'}),'12.50');assert.equal(scannerPriceAfterLookup('12.50',true,{gbp:'14.25'}),'14.25');});
