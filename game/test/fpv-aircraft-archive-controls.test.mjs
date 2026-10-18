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
function fixture(t, { verify, begin, append, list, remove, key = 'academy' } = {}) {
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
      if (begin) await begin();
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
    async list(options) {
      if (list) await list(options);
      return [...records.values()].map((row) => structuredClone(row));
    },
    async exportPackage(id) {
      return { manifest: structuredClone(records.get(id)) };
    },
    async delete(id) {
      calls.push(['delete', id]);
      if (remove) await remove(id);
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
  let activeSession = session;
  window.confirm = () => true;
  const ui = mountAircraftArchiveControls({
    parent: document.body,
    key,
    window,
    locale: () => locale,
    getSession: () => activeSession,
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
      ticks = generation === '0' ? 0 : 500;
    },
    setTicks: (value) => {
      ticks = value;
    },
    replaceSession: () => {
      activeSession = { ...session };
      generation = '0';
      sealed = -1;
      ticks = 0;
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
  assert.equal(f.records.size, 0);
});

test('preparing and replacing paused aircraft never consumes archive capacity', async (t) => {
  const f = fixture(t);
  for (let i = 0; i < 20; i++) {
    f.replaceSession();
    f.update();
    await settle();
    assert.equal(f.records.size, 0);
    assert.equal(f.button('Finish current archive').disabled, true);
  }
  assert.equal(f.calls.length, 0, 'no empty manifest is persisted or retired');
  assert.match(f.ui.root.textContent, /Ready to archive when flight begins/);
  const reads = f.reads;
  for (let i = 0; i < 50; i++) f.update();
  await settle();
  assert.equal(f.reads, reads, 'waiting at the same accepted tick does not poll the worker again');
  f.setLocale('uk');
  f.update();
  assert.match(f.ui.root.textContent, /Готово до архівування після початку польоту/);
});

test('first accepted flight progress opens an archive before segment rotation so short flights can finish', async (t) => {
  const f = fixture(t);
  f.update();
  await settle();
  f.setTicks(1);
  f.update();
  await settle();
  assert.deepEqual(f.calls, [['begin', 'archive-1', { kind: 'fresh', startTick: 0 }]]);
  assert.equal(f.button('Finish current archive').disabled, false);
  f.button('Finish current archive').click();
  await settle();
  assert.deepEqual(
    f.calls.map(([kind]) => kind),
    ['begin', 'append', 'finish'],
  );
  assert.equal(f.records.get('archive-1').state, 'ended');
});

test('refreshing saved sessions replaces preparation feedback with success in both languages', async (t) => {
  const f = fixture(t);
  f.update();
  await settle();
  for (const [language, button, success] of [
    ['en', 'Refresh saved sessions', 'Saved sessions refreshed.'],
    ['uk', 'Оновити збережені сесії', 'Список збережених сесій оновлено.'],
  ]) {
    f.setLocale(language);
    f.update();
    f.button(button).click();
    await settle();
    assert.ok(f.ui.root.textContent.includes(success));
    assert.doesNotMatch(f.ui.root.textContent, /Preparing…|Підготовка…/);
    assert.equal(f.button(button).disabled, false);
    assert.equal(f.records.size, 0, 'refreshing an empty library creates no archive');
  }
  f.setTicks(1);
  f.update();
  await settle();
  const before = structuredClone([...f.records.values()]);
  f.button('Оновити збережені сесії').click();
  await settle();
  assert.match(f.ui.root.textContent, /Список збережених сесій оновлено/);
  assert.equal(f.ui.root.querySelector('select').children.length, 1);
  assert.deepEqual([...f.records.values()], before, 'refreshing changes only the displayed list');
});

const savedRow = (id) => ({
  id,
  name: id,
  host: 'world',
  revision: 1,
  startTick: 0,
  endTick: 50,
  state: 'ended',
});

test('an initial archive-list failure is visible and retries only through explicit refresh', async (t) => {
  for (const [language, refresh, failure, success] of [
    [
      'en',
      'Refresh saved sessions',
      /Could not load saved sessions.*list may be incomplete/,
      /Saved sessions refreshed/,
    ],
    [
      'uk',
      'Оновити збережені сесії',
      /Не вдалося завантажити збережені сесії.*список може бути неповним/,
      /Список збережених сесій оновлено/,
    ],
  ]) {
    let fail = true,
      reads = 0;
    const f = fixture(t, {
      list: async () => {
        reads++;
        if (fail) throw new Error('database connection is closing');
      },
    });
    f.setLocale(language);
    f.records.set('kept', savedRow('kept'));
    f.update();
    await settle();
    assert.match(f.ui.root.textContent, failure);
    assert.match(f.ui.root.textContent, /database connection is closing/);
    assert.equal(f.ui.root.querySelector('select').children.length, 0);
    assert.equal(f.records.size, 1);
    for (let i = 0; i < 20; i++) f.update();
    await settle();
    assert.equal(reads, 1, 'painting does not retry the failed read');
    assert.deepEqual(f.calls, [], 'inventory failure does not write or delete archives');
    fail = false;
    f.button(refresh).click();
    await settle();
    assert.equal(reads, 2);
    assert.equal(f.ui.root.querySelector('select').children.length, 1);
    assert.match(f.ui.root.textContent, success);
    assert.doesNotMatch(f.ui.root.textContent, /database connection is closing/);
  }
});

test('a committed archive deletion is distinguished from a failed inventory refresh in both languages', async (t) => {
  for (const [language, button, receipt, refresh] of [
    [
      'en',
      'Delete selected local archive',
      /Selected local archive deleted.*Could not refresh the remaining sessions.*current status is unknown/,
      'Refresh saved sessions',
    ],
    [
      'uk',
      'Видалити вибраний локальний архів',
      /Вибраний локальний архів видалено.*Не вдалося оновити решту сесій.*поточний стан невідомий/,
      'Оновити збережені сесії',
    ],
  ]) {
    let fail = false,
      reads = 0;
    const f = fixture(t, {
      list: async () => {
        reads++;
        if (fail) throw new Error('database connection is closing');
      },
      remove: async () => {
        fail = true;
      },
    });
    f.setLocale(language);
    f.records.set('selected', savedRow('selected'));
    f.records.set('protected', savedRow('protected'));
    f.update();
    await settle();
    f.ui.root.querySelector('select').value = 'selected';
    f.button(button).click();
    await settle();
    assert.match(f.ui.root.textContent, receipt);
    assert.doesNotMatch(f.ui.root.textContent, /Could not complete|Не вдалося завершити/);
    assert.deepEqual([...f.records.keys()], ['protected']);
    assert.deepEqual(
      f.ui.root.querySelector('select').children.map((row) => row.value),
      ['protected'],
    );
    for (let i = 0; i < 20; i++) f.update();
    await settle();
    assert.equal(reads, 2, 'a failed post-commit refresh is not retried automatically');
    assert.deepEqual(f.calls, [['delete', 'selected']]);
    fail = false;
    f.button(refresh).click();
    await settle();
    assert.equal(reads, 3);
    assert.deepEqual(f.calls, [['delete', 'selected']], 'refresh never repeats the deletion');
    assert.doesNotMatch(f.ui.root.textContent, /database connection is closing/);
  }
});

test('a failed archive deletion does not claim success or remove its cached row', async (t) => {
  const f = fixture(t, {
    remove: async () => {
      throw new Error('delete transaction failed');
    },
  });
  f.records.set('selected', savedRow('selected'));
  f.records.set('protected', savedRow('protected'));
  f.update();
  await settle();
  f.ui.root.querySelector('select').value = 'selected';
  f.button('Delete selected local archive').click();
  await settle();
  assert.match(f.ui.root.textContent, /Could not complete.*delete transaction failed/);
  assert.doesNotMatch(f.ui.root.textContent, /archive deleted/);
  assert.deepEqual([...f.records.keys()], ['selected', 'protected']);
  assert.equal(f.ui.root.querySelector('select').children.length, 2);
  assert.deepEqual(f.calls, [['delete', 'selected']]);
});

test('cancelling the inventory refresh after deletion preserves the committed receipt', async (t) => {
  let deleted = false;
  const f = fixture(t, {
    remove: async () => {
      deleted = true;
    },
    list: async ({ signal }) => {
      if (deleted)
        await new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('cancelled', 'AbortError')),
          ),
        );
    },
  });
  f.records.set('selected', savedRow('selected'));
  f.records.set('protected', savedRow('protected'));
  f.update();
  await settle();
  f.ui.root.querySelector('select').value = 'selected';
  f.button('Delete selected local archive').click();
  await settle();
  f.button('Cancel archive operation').click();
  await settle();
  assert.match(
    f.ui.root.textContent,
    /Selected local archive deleted.*Refreshing saved sessions was cancelled/,
  );
  assert.doesNotMatch(f.ui.root.textContent, /Archive operation cancelled/);
  assert.deepEqual([...f.records.keys()], ['protected']);
  assert.deepEqual(f.calls, [['delete', 'selected']]);
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
  assert.equal(f.calls.filter(([kind]) => kind === 'begin').length, 0);
  f.setSealed(0);
  f.update();
  await settle();
  assert.equal(f.calls.filter(([kind]) => kind === 'begin').length, 1);
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

test('a full archive store is not consulted until flight begins and cannot stop flight progress', async (t) => {
  const f = fixture(t, {
    begin: async () => {
      throw new Error('Archive storage is full');
    },
  });
  f.update();
  await settle();
  assert.equal(f.calls.length, 0);
  assert.doesNotMatch(f.ui.root.textContent, /Archive stopped/);
  f.setTicks(1);
  f.update();
  await settle();
  assert.match(f.ui.root.textContent, /Archive stopped; flying continues.*storage is full/);
  const reads = f.reads;
  for (let tick = 2; tick < 100; tick++) {
    f.setTicks(tick);
    f.update();
  }
  await settle();
  assert.equal(f.calls.length, 1, 'quota failure does not queue repeated writes');
  assert.equal(f.reads, reads);
  assert.equal(f.records.size, 0);
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
  assert.equal(f.records.size, 1, 'restoring at tick500 alone does not create another archive');
  f.setTicks(501);
  f.update();
  await settle();
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

test('archive names identify the real host in English and Ukrainian', async (t) => {
  for (const [key, en, uk] of [
    ['academy', 'Academy', 'Академія'],
    ['world', 'World', 'Світ'],
    ['arena', 'Advanced practice', 'Розширена практика'],
  ]) {
    for (const [language, name] of [
      ['en', en],
      ['uk', uk],
    ]) {
      const f = fixture(t, { key });
      f.setLocale(language);
      f.setTicks(1);
      f.update();
      await settle();
      const record = [...f.records.values()][0];
      assert.equal(record.host, key);
      assert.ok(record.name.startsWith(`${name} · `));
    }
  }
});
