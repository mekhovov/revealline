import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  derivePngStill,
  PNG_PREVIEW_MAX_BYTES,
  PNG_PREVIEW_MAX_CHUNKS,
} from '../../authoring/motion-lab/png-preview.mjs';
const fixtures = new URL('./fixtures/motion-background/', import.meta.url);
const control = new Uint8Array(await readFile(new URL('static-default.png', fixtures)));
const apng = new Uint8Array(await readFile(new URL('animated-separate-default.png', fixtures)));
const invalid = new Uint8Array(await readFile(new URL('invalid-signature-only.png', fixtures)));
const signature = control.slice(0, 8);
function chunks(bytes) {
  const result = [];
  for (let pos = 8; pos < bytes.length; ) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0);
    result.push({
      name: String.fromCharCode(...bytes.slice(pos + 4, pos + 8)),
      data: bytes.slice(pos + 8, pos + 8 + size),
    });
    pos += size + 12;
  }
  return result;
}
function chunk(name, data = new Uint8Array()) {
  const bytes = new Uint8Array(data.length + 12),
    view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(
    [...name].map((c) => c.charCodeAt(0)),
    4,
  );
  bytes.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(4, bytes.length - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
  return bytes;
}
function png(rows) {
  return new Uint8Array(
    Buffer.concat([signature, ...rows.map(({ name, data }) => chunk(name, data))]),
  );
}
const ordinary = chunks(control),
  animated = chunks(apng);
const fail = (bytes) => assert.throws(() => derivePngStill(bytes), /PNG.*structure/);

test('Separate-default APNG produces the exact static control and does not mutate original bytes', () => {
  const before = apng.slice(),
    result = derivePngStill(apng);
  assert.equal(result.animated, true);
  assert.deepEqual(result.bytes, control);
  assert.deepEqual(apng, before);
});
test('Ordinary PNG is validated then returned byte-identically without an allocation', () => {
  const result = derivePngStill(control);
  assert.equal(result.bytes, control);
  assert.equal(result.animated, false);
});
test('Default-as-first APNG retains IDAT and ordinary metadata', () => {
  const actl = animated.find((c) => c.name === 'acTL').data.slice();
  new DataView(actl.buffer).setUint32(0, 1);
  const fctl = animated.find((c) => c.name === 'fcTL');
  const metadata = [
    { name: 'gAMA', data: Uint8Array.of(0, 0, 177, 143) },
    { name: 'sRGB', data: Uint8Array.of(0) },
  ];
  const normal = [ordinary[0], ...metadata, ...ordinary.slice(1)];
  const input = png([
    ordinary[0],
    ...metadata,
    { name: 'acTL', data: actl },
    fctl,
    ...ordinary.slice(1),
  ]);
  assert.deepEqual(derivePngStill(input).bytes, png(normal));
});
test('Split contiguous IDAT chunks are retained exactly including a zero-length chunk', () => {
  const idat = ordinary[1].data;
  const rows = [
    ordinary[0],
    { name: 'IDAT', data: idat.slice(0, 8) },
    { name: 'IDAT', data: new Uint8Array() },
    { name: 'IDAT', data: idat.slice(8) },
    ordinary[2],
  ];
  const input = png(rows);
  assert.equal(derivePngStill(input).bytes, input);
});
test('PNG signature, truncation, chunk length and CRC failures reject', () => {
  for (const bytes of [invalid, control.slice(0, -1), new Uint8Array(20), control.slice(1)])
    fail(bytes);
  const huge = control.slice();
  new DataView(huge.buffer).setUint32(8, 0x7fffffff);
  fail(huge);
  const corrupt = control.slice();
  corrupt[20] ^= 1;
  fail(corrupt);
});
test('Missing, duplicate and misplaced required chunks reject', () => {
  for (const rows of [
    ordinary.slice(1),
    ordinary.slice(0, -1),
    [ordinary[0], ordinary[0], ...ordinary.slice(1)],
    [ordinary[0], ordinary[2]],
    [...ordinary, ordinary[2]],
  ])
    fail(png(rows));
  const input = new Uint8Array(control.length + 1);
  input.set(control);
  fail(input);
  fail(png([ordinary[0], { name: 'IDAT', data: new Uint8Array() }, ordinary[2]]));
});
test('Interrupted IDAT, unknown critical chunk and invalid chunk name reject', () => {
  fail(
    png([
      ordinary[0],
      ordinary[1],
      { name: 'tEXt', data: Uint8Array.of(97, 0) },
      ordinary[1],
      ordinary[2],
    ]),
  );
  for (const name of ['ABCD', 'teXt', 'a1AA'])
    fail(png([ordinary[0], { name, data: new Uint8Array() }, ...ordinary.slice(1)]));
});
test('Invalid PNG dimensions, color-depth, filter, compression and interlace reject', () => {
  for (const [index, value] of [
    [0, 0],
    [1, 0],
    [8, 1],
    [9, 9],
    [10, 1],
    [11, 1],
    [12, 2],
  ]) {
    const head = ordinary[0].data.slice();
    if (index < 2) new DataView(head.buffer).setUint32(index * 4, value);
    else head[index] = value;
    fail(png([{ name: 'IHDR', data: head }, ...ordinary.slice(1)]));
  }
});
test('Indexed palette and transparency structure is validated without decoding pixel data', () => {
  const head = ordinary[0].data.slice();
  head[9] = 3;
  fail(png([{ name: 'IHDR', data: head }, ...ordinary.slice(1)]));
  const palette = { name: 'PLTE', data: Uint8Array.of(0, 0, 0, 255, 255, 255) };
  const rows = [
    { name: 'IHDR', data: head },
    palette,
    { name: 'tRNS', data: Uint8Array.of(0, 255) },
    ...ordinary.slice(1),
  ];
  assert.equal(derivePngStill(png(rows)).animated, false);
  fail(png([rows[0], palette, palette, ...ordinary.slice(1)]));
  fail(
    png([rows[0], palette, { name: 'tRNS', data: Uint8Array.of(1, 2, 3) }, ...ordinary.slice(1)]),
  );
  fail(png([ordinary[0], { name: 'tRNS', data: Uint8Array.of(1, 2) }, ...ordinary.slice(1)]));
});
test('APNG ordering, frame counts, sequence and absent frame data reject', () => {
  const without = (name) => animated.filter((c) => c.name !== name);
  fail(png(without('acTL')));
  fail(png(without('fcTL')));
  fail(png(without('fdAT')));
  for (const name of ['acTL', 'fcTL', 'fdAT']) {
    const rows = animated.map((c) => ({ name: c.name, data: c.data.slice() }));
    const row = rows.find((c) => c.name === name);
    new DataView(row.data.buffer).setUint32(0, 999);
    fail(png(rows));
  }
  fail(png([ordinary[0], ordinary[1], animated[1], ordinary[2]]));
});
test('APNG out-of-bounds dimensions and unsupported frame operations reject', () => {
  for (const [index, value] of [
    [4, 0],
    [8, 0],
    [12, 32],
    [16, 24],
    [24, 3],
    [25, 2],
  ]) {
    const rows = animated.map((c) => ({ name: c.name, data: c.data.slice() })),
      row = rows.find((c) => c.name === 'fcTL');
    if (index < 24) new DataView(row.data.buffer).setUint32(index, value);
    else row.data[index] = value;
    fail(png(rows));
  }
});
test('Encoded byte and chunk count limits reject before producing a derivative', () => {
  fail(new Uint8Array(PNG_PREVIEW_MAX_BYTES + 1));
  const rows = [
    ordinary[0],
    ...Array.from({ length: PNG_PREVIEW_MAX_CHUNKS }, () => ({
      name: 'tEXt',
      data: Uint8Array.of(97, 0),
    })),
    ...ordinary.slice(1),
  ];
  fail(png(rows));
});
