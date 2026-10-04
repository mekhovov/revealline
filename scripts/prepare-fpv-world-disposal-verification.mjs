#!/usr/bin/env node
/** Bounded manual actual-host fixture; no production monkey patches or Git mutations. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 2) {
  if (
    !['--out', '--player-root', '--player-receipt', '--baseline'].includes(args[i]) ||
    !args[i + 1]
  )
    throw Error('Expected --out dist/NAME --player-root PATH --player-receipt PATH --baseline SHA');
  opts[args[i].slice(2)] = args[i + 1];
}
if (!/^dist\/fpv-world-disposal-[a-z0-9-]+$/.test(opts.out ?? '')) throw Error('Invalid output');
const baseline = opts.baseline ?? 'a087facd9ca57f0e7519aa161cb6acc86a7eee3e';
if (!/^[a-f0-9]{40}$/.test(baseline)) throw Error('Exact baseline required');
const dest = path.join(root, opts.out);
if (await fs.stat(dest).catch(() => null)) throw Error('Output already exists');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...a) => execFileSync('git', a, { cwd: root, maxBuffer: 24 * 1024 * 1024 });
const hostPath = 'optional-practice/civilian-fpv/world-app.mjs';
const playerRoot = path.resolve(opts['player-root']);
const receiptBytes = await fs.readFile(opts['player-receipt']);
const receipt = JSON.parse(receiptBytes);
if (receipt.files?.length !== 102) throw Error('Expected complete 102-file admitted player');
const files = [];
const sources = [];
for (const entry of receipt.files) {
  if (
    !/^(?:game|optional-practice|launcher)\/[\w./-]+$/.test(entry.path) &&
    entry.path !== 'optional-package.json'
  )
    throw Error('Invalid path');
  const src = path.join(playerRoot, entry.path),
    bytes = await fs.readFile(src);
  if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256)
    throw Error(`Player hash mismatch ${entry.path}`);
  let current;
  try {
    current = await fs.readFile(path.join(root, entry.path));
  } catch {
    current = bytes;
  }
  // Only raw source paths exist in the worktree. All unchanged package assets stay immutable.
  const selected = current;
  files.push({
    path: entry.path,
    bytes: selected.length,
    sha256: hash(selected),
    method: selected.equals(bytes) ? 'verified-hardlink' : 'current-source-overlay',
  });
  sources.push({ entry, src, bytes: selected, link: selected.equals(bytes) });
}
const before = git('show', `${baseline}:${hostPath}`);
const after = await fs.readFile(path.join(root, hostPath));
const base = `/${opts.out}`;
function serveHost(bytes) {
  let text = bytes.toString();
  const ast = parse(text, { sourceType: 'module', ecmaVersion: 'latest' });
  for (const n of ast.body.filter((n) => n.type === 'ImportDeclaration').reverse()) {
    if (!n.source.value.startsWith('.')) throw Error('Unexpected bare import');
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(hostPath), n.source.value),
    );
    text =
      text.slice(0, n.source.start) +
      JSON.stringify(`${base}/candidate/${target}`) +
      text.slice(n.source.end);
  }
  return text;
}
const setup = `
const query=new URL(location.href).searchParams, prefix=query.get('database');
if(!prefix?.startsWith('fpv-disposal-'))throw Error('Isolated database required');
window.fixtureErrors=[];addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
window.fixtureStorage=parent.fixtureStorage;Object.defineProperty(window,'localStorage',{value:fixtureStorage});
const nativeDB=indexedDB;
window.fixtureDBs=[];window.fixtureWrites=[];window.fixtureFault={armed:false,aborts:0};
window.fixtureHydration={phase:query.get('delay'),released:false,held:0,pending:[],release(){this.released=true;for(const fn of this.pending.splice(0))fn()}};
function holdDelivery(target,property,event,phase){const gate=fixtureHydration;if(gate.released||gate.phase!==phase)return;let callback;Object.defineProperty(target,property,{get:()=>callback,set:fn=>callback=fn});target.addEventListener(event,e=>{gate.held++;const invoke=()=>callback?.call(target,e);if(gate.released)invoke();else gate.pending.push(invoke)})}
const identities=new WeakMap(),nativeClose=IDBDatabase.prototype.close,nativeTransaction=IDBDatabase.prototype.transaction;
IDBDatabase.prototype.close=function(){const row=identities.get(this);if(row)row.closes++;return nativeClose.call(this)};
IDBDatabase.prototype.transaction=function(...a){const row=identities.get(this);if(row)row.transactions++;const tx=nativeTransaction.apply(this,a);if(a[0]==='session'&&a[1]==='readonly'&&this.name===prefix+'revealline.fpv.world-records.v1')holdDelivery(tx,'oncomplete','complete','session');return tx};
Object.defineProperty(window,'indexedDB',{value:{open(name,version){const full=prefix+name;parent.fixtureRegisterDB(full);const req=version===undefined?nativeDB.open(full):nativeDB.open(full,version);req.addEventListener('success',()=>{const row={name:full,closes:0,transactions:0};identities.set(req.result,row);fixtureDBs.push(row)});holdDelivery(req,'onsuccess','success','open');return req},deleteDatabase:name=>nativeDB.deleteDatabase(prefix+name),cmp:nativeDB.cmp.bind(nativeDB)}});
const nativePut=IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put=function(...a){const result=nativePut.apply(this,a);if(this.name==='session'){const row={database:this.transaction.db.name,key:a[1],ticks:a[0]?.proof?.frames?.length,outcome:'pending'};fixtureWrites.push(row);this.transaction.addEventListener('complete',()=>row.outcome='complete');this.transaction.addEventListener('abort',()=>row.outcome='abort');if(fixtureFault.armed){fixtureFault.aborts++;this.transaction.abort()}}return result};
Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
const callbacks=new Map();let next=0;
window.requestAnimationFrame=cb=>{callbacks.set(++next,cb);return next};window.cancelAnimationFrame=id=>callbacks.delete(id);
window.fixtureRAF={stamp:performance.now(),pending:()=>callbacks.size,deliver(delta=0){this.stamp+=delta;const work=[...callbacks.values()];callbacks.clear();for(const cb of work)cb(this.stamp);return work.length}};
`;
const boot = `
import {createFlightRenderer} from '${base}/candidate/optional-practice/civilian-fpv/world-assets.mjs';
import {WORLD_CATALOGUE} from '${base}/candidate/optional-practice/civilian-fpv/world-catalogue.mjs';
import RAPIER from '${base}/candidate/optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
window.fixturePhysics=[];const worlds=new WeakMap(),observe=world=>{if(!worlds.has(world)){const row={frees:0};worlds.set(world,row);fixturePhysics.push(row)}return worlds.get(world)},createCollider=RAPIER.World.prototype.createCollider,freeWorld=RAPIER.World.prototype.free;RAPIER.World.prototype.createCollider=function(...args){observe(this);return createCollider.apply(this,args)};RAPIER.World.prototype.free=function(){observe(this).frees++;return freeWorld.call(this)};
window.fixtureEntry=WORLD_CATALOGUE.find(e=>e.id==='woodland-08');
const variant=new URL(location.href).searchParams.get('variant');
const {mountWorldApp}=await import('${base}/world-app.'+(variant==='baseline'?'before':'candidate')+'.served.mjs');
window.fixtureRendererEvents={created:0,disposed:0,draws:0};
const rendererFactory=options=>{const r=createFlightRenderer(options);fixtureRendererEvents.created++;window.fixtureRenderer=r;const dispose=r.dispose,draw=r.draw;r.dispose=function(){fixtureRendererEvents.disposed++;return dispose.call(this)};r.draw=function(state,...a){const result=draw.call(this,state,...a);window.fixtureDrawState=state;fixtureRendererEvents.draws++;return result};return r};
window.fixtureApp=mountWorldApp({rendererFactory});
`;
let html = await fs.readFile(path.join(root, 'optional-practice/fpv-worlds/index.html'), 'utf8');
html = html
  .replace('data-fpv-worlds="true"', 'data-fpv-worlds="fixture"')
  .replace(/<script\b[^>]*src="[^"]*world-app\.mjs"[^>]*><\/script>/, '')
  .replace(
    '<head>',
    `<head><base href="${base}/candidate/optional-practice/fpv-worlds/"><script>${setup}</script>`,
  )
  .replace('</body>', `<script type="module">${boot}</script></body>`);
const artifacts = new Map([
  ['world-app.before.mjs', before],
  ['world-app.candidate.mjs', after],
  ['world-app.before.served.mjs', serveHost(before)],
  ['world-app.candidate.served.mjs', serveHost(after)],
  ['player.html', html],
  [
    'index.html',
    await fs.readFile(path.join(root, 'docs/evidence/fpv-world-disposal-browser-harness.html')),
  ],
]);
await fs.mkdir(dest, { recursive: true });
for (const { entry, src, bytes, link } of sources) {
  const target = path.join(dest, 'candidate', entry.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (link) await fs.link(src, target);
  else await fs.writeFile(target, bytes, { flag: 'wx' });
}
for (const [name, bytes] of artifacts)
  await fs.writeFile(path.join(dest, name), bytes, { flag: 'wx' });
const manifest = {
  format: 'FPVWorldDisposalFixture.v1',
  baseline,
  workingHead: git('rev-parse', 'HEAD').toString().trim(),
  baselineHostSha256: hash(before),
  candidateHostSha256: hash(after),
  playerReceiptSha256: hash(receiptBytes),
  playerSource: receipt.sourceRevision,
  files,
  fixtureFiles: Object.fromEntries([...artifacts].map(([name, bytes]) => [name, hash(bytes)])),
  scope:
    'Actual host, renderer, physics, controls, native IndexedDB; isolated DB names/settings and externally delivered RAF timestamps. Performance clock and production guards unchanged. Verified immutable admitted assets plus explicitly hashed current source overlays; diagnostic source fixture is not a new admission.',
};
await fs.writeFile(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify(
    {
      output: dest,
      url: `http://127.0.0.1:8878/${opts.out}/index.html`,
      host: manifest.candidateHostSha256,
      files: files.length,
      overlays: files.filter((x) => x.method === 'current-source-overlay').map((x) => x.path),
    },
    null,
    2,
  ),
);
