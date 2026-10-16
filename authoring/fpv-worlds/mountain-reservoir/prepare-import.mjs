#!/usr/bin/env node
// Immutable content fixture over an explicitly admitted historical host; no rebuild or overlay.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [receiptArg, generatedArg, proofArg, outputArg] = process.argv.slice(2);
if (!outputArg) throw Error('Use ADMITTED_RECEIPT GENERATED_SCENE PROOF_DIRECTORY NEW_OUTPUT');
const sha = (b) => createHash('sha256').update(b).digest('hex'),
  receiptBytes = await fs.readFile(receiptArg),
  admitted = JSON.parse(receiptBytes),
  output = path.resolve(outputArg),
  source = await fs.realpath(admitted.output);
if (admitted.files.length !== 102 || !admitted.checks.every((c) => c.passed))
  throw Error('A successful complete 102-file admission receipt is required');
const frozen = [];
for (const file of admitted.files) {
  if (path.isAbsolute(file.path) || file.path.split('/').includes('..'))
    throw Error('Unsafe member');
  const from = await fs.realpath(path.join(source, file.path)),
    bytes = await fs.readFile(from);
  if (
    !from.startsWith(source + path.sep) ||
    bytes.length !== file.bytes ||
    sha(bytes) !== file.sha256
  )
    throw Error('Admitted member changed: ' + file.path);
  frozen.push({ ...file, from });
}
const projectBytes = await fs.readFile(path.join(generatedArg, 'prepared/project.json')),
  project = JSON.parse(projectBytes),
  qualification = JSON.parse(await fs.readFile(path.join(proofArg, 'qualification.json')));
if (qualification.status !== 'passed' || qualification.modes.length !== 2)
  throw Error('Two mode proof gate');
const inputs = {
  'project.json': projectBytes,
  'scene.glb': await fs.readFile(path.join(generatedArg, 'prepared', project.world.modelAsset)),
  'checkpoint.rlpack': await fs.readFile(qualification.pack.path),
  'proofs.json': await fs.readFile(path.join(proofArg, qualification.archive.path)),
  'qualification.json': Buffer.from(JSON.stringify(qualification)),
};
if (
  sha(inputs['checkpoint.rlpack']) !== qualification.pack.sha256 ||
  sha(inputs['proofs.json']) !== qualification.archive.sha256
)
  throw Error('Content proof binding mismatch');
await fs.mkdir(output);
for (const file of frozen) {
  const destination = path.join(output, 'player', file.path);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.link(file.from, destination);
}
await fs.mkdir(path.join(output, 'content'));
for (const [name, bytes] of Object.entries(inputs))
  await fs.writeFile(path.join(output, 'content', name), bytes, { flag: 'wx' });
const setup = `
window.fixtureErrors=[];addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
const nativeDB=window.indexedDB,prefix=new URL(location.href).searchParams.get('database');
if(!prefix?.startsWith('fpv-reservoir-'))throw Error('Private native database prefix required');
Object.defineProperty(window,'indexedDB',{value:{open(name,version){return version===undefined?nativeDB.open(prefix+name):nativeDB.open(prefix+name,version)},deleteDatabase:name=>nativeDB.deleteDatabase(prefix+name),cmp:nativeDB.cmp.bind(nativeDB)}});
Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
if(new URL(location.href).searchParams.get('clock')!=='native'){let next=1;const callbacks=new Map();window.requestAnimationFrame=cb=>{const id=next++;callbacks.set(id,cb);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);window.fixtureRAF={stamp:performance.now(),deliver(delta=0){this.stamp+=delta;const pending=[...callbacks.values()];callbacks.clear();for(const cb of pending)cb(this.stamp)}}}
`;
const boot = `
const base=new URL('./player/optional-practice/civilian-fpv/',location.href).href;
const [{mountWorldApp},{createFlightRenderer},model,storage,records,collision]=await Promise.all(['world-app.mjs','world-assets.mjs','world-model.mjs','world-store.mjs','world-records.mjs','world-collision.mjs'].map(p=>import(base+p)));
window.fixtureModel=model;window.fixtureCollision=collision;window.fixtureWorldStore=await storage.openWorldStore({indexedDB:window.indexedDB});window.fixtureRecords=await records.openWorldRecords(window.indexedDB);
const rendererFactory=options=>{const renderer=createFlightRenderer(options),draw=renderer.draw,set=renderer.setCourse;window.fixtureRenderer=renderer;renderer.setCourse=function(c,...args){window.fixtureDrawState=null;window.fixtureRenderedCourse=c.id;return set.call(this,c,...args)};renderer.draw=function(s,...args){const value=draw.call(this,s,...args);window.fixtureDrawState=s;return value};return renderer};
window.fixtureApp=mountWorldApp({rendererFactory});
`;
let html = (await fs.readFile(path.join(source, admitted.entry))).toString();
if (!html.includes('data-fpv-worlds="true"')) throw Error('Unexpected automatic mount guard');
html = html
  .replace('data-fpv-worlds="true"', 'data-fpv-worlds="fixture"')
  .replace(/<script\b[^>]*src="[^"]*world-app\.mjs"[^>]*><\/script>/, '')
  .replace(
    '<head>',
    '<head><base href="./player/optional-practice/fpv-worlds/"><script>' + setup + '</script>',
  )
  .replace('</body>', '<script type="module">' + boot + '</script></body>');
const artifacts = {
  'host.html': Buffer.from(html),
  'index.html': await fs.readFile(new URL('./import-preview.html', import.meta.url)),
  'import-harness.mjs': await fs.readFile(new URL('./import-harness.mjs', import.meta.url)),
};
for (const [name, bytes] of Object.entries(artifacts))
  await fs.writeFile(path.join(output, name), bytes, { flag: 'wx' });
const manifest = {
  format: 'FPVReservoirImportedCheckpoint.v1',
  authoringCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  admittedSource: admitted.sourceRevision,
  admittedReceiptSHA256: sha(receiptBytes),
  admittedZIP: admitted.zip,
  files: admitted.files,
  content: Object.entries(inputs).map(([name, bytes]) => ({
    path: 'content/' + name,
    bytes: bytes.length,
    sha256: sha(bytes),
  })),
  harness: Object.entries(artifacts).map(([name, bytes]) => ({
    path: name,
    bytes: bytes.length,
    sha256: sha(bytes),
  })),
  packIdentity: qualification.pack.identity,
  scope:
    'First course only, admitted historical #1060 host 79a721dd1, no runtime overlay. Real File import/native IDB, collision queries and two complete actual catalogue Watch replays; controlled RAF with unchanged performance clock and pause guards. Separate native-clock launch remains manual. No full-world/offline/device/FPS acceptance.',
};
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify(
    {
      output,
      admittedSource: manifest.admittedSource,
      files: frozen.length,
      packIdentity: manifest.packIdentity,
    },
    null,
    2,
  ),
);
