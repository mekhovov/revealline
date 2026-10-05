// Freeze an explicit source overlay or an exact complete admitted player.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const [
  root,
  revision,
  player,
  inventoryPath,
  reservoirPath,
  festivalPath,
  proofPath,
  out,
  scenario = 'catalogue',
] = process.argv.slice(2);
if (
  !/^[a-f0-9]{40}$/.test(revision ?? '') ||
  ![root, player, inventoryPath, reservoirPath, festivalPath, proofPath, out].every(
    (p) => p && path.isAbsolute(p),
  )
)
  throw Error(
    'Use ABS_ROOT EXACT_REV ABS_PLAYER ABS_INVENTORY ABS_RESERVOIR ABS_FESTIVAL ABS_RESERVOIR_PROOFS ABS_NEW_OUT',
  );
if (!['catalogue', 'mode-diagnostic', 'admitted'].includes(scenario))
  throw Error('Unknown manual scenario');
const admitted = scenario === 'admitted';
const hash = (b) => createHash('sha256').update(b).digest('hex'),
  git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      maxBuffer: 20 * 1024 * 1024,
    }),
  inventoryBytes = await fs.readFile(inventoryPath),
  inventory = JSON.parse(inventoryBytes),
  stageBytes = await fs.readFile(player + '.json'),
  stage = JSON.parse(stageBytes),
  hostPath = 'optional-practice/civilian-fpv/world-app.mjs',
  inputs = [];
if (
  stage.files.length !== 102 ||
  !stage.checks.every((r) => r.passed) ||
  inventory.inputs.length !== 95 ||
  stage.sourceRevision !== inventory.sourceRevision ||
  stage.sourceTree !== inventory.sourceTree
)
  throw Error('Exact complete102/95 baseline required');
if (
  admitted &&
  (stage.sourceRevision !== revision ||
    stage.sourceTree !==
      git('rev-parse', revision + '^{tree}')
        .toString()
        .trim())
)
  throw Error('Exact admitted revision/tree required');
for (const row of inventory.inputs) {
  const bytes = git('show', revision + ':' + row.path),
    changed = hash(bytes) !== row.sha256;
  if (changed && row.path !== hostPath) throw Error('Unexpected overlay ' + row.path);
  if (!bytes.equals(await fs.readFile(path.join(root, row.path))))
    throw Error('Working source differs ' + row.path);
  inputs.push({ ...row, bytes: bytes.length, sha256: hash(bytes), changed });
}
if (inputs.filter((r) => r.changed).length !== (admitted ? 0 : 1))
  throw Error(admitted ? 'Admitted fixture forbids overlays' : 'Exactly one host overlay required');
if (await fs.stat(out).catch(() => null)) throw Error('Never replace frozen output');
await fs.mkdir(out);
const files = [];
async function write(name, bytes, provenance = 'manual fixture') {
  await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
  await fs.writeFile(path.join(out, name), bytes, { flag: 'wx' });
  files.push({ path: name, bytes: Buffer.byteLength(bytes), sha256: hash(bytes), provenance });
}
for (const row of stage.files) {
  if (!/^[\w./-]+$/.test(row.path) || row.path.split('/').includes('..'))
    throw Error('Unsafe member');
  const source = path.join(player, row.path),
    bytes = await fs.readFile(source),
    target = 'player/' + row.path;
  if (bytes.length !== row.bytes || hash(bytes) !== row.sha256)
    throw Error('Changed admitted member ' + row.path);
  if (!admitted && row.path === hostPath)
    await write(target, git('show', revision + ':' + row.path), 'exact committed host overlay');
  else {
    await fs.mkdir(path.dirname(path.join(out, target)), { recursive: true });
    await fs.link(source, path.join(out, target));
    files.push({ ...row, path: target, provenance: 'immutable admitted member' });
  }
}
const content = await import(
    pathToFileURL(path.join(root, 'optional-practice/civilian-fpv/world-content.mjs'))
  ),
  model = await import(
    pathToFileURL(path.join(root, 'optional-practice/civilian-fpv/world-model.mjs'))
  ),
  packs = {};
for (const [key, input, expected] of [
  ['reservoir', reservoirPath, '50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554'],
  ['festival', festivalPath, '87baca276e174f31ba19c02f4f2359c97affa07eefd4a5f4912b4d8664450f51'],
]) {
  const bytes = await fs.readFile(input),
    pack = await content.inspectPack(bytes);
  if (hash(bytes) !== expected) throw Error('Exact qualified pack required ' + key);
  await write('content/' + key + '.rlpack', bytes, 'immutable qualified data pack');
  packs[key] = {
    id: pack.project.id,
    world: pack.project.world.id,
    sha256: expected,
    bytes: bytes.length,
    courses: pack.project.courses.map((c) => ({ id: c.id, locales: c.locales })),
  };
}
const festival = await content.inspectPack(await fs.readFile(festivalPath)),
  base = festival.project.courses.find((c) => c.id === 'festival-grounds-06'),
  diagnosticCourses = ['catalogue-mode-split', 'catalogue-mixed', 'catalogue-gate'].map((id) => {
    const course = structuredClone(base);
    course.id = id;
    course.world.id = 'catalogue-diagnostic-world';
    for (const locale of ['en', 'uk']) course.locales[locale].title = id;
    if (id === 'catalogue-mode-split')
      course.steps.acro.find((s) => s.type === 'actor-track-v1').minTargetTravel = 0;
    if (id === 'catalogue-mixed')
      for (const steps of Object.values(course.steps))
        steps.push({
          ...structuredClone(steps.find((s) => s.type === 'actor-track-v1')),
          minTargetTravel: 0,
        });
    if (id === 'catalogue-gate')
      for (const steps of Object.values(course.steps))
        steps.push(structuredClone(festival.project.courses[1].steps.acro[0]));
    return model.validateWorldCourse(course);
  }),
  diagnosticProject = {
    format: 'FPVWorldProject.v1',
    id: 'catalogue-diagnostic',
    title: 'Catalogue criteria diagnostic',
    world: { id: 'catalogue-diagnostic-world' },
    courses: diagnosticCourses,
  },
  diagnosticBytes = Buffer.from(await (await content.preparePack(diagnosticProject)).arrayBuffer()),
  diagnostic = await content.inspectPack(diagnosticBytes);
await write(
  'content/diagnostic.rlpack',
  diagnosticBytes,
  'explicit synthetic validated criteria pack, never a published world',
);
packs.diagnostic = {
  id: diagnostic.project.id,
  world: diagnostic.project.world.id,
  sha256: hash(diagnosticBytes),
  bytes: diagnosticBytes.length,
  courses: diagnosticCourses.map((c) => ({ id: c.id, locales: c.locales })),
};
const proofs = await fs.readFile(proofPath);
if (hash(proofs) !== '073ee3e359764d35039f607d02d0815ac0768b892d046b1426c5c4a55f4cacfb')
  throw Error('Exact separate Reservoir proofs required');
await write('content/proofs.json', proofs, 'separate immutable16-proof archive');
const html = await fs.readFile(
  path.join(player, 'optional-practice/fpv-worlds/index.html'),
  'utf8',
);
if (
  !html.includes('data-fpv-worlds="true"') ||
  !html.includes('src="../civilian-fpv/world-app.mjs"')
)
  throw Error('Expected entry markers');
await write(
  'player/optional-practice/fpv-worlds/catalogue-host.html',
  html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
    .replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../host.mjs"'),
);
await write('host.mjs', await fs.readFile(new URL('host.mjs', import.meta.url)));
const run = await fs.readFile(new URL('run.mjs', import.meta.url), 'utf8');
if (scenario === 'mode-diagnostic') {
  const marker = 'async function execute() {';
  if (run.split(marker).length !== 2) throw Error('Expected one manual run boundary');
  await write(
    'run.mjs',
    run.slice(0, run.indexOf(marker)) +
      (await fs.readFile(new URL('mode-diagnostic.mjs', import.meta.url), 'utf8')),
    'shared public-control helpers plus explicit mode diagnostic',
  );
} else await write('run.mjs', run);
await write(
  'index.html',
  '<!doctype html><meta charset="utf-8"><title>Imported catalogue truthfulness</title><style>body{margin:0;background:#142029;color:white;font:14px system-ui}header{padding:10px}button{font:inherit;padding:8px}iframe{display:block;width:100%;height:760px;border:0}textarea{width:98%;height:220px}pre{white-space:pre-wrap}</style><header><button id="run">Run native imported catalogue checks</button> <span id="status">Exact packs and separate proofs; keep visible.</span></header><iframe id="sim" title="Native catalogue player" src="about:blank"></iframe><pre id="summary"></pre><label>Complete receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>',
);
const fixture = {
  format: 'FPVImportedCatalogueFixture.v1',
  scenario,
  revision,
  sourceTree: git('rev-parse', revision + '^{tree}')
    .toString()
    .trim(),
  baseline: {
    sourceRevision: stage.sourceRevision,
    sourceTree: stage.sourceTree,
    zip: stage.zip,
    receiptSHA256: hash(stageBytes),
    inventorySHA256: hash(inventoryBytes),
  },
  inputs,
  overlays: inputs.filter((r) => r.changed),
  packs,
  proofs: { bytes: proofs.length, sha256: hash(proofs) },
  files,
  limitations: [
    admitted
      ? 'Exact complete102-member admitted player;95 source inputs match the admitted revision/tree; zero runtime overlays. This fixture does not qualify cached native offline use.'
      : 'Complete102-member admitted baseline with exactly one committed host overlay; not a fresh admission or cached native offline qualification.',
    'Original native clocks, state and public controls. Same-realm prefixed native IndexedDB. Pack and proof imports are separate actions; no published Browse claim.',
    'No new unit coverage, physics, runtime schema, authored pack or proof changes.',
  ],
};
await fs.writeFile(path.join(out, 'fixture.json'), JSON.stringify(fixture, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    out,
    revision,
    files: files.length,
    overlays: fixture.overlays,
    fixtureSHA256: hash(await fs.readFile(path.join(out, 'fixture.json'))),
  }),
);
