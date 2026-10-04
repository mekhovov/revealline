#!/usr/bin/env node
// Immutable content fixture over an explicitly admitted historical host; no rebuild or overlay.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
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
if (
  qualification.status !== 'passed' ||
  qualification.flights.length !== 16 ||
  !qualification.checks.every((c) => c.passed) ||
  project.courses.length !== 8 ||
  qualification.archives.length !== 1 ||
  qualification.archives[0].records !== 16
)
  throw Error('Eight courses/sixteen exact ordinary-flight proof gate');
// Authenticate the complete static module closure used by ordinary flight,
// collision, content parsing and proof import against the newly admitted host.
const proofRuntime = [],
  seen = new Set(),
  root = process.cwd();
async function projectedCatalog() {
  const sourceInputs = [];
  const read = (file) => {
    const bytes = execFileSync('git', ['show', 'HEAD:' + file]);
    sourceInputs.push({ path: file, bytes: bytes.length, sha256: sha(bytes) });
    return bytes;
  };
  const policy = (
    await import(
      'data:text/javascript;base64,' +
        read('publishing/optional-package-policy.mjs').toString('base64')
    )
  ).OPTIONAL_PACKAGE_POLICIES['fpv-worlds'];
  const locales = {};
  for (const language of ['en', 'uk']) {
    const errors = JSON.parse(read(`game/locales/${language}/errors.json`));
    locales[language] = {
      errors: Object.fromEntries(
        Object.entries(errors).filter(([key]) => key.startsWith('dataJson.')),
      ),
    };
    for (const [namespace, keys] of Object.entries(policy.localeKeys ?? {})) {
      const source = JSON.parse(read(`game/locales/${language}/${namespace}.json`));
      if (!keys.every((key) => typeof source[key] === 'string'))
        throw Error('Incomplete optional locale projection');
      locales[language][namespace] = Object.fromEntries(keys.map((key) => [key, source[key]]));
    }
  }
  return {
    bytes: Buffer.from(
      `// Selected optional-practice validator messages only.\nglobalThis.RevealLineTranslations=${JSON.stringify(locales)};\n`,
    ),
    sourceInputs,
  };
}
async function qualifyModule(relative) {
  if (seen.has(relative)) return;
  seen.add(relative);
  const local = await fs.readFile(path.join(root, relative));
  const pinned = frozen.find((f) => f.path === relative);
  const projection = relative === 'game/i18n/catalogs.mjs' ? await projectedCatalog() : null;
  const expected = projection?.bytes ?? local;
  if (!pinned || sha(expected) !== pinned.sha256 || expected.length !== pinned.bytes)
    throw Error('Qualified proof runtime differs from admitted member: ' + relative);
  proofRuntime.push({
    path: relative,
    bytes: expected.length,
    sha256: sha(expected),
    ...(projection
      ? {
          presentationProjection:
            'Exact existing optional-package-policy locale projection; flight/collision code is byte-identical.',
          sourceInputs: projection.sourceInputs,
        }
      : {}),
  });
  const ast = parse(local.toString(), { ecmaVersion: 'latest', sourceType: 'module' });
  const imports = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression',
      ].includes(node.type) &&
      node.source
    ) {
      if (node.source.type !== 'Literal' || !node.source.value.startsWith('.'))
        throw Error('Unresolved proof runtime import in ' + relative);
      imports.push(node.source.value);
    }
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
  }
  visit(ast);
  for (const dependency of imports)
    await qualifyModule(path.normalize(path.join(path.dirname(relative), dependency)));
}
for (const name of [
  'world-model.mjs',
  'world-collision.mjs',
  'world-content.mjs',
  'world-records.mjs',
])
  await qualifyModule('optional-practice/civilian-fpv/' + name);
const inputPaths = {
  'project.json': path.join(generatedArg, 'prepared/project.json'),
  'scene.glb': path.join(generatedArg, 'prepared', project.world.modelAsset),
  'world.rlpack': qualification.pack.path,
  'world.zip': path.join(generatedArg, 'prepared', 'festival-grounds.' + project.revision + '.zip'),
  'proofs.json': path.join(proofArg, qualification.archives[0].path),
  'qualification.json': path.join(proofArg, 'qualification.json'),
};
const inputs = Object.fromEntries(
  await Promise.all(
    Object.entries(inputPaths).map(async ([name, file]) => [name, await fs.readFile(file)]),
  ),
);
if (
  sha(inputs['world.rlpack']) !== qualification.pack.sha256 ||
  sha(inputs['proofs.json']) !== qualification.archives[0].sha256
)
  throw Error('Content proof binding mismatch');
await fs.mkdir(output);
for (const file of frozen) {
  const destination = path.join(output, 'player', file.path);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.link(file.from, destination);
}
await fs.mkdir(path.join(output, 'content'));
for (const [name, bytes] of Object.entries(inputs)) {
  const destination = path.join(output, 'content', name);
  // Both sides are immutable generated evidence, never mutable authoring source.
  await fs.link(path.resolve(inputPaths[name]), destination);
  if (sha(await fs.readFile(destination)) !== sha(bytes))
    throw Error('Frozen content changed while linking: ' + name);
}
const setup = `
window.fixtureErrors=[];window.fixtureWarnings=[];window.fixtureDiagnosticsDropped=0;const diagnostic=(rows,value)=>{if(rows.length<1000)rows.push(value);else fixtureDiagnosticsDropped++};addEventListener('error',e=>diagnostic(fixtureErrors,e.message));addEventListener('unhandledrejection',e=>diagnostic(fixtureErrors,String(e.reason)));for(const name of ['warn','error']){const native=console[name].bind(console);console[name]=(...args)=>{diagnostic(name==='warn'?fixtureWarnings:fixtureErrors,args.map(String).join(' '));return native(...args)}}
window.fixtureDownloads=[];const fixtureURLs=new Map(),fixtureCreate=URL.createObjectURL.bind(URL),fixtureRevoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=fixtureCreate(blob);fixtureURLs.set(url,blob);return url};URL.revokeObjectURL=url=>{fixtureRevoke(url);fixtureURLs.delete(url)};const fixtureAnchor=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&fixtureURLs.has(this.href)){fixtureDownloads.push({name:this.download,blob:fixtureURLs.get(this.href)});return}return fixtureAnchor.call(this)};
Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
const nativeDB=window.indexedDB,prefix=new URL(location.href).searchParams.get('database');
if(!prefix?.startsWith('fpv-festival-'))throw Error('Private native database prefix required');
Object.defineProperty(window,'indexedDB',{value:{open(name,version){return version===undefined?nativeDB.open(prefix+name):nativeDB.open(prefix+name,version)},deleteDatabase:name=>nativeDB.deleteDatabase(prefix+name),cmp:nativeDB.cmp.bind(nativeDB)}});
Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
if(new URL(location.href).searchParams.get('clock')!=='native'){let next=1;const callbacks=new Map();window.requestAnimationFrame=cb=>{const id=next++;callbacks.set(id,cb);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);window.fixtureRAF={stamp:performance.now(),deliver(delta=0){this.stamp+=delta;const pending=[...callbacks.values()];callbacks.clear();for(const cb of pending)cb(this.stamp)}}}
`;
const boot = `
const base=new URL('./player/optional-practice/civilian-fpv/',location.href).href;
const [{mountWorldApp},{createFlightRenderer},model,storage,records,collision,zip]=await Promise.all(['world-app.mjs','world-assets.mjs','world-model.mjs','world-store.mjs','world-records.mjs','world-collision.mjs','world-zip.mjs'].map(p=>import(base+p)));
window.fixtureZIP=zip;
window.fixtureModel=model;window.fixtureCollision=collision;window.fixtureWorldStore=await storage.openWorldStore({indexedDB:window.indexedDB});window.fixtureRecords=await records.openWorldRecords(window.indexedDB);
window.fixtureRenderers=[];const rendererFactory=options=>{const renderer=createFlightRenderer(options),draw=renderer.draw,set=renderer.setCourse;window.fixtureRenderers.push(renderer);window.fixtureRenderer=renderer;renderer.setCourse=function(c,...args){window.fixtureDrawState=null;window.fixtureRenderedCourse=c.id;return set.call(this,c,...args)};renderer.draw=function(s,...args){const value=draw.call(this,s,...args);window.fixtureDrawState=s;return value};return renderer};
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
  'index.html': await fs.readFile(new URL('./world-import-preview.html', import.meta.url)),
  'world-import-harness.mjs': await fs.readFile(
    new URL('./world-import-harness.mjs', import.meta.url),
  ),
};
for (const [name, bytes] of Object.entries(artifacts))
  await fs.writeFile(path.join(output, name), bytes, { flag: 'wx' });
const manifest = {
  format: 'FPVFestivalImportedWorld.v1',
  authoringCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  admittedSource: admitted.sourceRevision,
  admittedReceiptSHA256: sha(receiptBytes),
  admittedZIP: admitted.zip,
  proofRuntime,
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
    'Eight-course world on the identified complete admitted host, no runtime overlay; complete proof module closure matches local qualifier, with the standard locale catalogue projection regenerated exactly from current source/policy. Real File import/native IDB, source reimport, editor mode ownership, collision queries and sixteen complete catalogue Watch replays; controlled RAF with unchanged performance clock and pause guards. Native-clock and actual offline qualification remain separate. No hardware/FPS claim.',
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
