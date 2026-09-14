/** Bounded source-art verification; no image encoding or runtime adoption. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeOriginalPNG } from '../four-worlds-chapters/verify-images.mjs';
import { MEDIA_LIMITS } from '../../../game/media-library.mjs';

const folder = fileURLToPath(new URL('./', import.meta.url));
const root = resolve(folder, '../../..');
const themes = ['ukraine', 'retro', 'coupa'];
const names = ['listening-court', 'switchyard-gates', 'open-the-circuit'];
const cells = themes.flatMap((theme) =>
  names.map((name) => ({
    cellId: `sentinel-circuit/${name}/${theme}`,
    themeId: theme,
    missionSlot: name,
    path: `${theme}/originals/${name}.png`,
  })),
);
const documents = [
  'README.md',
  'prompts.json',
  'generation-results.json',
  'provenance.json',
  'verify.mjs',
];
const hash = (value) => createHash('sha256').update(value).digest('hex');
async function bytes(path) {
  assert.equal((await lstat(path)).isFile(), true, `Ordinary file required: ${path}`);
  return readFile(path);
}
async function pin(path, displayPath = path) {
  const value = await bytes(path);
  return { path: displayPath, bytes: value.length, sha256: hash(value) };
}
async function inventory(path, prefix = '') {
  const files = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      files.push(...(await inventory(resolve(path, entry.name), `${relative}/`)));
    else {
      assert.equal(entry.isFile(), true, `No symlink or special file: ${relative}`);
      files.push(relative);
    }
  }
  return files.sort();
}
async function verify() {
  const provenance = JSON.parse(await bytes(resolve(folder, 'provenance.json')));
  const prompts = JSON.parse(await bytes(resolve(folder, 'prompts.json')));
  const generated = JSON.parse(await bytes(resolve(folder, 'generation-results.json')));
  assert.equal(provenance.format, 'revealline-source-art-provenance.v1');
  assert.equal(prompts.format, 'revealline-source-art-prompts.v1');
  assert.equal(generated.format, 'revealline-source-art-generation-results.v1');
  for (const document of [provenance, prompts, generated]) {
    assert.equal(document.tool, 'image_gen.imagegen built-in');
    assert.equal(document.calls, 9);
  }
  for (const entries of [provenance.images, prompts.prompts, generated.generated])
    assert.deepEqual(
      entries.map((item) => item.cellId),
      cells.map((cell) => cell.cellId),
    );
  assert.deepEqual(prompts.inputImages, []);
  assert.equal(generated.edits, 0);
  assert.equal(provenance.editCalls, 0);
  assert.deepEqual(provenance.referenceImages, []);
  assert.deepEqual(provenance.pixelTransformations, []);
  assert.equal(provenance.rawOriginalsPreserved, true);
  assert.equal(new Set(provenance.images.map((item) => item.originalToolPath)).size, 9);
  assert.equal(MEDIA_LIMITS.assetBytes, 4 * 1024 * 1024);
  assert.equal(MEDIA_LIMITS.posterWidth, 1920);
  assert.equal(MEDIA_LIMITS.posterHeight, 1080);
  const context = [];
  for (const expected of provenance.contextPins) {
    assert.ok(!expected.path.startsWith('/') && !expected.path.split('/').includes('..'));
    const actual = await pin(resolve(root, expected.path), expected.path);
    assert.deepEqual(actual, expected, `Pinned source context: ${expected.path}`);
    context.push(actual);
  }
  assert.equal(context.length, 15);
  const decoded = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i],
      item = provenance.images[i],
      result = generated.generated[i];
    for (const key of ['cellId', 'themeId', 'missionSlot', 'path'])
      assert.equal(item[key], cell[key]);
    assert.equal(item.runtimeBinding, null);
    assert.equal(item.sourceBytesEqual, true);
    assert.equal(prompts.prompts[i].themeId, cell.themeId);
    assert.equal(prompts.prompts[i].missionSlot, cell.missionSlot);
    assert.equal(hash(prompts.prompts[i].prompt), item.promptSha256);
    assert.equal(result.mode, 'generate');
    assert.equal(result.tool, 'image_gen.imagegen built-in');
    assert.deepEqual(result.inputImages, []);
    assert.equal(result.workspacePath, cell.path);
    for (const key of ['bytes', 'sha256', 'promptSha256', 'originalToolPath'])
      assert.equal(result[key], item[key]);
    assert.ok(result.outputHint.includes(` as ${item.originalToolPath} by default.`));
    const value = await bytes(resolve(folder, cell.path));
    assert.equal(value.length, item.bytes);
    assert.equal(hash(value), item.sha256);
    assert.ok(value.length <= MEDIA_LIMITS.assetBytes);
    const image = decodeOriginalPNG(`data:image/png;base64,${value.toString('base64')}`);
    assert.equal(image.naturalWidth, item.width);
    assert.equal(image.naturalHeight, item.height);
    assert.ok(image.naturalWidth <= MEDIA_LIMITS.posterWidth);
    assert.ok(image.naturalHeight <= MEDIA_LIMITS.posterHeight);
    assert.equal(image.naturalWidth, image.naturalHeight * 2, 'Observed panorama ratio.');
    decoded.push({ cellId: cell.cellId, ...image, bytes: value.length, sha256: hash(value) });
  }
  assert.equal(new Set(decoded.map((image) => image.sha256)).size, 9);
  assert.equal(new Set(decoded.map((image) => image.pixelsSha256)).size, 9);
  const paths = [...documents, ...cells.map((cell) => cell.path)];
  const actualPaths = (await inventory(folder)).filter((path) => path !== 'verification.json');
  assert.deepEqual(actualPaths, [...paths].sort(), 'Exactly nine originals and six documents.');
  const files = [];
  for (const path of paths) files.push(await pin(resolve(folder, path), path));
  return {
    format: 'revealline-source-art-verification.v1',
    baseCommit: provenance.baseCommit,
    sourceCandidates: 9,
    newGeometries: 0,
    totalOriginalBytes: decoded.reduce((sum, image) => sum + image.bytes, 0),
    method:
      'Exact SHA/bytes; all PNG chunk CRCs, bounded full RGB8 scanline decompression and filters; existing unchanged decoder; no output image transformations.',
    visualReview:
      'All nine actual generated images visually inspected by the authoring agent. Per-image observations and deviations are in provenance and README; independent review is separate.',
    limits:
      'Source-art checks only; no browser/pack/storage/offline/gameplay/device/animation or rights certification.',
    files,
    decoded,
    protectedContext: context,
  };
}

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--record'));
const result = await verify();
const report = resolve(folder, 'verification.json');
if (args[0] === '--record') {
  await writeFile(report, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
} else {
  assert.deepEqual(JSON.parse(await bytes(report)), result, 'Source-art receipt differs.');
}
console.log(
  `PASS: ${result.sourceCandidates} original PNGs, ${result.totalOriginalBytes} bytes; exact source/context pins and bounded full RGB checks match.`,
);
