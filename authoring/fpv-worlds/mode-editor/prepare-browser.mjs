#!/usr/bin/env node
// Authoring-only manual qualification; never imported by a player.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  encodeWorldGLB,
  inspectImport,
  projectFromImport,
  canonicalWorldJSON,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import { exportEditableZip } from '../../../optional-practice/civilian-fpv/world-zip.mjs';
import {
  courseFromProject,
  synchronizeDefinitions,
} from '../../../optional-practice/civilian-fpv/world-app.mjs';

const HOST = 'optional-practice/civilian-fpv/world-app.mjs';
const EXPECTED_HOST = '6bd30bcd11caa83ccdb36d9bb7c826a9735b5d4549bb49008494921a6a0ba4cc';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  assert(
    ['--player', '--starter', '--out', '--admitted-source'].includes(key) && process.argv[i + 1],
    'Use --player ADMITTED_DIRECTORY --starter ACCEPTED_SPLIT_LEVEL_ZIP --out NEW_DIRECTORY',
  );
  options[key.slice(2)] =
    key === '--admitted-source' ? process.argv[i + 1] : path.resolve(process.argv[i + 1]);
}
assert(
  options.player && options.starter && options.out,
  'All three directory options are required',
);
const admitted = Boolean(options['admitted-source']);
if (admitted)
  assert(
    /^[a-f0-9]{40}$/.test(options['admitted-source']),
    'Expected exact admitted source commit',
  );
const player = await fs.realpath(options.player);
const starter = await fs.realpath(options.starter);
const overlay = await fs.readFile(
  admitted ? path.join(player, HOST) : new URL('../../../' + HOST, import.meta.url),
);
const descriptor = await fs.readFile(path.join(player, 'optional-package.json'));
const manifest = JSON.parse(descriptor);
assert(
  manifest.id === 'fpv-worlds' && manifest.files.length === 101,
  'Expected the admitted 102-member Worlds package',
);
assert(
  manifest.engineCommit ===
    (options['admitted-source'] ?? 'd9ad2561ee1d7685ef97961478b7de30278c1e48'),
  'Unexpected admitted source',
);
assert(
  manifest.files.find((f) => f.path === HOST)?.sha256 ===
    (admitted ? hash(overlay) : EXPECTED_HOST),
  'Unexpected admitted host',
);
const files = [
  ...manifest.files,
  { path: 'optional-package.json', bytes: descriptor.length, sha256: hash(descriptor) },
];
const staged = [];
async function checked(root, record) {
  assert(
    /^[a-zA-Z0-9_./-]+$/.test(record.path) &&
      !record.path.split('/').includes('..') &&
      !path.isAbsolute(record.path),
    'Unsafe source member',
  );
  const source = await fs.realpath(path.join(root, record.path));
  assert(source.startsWith(root + path.sep), 'Source member leaves its root');
  const bytes = await fs.readFile(source);
  assert(
    bytes.length === record.bytes && hash(bytes) === record.sha256,
    `Source checksum differs: ${record.path}`,
  );
  return source;
}
for (const record of files)
  staged.push({
    source: await checked(player, record),
    path: `player/${record.path}`,
    ...record,
    destination: `player/${record.path}`,
  });
const starterBytes = await fs.readFile(starter);
assert(
  hash(starterBytes) === 'dbf62085ac11aca531d70fd445fa00f8beb597aa7728a01f436b2dd495a05091',
  'Expected accepted r5 split-level ZIP',
);
const authored = new Map([['divergent.zip', starterBytes]]);
function scene(offset = 0, alternate = false) {
  const binary = new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const doc = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2, 3] }],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [
      { mesh: 0 },
      { translation: [0, 0, 12], extras: { rl: { id: 'spawn', kind: 'spawn' } } },
      {
        translation: [offset, 4, 0],
        extras: { rl: { id: 'gate', kind: 'gate', width: 6, height: 4, order: 1 } },
      },
      { translation: [0, 0, -12], extras: { rl: { id: 'landing', kind: 'landing', order: 2 } } },
    ],
  };
  if (alternate) {
    doc.nodes.push({
      translation: [0, 4, 0],
      extras: { rl: { id: 'other-gate', kind: 'gate', width: 6, height: 4, order: 3 } },
    });
    doc.scenes[0].nodes.push(4);
  }
  return encodeWorldGLB(doc, binary);
}
for (const mismatch of [false, true]) {
  const id = mismatch ? 'mode-bindings-differ' : 'mode-bindings-shared';
  const bytes = scene(0, mismatch),
    imported = await inspectImport({
      files: { 'source.glb': bytes },
      entry: 'source.glb',
      id,
      title: id,
    }),
    project = projectFromImport(imported);
  const authoredSource = structuredClone(project);
  authoredSource.source.anchors = authoredSource.source.anchors.filter(
    (a) => a.id !== 'other-gate',
  );
  const course = courseFromProject(authoredSource);
  project.courses = [course];
  project.routeBindings = {
    [course.id]: {
      'self-level': ['gate', 'landing'],
      acro: [mismatch ? 'other-gate' : 'gate', 'landing'],
    },
  };
  project.spawnBindings = { [course.id]: 'spawn' };
  // Materialize the compiler default profile, then retain it in the split definitions.
  synchronizeDefinitions(synchronizeDefinitions(project));
  assert(
    canonicalWorldJSON(synchronizeDefinitions(structuredClone(project))) ===
      canonicalWorldJSON(project),
    'Source fixture must already have canonical definitions and theme profile',
  );
  const zip = await exportEditableZip(project, {
    assets: new Map([[project.world.modelAsset, imported.modelBlob]]),
  });
  authored.set(id + '.zip', new Uint8Array(await zip.arrayBuffer()));
  authored.set(id + '.project.json', Buffer.from(JSON.stringify(project, null, 2) + '\n'));
}
authored.set('source-updated.glb', scene(0.5));
// Refuse replacement, including prior failed fixtures. Hardlinks are never modified or chmodded.
await fs.mkdir(options.out);
for (const record of staged) {
  const destination = path.join(options.out, record.destination);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  if (record.path === HOST && !admitted) await fs.writeFile(destination, overlay, { flag: 'wx' });
  else await fs.link(record.source, destination);
}
await fs.mkdir(path.join(options.out, 'inputs'));
for (const [name, bytes] of authored)
  await fs.writeFile(path.join(options.out, 'inputs', name), bytes, { flag: 'wx' });
const setup = `
window.fixtureToken=new URL(location.href).searchParams.get('token');window.fixtureErrors=[];
addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
const nativeIDB=window.indexedDB,dbPrefix=parent.fixtureDBPrefix;
Object.defineProperty(window,'indexedDB',{value:{
open(name,version){const full=dbPrefix+name;parent.fixtureDBNames.add(full);return version===undefined?nativeIDB.open(full):nativeIDB.open(full,version)},
deleteDatabase:name=>nativeIDB.deleteDatabase(dbPrefix+name),cmp:nativeIDB.cmp.bind(nativeIDB)
}});
Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
window.fixtureDownloads=[];const blobs=new Map(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),anchorClick=HTMLAnchorElement.prototype.click;
URL.createObjectURL=blob=>{const url=create(blob);blobs.set(url,blob);return url};URL.revokeObjectURL=url=>{revoke(url);blobs.delete(url)};
HTMLAnchorElement.prototype.click=function(){if(this.download&&blobs.has(this.href)){fixtureDownloads.push({name:this.download,blob:blobs.get(this.href)});return}return anchorClick.call(this)};
`;
const originalHTML = await fs.readFile(path.join(player, manifest.entry), 'utf8');
assert(
  originalHTML.includes('<head>') && originalHTML.includes('data-fpv-worlds="true"'),
  'Missing actual automatic host mount',
);
const hostHTML = originalHTML.replace(
  '<head>',
  `<head><base href="./player/optional-practice/fpv-worlds/"><script>${setup}</script>`,
);
await fs.writeFile(path.join(options.out, 'host.html'), hostHTML, { flag: 'wx' });
for (const [source, destination] of [
  ['browser-harness.html', 'index.html'],
  ['browser-harness.mjs', 'browser-harness.mjs'],
]) {
  await fs.copyFile(
    new URL(source, import.meta.url),
    path.join(options.out, destination),
    fs.constants.COPYFILE_EXCL,
  );
}
if (admitted) {
  const htmlPath = path.join(options.out, 'index.html');
  let html = await fs.readFile(htmlPath, 'utf8');
  html = html
    .replaceAll('source overlay qualification', 'admitted package qualification')
    .replaceAll('with source overlay', 'from admitted package')
    .replace(
      /  <p>[\s\S]*?<\/p>/,
      '  <p>Exact combined admitted player, actual Workshop and renderer, isolated native IndexedDB. All 102 package files are unchanged. Run the same public UI scenarios and trusted Acro drag as the source qualification. No offline, hardware or performance claim.</p>',
    );
  await fs.writeFile(htmlPath, html);
}
const receipt = {
  format: admitted ? 'FPVEditorModesAdmittedFixture.v1' : 'FPVEditorModesSourceOverlayFixture.v1',
  qualificationKind: admitted ? 'admitted-package' : 'source-overlay',
  sourceRevision: manifest.engineCommit,
  hostSha256: admitted ? hash(overlay) : EXPECTED_HOST,
  hostHTMLSha256: hash(hostHTML),
  packageRevision: manifest.revision,
  admittedFiles: files,
  overlay: {
    path: HOST,
    bytes: overlay.length,
    sha256: hash(overlay),
    sourceCommit: admitted
      ? manifest.engineCommit
      : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  },
  inputs: [...authored].map(([name, bytes]) => ({
    path: 'inputs/' + name,
    bytes: bytes.length,
    sha256: hash(bytes),
  })),
  browserSources: await Promise.all(
    ['index.html', 'browser-harness.mjs'].map(async (file) => ({
      path: file,
      sha256: hash(await fs.readFile(path.join(options.out, file))),
    })),
  ),
  modifications: [
    'Separate host HTML adds a base URL and isolated storage/download instrumentation before the unchanged automatic mount.',
    'The native IndexedDB factory remains in the host iframe realm; only database names are prefixed. Parent read-only inspection uses its own factory with the same prefix.',
    admitted
      ? 'All 102 admitted player files are unchanged immutable hardlinks; no runtime overlay.'
      : '101 baseline files remain immutable hardlinks; world-app.mjs is a separate exact source overlay. This fixture is NOT an admitted package. The original manifest is retained as baseline evidence; it does not certify the overlay.',
  ],
  limitations: [
    'Manual spatial drag remains necessary after stage one.',
    'Online native-IDB reopening only; no service-worker installation or offline claim.',
    'This UI fixture does not qualify new flight completion, public deployment or device behavior.',
  ],
};
await fs.writeFile(
  path.join(options.out, 'fixture.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify(
    {
      output: options.out,
      admittedFiles: files.length,
      inputs: receipt.inputs.length,
      hostSha256: admitted ? hash(overlay) : EXPECTED_HOST,
      browserQualification: 'pending',
    },
    null,
    2,
  ),
);
