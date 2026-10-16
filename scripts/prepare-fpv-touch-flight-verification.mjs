#!/usr/bin/env node
/** Prepare a frozen functional browser fixture; no network, Git writes or unit suite. */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOST = 'optional-practice/civilian-fpv/world-app.mjs';
const HTML = 'optional-practice/fpv-worlds/index.html';
const EVIDENCE = 'docs/evidence/fpv-touch-flight-harness.html';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw Error(message);
};
const within = (base, file) => file === base || file.startsWith(base + path.sep);
function dependencies(source, owner) {
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'module' })],
    found = [];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    const spec = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(
      node.type,
    )
      ? node.source?.value
      : node.type === 'ImportExpression' && node.source?.type === 'Literal'
        ? node.source.value
        : null;
    if (typeof spec === 'string' && spec.startsWith('.')) {
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(owner), spec));
      if (
        !/^(?:game|optional-practice)\/[a-zA-Z0-9_./-]+\.(?:mjs|js)$/.test(relative) ||
        relative.includes('..')
      )
        fail(`Unsupported dependency ${owner}: ${spec}`);
      found.push(relative);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value);
      else if (value && typeof value === 'object') pending.push(value);
    }
  }
  return found;
}
function player(html, sourceBase, candidateBase) {
  const setup = `
  window.fixtureErrors=[];addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
  window.fixtureToken=new URL(location.href).searchParams.get('token');
  const memory=new Map([['revealline.fpv.world-settings.v1',JSON.stringify({'world-language':'en','flight-source':'touch','flight-mode':'self-level','sim-motion':'reduced','flight-quality':'performance'})]]);
  window.fixtureStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
  window.fixtureStored=()=>Object.fromEntries(memory);
  Object.defineProperty(window,'localStorage',{value:fixtureStorage});
  const nativeDB=window.indexedDB;
  Object.defineProperty(window,'indexedDB',{value:{open(name,version){const key=parent.fixturePrefix+name;parent.fixtureNames.add(key);return version===undefined?nativeDB.open(key):nativeDB.open(key,version)},deleteDatabase:name=>nativeDB.deleteDatabase(parent.fixturePrefix+name),cmp:nativeDB.cmp.bind(nativeDB)}});
  Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
  let next=1;const callbacks=new Map();
  window.requestAnimationFrame=cb=>{const id=next++;callbacks.set(id,cb);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);
  window.fixtureRAF={deliver(stamp=performance.now()){const rows=[...callbacks.entries()];callbacks.clear();for(const[,cb]of rows)cb(stamp);return rows.length},pending:()=>callbacks.size};
  `;
  const boot = `
  import {mountWorldApp} from ${JSON.stringify(candidateBase + '/' + HOST)};
  import {WORLD_CATALOGUE,BEGINNER_CATALOGUE} from ${JSON.stringify(candidateBase + '/optional-practice/civilian-fpv/world-catalogue.mjs')};
  import {WORLD_DEMONSTRATIONS} from ${JSON.stringify(candidateBase + '/optional-practice/civilian-fpv/world-demonstrations.mjs')};
  import {worldCourseRequiresAcro} from ${JSON.stringify(candidateBase + '/optional-practice/civilian-fpv/world-model.mjs')};
  window.fixtureCatalogue={worlds:WORLD_CATALOGUE,school:BEGINNER_CATALOGUE,proofs:WORLD_DEMONSTRATIONS,requiresAcro:worldCourseRequiresAcro};
  const rendererFactory=()=>({available:true,ready:Promise.resolve(),setCourse(){},setQuality(){},setDrone(){},setPath(){},setGhost(){},loadScene:async()=>{},prepare:async()=>true,draw(state){window.fixtureRenderedTick=state.ticks},aimScreen:()=>null,dispose(){}});
  window.fixtureApp=mountWorldApp({rendererFactory});
  `;
  if (!html.includes('data-fpv-worlds="true"') || !html.includes('</body>'))
    fail('Missing supported World HTML mount markers');
  return html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="fixture"')
    .replace(/<script\b[^>]*src="[^"]*world-app\.mjs"[^>]*><\/script>/, '')
    .replace(
      '<head>',
      `<head><base href="${sourceBase}/optional-practice/fpv-worlds/"><script>${setup}</script>`,
    )
    .replace('</body>', `<script type="module">${boot}</script></body>`);
}
async function main() {
  let output = 'dist/fpv-touch-flight-verification',
    candidate = '',
    verifyOnly = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) output = args[++i];
    else if (args[i] === '--candidate-base' && args[i + 1])
      candidate = args[++i].replace(/\/$/, '');
    else if (args[i] === '--verify-only') verifyOnly = true;
    else if (args[i] === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-touch-flight-verification.mjs [--out dist/fpv-touch-flight-verification-NAME] [--candidate-base dist/PACKAGE] [--verify-only]',
      );
      return;
    } else fail(`Unknown/incomplete option: ${args[i]}`);
  }
  if (!/^dist\/fpv-touch-flight-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Use the named touch-flight dist fixture directory');
  if (candidate && !/^dist\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(candidate))
    fail('Candidate must be a prepared package directory under dist');
  const root = await fs.realpath(ROOT),
    base = await fs.realpath(path.join(ROOT, candidate));
  if (!within(root, base)) fail('Candidate leaves repository');
  const frozen = new Map(),
    pending = [HOST],
    sourceFiles = {};
  let total = 0;
  async function read(relative) {
    const file = await fs.realpath(path.join(base, relative));
    if (!within(base, file)) fail(`Escaping path: ${relative}`);
    const stat = await fs.stat(file);
    if (
      !stat.isFile() ||
      stat.size < 1 ||
      stat.size > 6 * 1024 * 1024 ||
      total + stat.size > 32 * 1024 * 1024
    )
      fail('Candidate exceeds fixture size bound');
    const bytes = await fs.readFile(file);
    total += bytes.length;
    frozen.set(relative, bytes);
    sourceFiles[relative] = hash(bytes);
    return bytes;
  }
  while (pending.length) {
    const relative = pending.pop();
    if (frozen.has(relative)) continue;
    if (frozen.size >= 192) fail('Module bound exceeded');
    const bytes = await read(relative);
    pending.push(...dependencies(bytes.toString(), relative));
  }
  const html = await read(HTML),
    candidateBase = `/${output}/candidate`,
    sourceBase = candidate ? `/${candidate}` : '';
  const artifacts = new Map([
    ['index.html', await fs.readFile(path.join(ROOT, EVIDENCE))],
    ['player.html', Buffer.from(player(html.toString(), sourceBase, candidateBase))],
  ]);
  const manifest = {
    format: 'FPVTouchFlightFixture.v1',
    candidateBase,
    sourceBase,
    sourceFiles,
    modules: frozen.size - 1,
    bytes: total,
    fixtureFiles: Object.fromEntries([...artifacts].map(([key, bytes]) => [key, hash(bytes)])),
    preparerSha256: hash(await fs.readFile(fileURLToPath(import.meta.url))),
    scope:
      'Real DOM PointerEvents and production input adapter. Controlled capture ownership shim, not native hardware capture. Production World host with native child-realm isolated IndexedDB and controlled rAF; renderer stub. Dependency bytes unchanged at unique HTTP URLs. CSS/artwork from selected base are outside these functional hash assertions; real viewport and physical-device qualification separate.',
  };
  for (const [relative, expected] of Object.entries(sourceFiles)) {
    if (hash(await fs.readFile(path.join(base, relative))) !== expected)
      fail(`Source changed during preparation: ${relative}`);
  }
  if (verifyOnly) {
    console.log(
      JSON.stringify({
        verified: true,
        writes: 0,
        modules: manifest.modules,
        bytes: total,
        hostSha256: sourceFiles[HOST],
      }),
    );
    return;
  }
  const dist = path.join(ROOT, 'dist'),
    stat = await fs.lstat(dist).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return null;
    });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) fail('dist must be a real directory');
  if (!stat) await fs.mkdir(dist);
  const target = path.join(ROOT, output);
  if (
    await fs.lstat(target).then(
      () => true,
      (e) => {
        if (e.code !== 'ENOENT') throw e;
        return false;
      },
    )
  )
    fail('Output exists; choose a fresh --out suffix');
  await fs.mkdir(target);
  for (const [relative, bytes] of frozen) {
    const dest = path.join(target, 'candidate', relative);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, bytes, { flag: 'wx' });
  }
  for (const [name, bytes] of artifacts)
    await fs.writeFile(path.join(target, name), bytes, { flag: 'wx' });
  await fs.writeFile(
    path.join(target, 'fixture-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      prepared: true,
      url: `http://127.0.0.1:8789/${output}/index.html`,
      modules: manifest.modules,
      bytes: total,
      hostSha256: sourceFiles[HOST],
    }),
  );
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
