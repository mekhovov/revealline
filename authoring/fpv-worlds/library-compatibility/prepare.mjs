// Hardlink immutable admitted closures; explicitly inventory committed source overlays.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parse } from 'acorn';
const [root, revision, oldPlayer, capablePlayer, inventoryPath, coatingPack, diagnosticPack, out] =
  process.argv.slice(2);
if (
  !/^[a-f0-9]{40}$/.test(revision ?? '') ||
  ![root, oldPlayer, capablePlayer, inventoryPath, coatingPack, diagnosticPack, out].every(
    (p) => p && path.isAbsolute(p),
  )
)
  throw Error(
    'ABS_ROOT EXACT_REV ABS_OLD_PLAYER ABS_CAPABLE_PLAYER ABS_INVENTORY ABS_COATING ABS_DIAGNOSTIC ABS_NEW_OUT',
  );
const hash = (b) => createHash('sha256').update(b).digest('hex'),
  git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      maxBuffer: 20 * 1024 * 1024,
    });
if (await fs.stat(out).catch(() => null)) throw Error('Never replace an existing fixture');
const sourcePaths = [
    'optional-practice/civilian-fpv/world-app.mjs',
    'optional-practice/civilian-fpv/world-content.mjs',
    'optional-practice/civilian-fpv/world-reaction-runtime.mjs',
    'optional-practice/worker-template.mjs',
  ],
  overlays = new Map(),
  inventoryBytes = await fs.readFile(inventoryPath),
  inventory = JSON.parse(inventoryBytes);
if (inventory.inputs.length !== 95) throw Error('95 admitted source inputs required');
const inputs = [];
for (const row of inventory.inputs) {
  const bytes = git('show', revision + ':' + row.path),
    changed = bytes.length !== row.bytes || hash(bytes) !== row.sha256;
  if (changed && !sourcePaths.includes(row.path))
    throw Error('Unexpected source overlay ' + row.path);
  if (changed && row.path !== 'optional-practice/worker-template.mjs')
    overlays.set(row.path, bytes);
  inputs.push({ ...row, bytes: bytes.length, sha256: hash(bytes), changed });
}
for (const file of sourcePaths)
  if (!git('show', revision + ':' + file).equals(await fs.readFile(path.join(root, file))))
    throw Error('Runtime draft changed ' + file);
const { installPracticeWorker } = await import(
  pathToFileURL(path.join(root, 'optional-practice/worker-template.mjs'))
);
const workerPath = 'optional-practice/fpv-worlds/worker.js',
  originalWorker = await fs.readFile(path.join(capablePlayer, workerPath), 'utf8'),
  call = parse(originalWorker, { ecmaVersion: 'latest' }).body[0].expression;
if (
  call?.callee?.type !== 'FunctionExpression' ||
  call.callee.id?.name !== 'installPracticeWorker' ||
  call.arguments.length !== 3
)
  throw Error('Unexpected generated worker wrapper');
overlays.set(
  workerPath,
  Buffer.from(
    originalWorker.slice(0, call.callee.start) +
      installPracticeWorker.toString() +
      originalWorker.slice(call.callee.end),
  ),
);
await fs.mkdir(out);
const files = [],
  stages = {};
async function write(name, bytes, provenance = 'manual fixture') {
  await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
  await fs.writeFile(path.join(out, name), bytes, { flag: 'wx' });
  files.push({ path: name, bytes: Buffer.byteLength(bytes), sha256: hash(bytes), provenance });
}
for (const [variant, player] of [
  ['old', oldPlayer],
  ['candidate', capablePlayer],
]) {
  const stageBytes = await fs.readFile(player + '.json'),
    stage = JSON.parse(stageBytes);
  if (stage.files.length !== 102 || !stage.checks.every((c) => c.passed))
    throw Error('Complete admitted stage required');
  if (
    variant === 'candidate' &&
    (stage.sourceRevision !== inventory.sourceRevision || stage.sourceTree !== inventory.sourceTree)
  )
    throw Error('Candidate baseline inventory mismatch');
  stages[variant] = {
    sourceRevision: stage.sourceRevision,
    sourceTree: stage.sourceTree,
    receiptSHA256: hash(stageBytes),
    zip: stage.zip,
  };
  for (const row of stage.files) {
    if (!/^[\w./-]+$/.test(row.path) || row.path.split('/').includes('..'))
      throw Error('Unsafe path');
    const source = path.join(player, row.path),
      bytes = await fs.readFile(source),
      target = variant + '/' + row.path;
    if (bytes.length !== row.bytes || hash(bytes) !== row.sha256)
      throw Error('Admitted asset changed ' + row.path);
    if (variant === 'candidate' && overlays.has(row.path))
      await write(
        target,
        overlays.get(row.path),
        'exact committed source overlay on admitted closure',
      );
    else {
      await fs.mkdir(path.dirname(path.join(out, target)), { recursive: true });
      await fs.link(source, path.join(out, target));
      files.push({ ...row, path: target, provenance: 'immutable admitted member' });
    }
  }
  const html = await fs.readFile(
    path.join(player, 'optional-practice/fpv-worlds/index.html'),
    'utf8',
  );
  if (
    !html.includes('data-fpv-worlds="true"') ||
    !html.includes('src="../civilian-fpv/world-app.mjs"')
  )
    throw Error('Expected native entry markers');
  await write(
    variant + '/optional-practice/fpv-worlds/compatibility-host.html',
    html
      .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
      .replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../host.mjs"'),
  );
}
const content = await import(
    pathToFileURL(path.join(root, 'optional-practice/civilian-fpv/world-content.mjs'))
  ),
  coatingBytes = await fs.readFile(coatingPack),
  coating = await content.inspectPack(coatingBytes);
if (hash(coatingBytes) !== '98dc5237b8e809029a0c08f414f36689c7a58313f911a84971d3ed0429477714')
  throw Error('Exact genuine coating pack required');
await write(
  'coating.rlpack',
  coatingBytes,
  'exact historical required-coating r14 pack; no final presentation claim',
);
const model = Buffer.from(await coating.assets.get(coating.project.world.modelAsset).arrayBuffer()),
  length = model.readUInt32LE(12),
  base = JSON.parse(model.subarray(20, 20 + length)),
  tail = model.subarray(20 + length);
async function changedPack(edit) {
  const doc = structuredClone(base);
  edit(doc);
  const json = Buffer.from(JSON.stringify(doc)),
    padding = (4 - (json.length % 4)) % 4,
    head = Buffer.from(model.subarray(0, 20));
  head.writeUInt32LE(20 + json.length + padding + tail.length, 8);
  head.writeUInt32LE(json.length + padding, 12);
  const assets = new Map(coating.assets);
  assets.set(
    coating.project.world.modelAsset,
    new Blob([head, json, Buffer.alloc(padding, 32), tail]),
  );
  return Buffer.from(await (await content.preparePack(coating.project, { assets })).arrayBuffer());
}
const future = await changedPack((doc) => {
    const name = 'REVEALLINE_future_diagnostic';
    doc.extensionsRequired.push(name);
    doc.extensionsUsed.push(name);
    (doc.extensions ??= {})[name] = { version: 1 };
  }),
  malformed = await changedPack((doc) => {
    doc.extensionsRequired = [{}];
  });
await write(
  'future.rlpack',
  future,
  'explicit unsupported-feature diagnostic; no production catalogue row',
);
await write('malformed.rlpack', malformed, 'explicit malformed required-extension-name diagnostic');
const diagnosticBytes = await fs.readFile(diagnosticPack),
  diagnostic = await content.inspectPack(diagnosticBytes);
if (
  diagnostic.project.id !== 'creator-install-diagnostic' ||
  diagnostic.project.courses[0].id !== 'creator-install-first'
)
  throw Error('Retained grounded practice diagnostic required');
await write(
  'diagnostic.rlpack',
  diagnosticBytes,
  'retained genuine ordinary 60-tick practice diagnostic from Creator fixture',
);
for (const name of ['host.mjs', 'worker.mjs', 'run.mjs'])
  await write(name, await fs.readFile(new URL(name, import.meta.url)));
await write(
  'index.html',
  '<!doctype html><meta charset="utf-8"><title>Library compatibility</title><style>body{margin:0;background:#142029;color:white;font:14px system-ui}header{padding:10px}button{font:inherit;padding:8px}iframe{display:block;width:100%;height:760px;border:0}textarea{width:98%;height:220px}pre{white-space:pre-wrap}</style><header><button id="run">Run old and capable player compatibility</button> <span id="status">Native controls and storage; named Worker transport. Keep visible.</span></header><iframe id="sim" title="Native compatibility player" src="about:blank"></iframe><pre id="summary"></pre><label>Complete receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>',
);
const row = (bytes, suffix) => ({
  id: coating.project.id,
  title: ['Required-coating diagnostic', 'Діагностика обов’язкового покриття'],
  revision: 'r14',
  commit: '13ea3d8e758018c04a7f7847cdbdb05f18ba7393',
  path: 'authoring/fpv-worlds/library-compatibility/diagnostic/' + suffix + '.rlpack',
  sha256: hash(bytes),
  bytes: bytes.length,
  courses: coating.project.courses.length,
});
const fixture = {
  format: 'FPVLibraryCompatibilityFixture.v1',
  revision,
  sourceTree: git('rev-parse', revision + '^{tree}')
    .toString()
    .trim(),
  stages,
  inventorySHA256: hash(inventoryBytes),
  inputs,
  overlays: [...overlays].map(([path, b]) => ({ path, bytes: b.length, sha256: hash(b) })),
  coating: row(coatingBytes, 'coating'),
  future: row(future, 'future'),
  diagnostic: {
    id: diagnostic.project.id,
    sha256: hash(diagnosticBytes),
    bytes: diagnosticBytes.length,
  },
  files,
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
