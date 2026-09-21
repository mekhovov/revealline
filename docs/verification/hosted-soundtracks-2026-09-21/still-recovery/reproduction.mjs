import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
const fromRoot=p=>import(pathToFileURL(`${process.cwd()}/${p}`));
const {workshop}=await fromRoot('game/test/helpers/still-workshop.mjs');
const {fixture,structuralProbe}=await fromRoot('game/test/helpers/soundtrack-fixtures.mjs');
const {emptySoundtrackLibrary,setCatalogueTracks,resolveSoundtrackCatalogue,resolveSoundtrackLibrary}=await fromRoot('game/soundtrack.mjs');
const {SOUNDTRACK_CATALOGUE}=await fromRoot('game/content/soundtrack-catalogue.mjs');
const {prepareSoundtrackLibrary,exportSoundtrackBundle,importSoundtrackBundle}=await fromRoot('game/soundtrack-bundle.mjs');
const {soundtrackPortableRecoveryPlan}=await fromRoot('game/soundtrack-portable.mjs');
const {createSoundtrackStore}=await fromRoot('game/soundtrack-store.mjs');
const original=await fixture('still-recovery');
function tinyCatalogue(redistribute='allowed'){
 const id='builtin.catalog.still-recovery';
 return resolveSoundtrackCatalogue({format:'revealline-soundtrack-catalogue.v2',edition:'still-review',tracks:[{...original.track,id,edition:'still-review',path:'optional/soundtracks/still-recovery.mp3',tags:{genres:['metal'],role:'any',energy:3,themes:[]},policy:{id,sha256:original.track.asset.sha256,webPlayback:'allowed',offlineCache:'allowed',redistribute,modify:'allowed',gameplayVideo:'unknown',contentId:'unknown'}}]});
}
async function decode(blob){const header=new Uint8Array(await blob.slice(0,12).arrayBuffer());const size=new DataView(header.buffer).getUint32(8,false);return{manifest:JSON.parse(await blob.slice(12,12+size).text()),bodyBytes:blob.size-12-size};}
async function actualHost(t,library,assets,catalogue){
 let network=0;t.mock.method(globalThis,'fetch',async()=>{network++;throw new Error('Unexpected network');});
 const h=await workshop(t);await h.open();
 const store=createSoundtrackStore({managedStore:h.managers[0]});
 const prepared=await prepareSoundtrackLibrary(library,assets,{catalogue,probeMedia:structuralProbe});
 await store.commit(prepared,{expectedGeneration:0});h.host.panel.close();
 const before=await store.read();
 assert.equal(await h.hostNode('export-audio').onclick(),true);
 const blob=h.urls.get(h.hostNode('download-audio').href);assert.ok(blob);
 const after=await store.read();assert.equal(after.generation,before.generation);assert.equal(network,0);
 return{blob,...await decode(blob),status:h.hostNode('status').textContent,savedAssets:after.assets.length,generation:after.generation};
}
test('REPRO: actual host exports 70 unused approved catalogue pins as unusable reference-only recovery',async t=>{
 const catalogue=resolveSoundtrackCatalogue(SOUNDTRACK_CATALOGUE),library=setCatalogueTracks(emptySoundtrackLibrary(),catalogue.tracks);
 assert.equal(catalogue.tracks.length,70);
 const result=await actualHost(t,library,[],catalogue);
 assert.equal(result.manifest.referenceOnlyTrackIds.length,70);assert.equal(result.manifest.assets.length,0);assert.equal(result.bodyBytes,0);
 await assert.rejects(importSoundtrackBundle(result.blob,{catalogue,probeMedia:structuralProbe}),/permitted recording cannot be reference-only/);
 const corrected=await exportSoundtrackBundle(library,[],{catalogue});
 const imported=await importSoundtrackBundle(corrected,{catalogue,probeMedia:structuralProbe});assert.equal(imported.library.catalogTracks.length,0);assert.equal(imported.assets.length,0);
 console.log(JSON.stringify({case:'unused70',result:'host returns success but current trusted importer rejects backup',hostReferenceCount:70,hostAssetCount:0,hostStatus:result.status,correctAuthorityOmittedPins:70,correctedBytes:corrected.size,networkRequests:0,savedGeneration:result.generation}));
});
test('REPRO: actual host drops installed permitted fixture bytes despite retaining them in storage',async t=>{
 const catalogue=tinyCatalogue(),track=catalogue.tracks[0];
 const library=resolveSoundtrackLibrary({...setCatalogueTracks(emptySoundtrackLibrary(),catalogue.tracks),installedTrackIds:[track.id]});
 const result=await actualHost(t,library,original.assets,catalogue);
 assert.equal(result.savedAssets,1);assert.equal(result.manifest.assets.length,0);assert.equal(result.bodyBytes,0);assert.deepEqual(result.manifest.referenceOnlyTrackIds,[track.id]);
 await assert.rejects(importSoundtrackBundle(result.blob,{catalogue,probeMedia:structuralProbe}),/permitted recording cannot be reference-only/);
 const fixed=await exportSoundtrackBundle(library,original.assets,{catalogue});
 const imported=await importSoundtrackBundle(fixed,{catalogue,probeMedia:structuralProbe});assert.equal(imported.assets.length,1);assert.deepEqual(new Uint8Array(await imported.assets[0].blob.arrayBuffer()),new Uint8Array(await original.blob.arrayBuffer()));
 console.log(JSON.stringify({case:'installedPermitted',savedOriginalBytes:original.blob.size,savedAssetCount:1,exportedAssets:0,exportedBodyBytes:0,hostStatus:result.status,correctAuthorityPreservesExactBytes:true,networkRequests:0}));
});
test('REPRO: genuine restricted recovery has no host notice that its audio is omitted',async t=>{
 const catalogue=tinyCatalogue('denied'),library=setCatalogueTracks(emptySoundtrackLibrary(),catalogue.tracks);
 const result=await actualHost(t,library,[],catalogue);
 const imported=await importSoundtrackBundle(result.blob,{catalogue,probeMedia:structuralProbe});assert.equal(imported.library.referenceOnlyTrackIds.length,1);
 const plan=soundtrackPortableRecoveryPlan(library,{catalogue});assert.match(plan.notice,/without audio/);assert.doesNotMatch(result.status,/without audio|online|reference/i);
 console.log(JSON.stringify({case:'restrictedNotice',recoveryReferenceCount:1,hostStatus:result.status,requiredNotice:plan.notice,networkRequests:0}));
});
