import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountAircraftArchiveControls } from '../../optional-practice/civilian-fpv/aircraft-archive-controls.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('shared archive file chooser stays visible when mounted directly in the Advanced arena', async () => {
  const css = await readFile(
    new URL('../../optional-practice/civilian-fpv/tuning.css', import.meta.url),
    'utf8',
  );
  assert.match(
    css,
    /\.aircraft-archive-controls input\[type=['"]file['"]\]\s*\{[^}]*display:\s*block/,
  );
});
function fixture(t, { verify, append } = {}) {
  const document = new Document(),
    window = new Events(),
    records = new Map(),
    calls = [];
  let generation = '0',
    sealed = -1,
    ticks = 0,
    locale = 'en',
    ids = 0,
    pauses = 0,
    reads = 0;
  const store = {
    async begin(spec) {
      calls.push(['begin', spec.id, spec.origin]);
      const row = {
        ...spec,
        revision: 0,
        state: 'open',
        startTick: spec.origin.startTick,
        endTick: spec.origin.startTick,
        finalHash: null,
        lastIndex: null,
      };
      records.set(row.id, row);
      return structuredClone(row);
    },
    async append(id, segment, options) {
      calls.push(['append', id, segment.index]);
      if (append) await append();
      const row = records.get(id);
      assert.equal(options.expectedRevision, row.revision);
      Object.assign(row, {
        revision: row.revision + 1,
        endTick: segment.endTick,
        lastIndex: segment.index,
        finalHash: segment.finalHash,
      });
      return structuredClone(row);
    },
    async finish(id, data, options) {
      const row = records.get(id);
      assert.equal(options.expectedRevision, row.revision);
      assert.equal(data.endTick, row.endTick);
      assert.equal(data.finalHash, row.finalHash);
      calls.push(['finish', id, data.reason]);
      row.state = data.reason;
      row.revision++;
      return structuredClone(row);
    },
    async list() {
      return [...records.values()].map((row) => structuredClone(row));
    },
    async exportPackage(id) {
      return { manifest: structuredClone(records.get(id)) };
    },
    async delete(id) {
      records.delete(id);
    },
    close() {},
  };
  const session = {
    async readSealedSegment(after) {
      reads++;
      return {
        generation,
        identity: '1234567890abcdef',
        config: {},
        origin: {
          kind: generation === '0' ? 'fresh' : 'checkpoint',
          startTick: generation === '0' ? 0 : 500,
        },
        latestTick: ticks,
        earliestIndex: 0,
        lastSealedIndex: sealed,
        gap: false,
        segment:
          after < sealed
            ? { index: after + 1, endTick: (after + 2) * 50, finalHash: '12345678' }
            : null,
      };
    },
    async finalizeArchive() {
      assert.ok(pauses > 0);
      sealed++;
      return { generation, finalizedThroughIndex: sealed };
    },
  };
  window.confirm = () => true;
  const ui = mountAircraftArchiveControls({
    parent: document.body,
    window,
    locale: () => locale,
    getSession: () => session,
    store,
    makeId: () => `archive-${++ids}`,
    onPause: () => pauses++,
    verify: verify ?? (async () => ({ verificationScope: 'complete-session' })),
    exportFile: async () => ({ status: 'requested' }),
  });
  const update = () =>
    ui.update({
      ticks,
      advancedTelemetry: {
        archiveStatus: {
          generation,
          lastSealedIndex: sealed,
          latestTick: ticks,
        },
      },
    });
  t.after(() => ui.dispose());
  return {
    ui,
    calls,
    records,
    update,
    get reads() {
      return reads;
    },
    button: (text) => ui.root.querySelectorAll('button').find((node) => node.textContent === text),
    setGeneration: (value) => {
      generation = value;
      sealed = -1;
    },
    setSealed: (value) => {
      sealed = value;
      ticks = (sealed + 1) * 50;
    },
    setLocale: (value) => {
      locale = value;
    },
  };
}

test('archive capture waits for prepared worker telemetry before requesting a segment', async (t) => {
  const f = fixture(t);
  f.ui.update({ ticks: 0 });
  await settle();
  assert.equal(f.reads, 0);
  assert.equal(f.ui.root.hidden, true);
  f.ui.update({
    ticks: 0,
    reason: 'preparing-aircraft',
    advancedTelemetry: {
      archiveStatus: { generation: '0', lastSealedIndex: -1, latestTick: 0 },
    },
  });
  await settle();
  assert.equal(f.reads, 0, 'initial telemetry alone does not mean terrain preparation is complete');
  f.update();
  await settle();
  assert.equal(f.ui.root.hidden, false);
  assert.ok(f.reads > 0);
});

test('archive verification distinguishes challenge outcomes from physics-only clip verification', async (t) => {
  for (const [challenge, expected] of [
    [{ verified: true, scored: false }, /Challenge outcome independently verified/],
    [
      { verified: false, reason: 'incomplete-challenge', scored: false },
      /not completed in this archive/,
    ],
    [
      { verified: false, reason: 'checkpoint-origin', scored: false },
      /cannot be verified from this clip/,
    ],
  ]) {
    const f = fixture(t, {
      verify: async () => ({ verificationScope: 'checkpoint-clip', challenge }),
    });
    f.update();
    await settle();
    f.setSealed(0);
    f.update();
    await settle();
    f.button('Finish current archive').click();
    await settle();
    f.button('Verify selected archive').click();
    await settle();
    assert.match(f.ui.root.textContent, /Clip physics verified/);
    assert.match(f.ui.root.textContent, expected);
    assert.match(f.ui.root.textContent, /Unscored/);
  }
});

test('archive controls save closed segments, capture the paused final tail and verify complete physics explicitly', async (t) => {
  const f = fixture(t);
  f.update();
  await settle();
  assert.equal(f.calls.filter(([kind]) => kind === 'begin').length, 1);
  f.setSealed(0);
  f.update();
  await settle();
  assert.match(f.ui.root.textContent, /Saved through 0:01/);
  f.button('Finish current archive').emit('click');
  await settle();
  assert.deepEqual(
    f.calls.filter(([kind]) => kind === 'append').map((entry) => entry[2]),
    [0, 1],
  );
  assert.equal(f.records.get('archive-1').state, 'ended');
  f.button('Verify selected archive').emit('click');
  await settle();
  assert.match(f.ui.root.textContent, /Complete session physics verified from reset. Unscored/);
  const count = f.reads;
  f.setSealed(3);
  f.update();
  await settle();
  assert.equal(f.reads, count, 'finishing an archive does not silently start another');
});

test('quota failure stops only archives, retains the durable point and does not retry on every paint', async (t) => {
  const f = fixture(t, {
    append: async () => {
      throw new Error('quota');
    },
  });
  f.update();
  await settle();
  f.setSealed(0);
  f.update();
  await settle();
  assert.match(
    f.ui.root.textContent,
    /Archive stopped; flying continues.*Saved through 0:00.*quota/,
  );
  const count = f.reads;
  for (let i = 0; i < 50; i++) f.update();
  await settle();
  assert.equal(f.reads, count);
  assert.equal(f.records.get('archive-1').endTick, 0);
});

test('pending segment writes remain bounded and the final write uses the durable revision', async (t) => {
  let release,
    pending = 0,
    largest = 0;
  const f = fixture(t, {
    append: async () => {
      largest = Math.max(largest, ++pending);
      await new Promise((resolve) => {
        release = resolve;
      });
      pending--;
    },
  });
  f.update();
  await settle();
  f.setSealed(0);
  f.update();
  await settle();
  for (let i = 0; i < 100; i++) f.update();
  assert.equal(largest, 1);
  release();
  await settle();
  assert.equal(f.records.get('archive-1').endTick, 50);
});

test('recovery generation closes the previous archive and creates an independent checkpoint-origin archive', async (t) => {
  const f = fixture(t);
  f.update();
  await settle();
  f.setSealed(0);
  f.update();
  await settle();
  f.setGeneration('restored-1');
  f.update();
  await settle();
  assert.equal(f.records.get('archive-1').state, 'interrupted');
  assert.deepEqual(f.records.get('archive-2').origin, { kind: 'checkpoint', startTick: 500 });
});

test('verification cancellation has no flight mutation and checkpoint clips are labeled without whole-session claims', async (t) => {
  let signal;
  const f = fixture(t, {
    verify: async (_packet, options) => {
      signal = options.signal;
      await new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError'))),
      );
    },
  });
  f.update();
  await settle();
  f.setSealed(0);
  f.update();
  await settle();
  f.button('Finish current archive').emit('click');
  await settle();
  f.button('Verify selected archive').emit('click');
  await settle();
  f.button('Cancel archive operation').emit('click');
  await settle();
  assert.equal(signal.aborted, true);
  assert.match(f.ui.root.textContent, /Archive operation cancelled/);
  assert.equal(f.records.get('archive-1').state, 'ended');
  f.setLocale('uk');
  f.update();
  assert.ok(f.button('Експортувати вибраний архів'));
  assert.match(f.ui.root.textContent, /Усі архіви дронів без заліку/);
});
