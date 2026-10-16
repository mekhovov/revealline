import { writeFile, readFile, mkdir, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  drawHuntActor,
  INDUSTRIAL_ROSTER_ART_REVISION,
  INDUSTRIAL_ROSTER_SAMPLES,
} from '../game/hunt/actor-art.mjs';
import { ACTOR_FAMILIES, ACTOR_CASTS } from '../game/hunt/actor-catalog.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

/** Deterministic pixel specimen of the real rectangle-based canvas rig. This
 * records native drawing, not a second hand-maintained character definition.
 * Sample pixel centres through the inverse transform, as nearest-neighbour
 * canvas rendering does. Browser/physical-size review remains a separate gate. */
export function rasterActor({ width = 32, height = width } = {}) {
  const rgba = new Uint8ClampedArray(width * height * 4),
    paints = [],
    rotations = [],
    stack = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  const multiply = ([a, b, c, d, e, f]) => {
    const [aa, ab, ac, ad, ae, af] = matrix;
    matrix = [
      aa * a + ac * b,
      ab * a + ad * b,
      aa * c + ac * d,
      ab * c + ad * d,
      aa * e + ac * f + ae,
      ab * e + ad * f + af,
    ];
  };
  const context = {
    fillStyle: '#000000',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    save() {
      stack.push({ matrix: [...matrix], color: this.fillStyle, alpha: this.globalAlpha });
    },
    restore() {
      const old = stack.pop();
      matrix = old.matrix;
      this.fillStyle = old.color;
      this.globalAlpha = old.alpha;
    },
    translate(x, y) {
      multiply([1, 0, 0, 1, x, y]);
    },
    scale(x, y) {
      multiply([x, 0, 0, y, 0, 0]);
    },
    rotate(angle) {
      rotations.push(angle);
      multiply([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
    },
    fillRect(x, y, w, h) {
      const [a, b, c, d, e, f] = matrix,
        det = a * d - b * c;
      const corners = [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ].map(([xx, yy]) => [a * xx + c * yy + e, b * xx + d * yy + f]);
      paints.push({
        color: this.fillStyle,
        alpha: this.globalAlpha,
        rotation: rotations.length,
        rect: [x, y, w, h],
        corners,
      });
      const left = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0])))),
        right = Math.min(width, Math.ceil(Math.max(...corners.map((p) => p[0]))));
      const top = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1])))),
        bottom = Math.min(height, Math.ceil(Math.max(...corners.map((p) => p[1]))));
      const color = [1, 3, 5].map((at) => Number.parseInt(this.fillStyle.slice(at, at + 2), 16));
      for (let yy = top; yy < bottom; yy++)
        for (let xx = left; xx < right; xx++) {
          const px = xx + 0.5 - e,
            py = yy + 0.5 - f,
            sx = (d * px - c * py) / det,
            sy = (-b * px + a * py) / det;
          if (sx < x - 1e-8 || sx >= x + w - 1e-8 || sy < y - 1e-8 || sy >= y + h - 1e-8) continue;
          const at = (yy * width + xx) * 4,
            old = rgba[at + 3] / 255,
            alpha = this.globalAlpha + old * (1 - this.globalAlpha);
          for (let channel = 0; channel < 3; channel++)
            rgba[at + channel] = Math.round(
              (color[channel] * this.globalAlpha +
                rgba[at + channel] * old * (1 - this.globalAlpha)) /
                alpha,
            );
          rgba[at + 3] = Math.round(alpha * 255);
        }
    },
  };
  return { width, height, rgba, context, paints, rotations };
}
export function soldierSpecimen(options = {}, size = 32) {
  const canvas = rasterActor({ width: size });
  drawHuntActor(canvas.context, 0, 0, size, 0, {
    artRevision: INDUSTRIAL_ROSTER_ART_REVISION,
    shadow: false,
    ...options,
  });
  return canvas;
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function writeAtomic(path, bytes) {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
export async function produceSoldierRoster(output) {
  await mkdir(output, { recursive: true });
  // Each row: three kit casts, each with true16/24/32px and a96px specimen.
  const cellWidth = 204,
    cellHeight = 112,
    sheet = {
      width: cellWidth * 3,
      height: cellHeight * 12,
      rgba: new Uint8ClampedArray(cellWidth * 3 * cellHeight * 12 * 4),
    };
  const samples = [];
  for (const [row, family] of ACTOR_FAMILIES.entries())
    for (const [column, cast] of ACTOR_CASTS.entries()) {
      let x = column * cellWidth + 4;
      for (const size of [16, 24, 32, 96]) {
        const sprite = soldierSpecimen(
          {
            family: family.id,
            cast: cast.id,
            state: 'walk',
            locomotionPhase: 1 / 6,
            armed: family.id === 'guard',
          },
          size,
        );
        const y = row * cellHeight + 8 + Math.floor((96 - size) / 2);
        for (let yy = 0; yy < size; yy++)
          sheet.rgba.set(
            sprite.rgba.subarray(yy * size * 4, (yy + 1) * size * 4),
            ((y + yy) * sheet.width + x) * 4,
          );
        samples.push({
          family: family.id,
          cast: cast.id,
          size,
          rectangle: { x, y, width: size, height: size },
          rgbaSha256: hash(sprite.rgba),
        });
        x += size + 6;
      }
    }
  const png = encodeSpritePNG(sheet),
    descriptors = JSON.stringify(INDUSTRIAL_ROSTER_SAMPLES, null, 2) + '\n';
  await writeAtomic(resolve(output, 'soldier-roster-v3.png'), png);
  await writeAtomic(resolve(output, 'soldier-roster-v3-animations.json'), descriptors);
  const sources = await Promise.all(
    [
      'game/hunt/actor-art.mjs',
      'game/hunt/actor-catalog.mjs',
      'game/hunt/industrial-soldier-kit.mjs',
      'game/presentation/actor-animation.mjs',
      'scripts/produce-soldier-roster.mjs',
    ].map(async (path) => ({
      path,
      sha256: hash(await readFile(new URL('../' + path, import.meta.url))),
    })),
  );
  const receipt = {
    format: 'revealline-soldier-specimens.v1',
    artRevision: INDUSTRIAL_ROSTER_ART_REVISION,
    families: 12,
    casts: 3,
    samples,
    sources,
    assets: [
      {
        path: 'soldier-roster-v3.png',
        bytes: png.length,
        sha256: hash(png),
        width: sheet.width,
        height: sheet.height,
      },
      {
        path: 'soldier-roster-v3-animations.json',
        bytes: Buffer.byteLength(descriptors),
        sha256: hash(descriptors),
      },
    ],
    runtimeDecodedAtlasBytes: 0,
    scope:
      'Original procedural source specimens; no gameplay or default adoption. Actual native browser/device and human acceptance remain separate.',
  };
  await writeAtomic(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = resolve(process.argv[2] ?? '.cache/soldier-roster-v3');
  const receipt = await produceSoldierRoster(output);
  console.log(
    JSON.stringify({
      output,
      families: receipt.families,
      casts: receipt.casts,
      assets: receipt.assets,
    }),
  );
}
