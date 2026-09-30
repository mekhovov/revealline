import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { inspectImport, encodeWorldGLB, projectFromImport, compilePlayable, mergeReimport, preparePack, inspectPack, installPack, resolveExperience } from '../../optional-practice/civilian-fpv/world-content.mjs';
import { openWorldStore } from '../../optional-practice/civilian-fpv/world-store.mjs';
import { exportEditableZip, importEditableZip } from '../../optional-practice/civilian-fpv/world-zip.mjs';
const requireAuthoring=createRequire(new URL('../../authoring/fpv-worlds/package.json',import.meta.url));
const {IDBFactory}=requireAuthoring('fake-indexeddb');
function fixture(change=()=>{}) {
  const binary=new Uint8Array(new Float32Array([0,0,0, 1,0,0, 0,1,0]).buffer);
  const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1,3]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],
    nodes:[{mesh:0},{translation:[10,0,0],children:[2]},{translation:[0,2,0],extras:{rl:{id:'start',kind:'spawn'}}},{extras:{rl:{id:'wall',kind:'collider',size:[2,3,1]}}}]};
  change(doc,binary); return {doc,binary,bytes:encodeWorldGLB(doc,binary)};
}
async function imported(change) {return inspectImport({files:{'world.glb':fixture(change).bytes},entry:'world.glb',id:'test-world'});}
async function projectPack() {const result=await imported(),project=projectFromImport(result),assets=new Map([[project.world.modelAsset,result.modelBlob]]);return {project,assets,pack:await preparePack(project,{assets})};}
test('extracts stable semantic IDs in world coordinates and produces a self-contained GLB',async()=>{
  const result=await imported();assert.deepEqual(result.metadata.anchors[0].position,{x:10,y:2,z:0});assert.equal(result.metadata.colliders[0].id,'wall');assert.match(result.sourceHash,/^[a-f0-9]{64}$/);
  const again=await inspectImport({files:{'reimport.glb':result.modelBlob},entry:'reimport.glb'});assert.equal(again.sourceHash,result.sourceHash);
});
test('local glTF resource resolution repacks buffers and rejects URLs, traversal and missing resources',async()=>{
  const {doc,binary}=fixture();doc.buffers[0].uri='mesh.bin';const files={'scene.gltf':JSON.stringify(doc),'mesh.bin':binary};
  const result=await inspectImport({files,entry:'scene.gltf'});assert.equal(result.document.buffers[0].uri,undefined);
  for(const uri of ['https://host/mesh.bin','../mesh.bin','%2e%2e/mesh.bin','mesh.bin?x','file:mesh.bin']) {doc.buffers[0].uri=uri;await assert.rejects(inspectImport({files:{...files,'scene.gltf':JSON.stringify(doc)},entry:'scene.gltf'}),/relative local paths/);}
  doc.buffers[0].uri='missing.bin';await assert.rejects(inspectImport({files:{...files,'scene.gltf':JSON.stringify(doc)},entry:'scene.gltf'}),/Missing local resource/);
});
test('GLB length, accessor overflow, nonfinite data, node cycles and duplicate semantic IDs are rejected',async()=>{
  const truncated=fixture().bytes.slice(0,-4);await assert.rejects(inspectImport({files:{'x.glb':truncated},entry:'x.glb'}),/length mismatch/);
  await assert.rejects(imported(d=>{d.accessors[0].count=1000;}),/Accessor exceeds/);
  await assert.rejects(imported((d,b)=>new DataView(b.buffer).setFloat32(0,NaN,true)),/Non-finite/);
  await assert.rejects(imported(d=>{d.nodes[2].children=[1];}),/cycle/);
  await assert.rejects(imported(d=>{d.nodes[3].extras.rl.id='start';}),/unique stable/);
});
test('required unsupported compression is rejected explicitly',async()=>{
  await assert.rejects(imported(d=>{d.extensionsRequired=['KHR_texture_basisu'];}),/Unsupported required extension/);
});
test('reimport keeps authored overrides and diagnoses removed source IDs',async()=>{
  const first=await imported(),project=projectFromImport(first);project.overrides.start={position:{x:20,y:2,z:0}};project.overrides.wall={deleted:true};
  const next=await imported(d=>{d.nodes[1].translation[0]=12;delete d.nodes[3].extras;});
  const merged=mergeReimport(project,next);assert.equal(compilePlayable(merged.project).world.anchors[0].position.x,20);assert.equal(merged.project.source.anchors[0].position.x,12);
  assert.ok(merged.diagnostics.some(d=>d.code==='orphan-override'&&d.id==='wall'));assert.ok(merged.diagnostics.some(d=>d.code==='override-preserved'));
});
test('project composition resolves explicit courses, themes and playlist references',async()=>{
  const {project}=await projectPack();project.courses=[{id:'first'}];project.themes=[{id:'pixel'}];project.playlists=[{id:'tour',courseIds:['first']}];
  assert.equal(resolveExperience(project,{playlistId:'tour',themeId:'pixel'}).course.id,'first');assert.throws(()=>resolveExperience(project,{courseId:'missing'}),/Unknown course/);
});
test('portable pack verifies exact hashes and rejects trailing bytes or tampering',async()=>{
  const {pack,project}=await projectPack(),verified=await inspectPack(pack);assert.equal(verified.project.id,project.id);
  const bytes=new Uint8Array(await pack.arrayBuffer());bytes[bytes.length-1]^=1;await assert.rejects(inspectPack(bytes),/hash mismatch/);
  await assert.rejects(inspectPack(new Blob([pack,new Uint8Array([0])])),/Trailing/);
});
test('editable ZIP round trip verifies directory metadata, CRC and resource closure',async()=>{
  const {project,assets}=await projectPack(),zip=await exportEditableZip(project,{assets}),result=await importEditableZip(zip);assert.deepEqual(result.project,project);assert.equal(result.assets.size,1);
  const bytes=new Uint8Array(await zip.arrayBuffer());bytes[45]^=1;await assert.rejects(importEditableZip(new Blob([bytes])),/checksum|metadata|JSON/);
});
test('IndexedDB install writes metadata and all blobs; stale generation does not change either',async()=>{
  const {pack,project}=await projectPack(),store=await openWorldStore({indexedDB:new IDBFactory(),name:'world-store'});
  try {
    const result=await installPack(pack,{store,expectedGeneration:0});assert.equal(result.generation,1);const stored=await store.get(project.id);assert.equal(stored.assets.size,1);
    await assert.rejects(installPack(pack,{store,expectedGeneration:0}),e=>e.code==='generation-conflict');assert.equal(await store.generation(),1);assert.equal((await store.get(project.id)).sha256,stored.sha256);
    const changed=structuredClone(project);changed.title='Revision two';const second=await preparePack(changed,{assets:stored.assets});await installPack(second,{store,expectedGeneration:1});assert.equal((await store.get(project.id)).project.title,'Revision two');
    await store.remove(project.id,{expectedGeneration:2});assert.equal(await store.get(project.id),null);assert.equal(await store.generation(),3);
  } finally {store.close();}
});
test('hash validation completes before installation; corrupt packs never open an install transaction',async()=>{
  const {pack}=await projectPack(),bytes=new Uint8Array(await pack.arrayBuffer());bytes[bytes.length-1]^=1;let called=false;
  await assert.rejects(installPack(bytes,{store:{install(){called=true;}}}),/hash mismatch/);assert.equal(called,false);
});
test('transaction abort after queuing new blobs retains the previous revision and blobs',async()=>{
  const {pack,project}=await projectPack(),store=await openWorldStore({indexedDB:new IDBFactory(),name:'rollback'});
  try {
    await installPack(pack,{store,expectedGeneration:0});const before=await store.get(project.id),assets=new Map([[project.world.modelAsset,new Blob(['replacement'])]]);
    await assert.rejects(store.install({project:{...project,uncloneable:()=>{}},assets,sha256:'0'.repeat(64),expectedGeneration:1}));
    const after=await store.get(project.id);assert.equal(after.sha256,before.sha256);assert.equal(await store.generation(),1);
    assert.deepEqual(new Uint8Array(await after.assets.get(project.world.modelAsset).arrayBuffer()),new Uint8Array(await before.assets.get(project.world.modelAsset).arrayBuffer()));
  } finally {store.close();}
});
test('animation cannot move gameplay anchors, but bounded cosmetic object animation is accepted',async()=>{
  const {doc,binary}=fixture(),data=new Uint8Array(68);data.set(binary);new Float32Array(data.buffer,36).set([0,1, 0,0,0, 1,0,0]);
  doc.buffers[0].byteLength=68;doc.bufferViews.push({buffer:0,byteOffset:36,byteLength:8},{buffer:0,byteOffset:44,byteLength:24});
  doc.accessors.push({bufferView:1,componentType:5126,count:2,type:'SCALAR',min:[0],max:[1]},{bufferView:2,componentType:5126,count:2,type:'VEC3'});
  doc.animations=[{samplers:[{input:1,output:2}],channels:[{sampler:0,target:{node:0,path:'translation'}}]}];
  const run=()=>inspectImport({files:{'animated.glb':encodeWorldGLB(doc,data)},entry:'animated.glb'});
  assert.equal((await run()).document.animations.length,1);doc.animations[0].channels[0].target.node=1;await assert.rejects(run(),/gameplay marker/);
});
