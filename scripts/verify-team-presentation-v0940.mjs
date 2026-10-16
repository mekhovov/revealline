#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs/verification/team-presentation-v0940-20260923/coverage.json');
const base = '80a47a3b25167d9dcd0bdf98b1bde6a95d112269';
const head = '20370a67892e5d48d65b0be9277c715d297b9f47';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const lines = (value) => (value ? value.split('\n').filter(Boolean) : []);
const patchId = (commit) => {
  const shown = execFileSync('git', ['show', '--format=', '--binary', commit], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
  const result = spawnSync('git', ['patch-id', '--stable'], { cwd: root, input: shown });
  if (result.status !== 0) throw new Error(`Cannot calculate stable patch ID for ${commit}.`);
  return result.stdout.toString().split(/\s+/)[0];
};
const diffPatchId = (from, to) => {
  const shown = execFileSync('git', ['diff', '--binary', `${from}..${to}`], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
  const result = spawnSync('git', ['patch-id', '--stable'], { cwd: root, input: shown });
  if (result.status !== 0) throw new Error(`Cannot calculate stable range patch ID.`);
  return result.stdout.toString().split(/\s+/)[0];
};
const commits = [
  { pr: 234, head: '44f6217fcdc44441bb1cbed8441cc61466192008', expectedPaths: 8 },
  { pr: 236, head: '516e9e60faeb688cd194eababd5d61052c82b603', expectedPaths: 91 },
  { pr: 238, head: '9e7ff24aa662c5f6cc33cb40f38084572207bc37', expectedPaths: 5 },
  { pr: 240, head: '444021555554e522388a8776983846f262f4fa25', expectedPaths: 33 },
  { pr: 243, head: 'bc8b7565f2c4277145b4763d76d928c45e024f1c', expectedPaths: 20 },
  { pr: 244, head: '1bd95403adf354c8d537905c3aa2cfa9cead71dc', expectedPaths: 5 },
  { pr: 245, head: 'e777522f0ce94fd253b8a54e69efc0a7ad9331bb', expectedPaths: 31 },
  { pr: 247, head: '20370a67892e5d48d65b0be9277c715d297b9f47', expectedPaths: 4 },
];
const parents = new Map(
  commits.map((entry, index) => [entry.head, commits[index - 1]?.head ?? base]),
);
// PR240 is the only two-commit PR in the exact chain.
parents.set('444021555554e522388a8776983846f262f4fa25', '9e7ff24aa662c5f6cc33cb40f38084572207bc37');
const rangePaths = lines(git('diff', '--name-only', `${base}..${head}`)).sort();
if (rangePaths.length !== 154)
  throw new Error(`Expected 154 historical paths, got ${rangePaths.length}.`);
const rangePathSha256 = sha256(`${rangePaths.join('\n')}\n`);
if (rangePathSha256 !== 'fee5887dadc77ecd389d5a10b45755ddfbd6109543d1c1552207f231fa6f405f')
  throw new Error('Historical range path identity changed.');
if (diffPatchId(base, head) !== 'b873e9cb897dadd6e5d044d812de8e306e5f85ad')
  throw new Error('Historical range patch identity changed.');

const perPr = commits.map((entry) => {
  const parent = parents.get(entry.head);
  const paths = lines(git('diff', '--name-only', `${parent}..${entry.head}`)).sort();
  if (paths.length !== entry.expectedPaths)
    throw new Error(`PR #${entry.pr} expected ${entry.expectedPaths} paths, got ${paths.length}.`);
  const commitList = lines(git('rev-list', '--reverse', `${parent}..${entry.head}`));
  return {
    ...entry,
    parent,
    commits: commitList.map((commit) => ({ commit, patchId: patchId(commit) })),
    paths,
    pathListSha256: sha256(`${paths.join('\n')}\n`),
  };
});

const retained58 =
  'authoring/library/fpv-field-kit/retained/runtime.ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54.json';
const compiled58 =
  'game/presentation/compiled/runtime.ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54.json';
for (const relative of [retained58, compiled58]) {
  const bytes = await fs.readFile(path.join(root, relative));
  if (
    bytes.length !== 979746 ||
    sha256(bytes) !== 'ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54'
  )
    throw new Error(`Exact accepted runtime58 differs: ${relative}.`);
}
const manifest = JSON.parse(
  await fs.readFile(path.join(root, 'game/presentation/compiled/manifest.json')),
);
if (
  !manifest.files.some(
    (file) => file.path === compiled58.slice('game/presentation/compiled/'.length),
  )
)
  throw new Error('Compiled ownership manifest omits accepted runtime58.');
const runtime = JSON.parse(
  await fs.readFile(path.join(root, 'game/presentation/compiled/runtime.json')),
);
if (runtime.source.revision !== 62 || runtime.resolved.theme.revision !== 62)
  throw new Error('Integrated current presentation must be exact revision62.');
for (const relative of ['package.json', 'package-lock.json', 'game/build-config.json']) {
  const value = JSON.parse(await fs.readFile(path.join(root, relative)));
  if (value.version !== '0.94.0') throw new Error(`Version is not 0.94.0: ${relative}.`);
}
const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json')));
if (lock.packages[''].version !== '0.94.0') throw new Error('Root lock version is not 0.94.0.');
const catalogue = JSON.parse(
  await fs.readFile(path.join(root, 'game/presentation/visual-themes.json')),
);
const admitted58 = catalogue.entries.find(
  (entry) => entry.id === 'field-kit-fpv' && entry.revision === 58,
);
if (
  admitted58?.presentation?.sha256 !==
    'ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54' ||
  admitted58.presentation.source.revision !== 58 ||
  admitted58.presentation.theme.revision !== 58
)
  throw new Error('Saved-visual admission does not bind exact published runtime58.');

const pr239 = {
  number: 239,
  head: '8c0da7c58a358f878ca24b937d3f70f37f85cb86',
  patchId: '1b637a15e1d80feaafb9cfa40442453fda0810f8',
  coveredBy: 245,
  pathListSha256: '3b1b92600b82329225a40387acd13d2ee1b0795d6299122cfe540599f19346c2',
  exactBlobs: {
    'authoring/asset-studio/cross-mode-preview.mjs': '2033d6201fbc06711af3d914040f9ba3b465a9eb',
    'authoring/prompts/studio-same-tick-counters.md': 'd01fdf5405d0562fbc3e9074c15903011a5a4503',
    'game/test/asset-studio-cross-mode.test.mjs': '1e1a2e9238e43e25620adf3ca61746769fc07b13',
  },
};
if (patchId(pr239.head) !== pr239.patchId) throw new Error('PR #239 patch identity changed.');
for (const [relative, blob] of Object.entries(pr239.exactBlobs))
  if (git('rev-parse', `${commits.find((entry) => entry.pr === 245).head}:${relative}`) !== blob)
    throw new Error(`PR #239 is not represented exactly by PR #245: ${relative}.`);
const maintainer = await fs.readFile(
  path.join(root, 'authoring/skills/xonix-runtime-maintainer/SKILL.md'),
  'utf8',
);
if (!maintainer.includes('## 2026-09-22 — Same-tick authoring counters'))
  throw new Error('PR #239 maintainer policy is missing.');

const result = {
  format: 'revealline-team-presentation-v0940-coverage.v1',
  releaseVersion: '0.94.0',
  historicalRange: {
    base,
    head,
    pathCount: rangePaths.length,
    pathListSha256: rangePathSha256,
    stablePatchId: 'b873e9cb897dadd6e5d044d812de8e306e5f85ad',
    paths: rangePaths,
  },
  perPr,
  conflictResolutions: [
    'authoring/skills/xonix-runtime-maintainer/SKILL.md',
    'game/couch/coop-picture-bindings.mjs',
    'game/couch/coop-view.mjs',
  ],
  supersession: {
    pr233: {
      replayed: false,
      proof: 'v0.93 exact coverage; historical range begins at its accepted head',
      head: base,
    },
    pr239,
    pr241: {
      included: false,
      head: 'dd22ec81eb55aace5a654a3366c62c34dfb22f70',
      pathCount: 13,
      reason: 'separate optional full-picture preview scope',
    },
  },
  retainedRuntime58: {
    sourceCommit: '6842203fbf24db198da21759e23d5c5c64d499dd',
    gitBlob: 'd5e6e66b5195a142e9a7205bfbef95429a80bd3c',
    bytes: 979746,
    sha256: 'ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54',
    paths: [retained58, compiled58],
    lazyDependencyFiles: 124,
    closureFiles: 125,
    closureBytes: 3284626,
  },
  integrationOnlyPaths: [
    'authoring/library/fpv-field-kit/production.rltheme',
    retained58,
    compiled58,
    'game/couch/coop-picture-bindings.mjs',
    'game/couch/coop-presentation.mjs',
    'game/presentation/compiled/manifest.json',
    'game/presentation/compiled/runtime.json',
    'game/presentation/compiled/studio.json',
    'game/presentation/visual-themes.json',
    'game/test/coop-actor-presentation.test.mjs',
    'game/test/coop-historical-import-picture.test.mjs',
    'game/test/coop-picture-bindings.test.mjs',
    'game/test/coop-reviewed-successor-picture.test.mjs',
    'game/test/field-kit-retained-runtime.test.mjs',
    'game/test/saved-visual-catalogue.test.mjs',
    'game/test/visual-sessions.test.mjs',
    'game/build-config.json',
    'package.json',
    'package-lock.json',
    'scripts/field-kit-retained-runtime.mjs',
    'scripts/verify-team-presentation-v0940.mjs',
    'docs/verification/team-presentation-v0940-20260923/README.md',
    'docs/verification/team-presentation-v0940-20260923/coverage.json',
  ],
  testPolicy: {
    mandatory: ['exact-source validate', 'build', 'retention and deterministic focused checks'],
    waivedDeferred: [
      'broad automated suites',
      'extended native/gameplay/responsive/offline journeys',
    ],
    localBuild: 'deferred to hosted exact-head CI after local ENOSPC capacity failure',
  },
};
const encoded = `${JSON.stringify(result, null, 2)}\n`;
if (process.argv[2] === '--write') {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, encoded);
  process.stdout.write(`wrote ${path.relative(root, output)}\n`);
} else {
  const current = await fs.readFile(output, 'utf8');
  if (current !== encoded) throw new Error('v0.94 integration coverage ledger is stale.');
  process.stdout.write(
    JSON.stringify({ status: 'verified', paths: rangePaths.length, retainedRuntime58: true }) +
      '\n',
  );
}
