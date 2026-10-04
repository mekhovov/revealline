#!/usr/bin/env node
// Freeze only immutable admitted files; never hardlink mutable source into a fixture.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [playerArg, generatedArg, outArg, beforeArg] = process.argv.slice(2);
if (!playerArg || !generatedArg || !outArg)
  throw Error('Use PLAYER_DIRECTORY GENERATED_DIRECTORY NEW_PREVIEW_DIRECTORY');
const player = await fs.realpath(playerArg),
  generated = await fs.realpath(generatedArg),
  output = path.resolve(outArg);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const descriptor = await fs.readFile(path.join(player, 'optional-package.json')),
  manifest = JSON.parse(descriptor);
if (manifest.id !== 'fpv-worlds' || manifest.files.length !== 101)
  throw Error('Expected complete 102-member admitted player');
const files = [
  ...manifest.files,
  { path: 'optional-package.json', bytes: descriptor.length, sha256: sha(descriptor) },
];
const checked = [];
for (const item of files) {
  if (item.path.includes('..') || path.isAbsolute(item.path)) throw Error('Unsafe manifest member');
  const from = await fs.realpath(path.join(player, item.path)),
    b = await fs.readFile(from);
  if (!from.startsWith(player + path.sep) || b.length !== item.bytes || sha(b) !== item.sha256)
    throw Error('Admitted source mismatch ' + item.path);
  checked.push({ from, ...item });
}
const codePins = [],
  packageProjections = [];
for (const item of files.filter(
  (f) => /\.(mjs|js)$/.test(f.path) && !f.path.endsWith('world-app.mjs'),
)) {
  let b;
  try {
    b = await fs.readFile(item.path);
  } catch {
    continue;
  }
  if (item.path === 'game/i18n/catalogs.mjs') {
    // The admitted standalone package generates its bounded locale catalogue.
    // Keep and authenticate that exact projection; it is not raw-source equality.
    if (item.sha256 !== '150f60e0ee7d0c281f026ccf76b11d02d73b6022e0097dec89875987e844fb3b')
      throw Error('Unexpected admitted locale projection');
    packageProjections.push({ ...item, sourceSHA256: sha(b) });
    continue;
  }
  if (sha(b) !== item.sha256)
    throw Error('Baseline dependency differs from current source ' + item.path);
  codePins.push({ path: item.path, sha256: item.sha256 });
}
await fs.mkdir(output);
for (const item of checked) {
  const to = path.join(output, 'player', item.path);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.link(item.from, to);
}
await fs.mkdir(path.join(output, 'content'));
const projectBytes = await fs.readFile(path.join(generated, 'prepared/project.json')),
  project = JSON.parse(projectBytes);
const modelPath = path.join(generated, 'prepared', project.world.modelAsset),
  modelBytes = await fs.readFile(modelPath);
await fs.writeFile(path.join(output, 'content/project.json'), projectBytes, { flag: 'wx' });
await fs.link(modelPath, path.join(output, 'content/scene.glb'));
const beforeContent = [];
let beforeRevision = null;
if (beforeArg) {
  const beforeRoot = await fs.realpath(beforeArg),
    beforeProject = JSON.parse(await fs.readFile(path.join(beforeRoot, 'prepared/project.json'))),
    beforePath = path.join(beforeRoot, 'prepared', beforeProject.world.modelAsset),
    beforeBytes = await fs.readFile(beforePath);
  const noRevision = (value) => JSON.stringify(value, (k, v) => (k === 'revision' ? undefined : v));
  if (noRevision(beforeProject.courses) !== noRevision(project.courses))
    throw Error('Before/after course or collision differs');
  beforeRevision = beforeProject.revision;
  await fs.link(beforePath, path.join(output, 'content/before-scene.glb'));
  beforeContent.push({
    path: 'content/before-scene.glb',
    bytes: beforeBytes.length,
    sha256: sha(beforeBytes),
  });
}
const html = await fs.readFile(new URL('./preview.html', import.meta.url));
await fs.writeFile(path.join(output, 'index.html'), html, { flag: 'wx' });
const record = {
  format: 'FPVMountainReservoirStaticPreview.v1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  baselinePlayer: manifest.engineCommit,
  scope:
    'Actual unchanged admitted renderer plus external original model/course. Host world-app is retained but not imported. Static camera poses are visual observations, not flights or completion proofs.',
  admittedFiles: files,
  unchangedSourceModules: codePins,
  packageProjections,
  content: [
    { path: 'content/project.json', bytes: projectBytes.length, sha256: sha(projectBytes) },
    { path: 'content/scene.glb', bytes: modelBytes.length, sha256: sha(modelBytes) },
    ...beforeContent,
  ],
  beforeRevision,
  comparison: beforeArg
    ? `Fixed identical ${project.revision} course/camera for both meshes; all course fields except revision equal ${beforeRevision}. Before mesh is immutable ${beforeRevision}, after is the new candidate.`
    : null,
  harnessSHA256: sha(html),
  build: JSON.parse(
    await fs.readFile(
      path.join(
        generated,
        project.courses.length === 1 ? 'checkpoint-build.json' : 'world-build.json',
      ),
    ),
  ),
};
await fs.writeFile(path.join(output, 'fixture.json'), JSON.stringify(record, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify(
    {
      output,
      admittedFiles: files.length,
      unchangedSourceModules: codePins.length,
      newContentBytes: projectBytes.length + modelBytes.length,
      source: record.sourceCommit,
    },
    null,
    2,
  ),
);
