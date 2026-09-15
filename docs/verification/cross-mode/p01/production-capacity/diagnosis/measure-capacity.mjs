// Read-only measurement, no production/test functions invoked or files mutated.
import fs from 'node:fs';
import crypto from 'node:crypto';
const raw = fs.readFileSync('authoring/library/fpv-field-kit/production.rltheme');
const m = JSON.parse(raw.subarray(12, 12 + raw.readUInt32BE(8)));
const prior = m.document;
const compiled = JSON.parse(fs.readFileSync('game/presentation/compiled/runtime.json'));
const required = prior.slots.filter(x => x.required).map(x => x.id);
const reference = x => ({id:x.id, revision:x.revision});
let selected = Object.fromEntries(Object.entries(compiled.resolved.bindings).map(([slot, ref]) =>
  [slot, prior.assets.find(x => x.id === ref.id && x.revision === ref.revision)]));
if (Object.values(selected).some(x => !x)) throw Error('Missing exact selected record');
function append(document, selected, replace) {
  const next = structuredClone(document), bindings = {}, selection = structuredClone(selected);
  for (const slot of required) {
    const asset = structuredClone(selected[slot]);
    if (replace) asset.description += ' / coordinated replacement capacity fixture';
    else asset.quality = {stage:'reviewed', evidence:['Capacity fixture only; not production qualification. '.repeat(4)]};
    const last = document.assets.filter(x => x.id === asset.id).sort((a,b) => b.revision-a.revision)[0];
    asset.revision=last.revision+1; asset.provenance.parent=reference(last);
    next.assets.push(asset); bindings[slot]=reference(asset); selection[slot]=asset;
  }
  const current=next.themes.find(x=>x.id===next.selection.theme.id && x.revision===next.selection.theme.revision);
  const theme={...structuredClone(current), revision:Math.max(...next.themes.filter(x=>x.id===current.id).map(x=>x.revision))+1,
    parent:reference(current), tokens:{}, bindings};
  next.themes.push(theme);next.selection.theme=reference(theme);next.selection.collection=null;next.revision++;
  return [next,selection];
}
function measure(value) {
  let total=0,nodes=0,numbers=0,numberActual=0,arrayKeys=0,strings=0,objectKeys=0;
  const enc = x => Buffer.byteLength(x);
  function walk(v) {
    nodes++;
    if(v===null || typeof v==='boolean') {total+=5;return;}
    if(typeof v==='number') {total+=24;numbers++;numberActual+=enc(JSON.stringify(v));return;}
    if(typeof v==='string') {const n=enc(v)+2;total+=n;strings+=n;return;}
    for(const [key,x] of Object.entries(v)) {
      const n=enc(key)+4;total+=n;
      if(Array.isArray(v))arrayKeys+=n;else objectKeys+=n;
      walk(x);
    }
  }
  walk(value);
  const serialized=Buffer.from(JSON.stringify(value));
  return {assets:value.assets.length,themes:value.themes.length,requiredSlots:required.length,
    serializedBytes:serialized.length,conservativeBytes:total,overcount:total-serialized.length,
    capBytes:4*1024*1024,serializedHeadroom:4*1024*1024-serialized.length,
    conservativeHeadroom:4*1024*1024-total,nodes,numberCount:numbers,
    numericCharge:numbers*24,actualNumericBytes:numberActual,arrayIndexKeyCharge:arrayKeys,
    stringCharge:strings,objectKeyCharge:objectKeys,
    serializedSha256:crypto.createHash('sha256').update(serialized).digest('hex')};
}
const [reviewed,nextSelected]=append(prior,selected,false);
const [replacement]=append(reviewed,nextSelected,true);
const result={status:'READ_ONLY_STATIC_INPUT_MEASUREMENT', sourceRevision:'69195ddd1d21a7bc3f863cf7589069a735301a03',
  provenance:'Actual r22 ledger and compiled exact selected bindings. Statically append the test’s 194 review successors, then 194 replacement successors. No production functions/test functions called, no validity success asserted.',
  assumptions:['Passing production reproduction confirms generated selected content equals retained selected content. No existing record contains the capacity-fixture evidence, so required review rows cannot reuse a prior fixture record.','JSON order does not affect measured total. This measurement does not identify the first traversal property that crosses the cap or replace runtime validation.'],
  capOwner:'game/presentation/model.mjs LIMITS.manifestBytes=4194304; own() invokes boundedJSON; both traversal budget and final serialized budget currently use the same cap.',
  current:measure(prior),reviewed:measure(reviewed),replacement:measure(replacement),
  wrapperBytes:{current:Buffer.byteLength(JSON.stringify(m)),reviewed:Buffer.byteLength(JSON.stringify({...m,document:reviewed})),replacement:Buffer.byteLength(JSON.stringify({...m,document:replacement}))},
  capacityFixturePreviouslyStored:prior.assets.some(x=>x.quality.evidence.some(x=>x.includes('Capacity fixture only'))),
  limitsPreservedByMeasurement:true,testsRun:false,sourceMutated:false};
console.log(JSON.stringify(result,null,2));
