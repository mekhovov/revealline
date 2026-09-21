import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
const fromRoot = (relative) => import(pathToFileURL(`${process.cwd()}/${relative}`));
const { createSoundtrackPlayer } = await fromRoot('game/ui/soundtrack-player.mjs');
const { BUILTIN_SOUNDTRACK_TRACKS, emptySoundtrackLibrary, resolveSoundtrackCatalogue, setCatalogueTracks } = await fromRoot('game/soundtrack.mjs');
const { audioHarness, settleUntil } = await fromRoot('game/test/helpers/soundtrack-audio.mjs');
const { fixture } = await fromRoot('game/test/helpers/soundtrack-fixtures.mjs');
function setup(library, options={}) {
  const h=audioHarness();
  h.player=createSoundtrackPlayer({soundscape:h.soundscape,audioElement:h.media,secondAudioElement:null,URLImpl:h.URLImpl,readAsset:async()=>null,fadeMs:0,...options});
  h.player.setLibrary(library);
  return h;
}
const recordings = await Promise.all(['independent-low','independent-high','independent-menu'].map(fixture));
const rawCatalogue=()=>({format:'revealline-soundtrack-catalogue.v2',edition:'cache-review',tracks:recordings.map((r,i)=>{
 const id=`builtin.catalog.cache-review-${i}`;
 return {...r.track,id,edition:'cache-review',path:`optional/soundtracks/cache-review-${i}.mp3`,tags:{genres:['metal'],role:i===2?'menu':'gameplay',energy:i===1?5:1,themes:[]},policy:{id,sha256:r.track.asset.sha256,webPlayback:'allowed',offlineCache:'allowed',redistribute:'allowed',modify:'allowed',gameplayVideo:'allowed',contentId:'not-registered'}};
})});
const readAsset=async hash=>recordings.find(r=>r.track.asset.sha256===hash)?.blob??null;

test('independent: context ownership and map/campaign/global precedence survive warmed selection reuse', async t=>{
 const ids=BUILTIN_SOUNDTRACK_TRACKS.slice(0,3).map(t=>t.id);
 const playlists=ids.map((id,i)=>({id:`review.list-${i}`,title:`List ${i}`,trackIds:[id],order:'ordered',repeat:'all'}));
 const library={...emptySoundtrackLibrary(),playlists,assignments:[{scope:'global',key:null,playlistId:playlists[0].id},{scope:'campaign',key:'campaign-a',playlistId:playlists[1].id},{scope:'map',key:'map-a',playlistId:playlists[2].id}]};
 const h=setup(library);t.after(()=>h.player.dispose());
 const context={scene:'gameplay'};h.player.setContext(context);await h.player.prepare();
 assert.deepEqual(h.player.snapshot().queue,[ids[0]]);
 context.campaignKey='campaign-a';await h.player.next();
 assert.deepEqual(h.player.snapshot().queue,[ids[0]]);
 h.player.setContext(context);await h.player.next();assert.deepEqual(h.player.snapshot().queue,[ids[1]]);
 context.mapKey='map-a';h.player.setContext(context);await h.player.next();assert.deepEqual(h.player.snapshot().queue,[ids[2]]);
 await h.player.selectPlaylist(playlists[0].id);assert.deepEqual(h.player.snapshot().queue,[ids[0]]);
 await h.player.selectPlaylist(null);assert.deepEqual(h.player.snapshot().queue,[ids[2]]);
 assert.equal(h.player.snapshot().desired,false);
});

test('independent: energy and scene changes invalidate the cache without external context mutation or playback intent', async t=>{
 const catalogue=resolveSoundtrackCatalogue(rawCatalogue());
 const library=setCatalogueTracks(emptySoundtrackLibrary(),catalogue.tracks);
 const h=setup(library,{catalogue,readAsset});t.after(()=>h.player.dispose());
 const context={scene:'gameplay',energy:1};h.player.setContext(context);await h.player.prepare();
 assert.deepEqual(h.player.snapshot().queue,[catalogue.tracks[0].id]);
 context.energy=5;await h.player.next();assert.deepEqual(h.player.snapshot().queue,[catalogue.tracks[0].id]);
 h.player.setContext(context);await h.player.next();assert.deepEqual(h.player.snapshot().queue,[catalogue.tracks[1].id]);
 h.player.setContext({scene:'menu',energy:1});
 await settleUntil(()=>h.player.snapshot().track?.id===catalogue.tracks[2].id && h.player.snapshot().status==='paused');
 assert.deepEqual(h.player.snapshot().queue,[catalogue.tracks[2].id]);
 assert.equal(h.player.snapshot().desired,false);assert.equal(h.media.plays,0);
});

test('independent: shallow frozen raw catalogue never gains cache authority and malformed live edits still reject', async t=>{
 const catalogue=Object.freeze(rawCatalogue());
 const library=setCatalogueTracks(emptySoundtrackLibrary(),catalogue.tracks);
 const h=setup({...library,listening:{...library.listening,mode:'metal'}},{catalogue,readAsset});t.after(()=>h.player.dispose());
 h.player.setContext({scene:'menu'});await h.player.prepare();
 assert.equal(h.player.snapshot().source,'catalogue');
 const policy=catalogue.tracks[2].policy;policy.webPlayback='denied';
 assert.equal(h.player.snapshot().source,'catalogue-fallback');
 const hash=policy.sha256;policy.sha256='0'.repeat(64);
 assert.throws(()=>h.player.snapshot(),/policy|hash|identity/i);
 policy.sha256=hash;policy.webPlayback='allowed';
 assert.equal(h.player.snapshot().source,'catalogue');
 assert.equal(h.media.plays,0);
});


test('independent: invalid raw catalogue cannot retain media ownership or master subscriptions', ()=>{
 const h=audioHarness(),subscriptions=new Set();
 const audioMaster={snapshot:()=>({muted:true,volume:1}),subscribe(fn){subscriptions.add(fn);return()=>subscriptions.delete(fn);}};
 const options={soundscape:h.soundscape,audioElement:h.media,secondAudioElement:null,URLImpl:h.URLImpl,readAsset:async()=>null,audioMaster};
 assert.throws(()=>createSoundtrackPlayer({...options,catalogue:{invalid:true}}),/soundtrack catalogue/);
 assert.equal(subscriptions.size,0);
 const player=createSoundtrackPlayer(options);
 assert.equal(subscriptions.size,2);
 player.dispose();assert.equal(subscriptions.size,0);
});
