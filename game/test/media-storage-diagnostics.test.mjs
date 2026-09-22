import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareStillAsset } from '../media-still.mjs';
import { prepareStoredStillMedia, verifyStoredStillAssets } from '../media-storage-record.mjs';
import { libraryRecord, mediaFixture, pngBytes, provenance } from './helpers/media-fixtures.mjs';

const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const context = mediaFixture(true);
const original = await prepareStillAsset(
  new Blob([pngBytes()]),
  { id: 'picture-a', provenance: provenance() },
  { decodeImage },
);
const library = libraryRecord(context.identity);
library.assets = [original.asset];
const prepared = await prepareStoredStillMedia(
  library,
  [{ sha256: original.asset.sha256, blob: original.blob }],
  { executionCatalog: context.catalog, decodeImage },
);

test('corrupt original identifies its exact asset and verification stage without accepting bytes', async () => {
  let decodes = 0;
  await assert.rejects(
    verifyStoredStillAssets(
      prepared.library,
      [{ sha256: original.asset.sha256, blob: new Blob(['not an image']) }],
      {
        decodeImage: async () => {
          decodes++;
          return decodeImage();
        },
      },
    ),
    (error) => {
      assert.equal(error.name, 'TypeError');
      assert.match(
        error.message,
        /Still original "picture-a" failed byte\/header\/decode verification/,
      );
      assert.match(error.message, /Only static PNG\/JPEG bytes are supported/);
      assert.equal(error.cause.message, 'Only static PNG/JPEG bytes are supported.');
      return true;
    },
  );
  assert.equal(decodes, 0);
  const verified = await verifyStoredStillAssets(prepared.library, prepared.assets, {
    decodeImage,
  });
  assert.deepEqual(Buffer.from(await verified[0].blob.arrayBuffer()), pngBytes());
});

test('decoder failures retain their cause while exact AbortError identity is not wrapped', async () => {
  const failure = new Error('Native decoder refused this original');
  await assert.rejects(
    verifyStoredStillAssets(prepared.library, prepared.assets, {
      decodeImage: async () => {
        throw failure;
      },
    }),
    (error) => {
      assert.match(error.message, /picture-a.*Native decoder refused this original/);
      assert.equal(error.cause, failure);
      return true;
    },
  );
  const cancellation = new DOMException('Original check cancelled', 'AbortError');
  await assert.rejects(
    verifyStoredStillAssets(prepared.library, prepared.assets, {
      decodeImage: async () => {
        throw cancellation;
      },
    }),
    (error) => error === cancellation,
  );
});
