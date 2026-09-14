import { format, resolveConfig } from 'prettier';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  pixelArtForSlot,
  FIELD_KIT_SPRITE_IDS,
  FIELD_KIT_SPRITE_VERSION,
  FIELD_KIT_COLORS,
} from '../game/presentation/pixel-art.mjs';
import { ASSET_SLOTS } from '../game/presentation/catalog.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const FIELD_KIT_SPRITE_DIRECTORY = 'game/assets/field-kit/sprites';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, crc]);
}
/** Deterministic RGBA PNG: filter0 rows, no metadata, standard DEFLATE level9. */
export function encodeSpritePNG({ width, height, rgba }) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    rgba.length !== width * height * 4
  )
    throw new Error('Invalid PNG pixel frame.');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      scanlines,
      y * (width * 4 + 1) + 1,
    );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function inspectSprite({ width, height, rgba }) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1,
    transparent = 0,
    opaque = 0;
  const colors = new Set();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4,
        alpha = rgba[at + 3];
      if (alpha === 0) {
        transparent++;
        continue;
      }
      if (alpha !== 255) throw new Error('Sprite alpha must be binary.');
      opaque++;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      colors.add(
        '#' + [...rgba.subarray(at, at + 3)].map((v) => v.toString(16).padStart(2, '0')).join(''),
      );
    }
  return {
    opaquePixels: opaque,
    transparentPixels: transparent,
    colors: [...colors].sort(),
    occupiedBounds:
      right < 0
        ? null
        : {
            x: left / width,
            y: top / height,
            width: (right - left + 1) / width,
            height: (bottom - top + 1) / height,
          },
  };
}
const explanations = {
  scout:
    'Slim X frame with one strapped amber battery and a front camera. The narrow fuselage keeps the reference scout silhouette light.',
  bomber:
    'Wider chassis with a green payload pack and two side pods. Twin amber retention bands distinguish the carrying equipment.',
  carrier:
    'Six explicit motors around a tall cargo cage. Amber side rails and three cross straps retain the heavier green pack.',
  interceptor:
    'Swept angular center frame, narrow battery and amber rear chevron. The sharp waist distinguishes the fast class without changing its motor locations.',
  fiber:
    'Rear cyan cable reel with dark flanges, separate from the amber battery. Compact drawings keep the reel as one readable horizontal cluster.',
  impact:
    'Pale front armor around a protected cyan camera and a short rear battery. The broad nose gives a distinct contact-oriented silhouette.',
  trapper:
    'Two long side equipment rails and split amber battery clusters around a cyan middle connector. The cage remains legible without baked cables or propellers.',
  bouncer:
    'Tracked patrol vehicle with a forward barrel and coral turret sensor; twin treads distinguish it from flying player craft.',
  'border-patrol':
    'Coral patrol quad with broad angular center armor and four static motor hubs. The engine draws its movement and threat cues separately.',
  'contour-patrol': 'Four-wheel armored patrol with paired front optics and a squared cabin.',
  'claimed-rover': 'Low tracked reclaiming rover with an open front fork and green utility hull.',
  eroder:
    'Tracked erosion machine with a wide toothed front blade and a coral rear sensor. The blade is a static part of the authored silhouette.',
  'lane-boss':
    'Large rectangular sensor carrier, twin mast tips, heavy side tracks and a coral emitter bank.',
  'relay-sentinel':
    'Large raised radar pedestal with an angular front dish, central sensor, and four coral stabilizer feet.',
  wall: 'Opaque slate blocks use stepped mortar, top highlights and a staggered layout to preserve a solid cell footprint.',
  slow: 'Opaque olive ground and winding dark ruts distinguish slow material from a rigid wall; short cool highlights suggest wet tracks.',
  lethal:
    'Coral diagonal hazard bands around a dark metal grate. Pattern and color distinguish the entire hazardous cell.',
  objective: 'Cyan relay diamond with a pale transmitter cap and an amber mast.',
  supply: 'Strapped olive field crate with a pale cross and an amber latch band.',
  life: 'Coral heart with a broad pale highlight, drawn as a small independent pixel symbol.',
  speed: 'Two forward cyan chevrons with a dark separating edge.',
  slowPickup: 'Amber hourglass with a pale waist and metal end caps.',
  freeze: 'Cyan eight-point freeze symbol with a pale central crystal and axial tips.',
};
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function promptFor(slot) {
  return `${slot.prompt}\n\nPRODUCTION FAMILY: Original Field Kit pixel sprites v${FIELD_KIT_SPRITE_VERSION}. Native frame ${slot.dimensions.width}×${slot.dimensions.height}; do not downsample an illustration. Use deliberate clusters, binary transparency, no gradients or antialiasing, and at most 12 opaque colors from ${Object.values(FIELD_KIT_COLORS).join(', ')}. Camera/front points NORTH at the top of the frame. ${slot.id.startsWith('player.') ? 'Preserve the exact registered motor positions; draw static hubs only. Never bake propeller blades, discs, speed arcs, or rotor blur. ' : ''}Keep text, gameplay hitboxes, selection badges and contact rings separate.\n\nSLOT GEOMETRY:\n${JSON.stringify(slot.geometry)}\n\nREQUIREMENTS:\n${slot.requirements.map((line) => '- ' + line).join('\n')}\n\nSave an untouched source, exact-size PNG, provenance and effective prompt. Review at 20, 24, and 32 CSS pixels on ink, light and actual arena backgrounds. A candidate is produced, not reviewed. Existing earned artwork and reference/game-generated sources must remain unchanged.`;
}
const glyphs = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '-': ['000', '000', '111', '000', '000'],
  '.': ['0', '0', '0', '0', '1'],
};
function sheetFor(entries) {
  const columns = 6,
    cardW = 232,
    cardH = 232,
    width = columns * cardW,
    height = 40 + Math.ceil(entries.length / columns) * cardH,
    rgba = new Uint8ClampedArray(width * height * 4);
  const colors = Object.fromEntries(
    Object.entries(FIELD_KIT_COLORS).map(([key, hex]) => [
      key,
      [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).concat(255),
    ]),
  );
  const rect = (x, y, w, h, c) => {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++)
        if (px >= 0 && py >= 0 && px < width && py < height)
          rgba.set(colors[c], (py * width + px) * 4);
  };
  const write = (text, x, y, color = 'light') => {
    for (const char of text.toUpperCase()) {
      const glyph = glyphs[char];
      if (!glyph) {
        x += 4;
        continue;
      }
      glyph.forEach((row, yy) =>
        [...row].forEach((p, xx) => {
          if (p === '1') rect(x + xx, y + yy, 1, 1, color);
        }),
      );
      x += glyph[0].length + 1;
    }
  };
  const place = (sprite, x, y, size) => {
    for (let py = 0; py < size; py++)
      for (let px = 0; px < size; px++) {
        const at =
          (Math.floor((py * sprite.height) / size) * sprite.width +
            Math.floor((px * sprite.width) / size)) *
          4;
        if (sprite.rgba[at + 3])
          rgba.set(sprite.rgba.subarray(at, at + 4), ((y + py) * width + x + px) * 4);
      }
  };
  rect(0, 0, width, height, 'ink');
  write('FIELD KIT - ORIGINAL PIXEL SPRITES - PRODUCED / AWAITING VISUAL REVIEW', 16, 15, 'white');
  entries.forEach((entry, index) => {
    const x = (index % columns) * cardW,
      y = 40 + Math.floor(index / columns) * cardH,
      sprite = pixelArtForSlot(entry.slotId);
    rect(x + 4, y + 4, cardW - 8, cardH - 8, 'shadow');
    write(`${entry.slotId.split('.')[1]} ${sprite.width}`, x + 14, y + 14, 'cyan');
    place(sprite, x + 52, y + 30, 128);
    for (const [size, offset] of [
      [20, 18],
      [24, 62],
      [32, 108],
    ]) {
      place(sprite, x + offset, y + 174, size);
      write(String(size), x + offset, y + 212, 'light');
    }
    rect(x + 166, y + 170, 44, 44, 'white');
    place(sprite, x + 172, y + 176, 32);
  });
  return { width, height, rgba };
}
function reviewHTML(manifest) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Field Kit sprite review</title><link rel="stylesheet" href="../../../ui/field-kit-fonts.css"><style>*{box-sizing:border-box}body{margin:0;background:#070b12;color:#f3f0db;font:18px/1.5 'Field Kit UI',sans-serif}header{padding:32px;max-width:1100px}h1{font:600 52px/1 'Field Kit Display',sans-serif;margin:12px 0}p{color:#a5b2bb}a{color:#78dce8}.status{color:#f4bf62;font:14px 'Field Kit Mono',monospace}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;padding:16px 32px 48px}.card{padding:20px;background:#101923;border:1px solid #425563;min-width:0}.card h2{font-size:19px;margin:0;color:#78dce8}.big{height:208px;display:grid;place-items:center;background:repeating-conic-gradient(#101923 0% 25%,#182531 0% 50%) 50%/16px 16px;margin:16px 0}.big img{width:192px;height:192px;image-rendering:pixelated}.native{display:flex;gap:20px;align-items:flex-end;min-height:64px}.native figure{display:grid;gap:6px;margin:0;justify-items:center;font:12px 'Field Kit Mono',monospace}.native img{image-rendering:pixelated}.light{background:#f3f0db;padding:8px}.card p{font-size:14px}.card code{font:12px 'Field Kit Mono',monospace;overflow-wrap:anywhere}summary{cursor:pointer;color:#78dce8;font-size:16px}textarea{width:100%;min-height:220px;background:#070b12;color:#f3f0db;border:1px solid #647786;padding:12px;resize:vertical;font:14px/1.5 'Field Kit UI',sans-serif}button{font:16px 'Field Kit UI',sans-serif;min-height:44px;background:#182531;color:#f3f0db;border:1px solid #647786;padding:8px 16px;margin:8px 0;cursor:pointer}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #78dce8;outline-offset:3px}@media(max-width:500px){header{padding:24px}.grid{padding:12px;grid-template-columns:1fr}}</style><header><div class="status">PRODUCED · NOT YET REVIEWED</div><h1>Field Kit sprite review</h1><p>Thirty original code-authored pixel assets. No pixels were taken from the hardware concept study, legacy game art, or Xposed references. North is up; player images contain static motor hubs and no propellers. Compact 32 and detailed 64 are rendered directly at their native pixel grids.</p><p>Review the 20, 24, and 32 CSS pixel samples and enlarged clusters, then check the real board. This page is an asset review, not gameplay. Camera/front orientation and cosmetic geometry do not change hitboxes.</p><a href="./sprites.json">Complete provenance and geometry</a> · <a href="./contact-sheet.png">PNG contact sheet</a> · <a href="../../../../authoring/asset-studio/">Asset Studio</a></header><main class="grid">${manifest.assets.map((asset) => `<article class="card"><h2>${escapeHTML(asset.slotId)}</h2><div class="big"><img src="./${asset.file.path}" alt="${escapeHTML(asset.description)}" width="${asset.file.width}" height="${asset.file.height}"></div><div class="native">${[20, 24, 32].map((size) => `<figure><img src="./${asset.file.path}" alt="" style="width:${size}px;height:${size}px"><figcaption>${size}px</figcaption></figure>`).join('')}<figure><span class="light"><img src="./${asset.file.path}" alt="" style="width:32px;height:32px"></span><figcaption>light32</figcaption></figure></div><p>${escapeHTML(asset.description)}</p><p>${asset.file.width}×${asset.file.height}px · ${asset.colors.length} colors · ${asset.file.bytes} bytes · ${asset.geometry.rotorAnchors.length} motor anchors</p><details><summary>Requirements and geometry</summary><p>${asset.requirements.map(escapeHTML).join('<br>')}</p><code>${escapeHTML(JSON.stringify(asset.geometry))}</code></details><details><summary>Copyable AI variation brief</summary><textarea readonly>${escapeHTML(asset.provenance.prompt)}</textarea><button type="button">Copy full prompt</button><p role="status"></p></details></article>`).join('')}</main><script>document.querySelectorAll('button').forEach(button=>button.onclick=async()=>{const text=button.previousElementSibling;try{await navigator.clipboard.writeText(text.value);button.nextElementSibling.textContent='Prompt copied.'}catch{text.focus();text.select();button.nextElementSibling.textContent='Text selected. Press Ctrl/Cmd+C.'}})</script></html>`;
}
export async function produceFieldKitSprites({ check = false } = {}) {
  const source = await readFile(resolve(root, 'game/presentation/pixel-art.mjs'));
  const manifest = {
    format: 'revealline-field-kit-sprite-production.v1',
    version: FIELD_KIT_SPRITE_VERSION,
    quality: { stage: 'produced', evidence: [] },
    source: { path: 'game/presentation/pixel-art.mjs', sha256: hash(source) },
    method:
      'Original authored integer-pixel drawings, generated directly at native sizes. No source images are edited, sampled or rescaled to create the production sprites.',
    concept:
      'AI hardware concept was reviewed only for equipment ideas; it faced south. These new drawings face north and contain no pixels copied from that study.',
    palette: FIELD_KIT_COLORS,
    assets: [],
  };
  const files = new Map();
  for (const slotId of FIELD_KIT_SPRITE_IDS) {
    const slot = ASSET_SLOTS.find((slot) => slot.id === slotId),
      sprite = pixelArtForSlot(slotId),
      facts = inspectSprite(sprite),
      bytes = encodeSpritePNG(sprite),
      filename = slotId.replaceAll('.', '-') + '.png';
    if (!facts.opaquePixels || facts.colors.length > 12)
      throw new Error(`Invalid production pixels for ${slotId}.`);
    if (sprite.width !== slot.dimensions.width || sprite.height !== slot.dimensions.height)
      throw new Error(`Registry dimensions differ for ${slotId}.`);
    if (bytes.length > slot.budget.maxBytes) throw new Error(`Byte budget exceeded for ${slotId}.`);
    if (slot.alpha === 'required' && !facts.transparentPixels)
      throw new Error(`Missing alpha for ${slotId}.`);
    const id = slotId.split('.')[1],
      description = explanations[slotId === 'pickup.slow' ? 'slowPickup' : id];
    manifest.assets.push({
      slotId,
      description,
      quality: { stage: 'produced', evidence: [] },
      file: {
        path: filename,
        mime: 'image/png',
        width: sprite.width,
        height: sprite.height,
        bytes: bytes.length,
        sha256: hash(bytes),
      },
      geometry: { ...structuredClone(slot.geometry), occupiedBounds: facts.occupiedBounds },
      colors: facts.colors,
      pixels: { opaque: facts.opaquePixels, transparent: facts.transparentPixels },
      requirements: slot.requirements,
      provenance: {
        creator: 'RevealLine original pixel-art recipe, authored with Codex',
        source: `game/presentation/pixel-art.mjs v${FIELD_KIT_SPRITE_VERSION}`,
        license: 'Original project artwork; no third-party or concept-image pixels incorporated.',
        prompt: promptFor(slot),
        parent: null,
      },
    });
    files.set(filename, bytes);
  }
  const formatting = await resolveConfig(resolve(root, '.prettierrc.json'));
  files.set(
    'sprites.json',
    Buffer.from(await format(JSON.stringify(manifest), { ...formatting, parser: 'json' })),
  );
  files.set(
    'review.html',
    Buffer.from(await format(reviewHTML(manifest), { ...formatting, parser: 'html' })),
  );
  files.set('contact-sheet.png', encodeSpritePNG(sheetFor(manifest.assets)));
  const directory = resolve(root, FIELD_KIT_SPRITE_DIRECTORY);
  if (!check) await mkdir(directory, { recursive: true });
  for (const [name, bytes] of files) {
    const path = resolve(directory, name);
    if (check) {
      const current = await readFile(path);
      if (!current.equals(bytes)) throw new Error(`Generated sprite artifact is stale: ${name}`);
    } else await writeFile(path, bytes);
  }
  return {
    count: manifest.assets.length,
    totalSpriteBytes: manifest.assets.reduce((sum, a) => sum + a.file.bytes, 0),
    artifacts: files.size,
    directory,
  };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  console.log(
    JSON.stringify(await produceFieldKitSprites({ check: process.argv.includes('--check') })),
  );
