import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [root, player, inventoryPath, revision, out] = process.argv.slice(2);
if (
  ![root, player, inventoryPath, out].every((p) => p && path.isAbsolute(p)) ||
  !/^[a-f0-9]{40}$/.test(revision ?? '')
)
  throw Error('Use ABS_ROOT ABS_PLAYER ABS_INVENTORY EXACT_COMMIT ABS_NEW_OUTPUT');
const hash = (b) => createHash('sha256').update(b).digest('hex'),
  git = (...a) =>
    execFileSync('git', a, {
      cwd: root,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      maxBuffer: 16 * 1024 * 1024,
    });
const stageBytes = await fs.readFile(player + '.json'),
  inventoryBytes = await fs.readFile(inventoryPath),
  stage = JSON.parse(stageBytes),
  inventory = JSON.parse(inventoryBytes);
if (
  stage.files.length !== 102 ||
  inventory.inputs.length !== 95 ||
  stage.sourceRevision !== inventory.sourceRevision ||
  stage.sourceTree !== inventory.sourceTree ||
  !stage.checks.every((c) => c.passed)
)
  throw Error('Require exact102 admitted members and95 inputs');
const inputs = [],
  overlays = new Map();
for (const row of inventory.inputs) {
  const bytes = git('show', revision + ':' + row.path),
    sha256 = hash(bytes),
    changed = bytes.length !== row.bytes || sha256 !== row.sha256;
  if (changed) {
    if (
      row.path !== 'optional-practice/civilian-fpv/world-app.mjs' ||
      bytes.length !== row.bytes - 63
    )
      throw Error('Unexpected source change ' + row.path);
    overlays.set(row.path, bytes);
  }
  inputs.push({ ...row, bytes: bytes.length, sha256, changed });
}
if (overlays.size !== 1) throw Error('Exactly one declared committed overlay required');
await fs.mkdir(out);
const files = [];
async function custom(name, bytes, provenance = 'manual fixture') {
  const dest = path.join(out, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes, { flag: 'wx' });
  files.push({
    path: name,
    bytes: Buffer.byteLength(bytes),
    sha256: hash(bytes),
    provenance,
  });
}
for (const row of stage.files) {
  if (!/^[\w./-]+$/.test(row.path) || row.path.split('/').includes('..'))
    throw Error('Unsafe member');
  const src = path.join(player, row.path),
    bytes = await fs.readFile(src);
  if (bytes.length !== row.bytes || hash(bytes) !== row.sha256)
    throw Error('Retained member mismatch ' + row.path);
  const name = 'player/' + row.path;
  if (overlays.has(row.path))
    await custom(name, overlays.get(row.path), 'committed ghost-access source overlay');
  else {
    const dest = path.join(out, name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.link(src, dest);
    files.push({ ...row, path: name, provenance: 'immutable admitted member' });
  }
}
for (const name of ['host.mjs', 'run.mjs'])
  await custom(name, await fs.readFile(new URL(name, import.meta.url)));
const pack = await fs.readFile(new URL('../diagnostic.rlpack', import.meta.url));
if (hash(pack) !== 'f50172e5d8e9e0666f6a07f91e5f3ede3c37490c570adbb845f265a21f963388')
  throw Error('Diagnostic pack differs');
await custom('diagnostic.rlpack', pack);
const html = await fs.readFile(
  path.join(player, 'optional-practice/fpv-worlds/index.html'),
  'utf8',
);
if (
  !html.includes('data-fpv-worlds="true"') ||
  !html.includes('src="../civilian-fpv/world-app.mjs"')
)
  throw Error('Native HTML differs');
await custom(
  'player/optional-practice/fpv-worlds/ghost-host.html',
  html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
    .replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../host.mjs"'),
);
await custom(
  'index.html',
  '<!doctype html><meta charset="utf-8"><title>Personal-best replay eligibility tail</title><style>body{margin:0;background:#142029;color:#fff;font:14px system-ui}header{padding:8px;display:flex;gap:12px;align-items:center}button{font:inherit;padding:8px}iframe{display:block;border:0;width:100%;height:760px}textarea{width:98%;height:220px}pre{white-space:pre-wrap}</style><header><button id="run">Run narrow replay tail</button><button id="continue" hidden>Continue checks</button><span id="status">Native language/action trace and replay tail; no manual stops.</span></header><iframe id="sim" title="Native FPV ghost access player" src="about:blank"></iframe><pre id="summary"></pre><label>Complete receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>',
);
const manifest = {
  format: 'FPVPublicGhostSettingsFixture.v1',
  sourceRevision: revision,
  focusedCandidate: '4cfa2ec8188437a454c8f8629c8062a9a7b4aa5e',
  baseline: {
    sourceRevision: stage.sourceRevision,
    sourceTree: stage.sourceTree,
    stageSHA256: hash(stageBytes),
    inventorySHA256: hash(inventoryBytes),
    zip: stage.zip,
  },
  inputs,
  files,
  overlays: [...overlays.keys()],
  limitations: [
    'Source-only explicit committed host overlay; no new package/offline/FPS claim.',
    'The diagnostic course is not a published lesson; a genuine native practice record is required.',
    'Native iframe storage uses a unique prefix. No flight state/clock/pause or proof verification guards are replaced.',
  ],
};
const bytes = JSON.stringify(manifest, null, 2) + '\n';
await fs.writeFile(path.join(out, 'fixture.json'), bytes, { flag: 'wx' });
console.log(
  JSON.stringify({
    output: out,
    sourceRevision: revision,
    fixtureSHA256: hash(bytes),
    files: files.length,
    overlays: [...overlays.keys()],
  }),
);
