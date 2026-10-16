import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';

async function signal(file) {
  const bytes = await readFile(new URL(`../audio/effects/${file}`, import.meta.url));
  let data, rate;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = bytes.readUInt32LE(offset + 4);
    if (bytes.toString('ascii', offset, offset + 4) === 'fmt ')
      rate = bytes.readUInt32LE(offset + 12);
    if (bytes.toString('ascii', offset, offset + 4) === 'data')
      data = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  const samples = Array.from(
    { length: data.length / 2 },
    (_, i) => data.readInt16LE(i * 2) / 32768,
  );
  const energy = [0];
  for (const sample of samples) energy.push(energy.at(-1) + sample * sample);
  const window = Math.min(samples.length, Math.round(rate * 0.05));
  let maximum = 0;
  for (let i = window; i < energy.length; i++)
    maximum = Math.max(maximum, (energy[i] - energy[i - window]) / window);
  return {
    db: 10 * Math.log10(maximum),
    peak: samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0),
  };
}
test('every packaged effect has calibrated short-window loudness and peak headroom', async () => {
  const report = JSON.parse(
    await readFile(
      new URL('../../authoring/audio/revealline-v1/loudness-report.json', import.meta.url),
    ),
  );
  assert.deepEqual(Object.keys(report).sort(), Object.keys(EFFECT_BANK).sort());
  const measured = {};
  for (const [name, entry] of Object.entries(EFFECT_BANK)) {
    const value = await signal(entry.file);
    measured[name] = value.db;
    assert.ok(value.peak <= (entry.loop ? 0.159 : 0.1001), `${name}: peak headroom`);
    assert.ok(
      Math.abs(value.db - report[name].target50msDbfs) < 0.6,
      `${name}: calibration ${value.db}`,
    );
  }
  for (const family of [
    'confirm',
    'paper',
    'pickup',
    'contact-metal',
    'contact-wood',
    'contact-glass',
    'contact-soft',
  ]) {
    const values = [family, `${family}-1`, `${family}-2`].map((name) => measured[name]);
    assert.ok(Math.max(...values) - Math.min(...values) < 0.6, `${family}: variation volume jump`);
  }
  assert.ok(Math.abs(measured['radio-armed-en'] - measured['radio-armed-uk']) < 0.6);
  assert.ok(Math.abs(measured['esc-start'] - measured['esc-retry']) < 0.6);
  const reveals = ['small', 'medium', 'large'].map((size) => measured[`reveal-${size}`]);
  assert.ok(Math.max(...reveals) - Math.min(...reveals) < 0.6);
});
