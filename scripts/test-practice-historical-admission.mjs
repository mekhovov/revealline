import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  HISTORICAL_PRACTICE_PIN,
  HISTORICAL_ADMISSION_CLOSURE,
  assertPinnedHistoricalEnvelope,
  assertHistoricalDependencies,
  assertHistoricalClosure,
  assertHistoricalArtifact,
  assertHistoricalCommittedInputs,
  admitPinnedHistoricalPractice,
} from './practice-historical-admission.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const minimalEnvelope = () => ({
  format: 'revealline-optional-packages.v1',
  version: HISTORICAL_PRACTICE_PIN.version,
  sourceRevision: HISTORICAL_PRACTICE_PIN.sourceRevision,
  sourceTree: HISTORICAL_PRACTICE_PIN.sourceTree,
  packages: [],
});
const encode = (value) => Buffer.from(JSON.stringify(value));

test('historical authority is one immutable reviewed commit/tree/envelope, not selectable policy', () => {
  assert(Object.isFrozen(HISTORICAL_PRACTICE_PIN));
  assert(Object.isFrozen(HISTORICAL_ADMISSION_CLOSURE));
  assert.equal(Object.keys(HISTORICAL_ADMISSION_CLOSURE).length, 13);
  assert.throws(
    () =>
      assertPinnedHistoricalEnvelope(
        encode({ ...minimalEnvelope(), sourceRevision: '0'.repeat(40) }),
      ),
    /commit/,
  );
  assert.throws(
    () =>
      assertPinnedHistoricalEnvelope(encode({ ...minimalEnvelope(), sourceTree: '0'.repeat(40) })),
    /tree/,
  );
  assert.throws(
    () => assertPinnedHistoricalEnvelope(encode({ ...minimalEnvelope(), version: 'v999.0.0' })),
    /version/,
  );
  assert.throws(() => assertPinnedHistoricalEnvelope(encode(minimalEnvelope())), /envelope/);
  assert.throws(() => assertPinnedHistoricalEnvelope(Buffer.alloc(1024 * 1024 + 1)), /Bounded/);
});

test('missing, extra and altered historical code or policy cannot pass closure verification', () => {
  assert.throws(() => assertHistoricalClosure(new Map()), /Exact historical executable closure/);
  const files = new Map(
    Object.keys(HISTORICAL_ADMISSION_CLOSURE).map((name) => [
      name,
      Buffer.from('export const bypass=true;'),
    ]),
  );
  assert.throws(() => assertHistoricalClosure(files), /executable changed/);
  files.set('publishing/extra-validator.mjs', Buffer.from(''));
  assert.throws(() => assertHistoricalClosure(files), /Exact historical executable closure/);
  assert(Object.hasOwn(HISTORICAL_ADMISSION_CLOSURE, 'publishing/optional-package-policy.mjs'));
  assert(Object.hasOwn(HISTORICAL_ADMISSION_CLOSURE, 'publishing/edition-zip.mjs'));
});

test('historical dependency closure rejects arbitrary validators, dynamic code and new builtins', () => {
  const name = 'publishing/optional-package-admission.mjs';
  assert.doesNotThrow(() =>
    assertHistoricalDependencies(
      name,
      Buffer.from('import path from "node:path"; import "./edition-zip.mjs";'),
    ),
  );
  for (const source of [
    'import("./edition-zip.mjs")',
    'require("node:fs")',
    'import "node:fs"',
    'export * from "./unreviewed.mjs"',
    'import "acorn"',
  ])
    assert.throws(() => assertHistoricalDependencies(name, Buffer.from(source)));
  assert.throws(() => assertHistoricalDependencies('unreviewed.mjs', Buffer.from('')));
});

test('bounded artifact verification rejects tampering, absent bytes and traversal', () => {
  const bytes = Buffer.from('synthetic unit artifact; never admission evidence');
  const pin = {
    path: 'manifest-optional-civilian-fpv.json',
    bytes: bytes.length,
    sha256: hash(bytes),
  };
  assert.doesNotThrow(() => assertHistoricalArtifact(pin, bytes));
  for (const changed of [
    undefined,
    Buffer.from('tampered'),
    Buffer.concat([bytes, Buffer.from(' ')]),
  ])
    assert.throws(() => assertHistoricalArtifact(pin, changed));
  for (const path of ['../outside', '/tmp/validator', 'two/parts', 'bad\nname'])
    assert.throws(() => assertHistoricalArtifact({ ...pin, path }, bytes));
});

test('all inventory inputs must independently match committed Git bytes, not archive self-assertions', () => {
  const bytes = Buffer.from('synthetic committed input; not real admission evidence');
  const row = { path: 'game/example.mjs', bytes: bytes.length, sha256: hash(bytes) };
  const inventory = {
    sourceRevision: HISTORICAL_PRACTICE_PIN.sourceRevision,
    sourceTree: HISTORICAL_PRACTICE_PIN.sourceTree,
    inputs: [row],
  };
  const committed = new Map([[row.path, bytes]]);
  assert.deepEqual(assertHistoricalCommittedInputs([inventory], committed), [row]);
  assert.throws(
    () => assertHistoricalCommittedInputs([inventory], new Map()),
    /committed Git blob/,
  );
  assert.throws(
    () =>
      assertHistoricalCommittedInputs([inventory], new Map([[row.path, Buffer.from('changed')]])),
    /committed Git blob/,
  );
  assert.throws(() =>
    assertHistoricalCommittedInputs([{ ...inventory, sourceTree: '0'.repeat(40) }], committed),
  );
  assert.throws(() =>
    assertHistoricalCommittedInputs(
      [{ ...inventory, inputs: [{ ...row, path: '../escape' }] }],
      committed,
    ),
  );
});

test('runner preserves bounded env-empty execution and unchanged current admission authority', async () => {
  const source = await readFile(
    new URL('./practice-historical-admission.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /timeout: 15000/);
  assert.match(source, /maxBuffer: 65536/);
  assert.match(source, /env: \{\}/);
  assert.match(source, /assert\.equal\(admission\.publicEligible, false\)/);
  assert.match(source, /validateOptionalPackageAdmission\(envelope/);
  assert(!source.includes('validateOptionalPackagePromotion('));
  assert(!source.includes('process.env.'));
  assert.match(source, /finally \{\s*await rm\(work/);
});

const realBundle = process.env.HISTORICAL_ADMISSION_TEST_BUNDLE;
test(
  'explicit local pinned snapshot passes strict historical admission and committed-input verification',
  { skip: !realBundle },
  async () => {
    const result = await admitPinnedHistoricalPractice(realBundle);
    assert.equal(result.receipt.publicEligible, false);
    assert.equal(result.receipt.diagnosticOnly, true);
    assert.equal(result.receipt.admission.publicEligible, false);
    assert.equal(result.receipt.envelopeSha256, HISTORICAL_PRACTICE_PIN.envelopeSha256);
    assert.equal(result.receipt.admission.packages.length, 3);
    assert(result.receipt.inputs.length > 100);
    assert.equal(result.admittedBytes.size, 12);
    const work = await mkdtemp(path.join(tmpdir(), 'historical-admission-negative-'));
    try {
      await writeFile(path.join(work, 'optional-packages.json'), result.envelopeBytes);
      await assert.rejects(admitPinnedHistoricalPractice(work), /ENOENT/);
      const pin = result.envelope.packages[0].manifest;
      await writeFile(path.join(work, pin.path), Buffer.from('tampered'));
      await assert.rejects(admitPinnedHistoricalPractice(work), /artifact changed/);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  },
);
