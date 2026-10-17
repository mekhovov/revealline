import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImageBytes, inspectImageDataUrl, CONTENT_LIMITS } from '../content.mjs';
import { rasterFixtures } from './helpers/raster-fixtures.mjs';

test('binary image inspection preserves original bytes and all embedded-image header checks', () => {
  for (const { mime, bytes } of rasterFixtures()) {
    const original = Buffer.from(bytes);
    const embedded = `data:${mime};base64,${bytes.toString('base64')}`;
    assert.deepEqual(inspectImageBytes(bytes, mime), inspectImageDataUrl(embedded));
    assert.deepEqual(bytes, original);
    const wrong = mime === 'image/png' ? 'image/jpeg' : 'image/png';
    assert.equal(inspectImageBytes(bytes, wrong).valid, false);
    assert.equal(inspectImageBytes(bytes.subarray(0, 8), mime).valid, false);
  }
});

test('binary inspection needs no base64 strings and retains byte/MIME budgets', (t) => {
  const { mime, bytes } = rasterFixtures()[0];
  for (const name of ['btoa', 'atob']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: () => assert.fail('Binary admission must not convert base64.'),
    });
    t.after(() => Object.defineProperty(globalThis, name, descriptor));
  }
  assert.equal(inspectImageBytes(bytes, mime).valid, true);
  assert.equal(
    inspectImageBytes(new Uint8Array(CONTENT_LIMITS.maxImageBytes + 1), mime).valid,
    false,
  );
  assert.equal(inspectImageBytes(bytes, 'image/svg+xml').valid, false);
  assert.equal(inspectImageBytes('unowned bytes', mime).valid, false);
});
