import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../sessions.mjs';
import { campaignKey, emptyLibrary } from '../library.mjs';
import { createAttemptFilePreparer } from '../attempt-file.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const base = await json('../content/campaign.json');
base.classRecipes = CLASSES;
const pack = await json('../content/packs/sentinel-relay.json');
const encounter = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
const proof = await json('../replays/sentinel-routes.json');
const stamp = '2026-09-12T12:34:56.789Z';
const copy = (value) => structuredClone(value);
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function flight(campaign = base, policy = 'immediate', ticks = 100, runId = 'current-flight') {
  const level = campaign.levels[0];
  const options = {
    classId: 'scout',
    classRecipes: campaign.classRecipes,
    seed: 1,
    turnPolicy: policy,
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'attempt-file-test');
  if (campaign === encounter) {
    const route = proof.routes.find((r) => r.variant === 'recovered' && r.turnPolicy === policy);
    for (const segment of route.segments) {
      if (run.tick >= ticks) break;
      if (segment.releaseBefore) {
        releaseInputs(run);
        recordRelease(recorder);
      }
      for (let i = 0; i < segment.ticks && run.tick < ticks; i++) {
        stepRun(run, segment.input, FIXED_DT);
        recordInput(recorder, segment.input);
      }
    }
  } else {
    for (let i = 0; i < ticks; i++) {
      stepRun(run, { direction: 'down' }, FIXED_DT);
      recordInput(recorder, { direction: 'down' });
    }
  }
  return {
    run,
    recorder,
    runId,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    savedAt: stamp,
  };
}
function harness({ campaign = base, policy = 'immediate', current = false, ticks = 100 } = {}) {
  const live = flight(campaign, policy, current ? ticks : 0);
  const saved = suspendSession(flight(campaign, policy, ticks, 'stored-earlier-flight'));
  let raw = JSON.stringify(saved),
    marker = null,
    journal = null,
    lockTail = Promise.resolve();
  const state = {
    run: live.run,
    recorder: live.recorder,
    runId: live.runId,
    library: emptyLibrary(),
    packs: {},
    started: current,
    paused: !current,
    practice: false,
    courseActive: false,
    courseEntry: null,
    recordingStopped: false,
    contentBusy: false,
    sessionBusy: false,
    backupBusy: false,
    hidden: false,
    themeId: 'fpv',
    bodyId: 'fpv-body',
  };
  const calls = { snapshot: 0, stored: 0, marker: 0, journal: 0, lock: 0, depth: 0, resolve: [] };
  const host = {
    getState: () => state,
    snapshotCurrent: () => {
      calls.snapshot++;
      state.paused = true;
      return suspendSession({
        ...live,
        run: state.run,
        recorder: state.recorder,
        runId: state.runId,
      });
    },
    resolveCampaign: (key) => {
      calls.resolve.push(key);
      return [base, encounter].find((candidate) => campaignKey(candidate) === key) ?? null;
    },
    readStored: () => {
      calls.stored++;
      return raw;
    },
    readBackupMarker: () => {
      calls.marker++;
      return marker;
    },
    readJournal: async () => {
      calls.journal++;
      return journal;
    },
    withStorageLock: async (work, signal) => {
      calls.lock++;
      assert.ok(signal instanceof AbortSignal);
      const previous = lockTail;
      let unlock;
      lockTail = new Promise((resolve) => {
        unlock = resolve;
      });
      await previous;
      try {
        signal.throwIfAborted();
        calls.depth++;
        try {
          return await work();
        } finally {
          calls.depth--;
        }
      } finally {
        unlock();
      }
    },
  };
  return {
    state,
    live,
    saved,
    calls,
    host,
    get raw() {
      return raw;
    },
    set raw(value) {
      raw = value;
    },
    set marker(value) {
      marker = value;
    },
    set journal(value) {
      journal = value;
    },
    create: () => createAttemptFilePreparer(host),
  };
}

test('source selection is synchronous and never probes the normal stored slot', () => {
  const h = harness(),
    api = h.create();
  assert.deepEqual(api.source(), { source: 'stored', label: 'Export saved attempt', reason: '' });
  h.state.started = true;
  assert.equal(api.source().source, 'current');
  assert.equal(api.source().label, 'Export current attempt');
  h.state.recordingStopped = true;
  assert.equal(api.source().source, null);
  assert.match(api.source().reason, /complete recording/);
  h.state.recordingStopped = false;
  h.state.recorder = null;
  assert.equal(api.source().source, null);
  h.state.run = null;
  assert.equal(
    api.source().source,
    null,
    'A broken started flight must not become stored-source fallback.',
  );
  assert.equal(
    h.calls.snapshot + h.calls.stored + h.calls.marker + h.calls.journal + h.calls.lock,
    0,
  );
});

for (const flag of [
  'practice',
  'courseActive',
  'courseEntry',
  'contentBusy',
  'sessionBusy',
  'backupBusy',
  'hidden',
])
  test(`${flag} blocks preparation before snapshot or storage access`, async () => {
    const h = harness();
    h.state[flag] = flag === 'courseEntry' ? {} : true;
    const api = h.create();
    assert.equal(api.source().source, null);
    await assert.rejects(api.prepare());
    assert.equal(
      h.calls.snapshot + h.calls.stored + h.calls.marker + h.calls.journal + h.calls.lock,
      0,
    );
  });

for (const campaign of [base, encounter])
  for (const policy of ['immediate', 'grid-center']) {
    const ticks = campaign === encounter ? 1505 : 100;
    test(`${campaign.id}/${policy}: stored live or recovery checkpoint verifies outside the short lock`, async () => {
      const h = harness({ campaign, policy, ticks }),
        api = h.create();
      const before = {
        raw: h.raw,
        state: copy(h.state),
        replay: exportReplay(h.live.recorder, h.live.run),
      };
      // A different Ready selection must not substitute its rules/roster.
      if (campaign === encounter) {
        const ready = flight(base, policy, 0);
        h.state.run = ready.run;
        h.state.recorder = ready.recorder;
      }
      let progress = 0;
      const result = await api.prepare({
        onProgress: () => {
          progress++;
          assert.equal(h.calls.depth, 0);
        },
      });
      assert.equal(result.source, 'stored');
      assert.equal(result.context, 'installed-campaign');
      assert.deepEqual(result.session, h.saved);
      assert.deepEqual(h.calls.resolve, [h.saved.campaignKey]);
      assert.equal(h.raw, before.raw);
      assert.equal(h.calls.snapshot, 0);
      assert.equal(h.calls.lock, 2);
      assert.equal(h.calls.journal, 2);
      assert.equal(h.calls.depth, 0);
      assert.ok(progress > 0);
      assert.deepEqual(h.state.library, before.state.library);
      assert.deepEqual(exportReplay(h.live.recorder, h.live.run), before.replay);
      result.assertCurrent();
      assert.equal(
        h.calls.journal,
        2,
        'Synchronous publication check does not pretend to query IndexedDB.',
      );
      const restored = await restoreSession(result.session, {
        campaign,
        campaignKey: campaignKey(campaign),
      });
      assert.equal(restored.run.status, campaign === encounter ? 'respawning' : 'running');
      assert.equal(restored.run.tick, ticks);
    });

    test(`${campaign.id}/${policy}: current unfinished flight wins over the older slot without requiring storage`, async () => {
      const h = harness({ campaign, policy, current: true, ticks });
      for (const name of ['readStored', 'readBackupMarker', 'readJournal', 'withStorageLock'])
        h.host[name] = () =>
          assert.fail('Current-file export must not need stored data or a writer.');
      const api = h.create(),
        result = await api.prepare();
      assert.equal(result.source, 'current');
      assert.equal(result.session.runId, h.state.runId);
      assert.notEqual(result.session.runId, h.saved.runId);
      assert.equal(h.calls.snapshot, 1);
      assert.equal(h.state.paused, true);
      assert.deepEqual(result.session.replay, exportReplay(h.state.recorder, h.state.run));
      result.assertCurrent();
      result.assertCurrent();
      assert.equal(h.calls.snapshot, 1, 'Publication checks never resuspend or change savedAt.');
    });
  }

test('a real won run exports only an earlier stored checkpoint', async () => {
  const h = harness({ current: true });
  while (h.state.run.status === 'running') {
    stepRun(h.state.run, { direction: 'down' }, FIXED_DT);
    recordInput(h.state.recorder, { direction: 'down' });
  }
  assert.equal(h.state.run.status, 'won');
  const checkpoint = authoritativeCheckpoint(h.state.run),
    api = h.create();
  assert.match(api.source().reason, /earlier saved checkpoint/);
  const result = await api.prepare();
  assert.equal(result.source, 'stored');
  assert.equal(h.calls.snapshot, 0);
  assert.deepEqual(authoritativeCheckpoint(h.state.run), checkpoint);
});

test('stopped current recorder never falls back to an older valid slot', async () => {
  const h = harness({ current: true });
  h.state.recordingStopped = true;
  await assert.rejects(h.create().prepare(), /complete recording/);
  assert.equal(h.calls.stored + h.calls.snapshot, 0);
});

test('a retained handoff hold does not block current export or change that hold', async () => {
  const h = harness({ current: true });
  h.state.paused = true;
  h.state.courseEntryHold = true;
  const result = await h.create().prepare();
  assert.equal(result.source, 'current');
  assert.equal(h.state.courseEntryHold, true);
});

test('permitted current pause autosave is independent from the owned export snapshot', async () => {
  const h = harness({ current: true }),
    take = h.host.snapshotCurrent;
  h.host.snapshotCurrent = () => {
    const session = take();
    h.raw = JSON.stringify(session);
    return session;
  };
  const result = await h.create().prepare({
    onProgress: () => {
      h.raw = 'a later ordinary autosave';
    },
  });
  assert.equal(result.source, 'current');
  assert.deepEqual(result.session.replay, exportReplay(h.state.recorder, h.state.run));
  assert.equal(h.raw, 'a later ordinary autosave');
  assert.equal(h.calls.snapshot, 1);
});

test('absent, unreadable, malformed and oversized stored data remain distinct and untouched', async () => {
  for (const [value, pattern] of [
    [null, /No saved attempt/],
    [undefined, /unreadable/],
    ['', /valid JSON/],
    ['{', /valid JSON/],
    ['é'.repeat(SESSION_STORAGE_BYTES / 2 + 1), /byte budget/],
  ]) {
    const h = harness();
    h.raw = value;
    await assert.rejects(h.create().prepare(), pattern);
    assert.equal(h.raw, value);
    assert.equal(h.calls.snapshot, 0);
  }
  const h = harness();
  h.host.readStored = () => {
    throw new Error('SecurityError');
  };
  await assert.rejects(h.create().prepare(), /could not be read/);
});

test('backup markers and journals fail closed, including unavailable reads', async () => {
  for (const [name, value] of [
    ['marker', 'locked'],
    ['marker', undefined],
    ['journal', { corrupt: true }],
    ['journal', false],
    ['journal', undefined],
  ]) {
    const h = harness();
    h[name] = value;
    const raw = h.raw;
    await assert.rejects(h.create().prepare(), /backup|Backup/);
    assert.equal(h.raw, raw);
    assert.equal(h.calls.snapshot, 0);
  }
  for (const name of ['readBackupMarker', 'readJournal']) {
    const h = harness();
    h.host[name] = () => {
      throw new Error('unavailable');
    };
    await assert.rejects(h.create().prepare(), /could not be read/);
  }
});

test('lockless host performs all read rechecks without a writer or profile repair', async () => {
  const h = harness();
  h.state.library = null;
  h.host.withStorageLock = (work) => work();
  const result = await h.create().prepare();
  assert.equal(result.source, 'stored');
  assert.equal(h.calls.journal, 2);
  assert.equal(h.state.library, null);
  assert.equal(h.raw, JSON.stringify(h.saved));
});

test('missing exact context is explicit rescue; wrong available rules cannot downgrade', async () => {
  const h = harness();
  h.host.resolveCampaign = () => null;
  assert.equal((await h.create().prepare()).context, 'replay-only');
  for (const context of [{}, encounter, Promise.resolve(base)]) {
    h.host.resolveCampaign = () => context;
    await assert.rejects(h.create().prepare());
  }
});

for (const current of [false, true])
  test(`${current ? 'current' : 'stored'} rejects source/content/lifecycle changes during a real verification yield`, async () => {
    for (const [field, value] of [
      ['run', {}],
      ['recorder', {}],
      ['runId', 'new-run'],
      ['library', {}],
      ['packs', {}],
      ['started', !current],
      ['paused', false],
      ['practice', true],
      ['courseActive', true],
      ['courseEntry', {}],
      ['recordingStopped', true],
      ['contentBusy', true],
      ['sessionBusy', true],
      ['backupBusy', true],
      ['hidden', true],
      ['themeId', 'retro'],
      ['bodyId', 'retro-body'],
    ]) {
      const h = harness({ current });
      await assert.rejects(
        h.create().prepare({
          onProgress: () => {
            h.state[field] = value;
          },
        }),
        { name: 'AbortError' },
      );
    }
  });

test('same-object advance and recording-only edits reject without a second suspension', async () => {
  for (const alter of [
    (h) => {
      h.state.paused = false;
      stepRun(h.state.run, {}, FIXED_DT);
      recordInput(h.state.recorder, {});
      h.state.paused = true;
    },
    (h) => {
      h.state.recorder.releaseAfter = false;
    },
    (h) => {
      h.state.recorder.segments[0].input.pickup = !h.state.recorder.segments[0].input.pickup;
    },
  ]) {
    const h = harness({ current: true });
    let changed = false;
    await assert.rejects(
      h.create().prepare({
        onProgress: () => {
          if (!changed) {
            changed = true;
            alter(h);
          }
        },
      }),
    );
    assert.equal(h.calls.snapshot, 1);
  }
});

test('explicit invalidation catches a zero-tick resume/re-pause and invalidates returned results', async () => {
  const h = harness({ current: true }),
    api = h.create();
  await assert.rejects(
    api.prepare({
      onProgress: () => {
        h.state.paused = false;
        api.invalidate();
        h.state.paused = true;
      },
    }),
    { name: 'AbortError' },
  );
  const result = await api.prepare();
  result.assertCurrent();
  api.invalidate();
  assert.throws(result.assertCurrent, { name: 'AbortError' });
});

test('stored raw bytes and transaction state are rechecked after replay and immediately before publication', async () => {
  for (const change of ['raw', 'marker', 'journal']) {
    const h = harness();
    await assert.rejects(
      h.create().prepare({
        onProgress: ({ ticks, total }) => {
          if (ticks === total) h[change] = change === 'raw' ? h.raw + '\n' : 'new transaction';
        },
      }),
    );
  }
  for (const change of ['raw', 'marker']) {
    const h = harness(),
      result = await h.create().prepare();
    h[change] = change === 'raw' ? h.raw + '\n' : 'new transaction';
    assert.throws(result.assertCurrent);
  }
});

test('a marker appearing during an asynchronous journal read blocks even lockless capture', async () => {
  const h = harness(),
    pending = deferred();
  h.host.withStorageLock = (work) => work();
  h.host.readJournal = () => pending.promise;
  const result = h.create().prepare();
  await turn();
  h.marker = 'new-backup';
  pending.resolve(null);
  await assert.rejects(result, /backup/);
  assert.equal(h.calls.stored, 0);
});

test('cancellation releases the short lock while a late journal read remains harmless', async () => {
  const h = harness(),
    pending = deferred(),
    controller = new AbortController();
  h.host.readJournal = () => pending.promise;
  const result = h.create().prepare({ signal: controller.signal });
  await turn();
  assert.equal(h.calls.depth, 1);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  await turn();
  assert.equal(h.calls.depth, 0);
  pending.resolve(null);
  await turn();
  assert.equal(h.calls.stored, 0);
});

test('queued-lock cancellation cannot later snapshot or publish', async () => {
  const h = harness(),
    queued = deferred(),
    controller = new AbortController();
  h.host.withStorageLock = async (work, signal) => {
    await queued.promise;
    signal.throwIfAborted();
    return work();
  };
  const result = h.create().prepare({ signal: controller.signal });
  await turn();
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  queued.resolve();
  await turn();
  assert.equal(h.calls.stored + h.calls.journal, 0);
});

test('a newer prepare aborts the older operation and its late completion cannot invalidate the new result', async () => {
  const h = harness(),
    pending = deferred();
  let calls = 0;
  h.host.readJournal = () => (++calls === 1 ? pending.promise : null);
  const api = h.create(),
    first = api.prepare();
  await turn();
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const second = api.prepare();
  await rejected;
  const result = await second;
  pending.resolve(null);
  await turn();
  result.assertCurrent();
  assert.equal(result.source, 'stored');
});

for (const current of [false, true])
  test(`${current ? 'current' : 'stored'} final-progress abort and later external abort prevent publication`, async () => {
    const h = harness({ current }),
      api = h.create(),
      controller = new AbortController();
    await assert.rejects(
      api.prepare({
        signal: controller.signal,
        onProgress: ({ ticks, total }) => {
          if (ticks === total) controller.abort();
        },
      }),
      { name: 'AbortError' },
    );
    const second = new AbortController(),
      result = await api.prepare({ signal: second.signal });
    second.abort();
    assert.throws(result.assertCurrent, { name: 'AbortError' });
  });

test('current snapshot must synchronously pause and exactly describe the existing run/recording', async () => {
  for (const bad of ['promise', 'unpaused', 'identity', 'replacement', 'replay']) {
    const h = harness({ current: true }),
      take = h.host.snapshotCurrent;
    h.host.snapshotCurrent = () => {
      const session = take();
      if (bad === 'promise') return Promise.resolve(session);
      if (bad === 'unpaused') h.state.paused = false;
      if (bad === 'identity') session.runId = 'different';
      if (bad === 'replacement') h.state.run = flight().run;
      if (bad === 'replay') session.replay.summary.score++;
      return session;
    };
    await assert.rejects(h.create().prepare());
    assert.equal(h.calls.snapshot, 1);
  }
});

test('adapter/option accessors and unknown fields reject without invoking capabilities', async () => {
  const h = harness();
  let reads = 0;
  const config = { ...h.host };
  Object.defineProperty(config, 'getState', {
    enumerable: true,
    get() {
      reads++;
      return h.host.getState;
    },
  });
  assert.throws(() => createAttemptFilePreparer(config), /data fields/);
  assert.throws(() => createAttemptFilePreparer({ ...h.host, writeStored() {} }), /unsupported/);
  const api = h.create();
  const options = {
    get onProgress() {
      reads++;
      return () => {};
    },
  };
  for (const value of [null, options, { extra: true }, { signal: {} }, { onProgress: null }])
    await assert.rejects(api.prepare(value));
  assert.equal(reads, 0);
  assert.equal(h.calls.snapshot + h.calls.stored, 0);
});
