import test from 'node:test';
import assert from 'node:assert/strict';
import { editionAdmissionFixture } from './edition-fixture.mjs';
import { validateEditionAdmission } from './edition-admission.mjs';
import { editionDescriptor, editionJSON } from './edition-candidate.mjs';
import { editionHash } from './edition-zip.mjs';
import { editionLauncherCurrentBytes } from './edition-promotion.mjs';
import {
  createEditionCapacityReport,
  editionCapacityPacket,
  EDITION_CAPACITY_REPORT,
} from './edition-capacity.mjs';

const json = (bytes) => JSON.parse(Buffer.from(bytes).toString());
const put = (files, name, value) => files.set(name, editionJSON(value));
const checksums = (files) =>
  put(files, 'checksums.json', {
    format: 'revealline-edition-checksums.v1',
    files: [...files]
      .filter(([name]) => name !== 'checksums.json')
      .map(([name, bytes]) => editionDescriptor(name, bytes))
      .sort((a, b) => a.path.localeCompare(b.path)),
  });
async function fixture() {
  const f = editionAdmissionFixture();
  const other = editionAdmissionFixture({ editionId: 'droneaid' });
  f.envelope.editions.push(...other.envelope.editions);
  for (const [name, bytes] of other.files) if (name !== 'editions.json') f.files.set(name, bytes);
  put(f.files, 'editions.json', f.envelope);
  put(f.files, 'candidate-verification.json', {
    format: 'revealline-edition-candidate-verification.v1',
    version: f.envelope.version,
    sourceRevision: f.envelope.sourceRevision,
    sourceTree: f.envelope.sourceTree,
    envelopeSha256: editionHash(f.files.get('editions.json')),
    sourceEligibility: {
      status: 'verified',
      format: 'revealline-public-source-eligibility.v1',
      files: 0,
      assets: 0,
    },
    admission: await validateEditionAdmission(f.envelope, f),
    reproducibleBuilds: 2,
    publicEligible: false,
  });
  put(f.files, EDITION_CAPACITY_REPORT, createEditionCapacityReport(f.files));
  checksums(f.files);
  return f;
}

test('capacity packet reports exact immutable and shared stable-pointer bytes, never whole-site readiness', async () => {
  const f = await fixture(),
    before = new Map(f.files);
  const report = createEditionCapacityReport(f.files);
  assert.equal(report.publicEligible, false);
  assert.equal(report.promotable, false);
  assert.equal(report.completeHostedOutput, false);
  assert.equal(report.publicationAssessment, 'not-performed');
  assert.equal(report.hostedBudgetBytes, 950_000_000);
  assert.equal(report.missingComponents.length, 4);
  assert.equal('withinBudget' in report, false);
  assert.equal('totalHostedBytes' in report, false);
  assert.deepEqual(
    report.inputs.envelope,
    editionDescriptor('editions.json', f.files.get('editions.json')),
  );
  for (const row of report.editions) {
    const original = f.files.get(row.manifest.path),
      manifest = json(original);
    assert.equal(row.immutable.bytes, manifest.totalBytes + original.length);
    assert.equal(row.immutable.files, manifest.files.length + 1);
    const pointer = editionLauncherCurrentBytes({
      editionId: row.id,
      version: f.envelope.version,
      entry: manifest.entry,
    });
    const originals = manifest.files.filter(
      (entry) => entry.path.startsWith('app/') && entry.path !== 'app/current.json',
    );
    assert.equal(
      row.stableLauncher.bytes,
      originals.reduce((n, entry) => n + entry.bytes, 0) + pointer.length,
    );
    assert.equal(row.stableLauncher.currentPointer.sha256, editionHash(pointer));
    assert.equal(
      row.immutableAndActiveLauncherBytes,
      row.immutable.bytes + row.stableLauncher.bytes,
    );
  }
  assert.equal(
    report.allEditionComponentsBytes,
    report.editions.reduce((n, row) => n + row.immutableAndActiveLauncherBytes, 0),
  );
  assert.deepEqual(f.files, before);
  assert.deepEqual(createEditionCapacityReport(new Map([...f.files].reverse())), report);
  const packet = editionCapacityPacket(f.files);
  assert.deepEqual([...packet.keys()].sort(), [
    'candidate-verification.json',
    'capacity-inventory.json',
    'checksums.json',
    'editions.json',
    'manifest-coupa.json',
    'manifest-droneaid.json',
  ]);
  assert([...packet.values()].reduce((n, bytes) => n + bytes.length, 0) < 100_000);
  assert.deepEqual(
    editionCapacityPacket(packet),
    packet,
    'Small packet verifies without downloading archive bodies again.',
  );
});

test('missing, changed and cross-source candidate metadata cannot supply a capacity report', async () => {
  const f = await fixture();
  for (const mutate of [
    (proof) => {
      proof.sourceRevision = 'c'.repeat(40);
    },
    (proof) => {
      proof.sourceTree = 'd'.repeat(40);
    },
    (proof) => {
      proof.envelopeSha256 = '0'.repeat(64);
    },
    (proof) => {
      proof.publicEligible = true;
    },
    (proof) => {
      proof.reproducibleBuilds = 1;
    },
    (proof) => {
      proof.sourceEligibility.status = 'not-applicable';
    },
    (proof) => {
      proof.sourceEligibility.format = 'unknown';
    },
    (proof) => {
      proof.admission.zipMembersVerified = false;
    },
    (proof) => {
      proof.admission.sourceTree = 'd'.repeat(40);
    },
    (proof) => {
      proof.admission.editions[0].totalBytes++;
    },
    (proof) => {
      proof.admission.editions.push(proof.admission.editions[0]);
    },
  ]) {
    const files = new Map(f.files),
      proof = json(files.get('candidate-verification.json'));
    mutate(proof);
    put(files, 'candidate-verification.json', proof);
    assert.throws(() => createEditionCapacityReport(files), /Capacity/);
  }
  const changed = new Map(f.files);
  changed.set(
    'manifest-coupa.json',
    Buffer.concat([changed.get('manifest-coupa.json'), Buffer.from('\n')]),
  );
  assert.throws(() => createEditionCapacityReport(changed), /bytes differ/);
  changed.delete('manifest-coupa.json');
  assert.throws(() => createEditionCapacityReport(changed), /Missing/);
});

test('capacity packets reject missing and unsupported checksum formats', async () => {
  const f = await fixture();
  for (const format of [undefined, 'revealline-edition-checksums.v2', 'unknown']) {
    const files = new Map(f.files),
      checksum = json(files.get('checksums.json'));
    if (format === undefined) delete checksum.format;
    else checksum.format = format;
    put(files, 'checksums.json', checksum);
    assert.throws(() => editionCapacityPacket(files), /Missing bounded candidate checksums/);
  }
});

test('malformed manifest inventory, duplicate identities and unsafe packet metadata fail closed', async () => {
  const f = await fixture();
  for (const mutate of [
    (m) => {
      m.files[0].bytes = -1;
    },
    (m) => {
      m.files[0].path = '../private.json';
    },
    (m) => {
      m.files.push(m.files[0]);
    },
    (m) => {
      m.totalBytes++;
    },
    (m) => {
      m.contentSha256 = 'f'.repeat(64);
    },
    (m) => {
      m.format = 'unknown';
    },
  ]) {
    const files = new Map(f.files),
      manifest = json(files.get('manifest-coupa.json'));
    mutate(manifest);
    put(files, 'manifest-coupa.json', manifest);
    const envelope = json(files.get('editions.json'));
    envelope.editions[0].manifest = editionDescriptor(
      'manifest-coupa.json',
      files.get('manifest-coupa.json'),
    );
    put(files, 'editions.json', envelope);
    const proof = json(files.get('candidate-verification.json'));
    proof.envelopeSha256 = editionHash(files.get('editions.json'));
    put(files, 'candidate-verification.json', proof);
    assert.throws(() => createEditionCapacityReport(files), /capacity|Capacity/);
  }
  const extra = new Map(f.files);
  extra.set('private-sentinel.json', Buffer.from('PRIVATE_SENTINEL'));
  assert(!editionCapacityPacket(extra).has('private-sentinel.json'));
  checksums(extra);
  assert.throws(() => editionCapacityPacket(extra), /checksum inventory/);
  const claim = new Map(f.files),
    report = json(claim.get(EDITION_CAPACITY_REPORT));
  report.publicEligible = true;
  put(claim, EDITION_CAPACITY_REPORT, report);
  checksums(claim);
  assert.throws(() => editionCapacityPacket(claim), /report differs/);
  const missing = new Map(f.files);
  missing.delete('checksums.json');
  assert.throws(() => editionCapacityPacket(missing), /Missing/);
  const oversized = new Map(f.files);
  oversized.set(EDITION_CAPACITY_REPORT, Buffer.alloc(256 * 1024 + 1));
  assert.throws(() => editionCapacityPacket(oversized), /oversized/);
  const duplicate = new Map(f.files),
    envelope = json(duplicate.get('editions.json'));
  envelope.editions[1] = envelope.editions[0];
  put(duplicate, 'editions.json', envelope);
  const proof = json(duplicate.get('candidate-verification.json'));
  proof.envelopeSha256 = editionHash(duplicate.get('editions.json'));
  put(duplicate, 'candidate-verification.json', proof);
  assert.throws(() => createEditionCapacityReport(duplicate), /Duplicate capacity edition/);
});
