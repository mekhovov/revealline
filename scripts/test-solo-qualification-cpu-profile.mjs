import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createQualificationCpuProfile } from './solo-qualification-cpu-profile.mjs';
import { qualificationProfileMode, validateQualification } from './solo-qualification.mjs';

test('CPU profiles require Chromium, a bounded recipe, and a separate profiling mode', () => {
  const recipe = { timeoutMs: 300000, requiredProfile: 'cpu' };
  assert.equal(qualificationProfileMode(['--cpu-profile'], 'chromium', recipe), 'cpu-profile');
  assert.throws(() => qualificationProfileMode([], 'chromium', recipe), /requires/);
  assert.throws(() => qualificationProfileMode(['--cpu-profile'], 'webkit', recipe), /Chromium/);
  for (const mode of ['audio-proof', 'memory-profile'])
    assert.throws(
      () => qualificationProfileMode(['--cpu-profile', `--${mode}`], 'chromium', recipe),
      /separately/,
    );
  assert.throws(
    () => qualificationProfileMode(['--cpu-profile'], 'chromium', { timeoutMs: 300001 }),
    /timeout/,
  );
  const scenario = {
    format: 'SoloQualificationV1',
    id: 'profile',
    kind: 'lifecycle',
    timeoutMs: 300000,
    coverage: [],
    actions: [{ type: 'wait', ms: 1000 }],
    requiredProfile: 'cpu',
  };
  assert.equal(validateQualification(scenario).requiredProfile, 'cpu');
  assert.throws(
    () => validateQualification({ ...scenario, requiredProfile: 'invented' }),
    /Unsupported/,
  );
  assert.throws(() => validateQualification({ ...scenario, timeoutMs: 300001 }), /timeout/);
});

test('CPU stop retains a failed-scenario profile once, with exact bytes, hash and clock units', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'solo-profile-'));
  try {
    const file = join(directory, 'partial.cpuprofile'),
      calls = [];
    const profile = {
      nodes: [{ id: 1 }],
      startTime: 100,
      endTime: 2100,
      samples: [1, 1],
      timeDeltas: [1000, 1000],
    };
    const cdp = {
      send: async (method, params) => {
        calls.push({ method, params });
        return method === 'Profiler.stop' ? { profile } : {};
      },
    };
    const owner = createQualificationCpuProfile(cdp, { file, maximumMs: 1000 });
    await owner.start();
    await Promise.all([owner.stop('scenario-failure'), owner.stop('duplicate-cleanup')]);
    const bytes = await readFile(file);
    assert.deepEqual(JSON.parse(bytes), profile);
    assert.equal(owner.report.status, 'retained');
    assert.equal(owner.report.stopReason, 'scenario-failure');
    assert.equal(owner.report.sampleCount, 2);
    assert.equal(owner.report.samplingIntervalUs, 1000);
    assert.equal(owner.report.profileEndTimeUs, 2100);
    assert.equal(owner.report.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(
      calls.map((row) => row.method),
      ['Profiler.enable', 'Profiler.setSamplingInterval', 'Profiler.start', 'Profiler.stop'],
    );
    assert.deepEqual(calls[1].params, { interval: 1000 });
    const next = createQualificationCpuProfile(cdp, { file, maximumMs: 1000 });
    await assert.rejects(next.start(), /overwrite/);
    assert.deepEqual(await readFile(file), bytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('bounded profile timer stops and retains partial evidence before asking the owner to close', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'solo-profile-limit-'));
  try {
    let closed = false;
    let finish;
    const done = new Promise((resolve) => {
      finish = resolve;
    });
    const owner = createQualificationCpuProfile(
      {
        send: async (method) =>
          method === 'Profiler.stop'
            ? { profile: { nodes: [], samples: [], startTime: 0, endTime: 5000 } }
            : {},
      },
      {
        file: join(directory, 'limited.cpuprofile'),
        maximumMs: 5,
        onLimit: () => {
          assert.equal(owner.report.status, 'retained');
          closed = true;
          finish();
        },
      },
    );
    await owner.start();
    const guard = setTimeout(() => finish(), 500);
    await done;
    clearTimeout(guard);
    assert.equal(closed, true);
    assert.equal(owner.report.limitReached, true);
    assert.equal(owner.report.stopReason, 'profile-duration-limit');
    await owner.stop();
    const failed = createQualificationCpuProfile(
      {
        send: async (method) => {
          if (method === 'Profiler.stop') throw new Error('browser closed');
          return {};
        },
      },
      { file: join(directory, 'missing.cpuprofile'), maximumMs: 1000 },
    );
    await failed.start();
    await failed.stop('scenario-failure');
    assert.equal(failed.report.status, 'failed');
    assert.match(failed.report.failure, /browser closed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
