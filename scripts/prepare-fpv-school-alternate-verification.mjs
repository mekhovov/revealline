#!/usr/bin/env node
/** Prepare an isolated manual host qualification. No Git writes or network requests. */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOST = 'optional-practice/civilian-fpv/world-app.mjs';
const HTML = 'optional-practice/fpv-worlds/index.html';
const EVIDENCE = 'docs/evidence/fpv-school-alternate-harness.html';
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
    if(!prefix?.startsWith('fpv-school-alternates-'))throw Error('Isolated fixture database prefix required');
    Object.defineProperty(window,'indexedDB',{value:{
      open(name,version){const full=prefix+name;parent.fixtureRegisterDB(full);return version===undefined?nativeDB.open(full):nativeDB.open(full,version)},
      deleteDatabase:name=>nativeDB.deleteDatabase(prefix+name),cmp:nativeDB.cmp.bind(nativeDB)
    }});
    Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
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

const REUSE_PLAYER = 'dist/fpv-railworks-wagon-admitted-player-9efa36364';
const REUSE_RECEIPT = 'docs/evidence/fpv-railworks-admitted-player.json';
const EXPECTED = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `beginner-${String(i + 1).padStart(2, '0')}`,
    mode: 'acro',
  })),
  ...Array.from({ length: 16 }, (_, i) => ({ id: `beginner-${i + 27}`, mode: 'self-level' })),
];
const key = (row) => row.id + ':' + row.mode;
async function filesBelow(directory, prefix = '') {
  const result = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    if (item.isSymbolicLink()) fail('Frozen tree must not contain symlinks: ' + relative);
    if (item.isDirectory())
      result.push(...(await filesBelow(path.join(directory, item.name), relative)));
    else if (item.isFile()) result.push(relative);
    else fail('Unsupported frozen file: ' + relative);
  }
  return result.sort();
}
async function main() {
  let output = 'dist/fpv-school-alternate-verification',
    candidate = '',
    proofDirectory = 'authoring/fpv-worlds/demonstrations/optional/school-alternates-v1',
    verifyOnly = false;
  const args = process.argv.slice(2),
    seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) fail('Repeated option: ' + flag);
    seen.add(flag);
    if (flag === '--verify-only') verifyOnly = true;
    else if (flag === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-school-alternate-verification.mjs [--out dist/fpv-school-alternate-verification-NAME] [--candidate-base dist/PACKAGE] [--proof-directory DIRECTORY] [--verify-only]\nDiscovers complete declared Acro and Self-level archive parts; requires exactly beginner-01–12/Acro and beginner-27–42/Self-level. Reuses verified immutable Railworks files; never links mutable source or overwrites a fixture. Preparation does not qualify playback.',
      );
      return;
    } else if (
      ['--out', '--candidate-base', '--proof-directory'].includes(flag) &&
      args[i + 1] &&
      !args[i + 1].startsWith('--')
    ) {
      const value = args[++i].replace(/\/$/, '');
      if (flag === '--out') output = value;
      else if (flag === '--candidate-base') candidate = value;
      else proofDirectory = value;
    } else fail('Unknown/incomplete option: ' + flag);
  }
  if (!/^dist\/fpv-school-alternate-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Use a bounded named School fixture under dist.');
  if (candidate && !/^dist\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(candidate))
    fail('Candidate must be a prepared package under dist.');
  const repositoryRoot = await fs.realpath(ROOT),
    candidateRoot = await fs.realpath(path.join(ROOT, candidate)),
    reuseRoot = path.join(repositoryRoot, REUSE_PLAYER),
    receiptBytes = await fs.readFile(path.join(ROOT, REUSE_RECEIPT)),
    receipt = JSON.parse(receiptBytes);
  if (!within(repositoryRoot, candidateRoot)) fail('Candidate leaves repository.');
  if (
    (await fs.realpath(reuseRoot)) !== reuseRoot ||
    receipt.output !== reuseRoot ||
    receipt.format !== 'FPVRailworksFullAdmittedPlayer.v1' ||
    receipt.sourceRevision !== '9efa36364425e2846002748bb29478b378d2b5cb' ||
    receipt.totals.files !== 102 ||
    !receipt.checks.length ||
    !receipt.checks.every((row) => row.passed)
  )
    fail('Retained full-player provenance does not match.');
  const immutable = new Map(),
    assets = new Map();
  if (
    JSON.stringify(await filesBelow(reuseRoot)) !==
    JSON.stringify(receipt.files.map((row) => row.path).sort())
  )
    fail('Retained player member set differs from receipt.');
  for (const row of receipt.files) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(row.path) || row.path.split('/').includes('..'))
      fail('Unsafe receipt member.');
    const file = path.join(reuseRoot, row.path),
      stat = await fs.stat(file),
      bytes = await fs.readFile(file);
    if (bytes.length !== row.bytes || digest(bytes) !== row.sha256)
      fail('Retained immutable file changed: ' + row.path);
    for (const inputRoot of new Set([
      repositoryRoot,
      ...(candidateRoot === reuseRoot ? [] : [candidateRoot]),
    ])) {
      const input = await fs.stat(path.join(inputRoot, row.path)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      });
      if (input && stat.dev === input.dev && stat.ino === input.ino)
        fail('Retained file aliases mutable input: ' + row.path);
    }
    assets.set(row.path, { file, bytes });
    immutable.set(row.sha256, { file, bytes });
  }
  if (
    receipt.files.length !== 102 ||
    [...assets.values()].reduce((n, row) => n + row.bytes.length, 0) !== receipt.totals.bytes
  )
    fail('Retained player count/byte total differs.');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim(),
    fixtureBase = '/' + output,
    candidateBase = fixtureBase + '/candidate',
    sourceBase = fixtureBase + '/assets',
    frozen = new Map(),
    sourceFiles = {},
    currentSources = {},
    pending = [HOST];
  let total = 0;
  async function read(relative) {
    const file = await fs.realpath(path.join(candidateRoot, relative));
    if (!within(candidateRoot, file)) fail('Candidate file leaves selected root: ' + relative);
    const stat = await fs.stat(file);
    if (stat.size < 1 || stat.size > MAX_FILE_BYTES || total + stat.size > MAX_TOTAL_BYTES)
      fail('Candidate dependency byte bound exceeded.');
    const bytes = await fs.readFile(file);
    total += bytes.length;
    return bytes;
  }
  while (pending.length) {
    const relative = pending.pop();
    if (frozen.has(relative)) continue;
    if (frozen.size >= MAX_MODULES) fail('Candidate dependency count exceeded.');
    const bytes = await read(relative);
    frozen.set(relative, bytes);
    sourceFiles[relative] = digest(bytes);
    currentSources[candidateBase + '/' + relative] = digest(bytes);
    for (const specifier of imports(bytes.toString('utf8')).literals) {
      const next = dependency(relative, specifier);
      if (next) pending.push(next);
    }
  }
  const html = await read(HTML);
  frozen.set(HTML, html);
  sourceFiles[HTML] = digest(html);
  currentSources[candidateBase + '/' + HTML] = digest(html);
  for (const [relative, row] of assets)
    currentSources[sourceBase + '/' + relative] = digest(row.bytes);
  const local = (relative) => import(pathToFileURL(path.join(candidateRoot, relative))),
    [records, catalogue, model, data, worldDemos, flightDemos] = await Promise.all([
      local('optional-practice/civilian-fpv/world-records.mjs'),
      local('optional-practice/civilian-fpv/world-catalogue.mjs'),
      local('optional-practice/civilian-fpv/world-model.mjs'),
      local('game/data-json.mjs'),
      local('optional-practice/civilian-fpv/world-demonstrations.mjs'),
      local('optional-practice/civilian-fpv/demonstrations.mjs'),
    ]);
  const core = {
    world: worldDemos.WORLD_DEMONSTRATIONS.length,
    flight: flightDemos.FLIGHT_DEMONSTRATIONS.length,
    worldSha256: digest(JSON.stringify(worldDemos.WORLD_DEMONSTRATIONS)),
    flightSha256: digest(JSON.stringify(flightDemos.FLIGHT_DEMONSTRATIONS)),
  };
  if (core.world !== 154 || core.flight !== 24) fail('Expected unchanged 178 core recordings.');
  for (const file of ['world-demonstrations.mjs', 'demonstrations.mjs']) {
    const relative = 'optional-practice/civilian-fpv/' + file;
    if (!frozen.get(relative)?.equals(assets.get(relative)?.bytes))
      fail('Core recording module changed: ' + file);
  }
  const archiveRoot = await fs.realpath(path.resolve(ROOT, proofDirectory)),
    archiveNames = (await fs.readdir(archiveRoot))
      .filter((name) => /^fpv-school-(?:acro|self-level)-proof-part-\d+-of-\d+\.json$/.test(name))
      .sort(),
    archives = [],
    artifacts = new Map(),
    allRecords = [];
  let archiveBytes = 0;
  for (const name of archiveNames) {
    const file = await fs.realpath(path.join(archiveRoot, name));
    if (!within(archiveRoot, file)) fail('Archive symlink leaves selected directory.');
    const stat = await fs.stat(file);
    if (stat.size > 32 * 1024 * 1024 || (archiveBytes += stat.size) > 32 * 1024 * 1024)
      fail('Archive fixture byte bound exceeded.');
    const bytes = await fs.readFile(file),
      part = JSON.parse(bytes),
      imported = await records.importProofPart(part),
      match = name.match(/^fpv-school-(acro|self-level)-proof-part-(\d+)-of-(\d+)\.json$/);
    if (
      part.format !== 'FPVProofArchive.v2' ||
      part.part !== Number(match[2]) ||
      part.parts !== Number(match[3]) ||
      imported.some((r) => r.proof.mode !== match[1] || r.status !== 'missing-dependency')
    )
      fail('Archive name/mode/import trust mismatch.');
    const relative = 'archives/' + name;
    archives.push({
      file: relative,
      input: path.relative(ROOT, file),
      sha256: digest(bytes),
      bytes: bytes.length,
      mode: match[1],
      part: part.part,
      parts: part.parts,
      archiveId: part.archiveId,
      records: imported.length,
    });
    artifacts.set(relative, bytes);
    allRecords.push(...imported);
  }
  for (const mode of ['acro', 'self-level']) {
    const parts = archives.filter((part) => part.mode === mode).sort((a, b) => a.part - b.part);
    if (
      !parts.length ||
      parts.length !== parts[0].parts ||
      parts.some(
        (p, i) =>
          p.part !== i + 1 || p.parts !== parts.length || p.archiveId !== parts[0].archiveId,
      )
    )
      fail('Missing/duplicate/inconsistent declared archive parts for ' + mode);
  }
  const actual = allRecords.map((r) => r.course.id + ':' + r.proof.mode).sort();
  if (JSON.stringify(actual) !== JSON.stringify(EXPECTED.map(key).sort()))
    fail('Archive must contain exactly the 28 approved course/mode pairs.');
  for (const row of allRecords) {
    const entry = catalogue.BEGINNER_CATALOGUE.find((e) => e.id === row.course.id);
    if (
      !entry ||
      model.worldCourseRequiresAcro(row.course) ||
      row.packIdentity !== entry.packIdentity ||
      data.dataIdentity(model.validateWorldCourse(row.course)) !==
        data.dataIdentity(model.validateWorldCourse(entry.course)) ||
      row.proof.session !== 'demonstration' ||
      row.proof.course !== entry.id ||
      worldDemos.WORLD_DEMONSTRATIONS.some(
        (d) => d.proof.course === entry.id && d.proof.mode === row.proof.mode,
      )
    )
      fail('Archive eligibility/course/dependency identity mismatch: ' + row.course.id);
  }
  artifacts.set('index.html', await fs.readFile(path.join(ROOT, EVIDENCE)));
  artifacts.set(
    'player.html',
    Buffer.from(buildPlayer(html.toString('utf8'), sourceBase, candidateBase)),
  );
  const manifest = {
    format: 'FPVSchoolAlternateFixture.v1',
    sourceRevision,
    candidateInput: candidate || '.',
    candidateBase,
    sourceBase,
    sourceFiles,
    candidateHostSha256: digest(frozen.get(HOST)),
    core,
    expectedPairs: EXPECTED,
    archives,
    reusedPlayer: {
      path: REUSE_PLAYER,
      receipt: REUSE_RECEIPT,
      receiptSha256: digest(receiptBytes),
      sourceRevision: receipt.sourceRevision,
      zip: receipt.zip,
      files: receipt.totals.files,
      bytes: receipt.totals.bytes,
    },
    fixtureFiles: Object.fromEntries([...artifacts].map(([name, bytes]) => [name, digest(bytes)])),
    currentSources,
    scope:
      'Manual actual-host, File input, IndexedDB, WebGL and controlled animation-clock qualification for 28 alternate School examples. Candidate dependency closure is frozen from the selected source/package root; CSS/art assets come from the complete immutable 102-file admitted Railworks player. No production code changes. Preparation authenticates transport and exact dependencies but does not trust imported verification flags or claim successful flight, browser behavior, offline installation, public deployment, FPS or human teaching acceptance.',
  };
  for (const [relative, bytes] of frozen)
    if (!(await fs.readFile(path.join(candidateRoot, relative))).equals(bytes))
      fail('Candidate changed during preparation: ' + relative);
  for (const archive of archives)
    if (digest(await fs.readFile(path.resolve(ROOT, archive.input))) !== archive.sha256)
      fail('Archive changed during preparation.');
  if (verifyOnly) {
    console.log(
      JSON.stringify({
        verified: true,
        writes: 0,
        sourceRevision,
        modules: frozen.size,
        sourceBytes: total,
        archives,
        core,
        reusedPlayer: manifest.reusedPlayer,
      }),
    );
    return;
  }
  const dist = path.join(ROOT, 'dist'),
    stat = await fs.lstat(dist);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('dist must be a real directory.');
  const destination = path.join(ROOT, output);
  await fs.mkdir(destination); // EEXIST deliberately preserves every earlier fixture.
  const storage = { linkedFiles: 0, linkedBytes: 0, writtenFiles: 0, writtenBytes: 0 };
  async function freeze(relative, bytes, reuse) {
    const file = path.join(destination, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    if (reuse && reuse.bytes.equals(bytes)) {
      if (!(await fs.readFile(reuse.file)).equals(bytes))
        fail('Immutable reuse changed before linking.');
      await fs.link(reuse.file, file);
      storage.linkedFiles++;
      storage.linkedBytes += bytes.length;
    } else {
      await fs.writeFile(file, bytes, { flag: 'wx' });
      storage.writtenFiles++;
      storage.writtenBytes += bytes.length;
    }
    if (!(await fs.readFile(file)).equals(bytes)) fail('Frozen file re-read mismatch: ' + relative);
  }
  for (const [relative, row] of assets) await freeze('assets/' + relative, row.bytes, row);
  for (const [relative, bytes] of frozen)
    await freeze('candidate/' + relative, bytes, immutable.get(digest(bytes)));
  for (const [relative, bytes] of artifacts) await freeze(relative, bytes);
  manifest.storage = storage;
  await fs.writeFile(
    path.join(destination, 'fixture-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      prepared: true,
      sourceRevision,
      url: 'http://127.0.0.1:8834/' + output + '/index.html',
      archives: archives.length,
      pairs: EXPECTED.length,
      storage,
      note: 'Preparation only; execute through approved browser UI for a manual qualification receipt.',
    }),
  );
}
main().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
