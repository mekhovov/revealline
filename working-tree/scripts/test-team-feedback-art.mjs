import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import {
  buildTeamFeedbackArt,
  produceTeamFeedbackArt,
  TEAM_FEEDBACK_ART_DIRECTORY,
} from './produce-team-feedback-art.mjs';
import { teamEffectSlotSpecs } from '../game/presentation/team-effect-slots.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'rl-feedback-art-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, TEAM_FEEDBACK_ART_DIRECTORY, 'source.mjs');
  await mkdir(join(directory, TEAM_FEEDBACK_ART_DIRECTORY), { recursive: true });
  await writeFile(source, await readFile(join(root, TEAM_FEEDBACK_ART_DIRECTORY, 'source.mjs')));
  return { directory, source, output: join(directory, TEAM_FEEDBACK_ART_DIRECTORY, 'prepared') };
}
function decode(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20),
    chunks = [];
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6);
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    rgba = [];
  assert.equal(raw.length, height * (width * 4 + 1));
  for (let row = 0; row < height; row++) {
    const start = row * (width * 4 + 1);
    assert.equal(raw[start], 0);
    rgba.push(...raw.subarray(start + 1, start + 1 + width * 4));
  }
  return { width, height, rgba };
}

test('produced family reproduces retained PNGs and stays below exact slot budgets', async () => {
  const { manifest, files } = await buildTeamFeedbackArt();
  const slots = teamEffectSlotSpecs();
  assert.deepEqual(
    manifest.assets.map((asset) => asset.slot).sort(),
    slots.map((s) => s.id).sort(),
  );
  for (const asset of manifest.assets) {
    const bytes = files.get(asset.file),
      pixels = decode(bytes),
      spec = slots.find((slot) => slot.id === asset.slot);
    assert.deepEqual(
      bytes,
      await readFile(join(root, TEAM_FEEDBACK_ART_DIRECTORY, 'prepared', asset.file)),
    );
    assert.equal(hash(bytes), asset.sha256);
    assert.equal(bytes.length, asset.bytes);
    assert.ok(bytes.length <= spec.budget.maxBytes);
    assert.equal(pixels.width, spec.dimensions.width);
    assert.equal(pixels.height, spec.dimensions.height);
    const alpha = new Set(),
      colors = new Set();
    for (let at = 0; at < pixels.rgba.length; at += 4) {
      alpha.add(pixels.rgba[at + 3]);
      if (pixels.rgba[at + 3])
        colors.add(
          '#' +
            pixels.rgba
              .slice(at, at + 3)
              .map((n) => n.toString(16).padStart(2, '0'))
              .join(''),
        );
    }
    assert.deepEqual(
      [...alpha].sort((a, b) => a - b),
      [0, 255],
    );
    assert.ok([...colors].every((color) => spec.palette.includes(color)));
    assert.equal(asset.quality, 'produced');
    assert.equal(asset.provenance.sourceSha256, manifest.sourceSha256);
  }
  await produceTeamFeedbackArt({ check: true });
});

test('check-only missing output never creates a production directory', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    produceTeamFeedbackArt({ projectRoot: f.directory, check: true }),
    /Missing produced/,
  );
  await assert.rejects(access(f.output), { code: 'ENOENT' });
});

test('mismatch preflight retains existing pixels without writing the other state', async (t) => {
  const f = await fixture(t),
    bytes = Buffer.from('retained recovery original');
  await mkdir(f.output);
  await writeFile(join(f.output, 'recovery.png'), bytes);
  await assert.rejects(
    produceTeamFeedbackArt({ projectRoot: f.directory }),
    /Immutable Team feedback output differs/,
  );
  assert.deepEqual(await readFile(join(f.output, 'recovery.png')), bytes);
  await assert.rejects(access(join(f.output, 'support.png')), { code: 'ENOENT' });
});

test('another drawing cannot be credited as the source of cached imported pixels', async (t) => {
  const f = await fixture(t);
  await writeFile(f.source, '// A different source revision.\n');
  await assert.rejects(
    produceTeamFeedbackArt({ projectRoot: f.directory }),
    /does not match the loaded drawing module/,
  );
  await assert.rejects(access(f.output), { code: 'ENOENT' });
});

test('fresh generation and repeat check retain the entire family byte-for-byte', async (t) => {
  const f = await fixture(t);
  const first = await produceTeamFeedbackArt({ projectRoot: f.directory });
  const second = await produceTeamFeedbackArt({ projectRoot: f.directory, check: true });
  assert.deepEqual(first, second);
  for (const asset of first.assets)
    assert.equal(hash(await readFile(join(f.output, asset.file))), asset.sha256);
  const manifest = JSON.parse(await readFile(join(f.output, 'manifest.json')));
  assert.deepEqual(manifest, first);
});
