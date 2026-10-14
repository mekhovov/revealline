#!/usr/bin/env node
/** Manual observation fixture. Copies verified package bytes; never edits a player. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [playerArg, receiptArg, outArg, ...extra] = process.argv.slice(2);
assert(
  playerArg && receiptArg && outArg && !extra.length,
  'Use STAGED_PLAYER STAGING_RECEIPT NEW_REPOSITORY_DIST_DIRECTORY',
);
const root = await fs.realpath(fileURLToPath(new URL('..', import.meta.url)));
const player = await fs.realpath(playerArg);
const dist = path.join(root, 'dist');
await fs.mkdir(dist, { recursive: true });
assert.equal(await fs.realpath(dist), dist, 'A symlinked dist is not accepted');
const requestedOut = path.resolve(outArg);
assert.equal(
  await fs.realpath(path.dirname(requestedOut)),
  dist,
  'Output must be a new direct child of repository dist',
);
const out = path.join(dist, path.basename(requestedOut));
assert(!out.startsWith(player + path.sep) && out !== player, 'Player and output must be separate');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stageBytes = await fs.readFile(receiptArg),
  stage = JSON.parse(stageBytes);
assert.equal(
  stage.format,
  'FPVGeneratedShellAdmittedPlayer.v1',
  'Use the current admitted-player staging script',
);
assert(
  stage.checks?.length && stage.checks.every((row) => row.passed === true),
  'Staging checks must all pass',
);
assert.equal(stage.packageId, 'fpv-worlds');
assert.match(stage.sourceRevision ?? '', /^[a-f0-9]{40}$/);
assert.match(stage.sourceTree ?? '', /^[a-f0-9]{40}$/);
assert.equal(
  execFileSync('git', ['rev-parse', `${stage.sourceRevision}^{tree}`], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  stage.sourceTree,
  'Source tree must resolve exactly',
);
const descriptorBytes = await fs.readFile(path.join(player, 'optional-package.json'));
const descriptor = JSON.parse(descriptorBytes);
assert.equal(descriptor.id, 'fpv-worlds');
assert.equal(descriptor.engineCommit, stage.sourceRevision);
assert.equal(descriptor.engineTree, stage.sourceTree);
assert.equal(descriptor.entry, stage.entry);
const records = [
  ...descriptor.files,
  { path: 'optional-package.json', bytes: descriptorBytes.length, sha256: sha(descriptorBytes) },
];
const safe = (name) =>
  typeof name === 'string' &&
  /^[A-Za-z0-9_./-]+$/.test(name) &&
  !path.isAbsolute(name) &&
  !name.split('/').some((part) => !part || part === '.' || part === '..');
assert(records.length && new Set(records.map((row) => row.path)).size === records.length);
assert(
  stage.files.length === records.length &&
    new Set(stage.files.map((row) => row.path)).size === records.length,
  'Manifest-derived member count must match staging',
);
const expected = new Map(records.map((row) => [row.path, row]));
for (const row of records) {
  assert(
    safe(row.path) &&
      Number.isSafeInteger(row.bytes) &&
      row.bytes >= 0 &&
      /^[a-f0-9]{64}$/.test(row.sha256),
  );
  const staged = stage.files.find((item) => item.path === row.path);
  assert(
    staged && staged.bytes === row.bytes && staged.sha256 === row.sha256,
    'Staging identity: ' + row.path,
  );
  const source = path.join(player, row.path),
    stat = await fs.lstat(source);
  assert(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      (await fs.realpath(source)).startsWith(player + path.sep),
  );
  const bytes = await fs.readFile(source);
  assert.equal(bytes.length, row.bytes, row.path);
  assert.equal(sha(bytes), row.sha256, row.path);
}
async function verifyDirectory(directory, prefix = '') {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const name = prefix + item.name;
    if (item.isDirectory()) await verifyDirectory(path.join(directory, item.name), name + '/');
    else
      assert(item.isFile() && expected.has(name), 'Unlisted or nonregular player member: ' + name);
  }
}
await verifyDirectory(player);
assert(
  safe(descriptor.entry) && expected.has(descriptor.entry),
  'Native entry must be an admitted member',
);
const observer = await fs.readFile(new URL('./fpv-current-observation.mjs', import.meta.url));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Current FPV player observation</title>
<style>body{margin:0;background:#101820;color:#eff6f9;font:14px system-ui}header{padding:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}button,select{font:inherit;min-height:44px}p{margin:6px 12px}iframe{display:block;border:0;width:100%;height:calc(100dvh - 155px);min-height:320px}textarea{box-sizing:border-box;width:100%;min-height:180px}#receipt[hidden]{display:none}</style></head><body>
<header><label>Window <select id="duration"><option value="30">30 seconds</option><option value="60" selected>60 seconds</option><option value="120">120 seconds</option></select></label><label>Observe <select id="workload"><option value="active">Flight / replay</option><option value="ready">Ready / disarmed</option></select></label><button id="begin" disabled>Begin</button><button id="stop" disabled>Stop</button><button id="export" disabled>Export receipt</button></header>
<p id="status" role="status">Verifying admitted package…</p><p>Begin waits for you to focus the player and start or resume it yourself. No automatic arming. Native callback gaps are not GPU time or device FPS.</p>
<iframe id="player" title="Unmodified admitted FPV player" allow="gamepad; fullscreen"></iframe><textarea id="receipt" readonly aria-label="Complete observation receipt" hidden></textarea><script type="module" src="./observer.mjs"></script></body></html>`;
await fs.mkdir(out);
for (const row of records) {
  const target = path.join(out, 'player', row.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(path.join(player, row.path), target, constants.COPYFILE_EXCL);
  const bytes = await fs.readFile(target);
  assert.equal(sha(bytes), row.sha256, 'Copied identity: ' + row.path);
}
await fs.writeFile(path.join(out, 'index.html'), html, { flag: 'wx' });
await fs.writeFile(path.join(out, 'observer.mjs'), observer, { flag: 'wx' });
const fixture = {
  format: 'FPVCurrentObservationFixture.v1',
  preparedAt: new Date().toISOString(),
  sourceRevision: stage.sourceRevision,
  sourceTree: stage.sourceTree,
  packageId: descriptor.id,
  packageRevision: descriptor.revision,
  entry: descriptor.entry,
  descriptor: { bytes: descriptorBytes.length, sha256: sha(descriptorBytes) },
  staging: {
    bytes: stageBytes.length,
    sha256: sha(stageBytes),
    zip: stage.zip,
    originalInputs: stage.originalInputs,
  },
  observer: { bytes: observer.length, sha256: sha(observer) },
  files: records,
  runtimeOverlays: 0,
  limits: [
    'All manifest members copied byte-exactly; native entry is unchanged.',
    'Staging receipt is source-bound evidence, not public deployment.',
    'Hashing is outside timed windows; no cold-cache benchmark.',
    'Observer records native child RAF gaps and available performance entries, not GPU elapsed time, physical input latency or hardware FPS.',
    'No simulation writes, clock substitution, automatic arming or resume.',
  ],
};
await fs.writeFile(path.join(out, 'fixture.json'), JSON.stringify(fixture, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    out,
    files: records.length,
    sourceRevision: stage.sourceRevision,
    runtimeOverlays: 0,
  }),
);
