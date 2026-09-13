/** Bounded original-art verification; no image transforms or runtime adoption. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeOriginalPNG } from '../four-worlds-chapters/verify-images.mjs';
import { MEDIA_LIMITS } from '../../../game/media-library.mjs';

const folder = fileURLToPath(new URL('./', import.meta.url));
const root = resolve(folder, '../../..');
const toolDirectory =
  '/Users/oleksandr.mekhovov/.codex/generated_images/01a09328-21d8-7e93-9403-7e6793a4fac2';
const images = [
  {
    name: 'split-ring-fpv',
    bytes: 2922125,
    sha256: 'db9bf4302c55608657f63f1660c4e5859669511942416586d1a6e1fb5394f0b2',
    promptSha256: 'eede3bf96a60e177d5d8ba2600690e29e91b175623dccb87f1b9a530e635f07d',
    toolFile: 'exec-589b5f66-22a6-4af3-a568-9740f337b00f.png',
  },
  {
    name: 'fault-fan-fpv',
    bytes: 2796382,
    sha256: '15474a7d695861364fc6a9a131c1849c7a5e72c65b011450b589eacde7635ec8',
    promptSha256: '1a8ae33a2eb2265bd94a584579d495f08d697a30fd04a25c9f3b7f9c2caf4f82',
    toolFile: 'exec-cd40055d-137c-4035-9fcd-012cc1b5ed93.png',
  },
  {
    name: 'frayed-causeway-fpv',
    bytes: 2938361,
    sha256: '5aae2f84912ca35b7145617c98d3c4ecac72a93d8d6cc04558d86873ca0938f1',
    promptSha256: '8d59a7e0b1ad4b5347317af6477def590b73d3fa3ce60f2b3c49743dc963e7d9',
    toolFile: 'exec-2c391696-a9da-450b-b13c-319207d43f14.png',
  },
];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const text = (value) => assert.ok(typeof value === 'string' && value.trim().length > 0);
async function bytes(path, maximum = 4 * 1024 * 1024) {
  const info = await lstat(path);
  assert.ok(info.isFile() && info.size <= maximum, `Bounded ordinary file required: ${path}`);
  const value = await readFile(path);
  assert.ok(value.length <= maximum);
  return value;
}
async function pin(path, displayPath) {
  const value = await bytes(path);
  return { path: displayPath, bytes: value.length, sha256: hash(value) };
}
async function inventory(path, prefix = '') {
  const files = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      assert.equal(relative, 'originals', 'Only the originals subdirectory is allowed.');
      files.push(...(await inventory(resolve(path, entry.name), `${relative}/`)));
    } else {
      assert.ok(entry.isFile(), `No links or special files: ${relative}`);
      files.push(relative);
    }
  }
  return files.sort();
}
async function verify(toolOriginals) {
  assert.equal(MEDIA_LIMITS.assetBytes, 4 * 1024 * 1024);
  assert.equal(MEDIA_LIMITS.posterWidth, 1920);
  assert.equal(MEDIA_LIMITS.posterHeight, 1080);
  const decoded = [];
  for (const image of images) {
    const metadata = JSON.parse(await bytes(resolve(folder, `${image.name}.json`), 64 * 1024));
    assert.deepEqual(
      Object.keys(metadata).sort(),
      [
        'format',
        'template',
        'adaptations',
        'assetId',
        'mode',
        'status',
        'prompt',
        'outputHint',
        'originalPath',
        'workspacePath',
        'review',
        'bytes',
        'width',
        'height',
        'sha256',
      ].sort(),
    );
    assert.equal(metadata.format, 'revealline-generated-source-art.v1');
    assert.equal(metadata.template, 'fpv-02-reveal-art');
    assert.equal(metadata.assetId, `fracture-lines-${image.name}`);
    assert.equal(metadata.mode, 'built-in-image_gen');
    assert.equal(metadata.status, 'produced-source-art; runtime adoption pending');
    assert.ok(Array.isArray(metadata.adaptations) && metadata.adaptations.length === 2);
    metadata.adaptations.forEach(text);
    text(metadata.prompt);
    assert.equal(hash(metadata.prompt), image.promptSha256, 'Full original prompt retained.');
    assert.equal(metadata.originalPath, `${toolDirectory}/${image.toolFile}`);
    assert.equal(metadata.workspacePath, `originals/${image.name}.png`);
    assert.equal(
      metadata.outputHint,
      `Generated images are saved to ${toolDirectory} as ${metadata.originalPath} by default.\nIf you need to use a generated image at another path, copy it and leave the original in place unless the user explicitly asks you to delete it.\nThe generated image is already displayed to the user. There is no need to render it in the final response as a Markdown image or file link.`,
    );
    assert.deepEqual(Object.keys(metadata.review).sort(), [
      'identity',
      'limits',
      'scene',
      'style',
      'subjects',
    ]);
    Object.values(metadata.review).forEach(text);
    assert.equal(metadata.width, 1774);
    assert.equal(metadata.height, 887);
    assert.equal(metadata.bytes, image.bytes);
    assert.equal(metadata.sha256, image.sha256);
    const value = await bytes(resolve(folder, metadata.workspacePath));
    assert.equal(value.length, image.bytes);
    assert.equal(hash(value), image.sha256);
    if (toolOriginals) {
      const original = await bytes(metadata.originalPath);
      assert.equal(original.length, value.length);
      assert.equal(hash(original), image.sha256);
      assert.deepEqual(original, value, 'Workspace copy equals the untouched default tool output.');
    }
    const facts = decodeOriginalPNG(`data:image/png;base64,${value.toString('base64')}`);
    assert.equal(facts.naturalWidth, metadata.width);
    assert.equal(facts.naturalHeight, metadata.height);
    assert.ok(
      facts.naturalWidth <= MEDIA_LIMITS.posterWidth &&
        facts.naturalHeight <= MEDIA_LIMITS.posterHeight,
    );
    assert.equal(facts.naturalWidth, 2 * facts.naturalHeight);
    decoded.push({
      assetId: metadata.assetId,
      bytes: value.length,
      sha256: hash(value),
      promptSha256: image.promptSha256,
      ...facts,
    });
  }
  assert.equal(new Set(decoded.map((image) => image.sha256)).size, 3);
  assert.equal(new Set(decoded.map((image) => image.pixelsSha256)).size, 3);
  const paths = [
    'README.md',
    'verify.mjs',
    ...images.flatMap((image) => [`${image.name}.json`, `originals/${image.name}.png`]),
  ];
  assert.deepEqual(
    (await inventory(folder)).filter((path) => path !== 'verification.json'),
    [...paths].sort(),
  );
  const files = [];
  for (const path of paths) files.push(await pin(resolve(folder, path), path));
  const context = [];
  for (const path of [
    'authoring/library/four-worlds-chapters/verify-images.mjs',
    'game/media-library.mjs',
  ])
    context.push(await pin(resolve(root, path), path));
  return {
    format: 'revealline-source-art-verification.v1',
    baseCommit: '5826719744a530a4d89d8c11f5150d9acbe7f7b8',
    sourceCandidates: 3,
    totalOriginalBytes: decoded.reduce((sum, image) => sum + image.bytes, 0),
    method:
      'Exact PNG and full-prompt pins; all chunk CRCs, bounded full RGB8 scanline decompression and filters through the unchanged decoder; no image encoding or transformations.',
    originalCopyEvidence:
      'Recording requires --tool-originals and exact byte equality with all three default tool files. Portable verification checks the recorded workspace/source pins; --tool-originals repeats the local copy comparison.',
    limits:
      'Source-art qualification only. No campaign completion, runtime binding, partial-reveal/browser readability, storage/offline/device, rotor animation or historical-location claim.',
    files,
    decoded,
    protectedContext: context,
  };
}

const args = process.argv.slice(2);
assert.equal(new Set(args).size, args.length);
assert.ok(args.every((arg) => ['--record', '--tool-originals'].includes(arg)));
assert.ok(
  !args.includes('--record') || args.includes('--tool-originals'),
  'Recording requires original-copy verification.',
);
const result = await verify(args.includes('--tool-originals'));
const report = resolve(folder, 'verification.json');
if (args.includes('--record')) {
  await writeFile(report, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
} else {
  assert.deepEqual(JSON.parse(await bytes(report)), result, 'Source-art receipt differs.');
}
console.log(
  `PASS: ${result.sourceCandidates} original PNGs / ${result.totalOriginalBytes} bytes; exact metadata and bounded full RGB/CRC checks${args.includes('--tool-originals') ? ', including default-output copy equality' : ''}.`,
);
