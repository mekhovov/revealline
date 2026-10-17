import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrateCpu } from './calibrate-solo-performance.mjs';

test('calibration finds bounded target rates and retains independent verification', async () => {
  const result = await calibrateCpu(async (rate) => 4000 / rate);
  assert.equal(result.presets.low.status, 'verified');
  assert.equal(result.presets.mid.status, 'verified');
  assert.ok(Math.abs(result.presets.mid.rate - 4) < 0.1);
  assert.equal(result.samples.filter((sample) => sample.purpose.endsWith('-verify')).length, 6);
  assert.ok(result.samples.length <= 25);
});

test('weak or unstable hosts are not silently labeled calibrated', async () => {
  const weak = await calibrateCpu(async () => 100);
  assert.equal(weak.presets.mid.status, 'host-too-slow');
  assert.equal(weak.presets.low.status, 'host-too-slow');
  assert.equal(weak.samples.length, 3);
  let samples = 0;
  const unstable = await calibrateCpu(async (rate) => (4000 / rate) * (++samples % 2 ? 1.3 : 0.7));
  assert.equal(unstable.presets.mid.status, 'unstable-or-off-target');
  await assert.rejects(
    calibrateCpu(async () => NaN),
    /Invalid calibration score/,
  );
});
