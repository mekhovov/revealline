/** Review inventory, not a visual-quality verdict. Never edits source artwork. */
import { execFileSync } from 'node:child_process';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const paths = execFileSync(
  'git',
  ['ls-files', '-z', '--', 'game', 'authoring', 'optional-practice'],
  { cwd: root, maxBuffer: 8 * 1024 * 1024 },
)
  .toString()
  .split('\0')
  .filter((file) => /\.(png|jpe?g|webp|gif|svg|gltf|glb|blend)$/i.test(file));
const assets = [];
for (const file of paths) {
  const bytes = await readFile(path.join(root, file));
  const immutable = /compiled\/|\/content\/|\/pictures\/|\/vendor\/|\/media\//.test(file);
  const authoring = file.startsWith('authoring/');
  assets.push({
    path: file,
    bytes: (await stat(path.join(root, file))).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    decision: immutable || authoring ? 'Keep' : 'Refine',
    reason: immutable
      ? 'Preserve immutable or authored ownership; upgrade through a new appearance revision.'
      : authoring
        ? 'Retain source and provenance; inspect before deriving a new production revision.'
        : 'Review native-size contrast and material consistency; preserve the current file until its successor is accepted.',
  });
}
const procedural = [
  [
    'game/hunt/actor-art.mjs',
    'Refine',
    'Four-family candidate first; retained renderer remains the default.',
  ],
  [
    'game/snake/classic-flight-art.mjs',
    'Keep',
    'Shared FPV rotor/body and connected Retro cable retained for sample comparison.',
  ],
  [
    'game/presentation/military-field-art.mjs',
    'Refine',
    'Utility car and tank sample; shared silhouettes keep existing behavior.',
  ],
  [
    'game/presentation/industrial-arcade.mjs',
    'Refine',
    'Material layering after actor readability review.',
  ],
  [
    'game/hunt/destruction.mjs',
    'Refine',
    'Identity and material pieces; preserve clean/brutal settings and caps.',
  ],
  [
    'optional-practice/civilian-fpv/renderer.mjs',
    'Refine',
    'Native geometry, shadows and phase tells; distinct 3D review.',
  ],
].map(([file, decision, reason]) => ({ path: file, decision, reason }));
const report = {
  format: 'industrial-art-inventory.v1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  scope:
    'Tracked visual/model files only; includes retained revisions, source candidates and derived copies. Decisions are triage, not human artistic approval.',
  counts: Object.fromEntries(
    ['game', 'authoring', 'optional-practice'].map((prefix) => [
      prefix,
      assets.filter((row) => row.path.startsWith(prefix + '/')).length,
    ]),
  ),
  bytes: assets.reduce((sum, row) => sum + row.bytes, 0),
  replacePolicy:
    'No existing identity is destructively replaced. Approved successors replace active bindings through immutable Studio revisions.',
  assets,
  procedural,
};
const folder = path.join(root, 'docs/qualification/industrial-art');
await mkdir(folder, { recursive: true });
await writeFile(path.join(folder, 'inventory.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(
  JSON.stringify({
    counts: report.counts,
    bytes: report.bytes,
    file: 'docs/qualification/industrial-art/inventory.json',
  }) + '\n',
);
