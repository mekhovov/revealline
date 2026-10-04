#!/usr/bin/env node
/** Freeze a complete admitted player with one explicit source-host overlay. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
const root = fileURLToPath(new URL('../', import.meta.url)),
  opts = {},
  args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  assert(['--player-root', '--player-receipt', '--data', '--out'].includes(args[i]) && args[i + 1]);
  opts[args[i].slice(2)] = args[i + 1];
}
assert(Object.keys(opts).length === 4 && /^dist\/fpv-imported-examples-[a-z0-9-]+$/.test(opts.out));
const dest = path.join(root, opts.out),
  base = '/' + opts.out,
  digest = (b) => createHash('sha256').update(b).digest('hex'),
  hostPath = 'optional-practice/civilian-fpv/world-app.mjs',
  receiptBytes = await fs.readFile(opts['player-receipt']),
  receipt = JSON.parse(receiptBytes),
  preparationBytes = await fs.readFile(path.join(opts.data, 'preparation.json')),
  preparation = JSON.parse(preparationBytes),
  candidate = await fs.readFile(path.join(root, hostPath)),
  baseline = await fs.readFile(path.join(opts['player-root'], hostPath)),
  files = [],
  assets = new Map();
assert(receipt.files.length === 102 && receipt.checks.every((c) => c.passed));
assert(preparation.passed && preparation.checks.every((c) => c.passed));
assert(
  digest(candidate) === preparation.candidateHostSha256 &&
    digest(baseline) === preparation.baselineHostSha256,
);
assert(!(await fs.stat(dest).catch(() => null)), 'Never replace a frozen fixture');
// A source experiment changes only this host. The other complete package files remain exact.
for (const entry of receipt.files) {
  assert(!entry.path.includes('..') && !path.isAbsolute(entry.path));
  const file = path.join(opts['player-root'], entry.path),
    bytes = await fs.readFile(file);
  assert(bytes.length === entry.bytes && digest(bytes) === entry.sha256, entry.path);
  const local = await fs.readFile(path.join(root, entry.path)).catch(() => null);
  assert(
    !local || entry.path === hostPath || local.equals(bytes),
    'Unexpected additional source overlay ' + entry.path,
  );
  files.push({ path: entry.path, bytes: bytes.length, sha256: digest(bytes) });
}
function servedHost(bytes) {
  let text = bytes.toString();
  const ast = parse(text, { sourceType: 'module', ecmaVersion: 'latest' });
  for (const item of ast.body.filter((n) => n.type === 'ImportDeclaration').reverse()) {
    assert(item.source.value.startsWith('.'));
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(hostPath), item.source.value),
    );
    text =
      text.slice(0, item.source.start) +
      JSON.stringify(base + '/player/' + resolved) +
      text.slice(item.source.end);
  }
  return text;
}
assets.set('host.before.mjs', baseline);
assets.set('host.after.mjs', candidate);
assets.set('host.before.served.mjs', servedHost(baseline));
assets.set('host.after.served.mjs', servedHost(candidate));
for (const row of preparation.files) {
  const bytes = await fs.readFile(path.join(opts.data, row.path));
  assert(row.bytes === bytes.length && row.sha256 === digest(bytes));
  assets.set('data/' + row.path, bytes);
}
assets.set('data/preparation.json', preparationBytes);
const setup = `
const q=new URL(location.href).searchParams, prefix=q.get('database');
if(!prefix?.startsWith('fpv-imported-examples-'))throw Error('Private fixture database required');
window.fixtureErrors=[]; addEventListener('error',e=>fixtureErrors.push(e.message)); addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
const nativeDB=indexedDB;
Object.defineProperty(window,'indexedDB',{value:{open(name,version){const full=prefix+name;parent.fixtureRegisterDB(full);return version===undefined?nativeDB.open(full):nativeDB.open(full,version)},deleteDatabase:name=>nativeDB.deleteDatabase(prefix+name),cmp:nativeDB.cmp.bind(nativeDB)}});
Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
let next=0;const callbacks=new Map();
window.requestAnimationFrame=cb=>{callbacks.set(++next,cb);return next};window.cancelAnimationFrame=id=>callbacks.delete(id);
window.fixtureRAF={stamp:performance.now(),deliver(delta=0){this.stamp+=delta;const pending=[...callbacks.values()];callbacks.clear();for(const cb of pending)cb(this.stamp);return pending.length}};
`;
const boot = `
import{createFlightRenderer}from'${base}/player/optional-practice/civilian-fpv/world-assets.mjs';
import{worldStateIdentity}from'${base}/player/optional-practice/civilian-fpv/world-model.mjs';
import{openWorldRecords}from'${base}/player/optional-practice/civilian-fpv/world-records.mjs';
window.fixtureWorldStateIdentity=worldStateIdentity;window.fixtureRecords=await openWorldRecords(window.indexedDB);
const{mountWorldApp}=await import('${base}/host.'+(new URL(location.href).searchParams.get('variant')==='before'?'before':'after')+'.served.mjs');
const rendererFactory=options=>{const r=createFlightRenderer(options), draw=r.draw,setCourse=r.setCourse;window.fixtureRenderer=r;r.setCourse=function(course,...args){window.fixtureDrawState=null;window.fixtureRenderedCourse=course.id;return setCourse.call(this,course,...args)};r.draw=function(state,...args){const value=draw.call(this,state,...args);window.fixtureDrawState=state;return value};return r};
window.fixtureApp=mountWorldApp({rendererFactory});
`;
let html = await fs.readFile(
  path.join(opts['player-root'], 'optional-practice/fpv-worlds/index.html'),
  'utf8',
);
assert(html.includes('data-fpv-worlds="true"'));
html = html
  .replace('data-fpv-worlds="true"', 'data-fpv-worlds="fixture"')
  .replace(/<script\b[^>]*src="[^"]*world-app\.mjs"[^>]*><\/script>/, '')
  .replace(
    '<head>',
    `<head><base href="${base}/player/optional-practice/fpv-worlds/"><script>${setup}</script>`,
  )
  .replace('</body>', `<script type="module">${boot}</script></body>`);
assets.set('player.html', html);
assets.set(
  'index.html',
  await fs.readFile(path.join(root, 'docs/evidence/fpv-imported-examples-browser-harness.html')),
);
await fs.mkdir(dest);
for (const file of files) {
  const target = path.join(dest, 'player', file.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.link(path.join(opts['player-root'], file.path), target);
}
for (const [name, bytes] of assets) {
  const target = path.join(dest, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes, { flag: 'wx' });
}
const manifest = {
  format: 'FPVImportedExamplesBrowser.v1',
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  playerSource: receipt.sourceRevision,
  playerReceiptSha256: digest(receiptBytes),
  baselineHostSha256: digest(baseline),
  candidateHostSha256: digest(candidate),
  runtimeGrowthBytes: candidate.length - baseline.length,
  files,
  fixtureFiles: [...assets].map(([name, b]) => ({
    path: name,
    bytes: Buffer.byteLength(b),
    sha256: digest(b),
  })),
  scope:
    '102 immutable admitted files. Only static host import paths rewritten; source candidate changes one explicitly bound host. Actual UI/File/IndexedDB/renderer/physics, private database names and memory preferences, external RAF scheduling. Real performance clock and pause guards untouched. No package admission or hardware-performance claim.',
};
await fs.writeFile(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify(
    {
      output: dest,
      url: 'http://127.0.0.1:8878' + base + '/index.html',
      playerFiles: files.length,
      fixtureBytes: [...assets.values()].reduce((n, b) => n + Buffer.byteLength(b), 0),
      hostSha256: manifest.candidateHostSha256,
    },
    null,
    2,
  ),
);
