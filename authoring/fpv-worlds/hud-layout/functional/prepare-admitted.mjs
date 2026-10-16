import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const [baseline, player, inventoryPath, revision, output] = process.argv.slice(2);
if (
  ![baseline, player, inventoryPath, output].every((p) => p && path.isAbsolute(p)) ||
  !/^[a-f0-9]{40}$/.test(revision ?? '')
)
  throw Error(
    'ABS_BASELINE_FIXTURE ABS_ADMITTED_PLAYER ABS_INVENTORY EXACT_REVISION ABS_NEW_OUTPUT',
  );
const sha = (b) => createHash('sha256').update(b).digest('hex'),
  baselineBytes = await fs.readFile(path.join(baseline, 'fixture.json')),
  source = JSON.parse(baselineBytes),
  stageBytes = await fs.readFile(player + '.json'),
  stage = JSON.parse(stageBytes),
  inventoryBytes = await fs.readFile(inventoryPath),
  inventory = JSON.parse(inventoryBytes);
if (
  source.files.length !== 106 ||
  source.overlays.length !== 1 ||
  source.inputs.length !== 95 ||
  source.sourceRevision !== '5cde6dbc97c3067b6023d2bf7fd97fe251805347' ||
  stage.files.length !== 102 ||
  inventory.inputs.length !== 95 ||
  stage.sourceRevision !== revision ||
  inventory.sourceRevision !== revision ||
  stage.sourceTree !== inventory.sourceTree ||
  !stage.checks.length ||
  !stage.checks.every((c) => c.passed)
)
  throw Error('Require exact historical source baseline and new admitted102/95 candidate');
await fs.mkdir(output);
const files = [];
async function link(root, row, name) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(row.path) || row.path.split('/').includes('..'))
    throw Error('Unsafe member');
  const src = path.join(root, row.path),
    bytes = await fs.readFile(src),
    dest = path.join(output, name);
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256)
    throw Error('Changed member ' + row.path);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.link(src, dest);
  files.push({ ...row, path: name });
}
async function custom(name, bytes, provenance = 'manual functional fixture') {
  const dest = path.join(output, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes, { flag: 'wx' });
  files.push({ path: name, bytes: Buffer.byteLength(bytes), sha256: sha(bytes), provenance });
}
for (const row of source.files) await link(baseline, row, 'baseline/' + row.path);
for (const row of stage.files) await link(player, row, 'candidate/player/' + row.path);
for (const name of ['probe-host.mjs', 'run.mjs', 'index.html']) {
  const row = source.files.find((r) => r.path === name);
  if (!row) throw Error('Missing historical observer member ' + name);
  await link(baseline, row, 'candidate/' + name);
}
const html = await fs.readFile(path.join(player, stage.entry), 'utf8');
if (
  !html.includes('data-fpv-worlds="true"') ||
  !html.includes('src="../civilian-fpv/world-app.mjs"')
)
  throw Error('Unexpected native entry');
await custom(
  'candidate/player/optional-practice/fpv-worlds/steady-host.html',
  html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
    .replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../probe-host.mjs"'),
  'native-depth observation entry; admitted player members unchanged',
);
await custom('run.mjs', await fs.readFile(new URL('run.mjs', import.meta.url)));
await custom(
  'index.html',
  `<!doctype html><meta charset="utf-8"><title>Admitted HUD and stick layout comparison</title><style>body{margin:0;background:#142029;color:white;font:14px system-ui}header{padding:8px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:1024px;height:720px}textarea{width:98%;height:180px}</style><header><button id="run">Compare native HUD and stick layouts</button><span id="status">Historical source baseline, exact admitted candidate. No timing measurement.</span></header><iframe id="sim" title="Native layout comparison" src="about:blank"></iframe><label>Summary<textarea id="summary" readonly></textarea></label><label>Complete receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>`,
);
const value = {
  format: 'FPVHUDLayoutFunctionalFixture.v1',
  variants: [
    {
      variant: 'baseline',
      manifestSha256: sha(baselineBytes),
      sourceRevision: source.sourceRevision,
      inputs: source.inputs,
      overlays: source.overlays,
      admission: source.admission,
    },
    {
      variant: 'candidate',
      sourceRevision: revision,
      sourceTree: stage.sourceTree,
      inputs: inventory.inputs,
      overlays: [],
      admission: {
        stageSha256: sha(stageBytes),
        inventorySha256: sha(inventoryBytes),
        archive: stage.zip,
        packageRevision: inventory.packageRevision,
      },
    },
  ],
  files,
};
const bytes = JSON.stringify(value, null, 2) + '\n';
await fs.writeFile(path.join(output, 'fixture.json'), bytes, { flag: 'wx' });
console.log(
  JSON.stringify({ output, files: files.length, sha256: sha(bytes), candidateOverlays: 0 }),
);
