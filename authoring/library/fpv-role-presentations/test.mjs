import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { test } from 'node:test';
import { crc32 } from '../../../scripts/game-cli.mjs';
import { createAnimationState, advanceAnimation } from '../../motion-lab/animation.mjs';
import { decodeRGBA } from './png.mjs';
import { validatePresentations } from './model.mjs';

const chunk = (type, data) => {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length);
  bytes.write(type, 4);
  data.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
};
const sample = Buffer.from([
  19, 31, 47, 0, 80, 99, 118, 128, 131, 151, 173, 255, 199, 213, 231, 253,
]);
function fixture(filter, { colorType = 6, width = 2, extra = [], rawExtra = false } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(2, 4);
  header[8] = 8;
  header[9] = colorType;
  const raw = Buffer.alloc(18 + (rawExtra ? 1 : 0));
  for (let y = 0; y < 2; y++) {
    raw[y * 9] = filter;
    for (let x = 0; x < 8; x++) {
      const a = x >= 4 ? sample[y * 8 + x - 4] : 0,
        b = y ? sample[x] : 0,
        c = y && x >= 4 ? sample[x - 4] : 0;
      let predict = 0;
      if (filter === 1) predict = a;
      if (filter === 2) predict = b;
      if (filter === 3) predict = Math.floor((a + b) / 2);
      if (filter === 4) {
        const p = a + b - c,
          ds = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
        predict = ds[0] <= ds[1] && ds[0] <= ds[2] ? a : ds[1] <= ds[2] ? b : c;
      }
      raw[y * 9 + x + 1] = (sample[y * 8 + x] - predict) & 255;
    }
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    ...extra,
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('all five RGBA filters preserve channels, alpha and pixel identity', () => {
  for (let filter = 0; filter <= 4; filter++) {
    const decoded = decodeRGBA(fixture(filter));
    assert.deepEqual(decoded.pixels, sample);
    assert.deepEqual(decoded.alpha, { zero: 1, partial: 2, opaque: 1 });
    assert.equal(decoded.pixelBytes, 16);
    assert.equal(decoded.nearOpaque, 2);
  }
});
test('damaged CRC, truncation, excess inflation and forbidden formats refuse', () => {
  const corrupt = fixture(0);
  corrupt[48] ^= 1;
  for (const bytes of [
    corrupt,
    fixture(0).subarray(0, -1),
    fixture(0, { colorType: 2 }),
    fixture(0, { width: 2049 }),
    fixture(0, { rawExtra: true }),
    fixture(0, { extra: [chunk('acTL', Buffer.alloc(8))] }),
    Buffer.concat([fixture(0), Buffer.from([0])]),
  ])
    assert.throws(() => decodeRGBA(bytes));
});
const text = readFileSync(new URL('./presentations.json', import.meta.url), 'utf8');
test('identity arrays cannot pass by regular-expression string coercion', () => {
  for (const field of ['baseCommit', 'sha256']) {
    const data = JSON.parse(text);
    if (field === 'baseCommit') data.baseCommit = [data.baseCommit];
    else data.roles[0].sha256 = [data.roles[0].sha256];
    assert.throws(() => validatePresentations(JSON.stringify(data)), /Exact/);
  }
});
test('each independent rig is finite; foreign paths, extra fields and out-of-frame hubs refuse', () => {
  const data = validatePresentations(text);
  assert.equal(data.roles.length, 7);
  for (const mutate of [
    (d) => {
      d.roles[0].body.src = '../other.png';
    },
    (d) => {
      d.roles[0].body.atlas = [];
    },
    (d) => {
      d.roles[0].body.rotors[0].x = 0.5;
    },
    (d) => {
      d.roles[0].recipe.components[0].type = 'action-state';
    },
    (d) => {
      d.roles[1].classId = 'scout';
    },
    (d) => {
      d.roles[0].recipe.components[0].bladeCount = 5;
    },
  ]) {
    const copy = JSON.parse(text);
    mutate(copy);
    assert.throws(() => validatePresentations(JSON.stringify(copy)));
  }
});
test('existing animator advances seven rigs without mutating data; pause/reduced motion hold phase', () => {
  const data = validatePresentations(text),
    before = JSON.stringify(data);
  for (const { recipe } of data.roles) {
    const first = createAnimationState(),
      next = advanceAnimation(first, recipe, { visualSpeed: 1, cruiseSpeed: 1 }, 1 / 30);
    assert.ok(next.phases['main-rotors'] > 0);
    assert.deepEqual(first, createAnimationState());
    assert.deepEqual(
      advanceAnimation(next, recipe, { visualSpeed: 1, cruiseSpeed: 1 }, 1 / 30, { paused: true }),
      next,
    );
    assert.deepEqual(
      advanceAnimation(next, recipe, { visualSpeed: 1, cruiseSpeed: 1 }, 1 / 30, {
        reducedMotion: true,
      }),
      next,
    );
  }
  assert.equal(JSON.stringify(data), before);
});
