import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
const fromRoot=p=>import(pathToFileURL(`${process.cwd()}/${p}`));
const {workshop}=await fromRoot('game/test/helpers/still-workshop.mjs');
const {fixture,structuralProbe}=await fromRoot('game/test/helpers/soundtrack-fixtures.mjs');
const {emptySoundtrackLibrary,upgradeSoundtrackLibrary,setCatalogueTracks,resolveSoundtrackCatalogue,resolveSoundtrackLibrary}=await fromRoot('game/soundtrack.mjs');
const {prepareSoundtrackLibrary,importSoundtrackBundle}=await fromRoot('game/soundtrack-bundle.mjs');
const {createSoundtrackStore}=await fromRoot('game/soundtrack-store.mjs');
const original=await fixture('recovery-limited'),personal=await fixture('recovery-owned');
function rawCatalogue(patch={}){
 const id='builtin.catalog.independent-still';
 return {format:'revealline-soundtrack-catalogue.v2',edition:'independent-still',tracks:[{...original.track,id,title:'Independent restricted title',edition:'independent-still',path:'optional/soundtracks/independent-still.mp3',tags:{genres:['metal'],role:'any',energy:3,themes:[]},policy:{id,sha256:original.track.asset.sha256,webPlayback:'allowed',offlineCache:'allowed',redistribute:'allowed',modify:'allowed',gameplayVideo:'unknown',contentId:'unknown',...patch}}]};
}
async function save(h,library,assets,catalogue){await h.open();const store=createSoundtrackStore({managedStore:h.managers[0]});await store.commit(await prepareSoundtrackLibrary(library,assets,{catalogue,probeMedia:structuralProbe}),{expectedGeneration:0});h.host.panel.close();return store;}
function noNetwork(t){const calls=t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network');});t.after(()=>assert.equal(calls.mock.callCount(),0));}

test('independent: mixed backup excludes a renamed restricted hash while preserving the permitted sibling and exact playlist',async t=>{
 noNetwork(t);const catalogue=resolveSoundtrackCatalogue(rawCatalogue({redistribute:'denied'}));
 const permitted={...personal.track,id:'personal.keep'},alias={...original.track,id:'personal.renamed',title:'Renamed local claim',rights:{...original.track.rights,kind:'original'}};
 const library=resolveSoundtrackLibrary({...upgradeSoundtrackLibrary(emptySoundtrackLibrary()),tracks:[permitted,alias],playlists:[{id:'personal.mix',title:'Ordered personal mix',trackIds:[permitted.id,alias.id,permitted.id],order:'ordered',repeat:'all'}],selection:{playlistId:'personal.mix'}});
 const h=await workshop(t,{host:{catalogue}});const store=await save(h,library,[...personal.assets,...original.assets],catalogue),puts=h.memory.allPuts.length,before=await store.read();
 assert.equal(await h.hostNode('export-audio').onclick(),true);
 const restored=await importSoundtrackBundle(h.urls.get(h.hostNode('download-audio').href),{catalogue,probeMedia:structuralProbe});
 assert.deepEqual(restored.library.referenceOnlyTrackIds,[alias.id]);assert.deepEqual(restored.library.playlists,library.playlists);assert.equal(restored.assets.length,1);assert.equal(restored.assets[0].sha256,personal.track.asset.sha256);assert.deepEqual(Buffer.from(await restored.assets[0].blob.arrayBuffer()),Buffer.from(await personal.blob.arrayBuffer()));
 assert.match(h.hostNode('status').textContent,/Renamed local claim.*without audio/);h.hostNode('download-audio').onclick();assert.match(h.hostNode('status').textContent,/Renamed local claim.*without audio/);
 assert.deepEqual(await store.read(),before);assert.equal(h.memory.allPuts.length,puts);
});

test('independent: raw host authority is privately owned and unknown offline permission stays an honest importable reference',async t=>{
 noNetwork(t);const raw=rawCatalogue({offlineCache:'unknown'}),trusted=resolveSoundtrackCatalogue(raw),library=setCatalogueTracks(emptySoundtrackLibrary(),trusted.tracks);
 const h=await workshop(t,{host:{catalogue:raw}});raw.tracks[0].policy.offlineCache='allowed';raw.tracks[0].policy.redistribute='allowed';
 const store=await save(h,library,[],trusted),puts=h.memory.allPuts.length;
 assert.equal(await h.hostNode('export-audio').onclick(),true);
 const restored=await importSoundtrackBundle(h.urls.get(h.hostNode('download-audio').href),{catalogue:trusted,probeMedia:structuralProbe});
 assert.deepEqual(restored.library.referenceOnlyTrackIds,[trusted.tracks[0].id]);assert.equal(restored.assets.length,0);assert.match(h.hostNode('status').textContent,/not verified/);assert.match(h.hostNode('status').textContent,/Independent restricted title/);
 assert.equal((await store.read()).generation,1);assert.equal(h.memory.allPuts.length,puts);
});

test('independent: a real saved explicit online playlist with no originals cannot be silently converted into recovery references',async t=>{
 noNetwork(t);const catalogue=resolveSoundtrackCatalogue(rawCatalogue()),track=catalogue.tracks[0];
 const library=resolveSoundtrackLibrary({...setCatalogueTracks(emptySoundtrackLibrary(),catalogue.tracks),playlists:[{id:'review.online',title:'Selected online',trackIds:[track.id],order:'ordered',repeat:'all'}],selection:{playlistId:'review.online'}});
 const h=await workshop(t,{host:{catalogue}});const store=await save(h,library,[],catalogue),puts=h.memory.allPuts.length,before=await store.read();
 assert.equal(await h.hostNode('export-audio').onclick(),false);assert.equal(h.urls.size,0);assert.equal(h.hostNode('download-audio').hidden,true);assert.match(h.hostNode('status').textContent,/missing permitted originals: Independent restricted title/);assert.match(h.hostNode('status').textContent,/No backup was prepared/);
 assert.deepEqual(await store.read(),before);assert.equal(h.memory.allPuts.length,puts);
});
