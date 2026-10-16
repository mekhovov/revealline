import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { prepareCreatorTeamPicture } from '../creator/team-picture.mjs';

function png(width, height, mark = 0) {
  const chunk = (type, body) => {
    const bytes = Buffer.concat([Buffer.from(type), body]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, bytes, tail]);
  };
  const header = Buffer.alloc(13),
    pixels = Buffer.alloc((width * 4 + 1) * height);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  pixels[1] = mark;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('Team creator picture preparation exports the exact reviewed runtime dimensions', async () => {
  const output = new Blob([png(1152, 576, 73)], { type: 'image/png' });
  let preparedOptions;
  let closed = 0;
  const drawCalls = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: '',
      fillRect: (...args) => drawCalls.push(['fill', ...args]),
      drawImage: (...args) => drawCalls.push(['image', ...args.slice(1)]),
    }),
    toBlob: (callback, mime) => {
      assert.equal(mime, 'image/png');
      callback(output);
    },
  };
  const result = await prepareCreatorTeamPicture(
    new Blob(['private source']),
    { alt: 'Two pilots crossing', fit: 'cover' },
    {
      prepareImage: async (_source, options) => {
        preparedOptions = options;
        return { runtime: { blob: new Blob(['reviewed derivative']) } };
      },
      decodeBitmap: async () => ({ width: 1280, height: 640, close: () => closed++ }),
      createCanvas: () => canvas,
    },
  );
  assert.deepEqual(preparedOptions, { alt: 'Two pilots crossing', fit: 'cover' });
  assert.equal(result.width, 1152);
  assert.equal(result.height, 576);
  assert.equal(result.mime, 'image/png');
  assert.equal(result.bytes, output.size);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(drawCalls.at(-1), ['image', 0, 0, 1152, 576]);
  assert.equal(closed, 1);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('Team creator page exposes generation, per-level media review and exact approval actions', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../creator/team.html', import.meta.url), 'utf8'),
    readFile(new URL('../creator/team-studio.mjs', import.meta.url), 'utf8'),
  ]);
  for (const id of [
    'generate',
    'team-levels',
    'review',
    'review-cards',
    'approve',
    'install',
    'download',
  ])
    assert.match(html, new RegExp(`id="${id}"`));
  assert.match(script, /prepareCreatorTeamCampaign/);
  assert.match(script, /prepareCreatorTeamPicture/);
  assert.match(script, /prepareCreatorTeamMediaCampaign/);
  assert.match(script, /openVideoPosterSource/);
  assert.match(script, /invalidateReview/);
  assert.match(script, /exportCreatorTeamMediaCampaign/);
  assert.match(script, /store\.install\(approved/);
});
