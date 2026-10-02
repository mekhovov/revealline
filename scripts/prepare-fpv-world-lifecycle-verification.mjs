#!/usr/bin/env node
/** Prepare an isolated manual host qualification. No Git writes or network requests. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASELINE = '02ac74d42a3f332f262da06c7d3911c9301dd39e';
const BASELINE_SHA = '871813b2a4bb010fa8497b592b1b6f4404837cb4bdcb76f2e7028d43cb2e6df8';
const HOST = 'optional-practice/civilian-fpv/world-app.mjs';
const HTML = 'optional-practice/fpv-worlds/index.html';
const EVIDENCE = 'docs/evidence/fpv-world-lifecycle-browser-harness.html';
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
function rewriteHost(source, candidateBase) {
  let output = source;
  for (const literal of imports(source).staticImports.sort((a, b) => b.start - a.start)) {
    const relative = dependency(HOST, literal.value);
    if (!relative) fail('Host fixture only supports known relative static module imports.');
    output =
      output.slice(0, literal.start) +
      JSON.stringify(`${candidateBase}/${relative}`) +
      output.slice(literal.end);
  }
  return output;
}
function buildPlayer(html, sourceBase, frozenBase, fixtureBase) {
  const setup = `
    const query=new URL(location.href).searchParams;
    const source=query.get('source');
    if(!['keyboard','touch','controller','radio'].includes(source))throw Error('Unknown qualification input source');
    window.fixtureLoadToken=query.get('token');
    window.fixtureErrors=[];addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
    const memory=new Map([['revealline.fpv.world-settings.v1',JSON.stringify({'world-language':'en','flight-source':source,'sim-motion':'reduced','flight-quality':'performance'})]]);
    window.fixtureStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
    Object.defineProperty(window,'localStorage',{value:fixtureStorage});Object.defineProperty(window,'indexedDB',{value:parent.fixtureDB});
    window.controlledRadio={id:'TX15 Joystick (Vendor: 1209 Product: 4f54)',index:0,mapping:'',connected:source==='radio',axes:[.004,.004,-1,.004,-1,0,0,0],buttons:Array.from({length:24},()=>({pressed:false,touched:false,value:0})),timestamp:0};
    window.controlledPad={id:'Controlled standard gamepad',index:1,mapping:'standard',connected:source==='controller',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0})),timestamp:0};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[controlledRadio.connected?controlledRadio:null,controlledPad.connected?controlledPad:null]});
    let nextId=1;const callbacks=new Map();
    window.requestAnimationFrame=cb=>{const id=nextId++;callbacks.set(id,cb);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.fixtureRAF={lastStamp:null,lastExecution:null,deliver(stamp=performance.now()){this.lastStamp=stamp;this.lastExecution=performance.now();const pending=[...callbacks.entries()];callbacks.clear();for(const[,cb]of pending)cb(stamp);return pending.length},pending:()=>callbacks.size};
  `;
  const boot = `
    import{WORLD_CATALOGUE}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-catalogue.mjs`)};
    import{defaultRadioProfile,createFlightProfileStore,DEFAULT_RESPONSE}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/radio-profile.mjs`)};
    const source=new URL(location.href).searchParams.get('source');
    const baseline=new URL(location.href).searchParams.get('variant')==='baseline';
    const{mountWorldApp}=await import(${JSON.stringify(fixtureBase)}+(baseline?'/world-app.before.served.mjs':'/world-app.candidate.served.mjs'));
    if(source==='radio')createFlightProfileStore({storage:fixtureStorage}).save({format:'FlightProfiles.v1',radio:defaultRadioProfile(),response:DEFAULT_RESPONSE});
    window.fixtureEntry=WORLD_CATALOGUE.find(e=>e.id==='garage-06');
    const rendererFactory=()=>({available:true,ready:Promise.resolve(),setCourse(){},setQuality(){},setDrone(){},setPath(){},setGhost(){},loadScene:async()=>{},prepare:async()=>true,draw(s){window.fixtureRenderedTick=s.ticks},aimScreen:()=>null,dispose(){}});
    window.fixtureApp=mountWorldApp({rendererFactory});
  `;
  if (!html.includes('data-fpv-worlds="true"') || !html.includes('</body>'))
    fail('Prepared World HTML lacks its supported mount markers.');
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
  let output = 'dist/fpv-world-lifecycle-verification',
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
        'Usage: node scripts/prepare-fpv-world-lifecycle-verification.mjs [--out dist/fpv-world-lifecycle-verification-NAME] [--candidate-base dist/PREPARED-WORLD-ROOT] [--verify-only]\nDefault candidate: current source. Baseline: pinned host from02ac74d42. Existing destinations are never overwritten. No fetching, checkout or Git writes.',
      );
      return;
    } else fail(`Unknown/incomplete option: ${args[i]}`);
  }
  if (!/^dist\/fpv-world-lifecycle-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Use dist/fpv-world-lifecycle-verification or a named sibling as output.');
  if (candidate && !/^dist\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(candidate))
    fail('Candidate base must be a prepared package directory under dist.');
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
  const result = spawnSync('git', ['--no-pager', 'show', `${BASELINE}:${HOST}`], {
    cwd: ROOT,
    encoding: null,
    maxBuffer: MAX_FILE_BYTES,
    timeout: 10000,
  });
  if (result.status !== 0 || result.error)
    fail(`Local baseline${BASELINE} is unavailable. This tool never fetches or switches branches.`);
  const before = result.stdout;
  if (digest(before) !== BASELINE_SHA) fail('Pinned baseline host SHA-256 differs.');
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
    ['world-app.before.mjs', before],
    ['world-app.candidate.mjs', current],
    [
      'world-app.before.served.mjs',
      Buffer.from(rewriteHost(before.toString('utf8'), candidateBase)),
    ],
    [
      'world-app.candidate.served.mjs',
      Buffer.from(rewriteHost(current.toString('utf8'), candidateBase)),
    ],
    ['index.html', await fs.readFile(path.join(ROOT, EVIDENCE))],
    [
      'player.html',
      Buffer.from(buildPlayer(html.toString('utf8'), sourceBase, candidateBase, fixtureBase)),
    ],
  ]);
  const manifest = {
    format: 'FPVWorldLifecycleFixture.v1',
    baseline: BASELINE,
    baselineSha256: BASELINE_SHA,
    candidateBase,
    sourceBase,
    sourceFiles,
    candidateHostSha256: digest(current),
    fixtureFiles: Object.fromEntries([...artifacts].map(([name, bytes]) => [name, digest(bytes)])),
    currentSources,
    scope:
      'Frozen baseline host versus candidate host; both resolve to an immutable copy of the selected candidate module dependency tree under this unique prepared URL. Only static host import URLs are rewritten; dependency bytes are unchanged. Real HTTP iframe URL; renderer lifecycle stub, real physics/input/actors. CSS and artwork use the original candidate base and are not visually qualified.',
  };
  if (verifyOnly) {
    console.log(
      JSON.stringify({
        verified: true,
        writes: 0,
        baseline: BASELINE,
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
      baseline: BASELINE,
      candidateBase: candidate || '.',
      modules: visited.size,
      bytes: total,
      url: `http://127.0.0.1:8789/${output}/index.html`,
      note: 'Use the approved browser tool to run baseline reproduction and candidate qualification. Preparation alone is not browser verification.',
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
