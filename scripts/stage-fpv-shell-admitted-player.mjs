/** Manual shell qualification fixture: extract only verified admitted members. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readEditionZip } from '../publishing/edition-zip.mjs';

const [candidate, id, out, reuse, expectedSource] = process.argv.slice(2);
assert(candidate && ['fpv-worlds', 'civilian-fpv'].includes(id) && out && reuse);
assert.match(expectedSource ?? '', /^[a-f0-9]{40}$/);
const root = fileURLToPath(new URL('../', import.meta.url)),
  output = path.resolve(out),
  reusable = await fs.realpath(reuse),
  digest = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  json = async (file) => JSON.parse(await fs.readFile(path.join(candidate, file), 'utf8')),
  verification = await json('optional-candidate-verification.json'),
  envelope = await json('optional-packages.json'),
  row = envelope.packages.find((item) => item.id === id),
  checks = [];
function check(name, passed) {
  checks.push({ name, passed: !!passed });
  assert(passed, name);
}
check(
  'source-bound two-build admission',
  verification.sourceRevision === expectedSource &&
    verification.reproducibleBuilds === 2 &&
    verification.committedInputsVerified &&
    verification.admission.zipMembersVerified,
);
for (const entry of (await json('optional-checksums.json')).files) {
  const bytes = await fs.readFile(path.join(candidate, entry.path));
  check(
    'candidate checksum: ' + entry.path,
    bytes.length === entry.bytes && digest(bytes) === entry.sha256,
  );
}
const zip = await fs.readFile(path.join(candidate, row.distribution.path)),
  descriptor = await fs.readFile(path.join(candidate, row.manifest.path)),
  manifest = JSON.parse(descriptor),
  members = readEditionZip(zip),
  expected = new Map(manifest.files.map((item) => [item.path, item]));
expected.set('optional-package.json', { bytes: descriptor.length, sha256: digest(descriptor) });
check(
  'admitted distribution identity',
  zip.length === row.distribution.bytes && digest(zip) === row.distribution.sha256,
);
check(
  'admitted descriptor identity',
  descriptor.length === row.manifest.bytes && digest(descriptor) === row.manifest.sha256,
);
check(
  'complete member set',
  members.size === expected.size && members.get('optional-package.json')?.equals(descriptor),
);
await fs.mkdir(output, { recursive: false });
const files = [];
let linked = 0,
  writtenBytes = 0;
for (const [name, bytes] of members) {
  const meta = expected.get(name),
    target = path.resolve(output, name);
  check(
    'admitted member: ' + name,
    !!meta &&
      bytes.length === meta.bytes &&
      digest(bytes) === meta.sha256 &&
      target.startsWith(output + path.sep),
  );
  await fs.mkdir(path.dirname(target), { recursive: true });
  const prior = path.join(reusable, name),
    stat = await fs.lstat(prior).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
  let same = false;
  if (
    stat?.isFile() &&
    !stat.isSymbolicLink() &&
    (await fs.realpath(prior)).startsWith(reusable + path.sep)
  ) {
    const live = await fs.stat(path.join(root, name)).catch(() => null);
    assert(
      !live || live.dev !== stat.dev || live.ino !== stat.ino,
      'Never share a mutable source inode',
    );
    same = (await fs.readFile(prior)).equals(bytes);
  }
  if (same) {
    await fs.link(prior, target);
    linked++;
  } else {
    await fs.writeFile(target, bytes, { flag: 'wx' });
    writtenBytes += bytes.length;
  }
  check('staged bytes: ' + name, (await fs.readFile(target)).equals(bytes));
  files.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
}
const inventory = await json(row.sourceInventory.path);
const receipt = {
  format: 'FPVGeneratedShellAdmittedPlayer.v1',
  packageId: id,
  sourceRevision: expectedSource,
  sourceTree: verification.sourceTree,
  output,
  entry: manifest.entry,
  zip: row.distribution,
  checks,
  files,
  originalInputs: inventory.inputs.length,
  originalInputBytes: inventory.inputs.reduce((sum, item) => sum + item.bytes, 0),
  immutableReuse: { root: reusable, linked, writtenBytes },
  limitations: [
    'Exact admitted distribution, no overlays.',
    'Local serving does not establish installed/offline, public deployment or hardware performance.',
  ],
};
await fs.writeFile(output + '.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    output,
    receipt: output + '.json',
    files: files.length,
    linked,
    writtenBytes,
    entry: manifest.entry,
  }),
);
