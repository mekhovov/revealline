import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createEditionZip, inspectEditionZip, readEditionZip } from '../publishing/edition-zip.mjs';
import {
  createEditionCandidate,
  editionDescriptor,
  editionJSON,
} from '../publishing/edition-candidate.mjs';
import { editionAdmissionFixture } from '../publishing/edition-fixture.mjs';
import { validateEditionAdmission } from '../publishing/edition-admission.mjs';

const text = (value) => Buffer.from(value);
test('candidate CI defaults cover every currently public company audience edition', async () => {
  const catalog = JSON.parse(
    await fs.readFile(new URL('../game/editions/catalog.json', import.meta.url)),
  );
  const workflow = await fs.readFile(
    new URL('../.github/workflows/company-edition-candidate.yml', import.meta.url),
    'utf8',
  );
  const expected = catalog.editions
    .filter((edition) => edition.publication === 'public')
    .map((edition) => edition.id)
    .sort();
  const manual = workflow
    .match(/default: ([a-z0-9,-]+)\n/)[1]
    .split(',')
    .sort();
  const automatic = workflow
    .match(/EDITION_IDS:.*inputs.editions \|\| '([a-z0-9,-]+)'/)[1]
    .split(',')
    .sort();
  assert.deepEqual(manual, expected);
  assert.deepEqual(automatic, expected);
});
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

test('source archive ships exact selected projections with original input hashes, never aggregate content', async () => {
  const fixture = editionAdmissionFixture(),
    name = 'game/i18n/content-registry.mjs',
    original = text("export default {omitted:'OMITTED_CAMPAIGN_SENTINEL'};"),
    projection = text('export default {};');
  const sourceFiles = new Map([...fixture.sourceFiles, [name, original]]),
    runtime = new Map([...fixture.runtime, [name, projection]]);
  const result = createEditionCandidate({
    compiled: { files: runtime, runtimeCatalog: fixture.catalog },
    sourceFiles,
    version: fixture.envelope.version,
    sourceRevision: fixture.envelope.sourceRevision,
    sourceTree: fixture.envelope.sourceTree,
  });
  const envelope = { ...fixture.envelope, editions: [result.edition] },
    source = JSON.parse(result.files.get(result.edition.sourceInventory.path)),
    archive = readEditionZip(result.files.get(result.edition.sourceArchive.path));
  assert.equal(source.kind, 'selected-inputs-and-projections');
  assert.deepEqual(source.projections, [
    {
      kind: 'selected-locales',
      original: editionDescriptor(name, original),
      output: editionDescriptor(name, projection),
    },
  ]);
  assert.deepEqual(archive.get(name), projection);
  assert.ok(
    ![...archive.values()].some((contents) => contents.includes('OMITTED_CAMPAIGN_SENTINEL')),
  );
  assert.deepEqual(
    sourceFiles.get(name),
    original,
    'Commit-bound original bytes remain untouched.',
  );
  assert.equal(
    (await validateEditionAdmission(envelope, { read: async (row) => result.files.get(row.path) }))
      .zipMembersVerified,
    true,
  );

  // Even coherent outer ZIP/descriptors cannot substitute the original
  // aggregate for a projected member recorded by the admitted runtime.
  archive.set(name, original);
  source.files = source.files.map((row) =>
    row.path === name ? editionDescriptor(name, original) : row,
  );
  source.totalBytes = source.files.reduce((sum, row) => sum + row.bytes, 0);
  const sourceBytes = editionJSON(source);
  archive.set('source-inventory.json', sourceBytes);
  const archiveBytes = createEditionZip(archive);
  result.files.set(result.edition.sourceInventory.path, sourceBytes);
  result.files.set(result.edition.sourceArchive.path, archiveBytes);
  result.edition.sourceInventory = editionDescriptor(
    result.edition.sourceInventory.path,
    sourceBytes,
  );
  result.edition.sourceArchive = editionDescriptor(result.edition.sourceArchive.path, archiveBytes);
  await assert.rejects(
    validateEditionAdmission(envelope, { read: async (row) => result.files.get(row.path) }),
    /artifact bytes differ|unprojected aggregate/,
  );
});
