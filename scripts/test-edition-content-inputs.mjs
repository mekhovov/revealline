import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateEditionContentPackages } from './edition-content-inputs.mjs';
const bytes = Buffer.from('locally owned content');
const pin = {path:'game/collections/one.png', bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex'), approved:true, publication:'public'};
const files = new Map([[pin.path, bytes]]);
const packages = [{id:'local-one',files:[pin]}];
test('local content has explicit public approval and immutable byte identity',()=>{
 assert.deepEqual([...validateEditionContentPackages(packages,files)],[pin.path]);
 for(const change of [{approved:false},{publication:'private'},{bytes:1},{sha256:'0'.repeat(64)},{path:'game/../outside.png'},{path:'/tmp/picture.png'}])
  assert.throws(()=>validateEditionContentPackages([{id:'local-one',files:[{...pin,...change}]}],files));
 assert.throws(()=>validateEditionContentPackages(packages,new Map([[pin.path,Buffer.from('changed')]])));
 assert.throws(()=>validateEditionContentPackages([...packages,...packages],files));
 assert.throws(()=>validateEditionContentPackages([{id:'local-one',files:[pin,pin]}],files));
});
