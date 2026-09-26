import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditionZip, inspectEditionZip, readEditionZip } from '../publishing/edition-zip.mjs';
import { createEditionCandidate, editionDescriptor } from '../publishing/edition-candidate.mjs';
import { editionAdmissionFixture } from '../publishing/edition-fixture.mjs';
import { validateEditionAdmission } from '../publishing/edition-admission.mjs';

const text = (value) => Buffer.from(value);
test('complete candidate files reproduce byte for byte regardless of source Map insertion order', async () => {
  const fixture = editionAdmissionFixture();
  const inputs = {
    compiled: { files: fixture.runtime, runtimeCatalog: fixture.catalog },
    sourceFiles: fixture.sourceFiles,
    version: fixture.envelope.version,
    sourceRevision: fixture.envelope.sourceRevision,
    sourceTree: fixture.envelope.sourceTree,
  };
  const first = createEditionCandidate(inputs),
    second = createEditionCandidate({
      ...inputs,
      compiled: { ...inputs.compiled, files: new Map([...fixture.runtime].reverse()) },
      sourceFiles: new Map([...fixture.sourceFiles].reverse()),
    });
  assert.deepEqual(first.edition, second.edition);
  for (const [name, bytes] of first.files) assert.deepEqual(bytes, second.files.get(name), name);
  const admitted = await validateEditionAdmission(fixture.envelope, fixture);
  assert.equal(admitted.zipMembersVerified, true);
  assert.equal(admitted.publicEligible, false);
});

test('ZIP reader independently verifies structures, original CRCs, hashes, names and closed inventory', () => {
  const files = new Map([
    ['game/company.html', text('HELLO_GAME')],
    ['app/current.json', text('{}')],
  ]);
  const zip = createEditionZip(files),
    rows = [...files].map(([name, bytes]) => editionDescriptor(name, bytes));
  assert.deepEqual(
    inspectEditionZip(zip, rows),
    new Map([...files].sort(([a], [b]) => a.localeCompare(b))),
  );
  assert.deepEqual(readEditionZip(zip), inspectEditionZip(zip, rows));
  const corrupt = Buffer.from(zip);
  corrupt[corrupt.indexOf('HELLO_GAME')] ^= 1;
  assert.throws(() => inspectEditionZip(corrupt, rows), /hash differs/);
  assert.throws(
    () =>
      inspectEditionZip(
        zip,
        rows.map((row) => ({ ...row, sha256: '0'.repeat(64) })),
      ),
    /hash differs/,
  );
  assert.throws(() => inspectEditionZip(Buffer.concat([zip, text('extra')]), rows), /end record/);
  assert.throws(() => inspectEditionZip(zip, rows.slice(1)), /directory differs/);
  assert.throws(() => createEditionZip(new Map([['../private.json', text('secret')]])), /member/);
  assert.throws(() => createEditionZip(new Map([['.env', text('secret')]])), /member/);
});

test('candidate construction fails closed for private source sentinels and unapproved media', () => {
  const fixture = editionAdmissionFixture();
  const inputs = {
    compiled: { files: fixture.runtime, runtimeCatalog: fixture.catalog },
    sourceFiles: fixture.sourceFiles,
    version: fixture.envelope.version,
    sourceRevision: fixture.envelope.sourceRevision,
    sourceTree: fixture.envelope.sourceTree,
  };
  assert.throws(
    () =>
      createEditionCandidate({
        ...inputs,
        sourceFiles: new Map([
          ...fixture.sourceFiles,
          ['research/private/export.json', text('PRIVATE_SENTINEL')],
        ]),
      }),
    /Source-only/,
  );
  assert.throws(
    () =>
      createEditionCandidate({
        ...inputs,
        sourceFiles: new Map([
          ...fixture.sourceFiles,
          ['game/editions/assets/unreviewed.ttf', text('PRIVATE_FONT')],
        ]),
      }),
    /no public eligibility/,
  );
});
