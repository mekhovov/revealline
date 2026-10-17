#!/usr/bin/env node
// Independent comparison of completed software flights. This is not a native flight or art test.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [oldArchivePath, newArchivePath, oldQualificationPath, newQualificationPath, out] =
  process.argv.slice(2);
assert(
  oldArchivePath && newArchivePath && oldQualificationPath && newQualificationPath && out,
  'Use R16_ARCHIVE CANDIDATE_ARCHIVE R16_QUALIFICATION CANDIDATE_QUALIFICATION NEW_RECEIPT',
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  oldBytes = await readFile(oldArchivePath),
  newBytes = await readFile(newArchivePath),
  before = JSON.parse(oldBytes),
  after = JSON.parse(newBytes),
  bq = JSON.parse(await readFile(oldQualificationPath, 'utf8')),
  aq = JSON.parse(await readFile(newQualificationPath, 'utf8'));
assert.equal(hash(oldBytes), '073ee3e359764d35039f607d02d0815ac0768b892d046b1426c5c4a55f4cacfb');
assert.equal(before.records.length, 16);
assert.equal(after.records.length, 16);
assert.equal(aq.status, 'passed');
assert(aq.checks.every((c) => c.passed));
assert.equal(bq.flights.length, 16);
assert.equal(aq.flights.length, 16);
const pairs = [];
for (let i = 0; i < 16; i++) {
  const b = before.records[i],
    a = after.records[i],
    bp = structuredClone(b.proof),
    ap = structuredClone(a.proof),
    bf = structuredClone(bq.flights[i]),
    af = structuredClone(aq.flights[i]),
    bc = structuredClone(b.course),
    ac = structuredClone(a.course);
  assert.equal(
    b.packIdentity,
    'fpv-pack:50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554',
  );
  assert.equal(a.packIdentity, aq.pack.identity);
  assert.equal(b.status, 'verified');
  assert.equal(a.status, 'verified');
  assert.equal(b.diagnostic, 'complete');
  assert.equal(a.diagnostic, 'complete');
  assert.equal(bp.course, ap.course);
  assert.equal(bp.mode, ap.mode);
  assert.notEqual(bp.courseIdentity, ap.courseIdentity);
  delete bp.courseIdentity;
  delete ap.courseIdentity;
  assert.deepEqual(ap, bp, 'Every input/backend/response/physical identity stays exact');
  delete bc.revision;
  delete ac.revision;
  assert.deepEqual(ac, bc, 'Only explicit course revision changes');
  delete bf.revision;
  delete af.revision;
  delete bf.proof.sha256;
  delete af.proof.sha256;
  assert.deepEqual(af, bf, 'Physical flight, sampled path, milestones and proof length stay exact');
  pairs.push({
    course: b.course.id,
    mode: b.proof.mode,
    ticks: af.ticks,
    inputsAndPhysicalResultExact: true,
    sampledPathExact: true,
    changedProofFields: ['courseIdentity'],
    changedFlightMetadata: ['revision', 'proof.sha256'],
  });
}
assert.equal(new Set(pairs.map((p) => p.course + ':' + p.mode)).size, 16);
const receipt = {
  format: 'FPVReservoirMineralFinishProofParity.v1',
  status: 'passed',
  beforeArchiveSHA256: hash(oldBytes),
  afterArchiveSHA256: hash(newBytes),
  beforePack: bq.pack.identity,
  candidatePack: aq.pack.identity,
  candidateChecks: aq.checks.length,
  pairs,
  scope:
    'Sixteen fresh ordinary-control software completions plus independent complete/archive replays are compared with published r16 recordings/results. All inputs and physical results remain exact; only revision-bound identity/checksum changes. Original r16 archives remain untouched. Candidate proof files stay external/unpublished until native art decision. No native clock, rendered quality, hardware, package, player, offline or public acceptance.',
};
await writeFile(out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    status: receipt.status,
    pairs: pairs.length,
    checks: receipt.candidateChecks,
    receipt: out,
  }),
);
