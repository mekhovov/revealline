import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareMobileCreatorVideo } from '../creator/video-mobile.mjs';

function atomOffset(bytes, name) {
  return Buffer.from(bytes).indexOf(name, 0, 'ascii') - 4;
}

test('mobile preparation identifies real video bytes even with absent or incorrect MIME labels', async () => {
  const bytes = await readFile(
    new URL('./fixtures/video/owned-avc-aac-fixture.mp4', import.meta.url),
  );
  for (const type of ['', 'application/octet-stream', 'video/webm']) {
    const prepared = await prepareMobileCreatorVideo(new Blob([bytes], { type }));
    const output = new Uint8Array(await prepared.arrayBuffer());
    assert.equal(prepared.type, 'video/mp4');
    assert(atomOffset(output, 'moov') > 0);
    assert(atomOffset(output, 'moov') < atomOffset(output, 'mdat'));
  }
});

test('a claimed MP4 MIME type cannot send invalid bytes into conversion', async () => {
  let loaded = false;
  await assert.rejects(
    prepareMobileCreatorVideo(new Blob(['not a video'], { type: 'video/mp4' }), {
      loadLibrary: async () => {
        loaded = true;
      },
    }),
    /Unsupported video container/,
  );
  assert.equal(loaded, false);
});

test('Creator remuxes the retained H.264/AAC recording to a fast-start mobile MP4', async () => {
  const source = await readFile(
      new URL('../editions/assets/social-drone/sky-watch-v1.mp4', import.meta.url),
    ),
    original = new Uint8Array(source),
    prepared = await prepareMobileCreatorVideo(new Blob([source], { type: 'video/mp4' })),
    bytes = new Uint8Array(await prepared.arrayBuffer());
  assert.equal(prepared.type, 'video/mp4');
  assert(atomOffset(original, 'moov') > atomOffset(original, 'mdat'));
  assert(atomOffset(bytes, 'moov') > 0);
  assert(atomOffset(bytes, 'moov') < atomOffset(bytes, 'mdat'));
  assert(bytes.byteLength > 3_000_000);
});

test('Creator mobile preparation honors an already-cancelled intake', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    prepareMobileCreatorVideo(new Blob(['video'], { type: 'video/mp4' }), {
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
});
