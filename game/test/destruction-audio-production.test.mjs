import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const authoring = new URL('../../authoring/audio/revealline-v1/', import.meta.url);
const sourceRoot = new URL('originals/kenney-destruction-v1/', authoring);
const sourceBytes = await readFile(new URL('sources.json', sourceRoot));
const sources = JSON.parse(sourceBytes);
const production = JSON.parse(await readFile(new URL('destruction-production.json', authoring)));
const durations = { soft: 0.22, armored: 0.3, light: 0.45, heavy: 0.75, electronic: 0.3 };

test('destruction sources retain exact licensed originals and checked production recipe', async () => {
  assert.equal(sources.license, 'CC0-1.0');
  assert.equal(production.sourceManifestSha256, sha256(sourceBytes));
  assert.equal(
    production.producerSha256,
    sha256(await readFile(new URL('produce_destruction.py', authoring))),
  );
  for (const [pack, entry] of Object.entries(sources.packs)) {
    const license = await readFile(new URL(entry.licenseFile, sourceRoot));
    assert.equal(sha256(license), entry.licenseSha256);
    assert.match(license.toString(), /Creative Commons Zero, CC0/);
    for (const [name, expected] of Object.entries(entry.files)) {
      const bytes = await readFile(new URL(`${pack}/${name}`, sourceRoot));
      assert.equal(bytes.byteLength, expected.bytes);
      assert.equal(sha256(bytes), expected.sha256);
    }
  }
});

test('all destruction families have three distinct, short, headroom-safe PCM recordings', async () => {
  assert.equal(Object.keys(production.entries).length, 15);
  let total = 0;
  for (const [family, duration] of Object.entries(durations)) {
    const variants = new Set();
    for (const suffix of ['', '-1', '-2']) {
      const name = `destroy-${family}${suffix}`;
      const entry = EFFECT_BANK[name];
      const receipt = production.entries[name];
      const bytes = await readFile(new URL(`../audio/effects/${entry.file}`, import.meta.url));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
      assert.equal(bytes.readUInt16LE(20), 1, 'PCM encoding');
      assert.equal(bytes.readUInt16LE(22), 1, 'Mono');
      assert.equal(bytes.readUInt32LE(24), 48000);
      assert.equal(bytes.readUInt16LE(34), 16);
      assert.equal(bytes.readUInt32LE(40) / (48000 * 2), duration);
      assert.equal(bytes.byteLength, entry.bytes);
      assert.equal(sha256(bytes), entry.sha256);
      assert.equal(receipt.sha256, entry.sha256);
      assert.equal(receipt.duration, duration);
      assert.equal(entry.loop, false);
      assert.equal(bytes.readInt16LE(44), 0, 'Fade starts at zero');
      assert.equal(bytes.readInt16LE(bytes.length - 2), 0, 'Fade ends at zero');
      let peak = 0;
      let energy = 0;
      for (let offset = 44; offset < bytes.length; offset += 2) {
        const sample = bytes.readInt16LE(offset) / 32768;
        peak = Math.max(peak, Math.abs(sample));
        energy += sample * sample;
      }
      assert.ok(energy > 0, `${name} must contain audible signal`);
      assert.ok(peak <= 0.10001, `${name} exceeds -20 dBFS ceiling`);
      assert.ok(receipt.max50msDbfs <= receipt.recipe.targetMax50msDbfs + 0.01);
      variants.add(entry.sha256);
      total += bytes.byteLength;
    }
    assert.equal(variants.size, 3, `${family} has three genuinely different files`);
  }
  assert.equal(total, 582420);
});
