import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [root, player, inventoryPath, revision, originalPack, out] = process.argv.slice(2);
if (
  ![root, player, inventoryPath, originalPack, out].every((p) => p && path.isAbsolute(p)) ||
  !/^[a-f0-9]{40}$/.test(revision ?? '')
)
  throw Error(
    'ABS_ROOT ABS_PLAYER ABS_INVENTORY EXACT_SOURCE ABS_ORIGINAL_DIAGNOSTIC ABS_NEW_OUTPUT',
  );
const hash = (b) => createHash('sha256').update(b).digest('hex');
const git = (...args) =>
  execFileSync('git', args, {
    cwd: root,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    maxBuffer: 20 * 1024 * 1024,
  });
const stageBytes = await fs.readFile(player + '.json'),
  inventoryBytes = await fs.readFile(inventoryPath);
const stage = JSON.parse(stageBytes),
  inventory = JSON.parse(inventoryBytes);
if (
  stage.files.length !== 102 ||
  inventory.inputs.length !== 95 ||
  stage.sourceRevision !== inventory.sourceRevision ||
  stage.sourceTree !== inventory.sourceTree ||
  !stage.checks.every((c) => c.passed)
)
  throw Error('Exact admitted 102/95 baseline required');
const inputs = [],
  overlays = new Map();
for (const row of inventory.inputs) {
  const bytes = git('show', revision + ':' + row.path),
    sha256 = hash(bytes),
    changed = bytes.length !== row.bytes || sha256 !== row.sha256;
  if (changed) {
    if (
      ![
        'optional-practice/civilian-fpv/world-app.mjs',
        'optional-practice/civilian-fpv/world-visuals.mjs',
      ].includes(row.path)
    )
      throw Error('Unexpected input ' + row.path);
    overlays.set(row.path, bytes);
  }
  inputs.push({ ...row, bytes: bytes.length, sha256, changed });
}
if (overlays.size !== 2)
  throw Error('Expected only historical host and qualified visual projection differences');
await fs.mkdir(out);
const files = [];
async function write(name, bytes, provenance = 'manual functional fixture') {
  await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
  await fs.writeFile(path.join(out, name), bytes, { flag: 'wx' });
  files.push({ path: name, bytes: Buffer.byteLength(bytes), sha256: hash(bytes), provenance });
}
for (const row of stage.files) {
  if (!/^[\w./-]+$/.test(row.path) || row.path.split('/').includes('..'))
    throw Error('Unsafe member');
  const src = path.join(player, row.path),
    bytes = await fs.readFile(src),
    dest = 'player/' + row.path;
  if (bytes.length !== row.bytes || hash(bytes) !== row.sha256)
    throw Error('Retained member changed ' + row.path);
  if (overlays.has(row.path))
    await write(dest, overlays.get(row.path), 'exact committed current-main source overlay');
  else {
    await fs.mkdir(path.dirname(path.join(out, dest)), { recursive: true });
    await fs.link(src, path.join(out, dest));
    files.push({ ...row, path: dest, provenance: 'immutable admitted member' });
  }
}
const contentPath = 'optional-practice/civilian-fpv/world-content.mjs';
if (
  hash(await fs.readFile(path.join(root, contentPath))) !==
  hash(git('show', revision + ':' + contentPath))
)
  throw Error('Pack preparer source changed');
const { inspectPack, preparePack } = await import(pathToFileURL(path.join(root, contentPath)));
const originalBytes = await fs.readFile(originalPack),
  original = await inspectPack(originalBytes);
const project = structuredClone(original.project);
project.id = 'creator-install-diagnostic';
project.title = 'Creator install reliability fixture';
project.world.id = project.id;
project.world.title = project.title;
project.courses = ['first', 'second'].map((suffix) => {
  const c = structuredClone(original.project.courses[0]);
  c.id = 'creator-install-' + suffix;
  c.world.id = project.world.id;
  c.locales.en.title = 'Install diagnostic ' + suffix;
  c.locales.uk.title = 'Діагностика встановлення ' + suffix;
  return c;
});
const pack = await preparePack(project),
  bytes = Buffer.from(await pack.arrayBuffer()),
  inspected = await inspectPack(bytes);
await write(
  'diagnostic.rlpack',
  bytes,
  'two-course data-only derivative of retained ordinary 60-tick grounded diagnostic',
);
await write('expected-project.json', JSON.stringify(inspected.project, null, 2) + '\n');
for (const name of ['host.mjs', 'run.mjs'])
  await write(name, await fs.readFile(new URL(name, import.meta.url)));
const html = await fs.readFile(
  path.join(player, 'optional-practice/fpv-worlds/index.html'),
  'utf8',
);
if (
  !html.includes('data-fpv-worlds="true"') ||
  !html.includes('src="../civilian-fpv/world-app.mjs"')
)
  throw Error('Native HTML changed');
await write(
  'player/optional-practice/fpv-worlds/install-host.html',
  html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
    .replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../host.mjs"'),
);
await write(
  'index.html',
  '<!doctype html><meta charset="utf-8"><title>Creator install transaction reliability</title><style>body{margin:0;background:#142029;color:white;font:14px system-ui}header{padding:10px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:100%;height:760px}textarea{width:98%;height:220px}pre{white-space:pre-wrap}</style><header><button id="run">Run bounded native install diagnostic</button> <span id="status">Real practice and recovery, then named native IndexedDB aborts. Keep this fixture visible.</span></header><iframe id="sim" title="Native Creator install player" src="about:blank"></iframe><pre id="summary"></pre><label>Full receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>',
);
const fixture = {
  format: 'FPVCreatorInstallFixture.v1',
  revision,
  sourceTree: git('rev-parse', revision + '^{tree}')
    .toString()
    .trim(),
  baseline: {
    sourceRevision: stage.sourceRevision,
    sourceTree: stage.sourceTree,
    stageSHA256: hash(stageBytes),
    inventorySHA256: hash(inventoryBytes),
    zip: stage.zip,
  },
  inputs,
  overlays: [...overlays.keys()],
  originalDiagnostic: { bytes: originalBytes.length, sha256: hash(originalBytes) },
  pack: {
    id: project.id,
    sha256: inspected.sha256,
    bytes: bytes.length,
    courses: project.courses.map((c) => c.id),
  },
  files,
  limitations: [
    'Source-only current-main host and visual projection overlays; other 100 admitted members exact. Generated worker/descriptors remain historical; no new admitted/offline claim.',
    'Same-frame native IndexedDB. Faults abort real transactions after successful native requests; this is not disk quota exhaustion.',
    'Public DOM events and original native clocks; no proof, physics, pause or arming injection. Production export bytes are captured before the OS download.',
  ],
};
const text = JSON.stringify(fixture, null, 2) + '\n';
await fs.writeFile(path.join(out, 'fixture.json'), text, { flag: 'wx' });
console.log(
  JSON.stringify({
    out,
    revision,
    fixtureSHA256: hash(text),
    files: files.length,
    pack: fixture.pack,
    overlays: fixture.overlays,
  }),
);
