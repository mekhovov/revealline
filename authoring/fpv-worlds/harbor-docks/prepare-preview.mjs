#!/usr/bin/env node
// Immutable external-content preview over one exact complete admitted player.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [playerArg, generatedArg, outputArg] = process.argv.slice(2);
if (!playerArg || !generatedArg || !outputArg) throw Error('Use PLAYER GENERATED NEW_PREVIEW');
const player = await fs.realpath(playerArg),
  generated = await fs.realpath(generatedArg),
  output = path.resolve(outputArg);
const sha = (data) => createHash('sha256').update(data).digest('hex');
const descriptor = await fs.readFile(path.join(player, 'optional-package.json')),
  manifest = JSON.parse(descriptor);
if (
  manifest.id !== 'fpv-worlds' ||
  manifest.files.length !== 101 ||
  manifest.engineCommit !== '0b54fd0fdf8fe06dc900024a8b59713340b09bb3'
)
  throw Error('Expected exact complete admitted0b54 player');
const files = [
  ...manifest.files,
  { path: 'optional-package.json', bytes: descriptor.length, sha256: sha(descriptor) },
];
const checked = [];
for (const item of files) {
  if (item.path.includes('..') || path.isAbsolute(item.path)) throw Error('Unsafe member');
  const from = await fs.realpath(path.join(player, item.path)),
    data = await fs.readFile(from);
  if (
    !from.startsWith(player + path.sep) ||
    data.length !== item.bytes ||
    sha(data) !== item.sha256
  )
    throw Error('Admitted mismatch ' + item.path);
  checked.push({ ...item, from });
}
const projectPath = path.join(generated, 'prepared/project.json'),
  projectBytes = await fs.readFile(projectPath),
  project = JSON.parse(projectBytes);
if (project.courses.length !== 1 || project.courses[0].id !== 'harbor-docks-01')
  throw Error('Expected one-course Harbor checkpoint');
const modelPath = path.join(generated, 'prepared', project.world.modelAsset),
  modelBytes = await fs.readFile(modelPath),
  build = JSON.parse(await fs.readFile(path.join(generated, 'checkpoint-build.json')));
if (sha(modelBytes) !== build.prepared.sha256) throw Error('Prepared model changed');
const sources = [];
for (const item of build.sourceFiles) {
  const bytes = await fs.readFile(new URL(item.path, import.meta.url));
  if (sha(bytes) !== item.sha256)
    throw Error('Authoring source changed since generation ' + item.path);
  sources.push(item);
}
await fs.mkdir(output);
for (const item of checked) {
  const to = path.join(output, 'player', item.path);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.link(item.from, to);
}
await fs.mkdir(path.join(output, 'content'));
await fs.link(projectPath, path.join(output, 'content/project.json'));
await fs.link(modelPath, path.join(output, 'content/scene.glb'));
const html = await fs.readFile(new URL('./preview.html', import.meta.url));
await fs.writeFile(path.join(output, 'index.html'), html, { flag: 'wx' });
const receipt = {
  format: 'FPVHarborStaticFixture.v1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  baselinePlayer: manifest.engineCommit,
  runtimeOverlays: 0,
  scope:
    'Actual unchanged complete102 admitted renderer; static external one-course scene observations only. No flight/proof/performance acceptance.',
  admittedFiles: files,
  content: [
    { path: 'content/project.json', bytes: projectBytes.length, sha256: sha(projectBytes) },
    { path: 'content/scene.glb', bytes: modelBytes.length, sha256: sha(modelBytes) },
  ],
  variants: {
    candidate: {
      project: 'content/project.json',
      model: 'content/scene.glb',
      revision: project.revision,
    },
  },
  authoringSources: sources,
  harnessSHA256: sha(html),
  build,
};
await fs.writeFile(path.join(output, 'fixture.json'), JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    output,
    admittedFiles: files.length,
    modelSHA256: sha(modelBytes),
    sourceCommit: receipt.sourceCommit,
  }),
);
