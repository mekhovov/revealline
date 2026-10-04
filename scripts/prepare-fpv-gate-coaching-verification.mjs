/** Freeze a manual real-host fixture. No Git writes, fetching or unit tests. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2),
  output = args[0],
  candidate = args[1] ?? '';
if (
  !/^dist\/fpv-gate-coaching-verification-[a-z0-9-]+$/.test(output ?? '') ||
  (candidate && !/^dist\/[a-zA-Z0-9_/-]+$/.test(candidate))
)
  throw Error('Usage: preparer dist/fpv-gate-coaching-verification-NAME [dist/ADMITTED-PLAYER]');
const sha = (v) => createHash('sha256').update(v).digest('hex');
const sourceRoot = path.join(root, candidate),
  dest = path.join(root, output),
  base = `/${output}/candidate`;
await fs.access(dest).then(
  () => {
    throw Error('Preserve frozen destination; use a new name');
  },
  () => {},
);
const oldReceipt = JSON.parse(
  await fs.readFile(path.join(root, 'docs/evidence/fpv-railworks-admitted-player.json')),
);
const immutable = path.join(root, 'dist/fpv-railworks-wagon-admitted-player-9efa36364');
const pins = new Map(oldReceipt.files.map((r) => [r.path, r]));
const files = new Map(),
  sources = {},
  pending = ['optional-practice/civilian-fpv/world-app.mjs'];
while (pending.length) {
  const relative = pending.pop();
  if (files.has(relative)) continue;
  if (
    files.size >= 192 ||
    !/^(game|optional-practice)\/[a-zA-Z0-9_./-]+\.(mjs|js)$/.test(relative) ||
    relative.includes('..')
  )
    throw Error('Module closure bound');
  const bytes = await fs.readFile(path.join(sourceRoot, relative));
  if (bytes.length > 6 * 1024 * 1024) throw Error('Module exceeds bound');
  files.set(relative, bytes);
  sources[relative] = sha(bytes);
  const todo = [parse(bytes.toString(), { ecmaVersion: 'latest', sourceType: 'module' })];
  while (todo.length) {
    const node = todo.pop();
    if (!node || typeof node !== 'object') continue;
    const spec = [
      'ImportDeclaration',
      'ExportNamedDeclaration',
      'ExportAllDeclaration',
      'ImportExpression',
    ].includes(node.type)
      ? node.source?.value
      : null;
    if (typeof spec === 'string' && spec.startsWith('.'))
      pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(relative), spec)));
    for (const v of Object.values(node))
      if (Array.isArray(v)) todo.push(...v);
      else if (v && typeof v === 'object') todo.push(v);
  }
}
for (const row of oldReceipt.files) {
  if (files.has(row.path)) continue;
  const bytes = await fs.readFile(path.join(candidate ? sourceRoot : immutable, row.path));
  if (!candidate && sha(bytes) !== row.sha256)
    throw Error('Immutable admitted asset changed: ' + row.path);
  files.set(row.path, bytes);
}
const htmlPath = 'optional-practice/fpv-worlds/index.html';
files.set(htmlPath, await fs.readFile(path.join(sourceRoot, htmlPath)));
const inputs = await fs.readFile(path.join(root, 'dist/fpv-gate-coaching-inputs/inputs.json'));
if (inputs.length > 2 * 1024 * 1024) throw Error('Input fixture bound');
const setup = `
window.fixtureErrors=[];addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
window.fixtureDownloads=[];const urls=new Map(),nativeURL=URL.createObjectURL.bind(URL);URL.createObjectURL=function(blob){const url=nativeURL(blob);urls.set(url,blob);return url};document.addEventListener('click',event=>{const a=event.target.closest?.('a[download]');if(a){fixtureDownloads.push({name:a.download,blob:urls.get(a.href)});event.preventDefault()}},true);
const query=new URL(location.href).searchParams;window.fixtureLoadToken=query.get('token');const prefix=query.get('database');if(!prefix?.startsWith('fpv-gate-coaching-'))throw Error('Isolated database required');
Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});const nativeDB=window.indexedDB;Object.defineProperty(window,'indexedDB',{value:{open(name,version){parent.fixtureRegisterDB(prefix+name);return version===undefined?nativeDB.open(prefix+name):nativeDB.open(prefix+name,version)},deleteDatabase:name=>nativeDB.deleteDatabase(prefix+name),cmp:nativeDB.cmp.bind(nativeDB)}});
const nativeGet=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args){const request=nativeGet.apply(this,args);if(window.fixtureHoldPackRead&&this.name==='projects'&&args[0]==='gate-coach-fixture'&&--window.fixtureHoldPackRead===0){window.fixtureHoldPackRead=false;window.fixturePackReadHeld=true;window.fixturePackReadOutcome=null;for(const kind of ['abort','complete'])this.transaction.addEventListener(kind,()=>{window.fixturePackReadOutcome=kind},{once:true});const hold=()=>{if(window.fixtureReleasePackRead){window.fixturePackReadHeld=false;if(window.fixtureAbortPackRead!==false)this.transaction.abort()}else nativeGet.apply(this,args).addEventListener('success',hold,{once:true})};request.addEventListener('success',hold,{once:true})}return request};
Object.defineProperty(navigator,'getGamepads',{value:()=>[]});let next=1;const callbacks=new Map();window.requestAnimationFrame=cb=>{const id=next++;callbacks.set(id,cb);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);window.fixtureRAF={stamp:performance.now(),deliver(delta=0){this.stamp+=delta;const pending=[...callbacks.values()];callbacks.clear();for(const cb of pending)cb(this.stamp)}};
`;
const boot = `
import{mountWorldApp}from '${base}/optional-practice/civilian-fpv/world-app.mjs';
import{createFlightRenderer}from '${base}/optional-practice/civilian-fpv/world-assets.mjs';
import{openWorldRecords}from '${base}/optional-practice/civilian-fpv/world-records.mjs';
import{createFlightProfileStore,defaultRadioProfile}from '${base}/optional-practice/civilian-fpv/radio-profile.mjs';
import{WORLD_CATALOGUE,BEGINNER_CATALOGUE}from '${base}/optional-practice/civilian-fpv/world-catalogue.mjs';
import{preparePack,installPack}from '${base}/optional-practice/civilian-fpv/world-content.mjs';
import{openWorldStore}from '${base}/optional-practice/civilian-fpv/world-store.mjs';
window.fixtureCatalogue={worlds:WORLD_CATALOGUE,lessons:BEGINNER_CATALOGUE};
const data=await(await fetch('../inputs.json')).json();window.fixtureInputs=data;const row=data.rows[Number(query.get('row')??0)];
if(query.get('imported')==='yes'){const project={format:'FPVWorldProject.v1',id:'gate-coach-fixture',title:'Coaching dependency control',world:{id:'gate-coach-fixture'},courses:[row.entry.course]};const store=await openWorldStore({indexedDB}),blob=await preparePack(project),installed=await installPack(blob,{store});store.close();window.fixturePack={blob,revised:await preparePack({...project,title:'Revised coaching dependency control'})};row.entry={...row.entry,projectId:project.id,theme:'custom',packIdentity:'fpv-pack:'+installed.sha256};}
window.fixtureExternalPack=async action=>{const store=await openWorldStore({indexedDB});try{return action==='remove'?await store.remove('gate-coach-fixture',{expectedGeneration:await store.generation()}):await installPack(action==='revised'?fixturePack.revised:fixturePack.blob,{store,expectedGeneration:await store.generation()})}finally{store.close()}};
createFlightProfileStore({storage:localStorage}).save({format:'FlightProfiles.v1',radio:defaultRadioProfile(),response:row.reference.response});
window.fixtureRecords=await openWorldRecords(indexedDB);if(query.get('reference')==='yes')await fixtureRecords.put({course:row.entry.course,proof:row.reference,status:'verified',diagnostic:'complete',packIdentity:row.entry.packIdentity});
const rendererFactory=options=>{const renderer=createFlightRenderer(options),draw=renderer.draw,setCourse=renderer.setCourse,prepare=renderer.prepare;window.fixtureRenderer=renderer;renderer.draw=function(...args){window.fixtureLastState=args[0];return draw.apply(this,args)};renderer.setCourse=function(...args){window.fixtureLastCourse=args[0];return setCourse.apply(this,args)};renderer.prepare=function(...args){const pending=prepare.apply(this,args),fault=window.fixturePrepareFault;window.fixturePrepareFault=null;if(!fault)return pending;return Promise.resolve(pending).then(()=>{if(fault==='reject')throw Error('Fixture rejected scene preparation');return new Promise((_,reject)=>{window.fixtureRejectPreparation=()=>reject(Error('Fixture superseded preparation'))})})};return renderer};
window.fixtureApp=mountWorldApp({rendererFactory});
window.fixtureFlightStatusTrace=[];const flightStatus=document.getElementById('flight-status'),textContent=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');Object.defineProperty(flightStatus,'textContent',{configurable:true,get(){return textContent.get.call(this)},set(value){const result=textContent.set.call(this,value);fixtureFlightStatusTrace.push({value:String(value),stack:new Error().stack});while(fixtureFlightStatusTrace.length>100)fixtureFlightStatusTrace.shift();return result}});
window.fixtureStatusTrace=[];new MutationObserver(records=>{for(const record of records)fixtureStatusTrace.push({studio:[...record.addedNodes].map(node=>node.textContent).join(''),flight:document.getElementById('flight-status').textContent});while(fixtureStatusTrace.length>30)fixtureStatusTrace.shift()}).observe(document.getElementById('studio-status'),{childList:true,subtree:true,characterData:true});
`;
const html = files
  .get(htmlPath)
  .toString()
  .replace('data-fpv-worlds="true"', 'data-fpv-worlds="fixture"')
  .replace(/<script\b[^>]*src="[^"]*world-app\.mjs"[^>]*><\/script>/, '')
  .replace(
    '<head>',
    `<head><base href="${base}/optional-practice/fpv-worlds/"><script>${setup}</script>`,
  )
  .replace('</body>', `<script type="module">${boot}</script></body>`);
// Resolve the input relative to the fixture, independently of the real player's base URL.
const player = Buffer.from(
  html.replace("fetch('../inputs.json')", `fetch('/${output}/inputs.json')`),
);
const harness = await fs.readFile(
  path.join(root, 'docs/evidence/fpv-gate-coaching-browser-harness.html'),
);
await fs.mkdir(dest, { recursive: true });
let links = 0,
  written = 0;
for (const [relative, bytes] of files) {
  const target = path.join(dest, 'candidate', relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const old = pins.get(relative);
  if (old && old.sha256 === sha(bytes)) {
    const original = path.join(immutable, relative);
    if (sha(await fs.readFile(original)) !== old.sha256) throw Error('Link source changed');
    await fs.link(original, target);
    links++;
  } else {
    await fs.writeFile(target, bytes, { flag: 'wx' });
    written += bytes.length;
  }
  if (sha(await fs.readFile(target)) !== sha(bytes)) throw Error('Frozen byte mismatch');
}
for (const [name, bytes] of [
  ['index.html', harness],
  ['player.html', player],
  ['inputs.json', inputs],
])
  await fs.writeFile(path.join(dest, name), bytes, { flag: 'wx' });
const manifest = {
  format: 'FPVGateCoachingFixture.v1',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  candidate: candidate || 'source',
  hostSHA256: sources['optional-practice/civilian-fpv/world-app.mjs'],
  sourceFiles: sources,
  files: Object.fromEntries([...files].map(([n, b]) => [n, sha(b)])),
  fixtureFiles: {
    'index.html': sha(harness),
    'player.html': sha(player),
    'inputs.json': sha(inputs),
  },
  modules: Object.keys(sources).length,
  storage: { links, written },
  scope:
    'Actual production host and WebGL; supported startFlight recovery API restores an independently replayed ordinary command prefix; final tick uses real Arm/neutral input. Frozen styles/artwork. Transparent renderer observation retains arguments/this/results. No production timing/pause guards changed. No hardware/FPS claim.',
};
await fs.writeFile(
  path.join(dest, 'fixture-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      output,
      hostSHA256: manifest.hostSHA256,
      modules: manifest.modules,
      links,
      written,
      url: `http://127.0.0.1:8834/${output}/index.html`,
    },
    null,
    2,
  ),
);
