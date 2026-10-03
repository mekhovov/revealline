#!/usr/bin/env node
/** Bounded manual browser qualification; no Git/network writes or unit suite. */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOSTS = {
  academy: ['optional-practice/civilian-fpv/app.mjs', 'optional-practice/civilian-fpv/index.html'],
  world: [
    'optional-practice/civilian-fpv/world-app.mjs',
    'optional-practice/fpv-worlds/index.html',
  ],
};
const EVIDENCE = 'docs/evidence/fpv-two-stick-browser-harness.html';
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
function player(html, host, sourceBase, candidateBase) {
  const academy = host === 'academy';
  const setup = `
    window.fixtureErrors=[];
    addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
    window.fixtureStorage={getItem:k=>parent.fixtureMemory.get(k)??null,setItem:(k,v)=>parent.fixtureMemory.set(k,String(v)),removeItem:k=>parent.fixtureMemory.delete(k)};
    Object.defineProperty(window,'localStorage',{value:fixtureStorage});
    const nativeDB=window.indexedDB;
    Object.defineProperty(window,'indexedDB',{value:{open(name,version){const key=parent.fixturePrefix+name;parent.fixtureNames.add(key);return version===undefined?nativeDB.open(key):nativeDB.open(key,version)},deleteDatabase:name=>nativeDB.deleteDatabase(parent.fixturePrefix+name),cmp:nativeDB.cmp.bind(nativeDB)}});
    Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
    let next=1;const callbacks=new Map();window.requestAnimationFrame=cb=>{const id=next++;callbacks.set(id,cb);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.fixtureRAF={deliver(){const rows=[...callbacks.entries()];callbacks.clear();for(const[,cb]of rows)cb(performance.now());return rows.length}};
  `;
  const boot = `
    import {${academy ? 'mountFlightApp' : 'mountWorldApp'}} from ${JSON.stringify(candidateBase + '/' + HOSTS[host][0])};
    import * as catalogue from ${JSON.stringify(candidateBase + '/optional-practice/civilian-fpv/world-catalogue.mjs')};
    import * as legacy from ${JSON.stringify(candidateBase + '/optional-practice/civilian-fpv/catalogue.mjs')};
    import * as legacyModel from ${JSON.stringify(candidateBase + '/optional-practice/civilian-fpv/model.mjs')};
    import * as worldModel from ${JSON.stringify(candidateBase + '/optional-practice/civilian-fpv/world-model.mjs')};
    import {WORLD_DEMONSTRATIONS} from ${JSON.stringify(candidateBase + '/optional-practice/civilian-fpv/world-demonstrations.mjs')};
    window.fixtureCatalogue=catalogue;window.fixtureLegacy=legacy;window.fixtureLegacyModel=legacyModel;window.fixtureWorldModel=worldModel;window.fixtureProofs=WORLD_DEMONSTRATIONS;
    const rendererFactory=()=>({available:true,ready:Promise.resolve(),setCourse(){},setQuality(){},setDrone(){},setPresentation(){},setPath(){},setGhost(){},loadScene:async()=>{},prepare:async()=>true,draw(state){window.fixtureDrawn=state},aimScreen:()=>null,dispose(){}});
    window.fixtureApp=${academy ? 'mountFlightApp' : 'mountWorldApp'}({rendererFactory});
  `;
  const marker = academy ? 'data-civilian-fpv' : 'data-fpv-worlds';
  if (!html.includes(marker + '="true"') || !html.includes('</body>'))
    fail('Missing host mount marker');
  return html
    .replace(marker + '="true"', marker + '="fixture"')
    .replace(/<script\b[^>]*src="[^"]*(?:world-app|app)\.mjs"[^>]*><\/script>/g, '')
    .replace(
      '<head>',
      `<head><base href="${sourceBase}/optional-practice/${academy ? 'civilian-fpv' : 'fpv-worlds'}/"><script>${setup}</script>`,
    )
    .replace('</body>', `<script type="module">${boot}</script></body>`);
}
async function main() {
  let output = 'dist/fpv-two-stick-verification',
    candidate = '',
    academyCandidate = '',
    verifyOnly = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) output = args[++i];
    else if (args[i] === '--candidate-base' && args[i + 1])
      candidate = args[++i].replace(/\/$/, '');
    else if (args[i] === '--academy-base' && args[i + 1])
      academyCandidate = args[++i].replace(/\/$/, '');
    else if (args[i] === '--verify-only') verifyOnly = true;
    else if (args[i] === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-two-stick-verification.mjs [--out dist/fpv-two-stick-verification-NAME] [--candidate-base dist/WORLD-PACKAGE] [--academy-base dist/ACADEMY-PACKAGE] [--verify-only]',
      );
      return;
    } else fail('Unknown/incomplete option: ' + args[i]);
  }
  if (!/^dist\/fpv-two-stick-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Use a named two-stick dist directory');
  for (const base of [candidate, academyCandidate])
    if (base && !/^dist\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(base))
      fail('Package base must be under dist');
  const root = await fs.realpath(ROOT),
    bases = {
      world: await fs.realpath(path.join(ROOT, candidate)),
      academy: await fs.realpath(path.join(ROOT, academyCandidate)),
    };
  for (const base of Object.values(bases))
    if (!within(root, base)) fail('Candidate leaves repository');
  const frozen = new Map(),
    sourceFiles = {},
    inputPaths = new Map();
  let total = 0;
  async function read(relative, host) {
    const file = await fs.realpath(path.join(bases[host], relative));
    if (!within(bases[host], file)) fail('Escaping input: ' + relative);
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size < 1 || stat.size > 6 * 1024 * 1024)
      fail('Input size bound: ' + relative);
    const bytes = await fs.readFile(file),
      digest = hash(bytes);
    inputPaths.set(file, digest);
    if (frozen.has(relative)) {
      if (sourceFiles[relative] !== digest) fail('Shared package dependency differs: ' + relative);
      return bytes;
    }
    if ((total += bytes.length) > 32 * 1024 * 1024 || frozen.size >= 192)
      fail('Dependency closure exceeds bound');
    frozen.set(relative, bytes);
    sourceFiles[relative] = digest;
    return bytes;
  }
  // World first includes the demonstration modules used by the evidence boot.
  for (const host of ['world', 'academy']) {
    const pending = [HOSTS[host][0]],
      visited = new Set();
    while (pending.length) {
      const relative = pending.pop();
      if (visited.has(relative)) continue;
      visited.add(relative);
      const bytes = await read(relative, host);
      pending.push(...dependencies(bytes.toString(), relative));
    }
  }
  const candidateBase = `/${output}/candidate`,
    artifacts = new Map([['index.html', await fs.readFile(path.join(ROOT, EVIDENCE))]]);
  for (const host of ['world', 'academy']) {
    const html = await read(HOSTS[host][1], host);
    const base = host === 'world' ? candidate : academyCandidate;
    artifacts.set(
      host + '.html',
      Buffer.from(player(html.toString(), host, base ? '/' + base : '', candidateBase)),
    );
  }
  const manifest = {
    format: 'FPVTwoStickFixture.v1',
    candidateBase,
    worldBase: candidate || 'source',
    academyBase: academyCandidate || 'source',
    sourceFiles,
    modules: frozen.size - 2,
    bytes: total,
    fixtureFiles: Object.fromEntries([...artifacts].map(([k, v]) => [k, hash(v)])),
    preparerSha256: hash(await fs.readFile(fileURLToPath(import.meta.url))),
    scope:
      'Production Academy and World hosts, real DOM keyboard events, controlled rAF, renderer stub and isolated child-native IndexedDB. Frozen modules at unique HTTP URLs; selected-base CSS/artwork outside functional hashes. No physical keyboard/radio, graphics, offline or unit coverage claim.',
  };
  for (const [file, digest] of inputPaths)
    if (hash(await fs.readFile(file)) !== digest) fail('Input changed during preparation: ' + file);
  if (verifyOnly) {
    console.log(
      JSON.stringify({ verified: true, writes: 0, modules: manifest.modules, bytes: total }),
    );
    return;
  }
  const dist = path.join(ROOT, 'dist'),
    existing = await fs.lstat(dist).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return null;
    });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink()))
    fail('dist must be a real directory');
  if (!existing) await fs.mkdir(dist);
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
    fail('Output exists; choose a new suffix');
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
      sourceFiles,
    }),
  );
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
