import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareMobileCreatorVideo } from '../creator/video-mobile.mjs';

function atomOffset(bytes, name) {
  return Buffer.from(bytes).indexOf(name, 0, 'ascii') - 4;
}

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
