import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectOriginalMaster } from '../../authoring/library/revealline-original-soundtrack/build.mjs';

function flac({ rate = 48000, channels = 2, bits = 24, samples = 48000 } = {}) {
  const body = Buffer.alloc(48);
  body.write('fLaC');
  body[4] = 0x80;
  body.writeUIntBE(34, 5, 3);
  body.writeUInt16BE(4096, 8);
  body.writeUInt16BE(4096, 10);
  body.writeBigUInt64BE(
    (BigInt(rate) << 44n) |
      (BigInt(channels - 1) << 41n) |
      (BigInt(bits - 1) << 36n) |
      BigInt(samples),
    18,
  );
  body[42] = 0xff;
  body[43] = 0xf8;
  return body;
}

test('production FLAC inspection retains native stereo resolution and sample count', () => {
  assert.deepEqual(inspectOriginalMaster(flac()), {
    durationSeconds: 1,
    sampleRate: 48000,
    channels: 2,
    bitsPerSample: 24,
    encoding: 'flac',
  });
});

test('production rejects missing/truncated FLAC metadata, invalid resolution and absent audio', () => {
  for (const body of [
    flac().subarray(0, 30),
    flac().subarray(0, 42),
    flac({ samples: 0 }),
    flac({ rate: 22050 }),
    flac({ channels: 1 }),
    flac({ bits: 8 }),
  ]) {
    assert.throws(() => inspectOriginalMaster(body));
  }
  const metadata = flac();
  metadata[4] = 0;
  metadata[42] = 0x80;
  metadata.writeUIntBE(100, 43, 3);
  assert.throws(() => inspectOriginalMaster(metadata), /metadata/);
});

test('candidate recordings do not become approved runtime originals', async () => {
  const ready = JSON.parse(
    await readFile(
      new URL('../../authoring/library/revealline-original-soundtrack/ready.json', import.meta.url),
    ),
  );
  assert.deepEqual(ready.tracks, []);
});
