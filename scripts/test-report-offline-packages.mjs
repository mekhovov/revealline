import test from 'node:test';
import assert from 'node:assert/strict';
import { packageMeasurement } from './report-offline-packages.mjs';

test('package measurement counts matching hashes separately across actual cache owners', () => {
  const first = { path: 'first', sha256: 'same', bytes: 100 };
  const second = { ...first, path: 'second' };
  const measure = packageMeasurement([first, second], [first, second], [first]);
  assert.equal(measure.decodedTransferBytes, 300);
  assert.equal(measure.storedPayloadBytes, 400);
  assert.equal(measure.maximumDecodedTransferBytes, 400);
  assert.equal(measure.crossOwnerDuplicateBytes, 200);
  assert.equal(measure.owners.editionRuntime.uniqueHashes, 1);
  assert.equal(measure.owners.officialContent.files, 1);
  assert.equal(measure.owners.installedLauncher.files, 1);
});
