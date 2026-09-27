import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { decodeOriginalPNG } from '../authoring/library/four-worlds-chapters/verify-images.mjs';
import { crc32 } from './game-cli.mjs';

export const SCREENING_VERSION = 'revealline-artwork-screening.v1';
export const DECODER_PATH = 'authoring/library/four-worlds-chapters/verify-images.mjs';
export const DECODER_SHA256 = '100995d31bb65ed7797b0941988624cab76a2c37b297c81ec98ab8e16febcc34';
export const TRANSFORMS = Object.freeze([
  'identity',
  'rotate-90',
  'rotate-180',
  'rotate-270',
  'reflect',
  'reflect-rotate-90',
  'reflect-rotate-180',
  'reflect-rotate-270',
]);
export const SCREENING_LIMITS = Object.freeze({
  originals: 1024,
  pixels: 16 * 1024 * 1024,
  bytes: 4 * 1024 * 1024,
  grid: 16,
  nearest: 3,
  suspectDistance: 160,
  minimumContrast: 16,
});
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function checkImage(image) {
  assert.ok(Number.isSafeInteger(image.width) && image.width > 0 && image.width <= 8192);
  assert.ok(Number.isSafeInteger(image.height) && image.height > 0 && image.height <= 8192);
  assert.ok(image.width * image.height <= SCREENING_LIMITS.pixels);
  assert.equal(image.pixels.length, image.width * image.height * 3);
}

/** The existing pinned decoder validates chunks, CRCs, format and bounds first.
 * This second scan exposes its RGB samples for comparison, then cross-checks its
 * pixel digest. Neither pass performs color conversion or changes the original. */
export function decodeScreeningPNG(bytes) {
  assert.ok(bytes.length <= SCREENING_LIMITS.bytes, 'Original exceeds screening byte bound.');
  const checked = decodeOriginalPNG(`data:image/png;base64,${bytes.toString('base64')}`);
  const width = checked.naturalWidth,
    height = checked.naturalHeight,
    compressed = [];
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const stride = width * 3;
  const rows = inflateSync(Buffer.concat(compressed), { maxOutputLength: (stride + 1) * height });
  const pixels = Buffer.allocUnsafe(width * height * 3);
  for (let y = 0; y < height; y++) {
    const base = y * (stride + 1),
      filter = rows[base];
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const a = x >= 3 ? pixels[index - 3] : 0;
      const b = y ? pixels[index - stride] : 0;
      const c = y && x >= 3 ? pixels[index - stride - 3] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      if (filter === 2) predictor = b;
      if (filter === 3) predictor = Math.floor((a + b) / 2);
      if (filter === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[index] = (rows[base + 1 + x] + predictor) & 255;
    }
  }
  assert.equal(
    sha256(pixels),
    checked.pixelsSha256,
    'Screening decoder disagrees with pinned decoder.',
  );
  return { width, height, pixels };
}

/** Exact dihedral transforms: no resampling, interpolation or color changes. */
export function transformPixels(image, transform) {
  checkImage(image);
  const index = TRANSFORMS.indexOf(transform);
  assert.ok(index >= 0, 'Unknown pixel transform.');
  const rotation = index % 4,
    reflected = index >= 4;
  const width = rotation % 2 ? image.height : image.width;
  const height = rotation % 2 ? image.width : image.height;
  const pixels = Buffer.allocUnsafe(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sx, sy;
      if (rotation === 0) {
        sx = x;
        sy = y;
      }
      if (rotation === 1) {
        sx = y;
        sy = image.height - 1 - x;
      }
      if (rotation === 2) {
        sx = image.width - 1 - x;
        sy = image.height - 1 - y;
      }
      if (rotation === 3) {
        sx = image.width - 1 - y;
        sy = x;
      }
      if (reflected) sx = image.width - 1 - sx;
      const source = (sy * image.width + sx) * 3,
        target = (y * width + x) * 3;
      pixels[target] = image.pixels[source];
      pixels[target + 1] = image.pixels[source + 1];
      pixels[target + 2] = image.pixels[source + 2];
    }
  return { width, height, pixels };
}

export function exactPixelIdentity(image) {
  checkImage(image);
  return createHash('sha256')
    .update(`${image.width}x${image.height}:RGB8\n`)
    .update(image.pixels)
    .digest('hex');
}

export function exactTransformSignatures(image) {
  return TRANSFORMS.map((transform) => ({
    transform,
    sha256: exactPixelIdentity(transformPixels(image, transform)),
  }));
}

function integral(image) {
  checkImage(image);
  const stride = image.width + 1,
    sums = new Float64Array(stride * (image.height + 1));
  // Integer BT.601 luma approximation on encoded RGB samples, not linear-light/color-managed pixels.
  for (let y = 0; y < image.height; y++) {
    let sum = 0;
    for (let x = 0; x < image.width; x++) {
      const at = (y * image.width + x) * 3;
      sum += (77 * image.pixels[at] + 150 * image.pixels[at + 1] + 29 * image.pixels[at + 2]) >>> 8;
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + sum;
    }
  }
  return { sums, stride };
}

function gridFor({ sums, stride }, box) {
  const grid = Buffer.alloc(16 * 16 * 3);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const x0 = box.x + Math.floor((x * box.width) / 16),
        y0 = box.y + Math.floor((y * box.height) / 16);
      const x1 = Math.min(
        box.x + box.width,
        Math.max(x0 + 1, box.x + Math.floor(((x + 1) * box.width) / 16)),
      );
      const y1 = Math.min(
        box.y + box.height,
        Math.max(y0 + 1, box.y + Math.floor(((y + 1) * box.height) / 16)),
      );
      const sum =
        sums[y1 * stride + x1] -
        sums[y0 * stride + x1] -
        sums[y1 * stride + x0] +
        sums[y0 * stride + x0];
      const value = Math.floor(sum / ((x1 - x0) * (y1 - y0)));
      grid.fill(value, (y * 16 + x) * 3, (y * 16 + x) * 3 + 3);
    }
  return { width: 16, height: 16, pixels: grid };
}

function sketch(grid) {
  const gray = Array.from({ length: 256 }, (_, i) => grid.pixels[i * 3]);
  const mean = gray.reduce((sum, n) => sum + n, 0) / 256;
  const bits = new Uint32Array(23);
  let bit = 0;
  const push = (value) => {
    if (value) bits[bit >>> 5] |= 1 << (bit & 31);
    bit++;
  };
  gray.forEach((value) => push(value >= mean));
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 15; x++) push(gray[y * 16 + x] >= gray[y * 16 + x + 1]);
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 16; x++) push(gray[y * 16 + x] >= gray[(y + 1) * 16 + x]);
  const sorted = [...gray].sort((a, b) => a - b);
  return { bits, contrast: sorted[230] - sorted[25] };
}

export function similaritySignatures(image) {
  const summed = integral(image),
    boxes = [{ name: 'full', x: 0, y: 0, width: image.width, height: image.height }];
  for (const percent of [75, 50]) {
    const width = Math.max(1, Math.floor((image.width * percent) / 100));
    const height = Math.max(1, Math.floor((image.height * percent) / 100));
    for (const [name, fx, fy] of [
      ['center', 0.5, 0.5],
      ['top-left', 0, 0],
      ['top-right', 1, 0],
      ['bottom-left', 0, 1],
      ['bottom-right', 1, 1],
    ])
      boxes.push({
        name: `${percent}%-${name}`,
        x: Math.floor((image.width - width) * fx),
        y: Math.floor((image.height - height) * fy),
        width,
        height,
      });
  }
  return boxes.flatMap((box) => {
    const grid = gridFor(summed, box);
    return TRANSFORMS.map((transform) => ({
      crop: box.name,
      transform,
      ...sketch(transformPixels(grid, transform)),
    }));
  });
}

const bitCount = (word) => {
  word -= (word >>> 1) & 0x55555555;
  word = (word & 0x33333333) + ((word >>> 2) & 0x33333333);
  return (((word + (word >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};
function distance(a, b) {
  let value = 0;
  for (let i = 0; i < a.length; i++) value += bitCount(a[i] ^ b[i]) * (i < 8 ? 1 : 2);
  return value; // 256 mean bits + twice 480 gradient bits = 1216 maximum.
}

/** Compare a complete picture against bounded crop/orientation hypotheses in
 * either direction. Arbitrary crops, edits and general recolorings can be missed. */
export function compareSimilarity(left, right) {
  let best = null;
  const compare = (a, b, direction) => {
    const score = distance(a.bits, b.bits);
    if (!best || score < best.distance)
      best = {
        distance: score,
        crop: b.crop,
        transform: b.transform,
        direction,
        lowInformation: Math.min(a.contrast, b.contrast) < SCREENING_LIMITS.minimumContrast,
      };
  };
  for (const candidate of right) compare(left[0], candidate, 'right-to-left');
  for (const candidate of left)
    if (candidate.crop !== 'full') compare(right[0], candidate, 'left-to-right');
  return {
    ...best,
    suspected: !best.lowInformation && best.distance <= SCREENING_LIMITS.suspectDistance,
  };
}

/** Derived review thumbnail only; never used as an original or a game asset. */
export function thumbnailPNG(image, maximum = 96) {
  checkImage(image);
  const ratio = Math.min(1, maximum / Math.max(image.width, image.height));
  const width = Math.max(1, Math.floor(image.width * ratio)),
    height = Math.max(1, Math.floor(image.height * ratio));
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * image.width) / width),
        x1 = Math.floor(((x + 1) * image.width) / width);
      const y0 = Math.floor((y * image.height) / height),
        y1 = Math.floor(((y + 1) * image.height) / height);
      const sums = [0, 0, 0];
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++)
          for (let c = 0; c < 3; c++) sums[c] += image.pixels[(sy * image.width + sx) * 3 + c];
      for (let c = 0; c < 3; c++)
        rows[y * (width * 3 + 1) + 1 + x * 3 + c] = Math.floor(sums[c] / ((x1 - x0) * (y1 - y0)));
    }
  const chunk = (type, body) => {
    const value = Buffer.alloc(body.length + 12);
    value.writeUInt32BE(body.length);
    value.write(type, 4);
    body.copy(value, 8);
    value.writeUInt32BE(crc32(value.subarray(4, -4)), value.length - 4);
    return value;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  // zlib output varies across runtimes. Store DEFLATE blocks explicitly so the
  // review artifacts reproduce byte-for-byte across supported Node versions.
  const blocks = [Buffer.from([0x78, 0x01])];
  let s1 = 1,
    s2 = 0;
  for (const value of rows) {
    s1 = (s1 + value) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  for (let offset = 0; offset < rows.length; offset += 65535) {
    const length = Math.min(65535, rows.length - offset),
      block = Buffer.alloc(5);
    block[0] = offset + length === rows.length ? 1 : 0;
    block.writeUInt16LE(length, 1);
    block.writeUInt16LE(65535 - length, 3);
    blocks.push(block, rows.subarray(offset, offset + length));
  }
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(((s2 << 16) | s1) >>> 0);
  const compressed = Buffer.concat([...blocks, checksum]);
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Mission/mode ownership, not image-reference count, defines a current clash. */
export function classifyExactSharing(images) {
  const clusters = new Map();
  for (const image of images) {
    if (!clusters.has(image.canonicalPixels)) clusters.set(image.canonicalPixels, []);
    clusters.get(image.canonicalPixels).push(image);
  }
  const exactCurrent = [],
    historicalReuse = [];
  for (const [id, entries] of clusters) {
    const assignments = entries.flatMap((image) =>
      [...new Set(image.currentOwners)].map((owner) => ({ owner, artwork: image.id })),
    );
    if (new Set(assignments.map(({ owner }) => owner)).size > 1)
      exactCurrent.push({
        id,
        kind:
          entries.length === 1
            ? 'identical-source'
            : entries.every(
                  (image) =>
                    image.exactTransforms[0].sha256 === entries[0].exactTransforms[0].sha256,
                )
              ? 'identical-decoded-pixels'
              : 'exact-rotated-or-reflected-pixels',
        artwork: entries.map(({ id }) => id),
        assignments,
      });
    const historicalOwners = [
      ...new Set(entries.flatMap((image) => image.historicalOwners)),
    ].sort();
    if (
      historicalOwners.length &&
      historicalOwners.length + new Set(assignments.map(({ owner }) => owner)).size > 1
    )
      historicalReuse.push({
        id,
        artwork: entries.map(({ id }) => id),
        historicalOwners,
        currentOwners: [...new Set(assignments.map(({ owner }) => owner))].sort(),
      });
  }
  exactCurrent.sort((a, b) => a.id.localeCompare(b.id));
  historicalReuse.sort((a, b) => a.id.localeCompare(b.id));
  return { exactCurrent, historicalReuse };
}

/** Existing reports are evidence, not waivers for new cross-owner duplicates. */
export function validateArtworkChanges(report, { baseline, reviews } = {}) {
  assert.equal(
    baseline?.format,
    SCREENING_VERSION,
    'Strict new-art checking requires a prior screening report.',
  );
  assert.equal(
    baseline.method.algorithmSha256,
    report.method.algorithmSha256,
    'Review baseline must use the pinned screening implementation.',
  );
  assert.equal(baseline.method.decoderSha256, report.method.decoderSha256);
  const prior = new Map(baseline.images.map((image) => [image.id, new Set(image.currentOwners)]));
  const changed = report.images.flatMap((image) =>
    image.currentOwners
      .filter((owner) => !prior.get(image.id)?.has(owner))
      .map((owner) => ({ owner, artwork: image.id })),
  );
  const touched = new Set(changed.map(({ owner, artwork }) => `${owner}\n${artwork}`));
  const exactViolations = report.exactCurrent.filter((group) =>
    group.assignments.some(({ owner, artwork }) => touched.has(`${owner}\n${artwork}`)),
  );
  const approved = new Set();
  if (reviews) {
    assert.equal(reviews.format, 'revealline-artwork-visual-review.v1');
    assert.equal(
      reviews.inventorySha256,
      report.inventorySha256,
      'Visual review must match this exact inventory.',
    );
    for (const review of reviews.entries)
      if (
        review.decision === 'approved' &&
        typeof review.reviewer === 'string' &&
        review.reviewer.trim() &&
        typeof review.notes === 'string' &&
        review.notes.trim()
      )
        approved.add(`${review.owner}\n${review.artwork}`);
  }
  const pendingVisualReview = changed.filter(
    ({ owner, artwork }) => !approved.has(`${owner}\n${artwork}`),
  );
  return {
    changed,
    exactViolations,
    pendingVisualReview,
    passed: !exactViolations.length && !pendingVisualReview.length,
  };
}
