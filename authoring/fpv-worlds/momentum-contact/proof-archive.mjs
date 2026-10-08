/** Produce player-importable examples with the native checksummed archive producer. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  exportProofParts,
  importProofPart,
  worldRecordIdentity,
} from '../../../optional-practice/civilian-fpv/world-records.mjs';
import { inspectPack } from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  initWorldRuntime,
  validateWorldCourse,
  replayWorldFlight,
  worldStateIdentity,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';

const root = new URL('./', import.meta.url);
const source = JSON.parse(fs.readFileSync(new URL('evidence/practice-proofs.json', root)));
const pack = await inspectPack(fs.readFileSync(new URL('momentum-contact-practice.rlpack', root)));
const course = validateWorldCourse(pack.project.courses[0]);
assert.deepEqual(validateWorldCourse(source.course), course);
assert.deepEqual(
  source.flights.map((proof) => proof.mode),
  ['self-level', 'acro'],
);
const records = source.flights.map((proof) => {
  assert.equal(proof.session, 'demonstration');
  const record = {
    id: worldRecordIdentity({ course, proof }),
    course,
    proof,
    status: 'missing-dependency',
    diagnostic: 'Demonstration; verify against the exact practice pack on import.',
    packIdentity: `fpv-pack:${pack.sha256}`,
    // Stable fixture metadata, not a player's recording timestamp.
    savedAt: Date.UTC(2026, 9, 5),
  };
  record.byteLength = Buffer.byteLength(JSON.stringify(record)) + 64;
  return record;
});
const parts = await exportProofParts(records);
assert.equal(parts.length, 1);
assert.deepEqual(await exportProofParts(records), parts);
const serialized = JSON.stringify(parts[0]) + '\n';
assert.ok(Buffer.byteLength(serialized) < 128 * 1024);
const imported = await importProofPart(serialized);
assert.deepEqual(imported, records);
const changed = structuredClone(parts[0]);
changed.records[0].packIdentity = 'fpv-pack:' + '0'.repeat(64);
await assert.rejects(importProofPart(changed), /checksum does not match/);
await initWorldRuntime();
const examples = [];
for (const record of imported) {
  const result = await replayWorldFlight(course, record.proof);
  assert.equal(result.state.status, 'complete');
  assert.equal(worldStateIdentity(result.state), record.proof.finalStateIdentity);
  assert.deepEqual(result.state.hunt.caught, ['runner-01', 'runner-02']);
  examples.push({
    id: record.id,
    mode: record.proof.mode,
    ticks: record.proof.frames.length,
    finalStateIdentity: record.proof.finalStateIdentity,
    status: result.state.status,
  });
}
const receipt = {
  format: 'fpv-hunt-momentum-proof-archive.v1',
  file: 'momentum-contact-practice.proofs.json',
  archiveFormat: parts[0].format,
  archiveId: parts[0].archiveId,
  archiveSHA256: parts[0].sha256,
  fileSHA256: crypto.createHash('sha256').update(serialized).digest('hex'),
  bytes: Buffer.byteLength(serialized),
  packIdentity: `fpv-pack:${pack.sha256}`,
  reproducible: true,
  nativeImportPassed: true,
  changedDependencyChecksumRejected: true,
  examples,
  boundary:
    'Native producer/importer and exact runtime replay; browser import is a separate check.',
};
if (process.argv.includes('--write')) {
  fs.writeFileSync(new URL(receipt.file, root), serialized);
  fs.writeFileSync(
    new URL('evidence/proof-archive.json', root),
    JSON.stringify(receipt, null, 2) + '\n',
  );
}
console.log(JSON.stringify(receipt, null, 2));
