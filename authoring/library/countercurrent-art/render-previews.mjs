/** Explicit review derivatives only. Never writes into originals or replaces an output. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const args = process.argv.slice(2);
assert.equal(args.length, 4, '--canvas-module ABSOLUTE_MODULE --out NEW_DIRECTORY');
assert.equal(args[0], '--canvas-module');
assert.equal(args[2], '--out');
assert.ok(isAbsolute(args[1]) && isAbsolute(args[3]));
const output = resolve(args[3]);
assert.ok(output !== folder && !output.startsWith(`${folder}/`));
const moduleFile = resolve(args[1]);
assert.ok((await lstat(moduleFile)).isFile());
const { createCanvas, loadImage } = await import(pathToFileURL(moduleFile).href);
const manifestRaw = await readFile(resolve(folder, 'manifest.json'));
const manifest = JSON.parse(manifestRaw);
assert.equal(manifest.images.length, 12);
await mkdir(output); // Exclusive: all prior attempts remain intact.
const sheet = createCanvas(1200, 1020);
const g = sheet.getContext('2d');
g.fillStyle = '#101c2b';
g.fillRect(0, 0, sheet.width, sheet.height);
g.fillStyle = '#e7edf4';
g.font = '20px sans-serif';
g.fillText('Countercurrent / 12 original reward-art candidates', 16, 30);
g.font = '13px sans-serif';
g.fillText('384 × 192 review thumbnails. No runtime, collision-map or quality approval.', 16, 53);
const derivatives = [];
for (const [i, row] of manifest.images.entries()) {
  assert.match(
    row.path,
    /^originals\/(offset-docks|sandbar-braid|crossing-watch)-(fpv|ukraine|retro|coupa)\.png$/,
  );
  const source = await readFile(resolve(folder, row.path));
  assert.equal(source.length, row.bytes);
  assert.equal(hash(source), row.sha256);
  // The existing Canvas buffer loader can misclassify the embedded C2PA SVG icon.
  // A local .png path selects the PNG decoder without stripping source metadata.
  const image = await loadImage(resolve(folder, row.path));
  assert.equal(image.width, 1774);
  assert.equal(image.height, 887);
  assert.equal(hash(await readFile(resolve(folder, row.path))), row.sha256);
  const canvas = createCanvas(384, 192);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, 384, 192);
  const bytes = canvas.encodeSync('jpeg', 90);
  assert.ok(bytes.length < 128 * 1024);
  const name = `${row.missionSlot}-${row.themeId}.jpg`;
  await writeFile(resolve(output, name), bytes, { flag: 'wx' });
  const decoded = await loadImage(bytes);
  assert.equal(decoded.width, 384);
  assert.equal(decoded.height, 192);
  const decodeCanvas = createCanvas(384, 192);
  const d = decodeCanvas.getContext('2d');
  d.drawImage(decoded, 0, 0);
  const decodedRGBA = d.getImageData(0, 0, 384, 192).data;
  derivatives.push({
    cellId: row.cellId,
    originalPath: row.path,
    originalSha256: row.sha256,
    path: `thumbnails/${name}`,
    mime: 'image/jpeg',
    width: 384,
    height: 192,
    bytes: bytes.length,
    sha256: hash(bytes),
    decodedRGBASha256: hash(decodedRGBA),
  });
  const x = 12 + (i % 3) * 396;
  const y = 74 + Math.floor(i / 3) * 236;
  g.drawImage(decoded, x, y);
  g.fillStyle = '#e7edf4';
  g.font = '13px sans-serif';
  g.fillText(`${row.themeId.toUpperCase()} · ${row.missionSlot}`, x, y + 210);
  g.font = '12px sans-serif';
  g.fillText(row.title, x, y + 227);
}
await writeFile(resolve(output, 'contact-sheet.png'), sheet.toBuffer('image/png'), { flag: 'wx' });
const record = {
  format: 'revealline-source-art-derivatives.v1',
  purpose: 'Review previews only; original PNGs remain the future compiler inputs.',
  originalManifestSha256: hash(manifestRaw),
  recipe: {
    renderer: '@napi-rs/canvas',
    moduleSha256: hash(await readFile(moduleFile)),
    operation: 'Full-frame proportional resample; imageSmoothingEnabled=false',
    width: 384,
    height: 192,
    format: 'jpeg',
    quality: 90,
    crop: false,
    originalChanges: false,
  },
  validation:
    'Each encoded JPEG decoded through the same existing Canvas library; dimensions and decoded RGBA hash recorded. Portable verifier checks JPEG structure/hash and all source associations, not cross-platform encoder identity.',
  images: derivatives,
};
await writeFile(resolve(output, 'derivatives.json'), `${JSON.stringify(record, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    images: derivatives.length,
    bytes: derivatives.reduce((n, r) => n + r.bytes, 0),
    output,
  }),
);
