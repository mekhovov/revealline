#!/usr/bin/env node
/** Prepare an isolated manual host qualification. No Git writes or network requests. */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOST = 'optional-practice/civilian-fpv/world-app.mjs';
const HTML = 'optional-practice/fpv-worlds/index.html';
const EVIDENCE = 'docs/evidence/fpv-optional-examples-browser-harness.html';
const MAX_FILE_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_MODULES = 192;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw new Error(message);
};
const within = (parent, child) => child === parent || child.startsWith(parent + path.sep);
function imports(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const staticImports = [],
    literals = [],
    pending = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
      node.source
    ) {
      literals.push(node.source.value);
      staticImports.push(node.source);
    } else if (node.type === 'ImportExpression' && node.source?.type === 'Literal')
      literals.push(node.source.value);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value);
      else if (value && typeof value === 'object') pending.push(value);
    }
  }
  return { staticImports, literals };
}
function dependency(owner, specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) return null;
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(owner), specifier));
  if (
    !/^(?:game|optional-practice)\/[a-zA-Z0-9_./-]+\.(?:mjs|js)$/.test(relative) ||
    relative.includes('..')
  )
    fail(`Unsupported module dependency: ${owner} → ${specifier}`);
  return relative;
}
function buildPlayer(html, sourceBase, frozenBase) {
  const setup = `
    const query=new URL(location.href).searchParams;
    window.fixtureLoadToken=query.get('token');window.fixtureErrors=[];
    addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
    Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
    const nativeDB=window.indexedDB;
    const prefix=query.get('database');
    if(!prefix?.startsWith('fpv-optional-examples-'))throw Error('Isolated fixture database prefix required');
    Object.defineProperty(window,'indexedDB',{value:{
      open(name,version){const full=prefix+name;parent.fixtureRegisterDB(full);return version===undefined?nativeDB.open(full):nativeDB.open(full,version)},
      deleteDatabase:name=>nativeDB.deleteDatabase(prefix+name),cmp:nativeDB.cmp.bind(nativeDB)
    }});
    window.fixtureRecordWriteFault={after:null,count:0};
    const nativePut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){const fault=fixtureRecordWriteFault;if(this.name==='records'&&fault.after!==null&&fault.count++===fault.after){fault.after=null;const result=nativePut.apply(this,args);this.transaction.abort();return result}return nativePut.apply(this,args)};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
    window.fixtureYieldDelay=0;const nativeTimeout=window.setTimeout.bind(window);window.setTimeout=(callback,delay,...args)=>nativeTimeout(callback,delay===0&&fixtureYieldDelay?fixtureYieldDelay:delay,...args);
    if(query.get('clock')==='controlled'){
      let nextId=1;const callbacks=new Map();window.requestAnimationFrame=cb=>{const id=nextId++;callbacks.set(id,cb);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);
      window.fixtureRAF={stamp:performance.now(),deliver(delta=200){this.stamp+=delta;const pending=[...callbacks.entries()];callbacks.clear();for(const[,cb]of pending)cb(this.stamp);return pending.length}};
    }
  `;
  const boot = `
    import{mountWorldApp}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-app.mjs`)};
    import{createFlightRenderer}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-assets.mjs`)};
    import{worldStateIdentity}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-model.mjs`)};
    window.fixtureWorldStateIdentity=worldStateIdentity;
    import{openWorldRecords}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-records.mjs`)};
    window.fixtureRecords=await openWorldRecords(window.indexedDB);
    import{createFlightProfileStore,defaultRadioProfile,DEFAULT_RESPONSE}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/radio-profile.mjs`)};
    createFlightProfileStore({storage:window.localStorage}).save({format:'FlightProfiles.v1',radio:defaultRadioProfile(),response:DEFAULT_RESPONSE});
    const rendererFactory=options=>{const renderer=createFlightRenderer(options);window.fixtureRenderer=renderer;return renderer};
    window.fixtureApp=mountWorldApp({rendererFactory});
  `;
  if (!html.includes('data-fpv-worlds="true"') || !html.includes('</body>'))
    fail('Unsupported World HTML mount markers.');
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
  let output = 'dist/fpv-optional-examples-verification',
    candidate = '',
    proofFile = '',
    verifyOnly = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) output = args[++i];
    else if (args[i] === '--candidate-base' && args[i + 1])
      candidate = args[++i].replace(/\/$/, '');
    else if (args[i] === '--proof-file' && args[i + 1]) proofFile = args[++i];
    else if (args[i] === '--verify-only') verifyOnly = true;
    else if (args[i] === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-optional-examples-verification.mjs [--out dist/fpv-optional-examples-verification-NAME] [--candidate-base dist/PREPARED-WORLD-ROOT] --proof-file PATH [--verify-only]\nDefault candidate: current source. Real renderer and frozen module dependency tree. Existing destinations are never overwritten. No fetching, checkout or Git writes.',
      );
      return;
    } else fail(`Unknown/incomplete option: ${args[i]}`);
  }
  if (!/^dist\/fpv-optional-examples-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Use dist/fpv-optional-examples-verification or a named sibling as output.');
  if (candidate && !/^dist\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(candidate))
    fail('Candidate base must be a prepared package directory under dist.');
  if (!proofFile) fail('Provide the bounded optional recording archive with --proof-file.');
  const proofPath = await fs.realpath(proofFile);
  const proofSize = (await fs.stat(proofPath)).size;
  if (proofSize < 1 || proofSize > 2 * 1024 * 1024)
    fail('Fixture proof archive must be at most 2 MiB.');
  const proofBytes = await fs.readFile(proofPath);
  const proofArchive = JSON.parse(proofBytes.toString('utf8'));
  if (
    !Array.isArray(proofArchive.records) ||
    proofArchive.records.length !== 14 ||
    new Set(proofArchive.records.map((r) => r.course?.id)).size !== 14 ||
    proofArchive.records.some((r) => r.proof?.mode !== 'self-level')
  )
    fail('This fixture requires the 14 primary self-level examples.');
  const repositoryRoot = await fs.realpath(ROOT),
    candidateRoot = await fs.realpath(path.join(ROOT, candidate));
  if (!within(repositoryRoot, candidateRoot)) fail('Candidate base cannot leave the repository.');
  const sourceBase = candidate ? `/${candidate}` : '',
    fixtureBase = `/${output}`,
    candidateBase = `${fixtureBase}/candidate`;
  let total = 0;
  async function read(relative) {
    const file = await fs.realpath(path.join(candidateRoot, relative));
    if (!within(candidateRoot, file)) fail(`Candidate path leaves selected base: ${relative}`);
    const size = (await fs.stat(file)).size;
    if (size < 1 || size > MAX_FILE_BYTES || total + size > MAX_TOTAL_BYTES)
      fail('Candidate input exceeds bounded fixture size.');
    const bytes = await fs.readFile(file);
    total += bytes.length;
    return bytes;
  }
  const currentSources = {},
    sourceFiles = {},
    frozen = new Map(),
    pending = [HOST],
    visited = new Set();
  let current;
  while (pending.length) {
    const relative = pending.pop();
    if (visited.has(relative)) continue;
    if (visited.size >= MAX_MODULES) fail('Candidate dependency graph exceeds the module bound.');
    visited.add(relative);
    const bytes = await read(relative);
    currentSources[`${candidateBase}/${relative}`] = digest(bytes);
    sourceFiles[relative] = digest(bytes);
    frozen.set(relative, bytes);
    if (relative === HOST) current = bytes;
    for (const specifier of imports(bytes.toString('utf8')).literals) {
      const next = dependency(relative, specifier);
      if (next) pending.push(next);
    }
  }
  const html = await read(HTML);
  currentSources[`${candidateBase}/${HTML}`] = digest(html);
  sourceFiles[HTML] = digest(html);
  frozen.set(HTML, html);
  const artifacts = new Map([
    ['index.html', await fs.readFile(path.join(ROOT, EVIDENCE))],
    ['examples.json', proofBytes],
    ['player.html', Buffer.from(buildPlayer(html.toString('utf8'), sourceBase, candidateBase))],
  ]);
  const manifest = {
    format: 'FPVOptionalExamplesFixture.v1',
    candidateBase,
    sourceBase,
    sourceFiles,
    candidateHostSha256: digest(current),
    proofArchive: {
      sha256: digest(proofBytes),
      bytes: proofBytes.length,
      records: proofArchive.records.length,
    },
    fixtureFiles: Object.fromEntries([...artifacts].map(([name, bytes]) => [name, digest(bytes)])),
    currentSources,
    scope:
      'Actual candidate host and renderer with unchanged immutable module copies under a unique URL. Real HTTP iframe; controlled clock qualification and separate native real-time review. CSS/artwork resolve to the selected source/package base.',
  };
  if (verifyOnly) {
    console.log(
      JSON.stringify({
        verified: true,
        writes: 0,
        candidateBase: candidate || '.',
        modules: visited.size,
        bytes: total,
        candidateHostSha256: digest(current),
      }),
    );
    return;
  }
  const dist = path.join(ROOT, 'dist');
  const stat = await fs.lstat(dist).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
    fail('dist must be a real directory.');
  if (!stat) await fs.mkdir(dist);
  const destination = path.join(ROOT, output);
  const exists = await fs.lstat(destination).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (exists)
    fail(`Destination exists: ${output}; preserve running fixtures and use a fresh --out.`);
  await fs.mkdir(destination);
  for (const [relative, bytes] of frozen) {
    const target = path.join(destination, 'candidate', relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: 'wx' });
  }
  for (const [name, bytes] of artifacts)
    await fs.writeFile(path.join(destination, name), bytes, { flag: 'wx' });
  await fs.writeFile(
    path.join(destination, 'fixture-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      prepared: true,
      candidateBase: candidate || '.',
      modules: visited.size,
      bytes: total,
      url: `http://127.0.0.1:8789/${output}/index.html`,
      note: 'Use the approved browser tool to run optional example import and playback qualification. Preparation alone is not browser verification.',
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
