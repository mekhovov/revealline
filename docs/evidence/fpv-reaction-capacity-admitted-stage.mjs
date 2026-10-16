import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readEditionZip } from '../../publishing/edition-zip.mjs';
const root = process.cwd();
const candidate = path.join(root, 'dist/fpv-reaction-capacity-candidate-45d673d36');
const output = path.join(root, 'dist/fpv-reaction-capacity-admitted-player-45d673d36');
const reusable = path.join(root, 'dist/fpv-world-disposal-admitted-player-d9ad2561e');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const checks = [];
const check = (name, value) => {
  checks.push({ name, passed: !!value });
  assert(value, name);
};
const envelope = JSON.parse(
  await fs.readFile(path.join(candidate, 'optional-packages.json'), 'utf8'),
);
const verification = JSON.parse(
  await fs.readFile(path.join(candidate, 'optional-candidate-verification.json'), 'utf8'),
);
check(
  'exact source, two identical builds, committed inputs and ZIP admission',
  verification.sourceRevision === '45d673d3641b16d4dd8c51daa0eb7ce12ba96a4a' &&
    verification.reproducibleBuilds === 2 &&
    verification.committedInputsVerified &&
    verification.admission.zipMembersVerified,
);
const sums = JSON.parse(await fs.readFile(path.join(candidate, 'optional-checksums.json'), 'utf8'));
for (const file of sums.files) {
  const b = await fs.readFile(path.join(candidate, file.path));
  check('candidate checksum ' + file.path, b.length === file.bytes && sha(b) === file.sha256);
}
const row = envelope.packages.find((row) => row.id === 'fpv-worlds');
const zip = await fs.readFile(path.join(candidate, row.distribution.path));
check(
  'admitted world ZIP matches envelope',
  zip.length === row.distribution.bytes && sha(zip) === row.distribution.sha256,
);
const entries = readEditionZip(zip),
  manifestBytes = await fs.readFile(path.join(candidate, row.manifest.path)),
  manifest = JSON.parse(manifestBytes);
check(
  'manifest matches envelope',
  manifestBytes.length === row.manifest.bytes && sha(manifestBytes) === row.manifest.sha256,
);
const expected = new Map(manifest.files.map((f) => [f.path, f]));
expected.set('optional-package.json', { bytes: manifestBytes.length, sha256: sha(manifestBytes) });
check(
  'complete admitted ZIP has102 members including exact package descriptor',
  entries.size === 102 &&
    expected.size === 102 &&
    entries.get('optional-package.json')?.equals(manifestBytes),
);
await fs.mkdir(output, { recursive: false });
const files = [],
  reuse = JSON.parse(
    execFileSync(
      'git',
      [
        'show',
        '38e9b852490a4bee9d953fb4076da23ec16f7602:docs/evidence/fpv-world-disposal-admitted-player.json',
      ],
      { encoding: 'utf8' },
    ),
  ),
  reusableFiles = new Map(reuse.files.map((row) => [row.path, row]));
let linkedFiles = 0,
  linkedBytes = 0,
  writtenFiles = 0,
  writtenBytes = 0;
for (const [name, bytes] of entries) {
  const meta = expected.get(name);
  check(
    'member equals admitted inventory ' + name,
    !!meta && meta.bytes === bytes.length && meta.sha256 === sha(bytes),
  );
  const target = path.join(output, name);
  assert(target.startsWith(output + path.sep));
  await fs.mkdir(path.dirname(target), { recursive: true });
  const old = reusableFiles.get(name),
    source = path.join(reusable, name);
  let linked = false;
  if (old?.bytes === bytes.length && old.sha256 === sha(bytes)) {
    const stat = await fs.lstat(source),
      real = await fs.realpath(source);
    assert(
      stat.isFile() && !stat.isSymbolicLink() && real.startsWith(reusable + path.sep),
      'immutable admitted input path',
    );
    const prior = await fs.readFile(source);
    assert(prior.equals(bytes) && sha(prior) === old.sha256, 'prior admitted file is exact');
    let current;
    try {
      current = await fs.stat(path.join(root, name));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    assert(
      !current || current.dev !== stat.dev || current.ino !== stat.ino,
      'never link mutable source',
    );
    await fs.link(source, target);
    linked = true;
    linkedFiles++;
    linkedBytes += bytes.length;
  }
  if (!linked) {
    await fs.writeFile(target, bytes, { flag: 'wx' });
    writtenFiles++;
    writtenBytes += bytes.length;
  }
  const stored = await fs.readFile(target);
  check('staged member re-read exact ' + name, stored.equals(bytes));
  files.push({ path: name, bytes: stored.length, sha256: sha(stored) });
}
const sourceInventory = JSON.parse(
  await fs.readFile(path.join(candidate, row.sourceInventory.path), 'utf8'),
);
const receipt = {
  format: 'FPVReactionCapacityAdmittedPlayer.v1',
  sourceRevision: verification.sourceRevision,
  sourceTree: verification.sourceTree,
  output,
  entry: manifest.entry,
  zip: { ...row.distribution },
  checks,
  files,
  totals: {
    files: files.length,
    bytes: files.reduce((n, f) => n + f.bytes, 0),
    originalInputs: sourceInventory.inputs.length,
    originalInputBytes: sourceInventory.inputs.reduce((n, f) => n + f.bytes, 0),
  },
  limitations: [
    'Exact102-file admitted ZIP extraction, not a94-file development playtest.',
    'Local static serving is not installed identity, service-worker/offline, public deployment or hardware qualification.',
  ],
};
receipt.storage = {
  reusedImmutablePlayer: reusable,
  linkedFiles,
  linkedBytes,
  writtenFiles,
  writtenBytes,
};
const receiptPath = path.join(root, 'docs/evidence/fpv-reaction-capacity-admitted-player.json');
await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    passed: checks.length,
    receipt: receiptPath,
    ...receipt.totals,
    ...receipt.storage,
    zipSha256: row.distribution.sha256,
    url:
      'http://127.0.0.1:8878/dist/fpv-reaction-capacity-admitted-player-45d673d36/' +
      manifest.entry,
  }),
);
