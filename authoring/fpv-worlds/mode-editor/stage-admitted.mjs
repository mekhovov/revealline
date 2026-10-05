#!/usr/bin/env node
// Materialize one already admitted package; never builds or publishes it.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectEditionZip } from '../../../publishing/edition-zip.mjs';
const [bundle, baseline, out] = process.argv.slice(2).map((value) => path.resolve(value));
if (!bundle || !baseline || !out)
  throw new Error('Use BUNDLE_DIRECTORY BASELINE_PLAYER NEW_DIRECTORY');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const envelopeBytes = await fs.readFile(path.join(bundle, 'optional-packages.json')),
  envelope = JSON.parse(envelopeBytes),
  verifiedBytes = await fs.readFile(path.join(bundle, 'optional-candidate-verification.json')),
  verified = JSON.parse(verifiedBytes);
check(
  verified.envelopeSha256 === hash(envelopeBytes) &&
    verified.sourceRevision === envelope.sourceRevision &&
    verified.committedInputsVerified &&
    verified.reproducibleBuilds === 2 &&
    verified.admission.zipMembersVerified,
  'Expected two-build committed-input admission',
);
const selected = envelope.packages.find((row) => row.id === 'fpv-worlds');
check(selected, 'Worlds package is required');
async function checked(record) {
  check(/^[a-zA-Z0-9_.-]+$/.test(record.path), 'Unsafe bundle path');
  const bytes = await fs.readFile(path.join(bundle, record.path));
  check(
    bytes.length === record.bytes && hash(bytes) === record.sha256,
    'Bundle checksum: ' + record.path,
  );
  return bytes;
}
const manifestBytes = await checked(selected.manifest),
  manifest = JSON.parse(manifestBytes),
  zip = await checked(selected.distribution);
check(
  manifest.engineCommit === envelope.sourceRevision &&
    manifest.revision === selected.revision &&
    manifest.files.length === 101,
  'Expected exact 102-file admitted Worlds package',
);
const records = [
    ...manifest.files,
    { path: 'optional-package.json', bytes: manifestBytes.length, sha256: hash(manifestBytes) },
  ],
  members = inspectEditionZip(zip, records);
const old = JSON.parse(await fs.readFile(path.join(baseline, 'optional-package.json'))),
  oldRows = new Map(old.files.map((row) => [row.path, row]));
await fs.mkdir(out);
let linked = 0,
  written = 0;
for (const record of records) {
  const dest = path.join(out, record.path),
    bytes = members.get(record.path);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (oldRows.get(record.path)?.sha256 === record.sha256) {
    const source = await fs.realpath(path.join(baseline, record.path));
    check(
      source.startsWith((await fs.realpath(baseline)) + path.sep),
      'Baseline member escapes root',
    );
    check(hash(await fs.readFile(source)) === record.sha256, 'Baseline checksum: ' + record.path);
    await fs.link(source, dest);
    linked++;
  } else {
    await fs.writeFile(dest, bytes, { flag: 'wx' });
    written += bytes.length;
  }
}
const receipt = {
  format: 'FPVEditorModesAdmittedStage.v1',
  sourceRevision: envelope.sourceRevision,
  sourceTree: envelope.sourceTree,
  packageRevision: manifest.revision,
  verificationSha256: hash(verifiedBytes),
  archive: selected.distribution,
  manifest: selected.manifest,
  files: records,
  immutableHardlinks: linked,
  newBytes: written,
};
await fs.writeFile(out + '.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    output: out,
    sourceRevision: receipt.sourceRevision,
    files: records.length,
    immutableHardlinks: linked,
    newBytes: written,
  }),
);
