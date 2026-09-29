import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import {
  createFlightAttemptStore,
  verifyFlightAttempt,
} from '../../optional-practice/civilian-fpv/attempts.mjs';
const original = FLIGHT_DEMONSTRATIONS[0];
const proof = (extra = 0) => ({
  ...structuredClone(original),
  session: 'practice',
  frames: [
    ...Array.from({ length: 32000 + extra }, () => [0, 0, 0, 0]),
    ...structuredClone(original.frames),
  ],
});
test('a long legal ground wait remains a complete accepted flight proof', async () => {
  const value = proof();
  assert.ok(value.frames.length <= 36000);
  const actual = await verifyFlightAttempt(FLIGHT_COURSES, value, {
    yieldControl: () => Promise.resolve(),
  });
  assert.equal(actual.proof.frames.length, value.frames.length);
  assert.equal(actual.summary.ticks, value.frames.length);
  console.log(
    '@actual-long-proof ' +
      JSON.stringify({
        frames: value.frames.length,
        bytes: Buffer.byteLength(JSON.stringify(value)),
        hash: actual.hash,
      }),
  );
});
test('large notebook export round-trips every proof without widening importer limits', async () => {
  // Inject verification only at this archive boundary, avoiding 45 full physics
  // replays. The separate preceding test authenticates one actual long proof.
  let imports = 0;
  const verify = async (_courses, value) => {
    imports++;
    const n = value.frames.length - original.frames.length - 32000;
    assert.ok(n >= 0 && n < 45);
    return {
      hash: n.toString(16).padStart(64, '0'),
      proof: value,
      record: { attemptId: 'synthetic-boundary-' + n },
      summary: {},
    };
  };
  const from = createFlightAttemptStore({ courses: [], indexedDB: null, verify });
  const to = createFlightAttemptStore({ courses: [], indexedDB: null, verify });
  await from.load();
  await to.load();
  try {
    for (let n = 0; n < 45; n++) await from.accept(proof(n));
    const parts = typeof from.exportParts === 'function' ? from.exportParts() : [from.export()];
    console.log(
      '@backup-boundary ' +
        JSON.stringify({
          attempts: from.records().length,
          parts: parts.length,
          partBytes: parts.map((p) => Buffer.byteLength(JSON.stringify(p))),
        }),
    );
    for (const part of parts) await assert.doesNotReject(to.import(JSON.stringify(part)));
    assert.deepEqual(to.records(), from.records());
    assert.equal(
      parts.reduce((n, p) => n + p.attempts.length, 0),
      45,
    );
    assert.equal(imports, 90);
    if (typeof from.exportParts === 'function') {
      assert.throws(
        () => from.export(),
        /part/i,
        'Legacy single-file API must not emit an invalid backup or silently truncate it.',
      );
      assert.ok(parts.every((p) => p.attempts.length <= 16));
    }
  } finally {
    await from.close();
    await to.close();
  }
});
