import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountAircraftArchiveControls } from '../../optional-practice/civilian-fpv/aircraft-archive-controls.mjs';
import { mountPracticeSplits } from '../../optional-practice/civilian-fpv/flight-sectors.mjs';
import {
  aircraftCourseComparisonEligibility,
  verifyAircraftCourseArchive,
  verifyAircraftCourseArchiveInWorker,
} from '../../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { BEGINNER_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { createFlight } from '../../optional-practice/civilian-fpv/model.mjs';
import {
  createWorldFlight,
  validateWorldCourse,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
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
function fixture(
  t,
  {
    verify,
    verifyCourse,
    course,
    referenceIdentity,
    onReference,
    hasSplitReference,
    onVisualReference,
    hasVisualReference,
    begin,
    append,
    list,
    remove,
    archivePackage,
    Worker,
    workerURL,
    key = 'academy',
  } = {},
) {
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
      if (archivePackage) return structuredClone(archivePackage);
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
    referenceIdentity: () => referenceIdentity,
    ...(course ? { course: () => course } : {}),
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
  if (Worker) window.Worker = Worker;
  const ui = mountAircraftArchiveControls({
    parent: document.body,
    key,
    window,
    workerURL,
    locale: () => locale,
    getSession: () => activeSession,
    store,
    makeId: () => `archive-${++ids}`,
    onPause: () => pauses++,
    ...(onReference ? { onReference } : {}),
    ...(hasSplitReference ? { hasSplitReference } : {}),
    ...(onVisualReference ? { onVisualReference } : {}),
    ...(hasVisualReference ? { hasVisualReference } : {}),
    verify: verify ?? (async () => ({ verificationScope: 'complete-session' })),
    ...(verifyCourse ? { verifyCourse } : {}),
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
    session,
    calls,
    records,
    update,
    get reads() {
      return reads;
    },
    get pauses() {
      return pauses;
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

for (const known of [true, false])
  test(`archive stopped reason ${known ? 'localizes controlled capacity text' : 'preserves unknown diagnostics'} without retrying storage`, async (t) => {
    const message = known
      ? 'Aircraft archive storage is full; delete an archive to make space'
      : 'IDB connection closing <raw diagnostic>';
    const f = fixture(t, {
      begin: async () => {
        throw new Error(message);
      },
    });
    f.setTicks(1);
    f.update();
    await settle();
    assert.match(f.ui.root.textContent, /Archive stopped; flying continues/);
    assert.ok(f.ui.root.textContent.includes(message));
    const before = structuredClone(f.calls),
      reads = f.reads;
    for (const language of ['uk', 'en']) {
      f.setLocale(language);
      f.update();
      await settle();
      const expected =
        known && language === 'uk'
          ? 'Сховище архівів заповнене; видаліть архів, щоб звільнити місце'
          : message;
      assert.ok(f.ui.root.textContent.includes(expected), `${language}: ${expected}`);
      if (known && language === 'uk') assert.ok(!f.ui.root.textContent.includes(message));
      assert.deepEqual(f.calls, before, 'locale changes never retry the uncertain archive write');
      assert.equal(f.reads, reads);
      assert.equal(f.records.size, 0);
    }
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

const verificationCourse = () => ({
  id: 'frozen-intro',
  locales: { en: { title: 'Frozen intro' }, uk: { title: 'Початковий курс' } },
});
const courseVerified = () => ({
  scored: false,
  physics: { verified: true, verificationScope: 'complete-session' },
  course: { verified: true, completedAtTick: 301, missionHz: 50, splits: [] },
});
async function prepareCourseArchive(f) {
  f.records.set('recorded-flight', {
    ...savedRow('recorded-flight'),
    config: { response: { mode: 'acro' }, aircraft: { id: 'recorded-meteor75' } },
  });
  f.update();
  await settle();
}

test('course verification freezes the source course and uses the selected archive settings without writes', async (t) => {
  const course = verificationCourse();
  let received;
  const f = fixture(t, {
    course,
    verifyCourse: async (packet, frozen, options) => {
      assert.equal(f.pauses, 1);
      received = frozen;
      assert.notEqual(frozen, course);
      assert.equal(packet.manifest.config.aircraft.id, 'recorded-meteor75');
      assert.equal(packet.manifest.config.response.mode, 'acro');
      options.onProgress({ phase: 'course' });
      assert.match(f.ui.root.textContent, /Checking recorded course objectives/);
      return courseVerified();
    },
  });
  await prepareCourseArchive(f);
  const before = structuredClone([...f.records]);
  f.button('Verify course completion').click();
  course.locales.en.title = 'Changed after click';
  await settle();
  assert.equal(received.locales.en.title, 'Frozen intro');
  assert.match(
    f.ui.root.textContent,
    /recorded-flight · Frozen intro · Acro.*Recorded course completion verified: 6.02 s.*Unscored.*current flight is unchanged/,
  );
  assert.deepEqual([...f.records], before);
  assert.deepEqual(f.calls, []);
});

test('completed course feedback translates without repeating verification or live-region writes', async (t) => {
  let verifies = 0;
  const f = fixture(t, {
    course: verificationCourse(),
    verifyCourse: async () => {
      verifies++;
      return courseVerified();
    },
  });
  await prepareCourseArchive(f);
  f.button('Verify course completion').click();
  await settle();
  const result = f.ui.root
    .querySelectorAll('p')
    .find((node) => node.textContent.includes('Recorded course completion verified'));
  let text = result.textContent,
    writes = 0;
  Object.defineProperty(result, 'textContent', {
    configurable: true,
    get: () => text,
    set: (value) => {
      text = value;
      writes++;
    },
  });
  for (let i = 0; i < 50; i++) f.update();
  assert.equal(writes, 0);
  f.setLocale('uk');
  f.update();
  assert.match(text, /Початковий курс.*Завершення курсу в записі перевірено: 6.02 с.*Без заліку/);
  assert.match(f.ui.root.querySelector('select').textContent, /завершено/);
  assert.equal(f.ui.root.querySelector('select').value, 'recorded-flight');
  assert.equal(writes, 1);
  f.setLocale('en');
  f.update();
  assert.match(text, /Frozen intro.*Recorded course completion verified/);
  assert.equal(verifies, 1);
  assert.deepEqual(f.calls, []);
});

for (const [reason, en, uk] of [
  ['incomplete-course', /course was not completed/, /Курс не завершено/],
  ['course-needs-complete-reset-session', /archive is a clip/, /архів є фрагментом/],
  ['course-identity-mismatch', /different course or revision/, /іншого курсу або його версії/],
  [
    'unsupported-dynamic-course',
    /Unsupported course or recording: unsupported-dynamic-course/,
    /Непідтримуваний курс або запис: unsupported-dynamic-course/,
  ],
])
  test(`course verification reports ${reason} separately from successful physics`, async (t) => {
    const f = fixture(t, {
      course: verificationCourse(),
      verifyCourse: async () => ({ ...courseVerified(), course: { verified: false, reason } }),
    });
    await prepareCourseArchive(f);
    f.button('Verify course completion').click();
    await settle();
    assert.match(
      f.ui.root.textContent,
      /Recorded physics verified. Course completion not verified/,
    );
    assert.match(f.ui.root.textContent, en);
    f.setLocale('uk');
    f.update();
    assert.match(f.ui.root.textContent, uk);
    assert.doesNotMatch(f.ui.root.textContent, /Завершення курсу в записі перевірено/);
  });

test('Regional and other hosts without a frozen course retain physics-only verification', async (t) => {
  let checks = 0;
  const f = fixture(t, {
    key: 'regional',
    verify: async () => {
      checks++;
      return { verificationScope: 'complete-session' };
    },
  });
  await prepareCourseArchive(f);
  assert.equal(f.button('Verify course completion').disabled, true);
  assert.match(
    f.ui.root.textContent,
    /Course completion checks are available in Academy and World/,
  );
  assert.equal(f.button('Verify selected archive').disabled, false);
  f.button('Verify selected archive').click();
  await settle();
  assert.equal(checks, 1);
  assert.match(f.ui.root.textContent, /Complete session physics verified/);
});

for (const change of ['replace', 'restore', 'selection', 'dispose'])
  test(`course verification ignores late progress and results after ${change}`, async (t) => {
    let options, release;
    const f = fixture(t, {
      course: verificationCourse(),
      verifyCourse: async (_packet, _course, o) => {
        options = o;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    await prepareCourseArchive(f);
    f.button('Verify course completion').click();
    await settle();
    if (change === 'replace') {
      f.replaceSession();
      f.update();
    }
    if (change === 'restore') {
      f.setGeneration('restored-same-owner');
      f.update();
    }
    if (change === 'selection') {
      const select = f.ui.root.querySelector('select');
      select.value = 'different-archive';
      select.emit('change');
    }
    if (change === 'dispose') f.ui.dispose();
    assert.equal(options.signal.aborted, true);
    const before = f.ui.root.textContent;
    options.onProgress({ phase: 'course' });
    assert.equal(f.ui.root.textContent, before);
    release(courseVerified());
    await settle();
    assert.doesNotMatch(
      f.ui.root.textContent,
      /Recorded course completion verified|Course verification cancelled|Could not verify course/,
    );
    assert.deepEqual(f.calls, []);
  });

test('explicit cancellation terminates a course job and keeps its result correctly scoped and translatable', async (t) => {
  let signal;
  const f = fixture(t, {
    course: verificationCourse(),
    verifyCourse: async (_packet, _course, options) => {
      signal = options.signal;
      await new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError'))),
      );
    },
  });
  await prepareCourseArchive(f);
  f.button('Verify course completion').click();
  await settle();
  f.button('Cancel archive operation').click();
  await settle();
  assert.equal(signal.aborted, true);
  assert.match(f.ui.root.textContent, /recorded-flight.*Course verification cancelled/);
  f.setLocale('uk');
  f.update();
  assert.match(f.ui.root.textContent, /Перевірку курсу скасовано/);
  assert.equal(f.button('Перевірити завершення курсу').disabled, false);
  assert.deepEqual(f.calls, []);
});

// Short synthetic hold courses exercise real recording and canonical proof.
// Their success does not qualify an authored lesson or measured aircraft behavior.
await initAdvancedRuntime();
async function recordedReference(family) {
  const course = structuredClone(
    family === 'world' ? BEGINNER_CATALOGUE[0].course : FLIGHT_COURSES[0],
  );
  for (const mode of ['acro', 'self-level']) {
    const hold = structuredClone(course.steps[mode].find((step) => step.type === 'hold'));
    Object.assign(hold, {
      min: { x: -10000, y: -1000, z: -10000 },
      max: { x: 10000, y: 8000, z: 10000 },
      ticks: 3,
    });
    course.steps[mode] = [hold];
  }
  const preset = createPresetConfiguration('meteor75-analog-2022');
  let simulation;
  const session = createAircraftCourseSession(
    {
      course,
      mode: 'acro',
      legacy: family === 'academy',
      configuration: {
        response: preset.response,
        advanced: { aircraft: preset.aircraft, controller: preset.controller },
      },
    },
    {
      createMission: family === 'academy' ? createFlight : createWorldFlight,
      createClient: () => ({
        async initialize(config) {
          simulation = createAdvancedSimulation(config);
          return { telemetry: simulation.telemetry(), comparison: simulation.comparison() };
        },
        async stageTerrainFrame(frame) {
          return simulation.stageTerrainFrame(frame);
        },
        async commitTerrainFrame(value) {
          return simulation.commitTerrainFrame(value);
        },
        async step(sample, motions) {
          simulation.enqueueInput(sample);
          return simulation.stepMission({ motions });
        },
        dispose() {
          simulation?.dispose();
        },
      }),
    },
  );
  try {
    await session.prepare();
    const initial = simulation.readSealedSegment();
    session.arm();
    for (let i = 0; i < 8; i++) await session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    assert.equal(session.snapshot().step, 1);
    const { segment } = simulation.finalizeArchive(),
      size = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
    return {
      course,
      referenceIdentity: session.referenceIdentity(),
      packet: {
        format: 'AircraftArchivePackage.v1',
        manifest: {
          format: 'AircraftSessionArchive.v1',
          id: 'recorded-flight',
          host: family,
          name: 'Synthetic reference boundary',
          createdAt: 0,
          revision: 2,
          identity: initial.identity,
          config: initial.config,
          origin: initial.origin,
          state: 'ended',
          firstIndex: 0,
          lastIndex: 0,
          startTick: 0,
          endTick: segment.endTick,
          segmentCount: 1,
          payloadBytes: size(initial.config) + size(segment),
          finalHash: segment.finalHash,
          scored: false,
        },
        segments: [segment],
      },
    };
  } finally {
    await session.dispose();
  }
}
const referenceFixtures = {
  academy: await recordedReference('academy'),
  world: await recordedReference('world'),
};
const ownedReference = await verifyAircraftCourseArchive(
  referenceFixtures.academy.packet,
  referenceFixtures.academy.course,
  { collectReference: true },
);
assert.equal(aircraftCourseComparisonEligibility(ownedReference, ownedReference).eligible, true);
const referenceIdentity = ownedReference.course.referenceIdentity;
const referenceReport = () => ownedReference;
test('only owned compatible completed proof offers an explicit copied unscored split reference', async (t) => {
  const applied = [],
    report = referenceReport();
  const f = fixture(t, {
    course: referenceFixtures.academy.course,
    archivePackage: referenceFixtures.academy.packet,
    referenceIdentity,
    verifyCourse: async () => report,
    onReference: (session, value) => {
      applied.push({ session, value });
      return true;
    },
  });
  await prepareCourseArchive(f);
  assert.equal(f.button('Use as split reference').hidden, true);
  f.button('Use as split reference').emit('click');
  assert.equal(applied.length, 0, 'unverified imported data has no reference authority');
  f.button('Verify course completion').click();
  await settle();
  assert.equal(applied.length, 0, 'verification never selects automatically');
  assert.equal(f.button('Use as split reference').disabled, false);
  const writes = f.calls.slice();
  f.button('Use as split reference').click();
  assert.equal(applied.length, 1);
  assert.equal(applied[0].value.name, 'recorded-flight');
  assert.deepEqual(applied[0].value.rows, report.course.splits);
  assert.notEqual(applied[0].value.rows, report.course.splits);
  assert.throws(() => {
    report.course.splits[0].ticks = 1;
  }, TypeError);
  applied[0].value.rows[0].ticks = 1;
  assert.equal(report.course.splits[0].ticks, 3, 'The consumer receives an independent row copy');
  f.update();
  assert.equal(applied.length, 1, 'ordinary paused/live paints retain the selection');
  f.setLocale('uk');
  f.update();
  assert.equal(f.button('Прибрати орієнтир часу').disabled, false);
  assert.match(f.ui.root.textContent, /Сумісний орієнтир часу/);
  f.button('Прибрати орієнтир часу').click();
  assert.equal(applied.at(-1).value, null);
  assert.deepEqual(f.calls, writes, 'selection and clearing never write archives or flight state');
});
for (const mismatch of [
  'configurationClass',
  'terrainIdentity',
  'unprepared',
  'clip',
  'incomplete',
  'frequency',
  'missing-proof',
]) {
  test(`split reference rejects ${mismatch}`, async (t) => {
    const report = ['configurationClass', 'terrainIdentity', 'unprepared'].includes(mismatch)
        ? referenceReport()
        : structuredClone(referenceReport()),
      identity = { ...referenceIdentity };
    let calls = 0;
    if (mismatch in identity) identity[mismatch] = 'ffffffffffffffff';
    if (mismatch === 'clip') report.physics.verificationScope = 'checkpoint';
    if (mismatch === 'incomplete') report.course.verified = false;
    if (mismatch === 'frequency') report.course.missionHz = 100;
    if (mismatch === 'missing-proof') delete report.physics;
    const f = fixture(t, {
      course: referenceFixtures.academy.course,
      archivePackage: referenceFixtures.academy.packet,
      referenceIdentity: mismatch === 'unprepared' ? null : identity,
      verifyCourse: async () => report,
      onReference: () => {
        calls++;
        return true;
      },
    });
    await prepareCourseArchive(f);
    f.button('Verify course completion').click();
    await settle();
    assert.equal(f.button('Use as split reference').disabled, true);
    f.button('Use as split reference').emit('click');
    assert.equal(calls, 0);
  });
}
for (const change of ['selection', 'recovery', 'owner', 'verification', 'disposal']) {
  test(`selected reference is cleared on ${change}`, async (t) => {
    const applied = [];
    const f = fixture(t, {
      course: referenceFixtures.academy.course,
      archivePackage: referenceFixtures.academy.packet,
      referenceIdentity,
      verifyCourse: async () => referenceReport(),
      onReference: (session, value) => {
        applied.push({ session, value });
        return true;
      },
    });
    await prepareCourseArchive(f);
    f.button('Verify course completion').click();
    await settle();
    f.button('Use as split reference').click();
    if (change === 'selection') {
      const select = f.ui.root.querySelector('select');
      select.value = '';
      select.emit('change');
    }
    if (change === 'recovery') {
      f.setGeneration('1');
      f.update();
    }
    if (change === 'owner') {
      f.replaceSession();
      f.update();
    }
    if (change === 'verification') f.button('Verify course completion').click();
    if (change === 'disposal') f.ui.dispose();
    await settle();
    assert.equal(applied.length, 2);
    assert.equal(applied[1].value, null);
    assert.equal(applied[1].session, applied[0].session);
  });
}
test('reference presentation failures neither select nor escape into flight updates', async (t) => {
  const f = fixture(t, {
    course: referenceFixtures.academy.course,
    archivePackage: referenceFixtures.academy.packet,
    referenceIdentity,
    verifyCourse: async () => referenceReport(),
    onReference: () => {
      throw new Error('panel unavailable');
    },
  });
  await prepareCourseArchive(f);
  f.button('Verify course completion').click();
  await settle();
  assert.doesNotThrow(() => f.button('Use as split reference').click());
  assert.ok(f.button('Use as split reference'));
});

const visualReport = referenceReport;

for (const copy of ['plain', 'JSON'])
  test(`unowned ${copy} course reports cannot enable either reference control`, async (t) => {
    const report =
      copy === 'JSON'
        ? JSON.parse(JSON.stringify(ownedReference))
        : structuredClone(ownedReference);
    let selected = 0;
    const f = fixture(t, {
      course: referenceFixtures.academy.course,
      archivePackage: referenceFixtures.academy.packet,
      referenceIdentity,
      verifyCourse: async () => report,
      onReference: () => {
        selected++;
        return true;
      },
      onVisualReference: () => {
        selected++;
        return true;
      },
    });
    await prepareCourseArchive(f);
    f.button('Verify course completion').click();
    await settle();
    for (const label of ['Use as split reference', 'Show reference aircraft']) {
      assert.equal(f.button(label).disabled, true);
      f.button(label).emit('click');
    }
    assert.equal(selected, 0);
    assert.deepEqual(f.calls, []);
  });

class ProofWorker {
  static instances = [];
  constructor(url) {
    this.listeners = new Map();
    this.messages = [];
    this.terminated = false;
    this.handler = createAdvancedWorkerHandler(
      (data) => {
        if (!this.terminated) this.listeners.get('message')?.({ data: structuredClone(data) });
      },
      {
        courseAdapter: String(url).includes('/fpv-worlds/')
          ? {
              format: 'FlightCourse.v2',
              validate: validateWorldCourse,
              createMission: createWorldFlight,
            }
          : undefined,
      },
    );
    ProofWorker.instances.push(this);
  }
  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }
  removeEventListener(type) {
    this.listeners.delete(type);
  }
  postMessage(message) {
    const data = structuredClone(message);
    this.messages.push(data);
    this.pending = this.handler.receive(data);
  }
  terminate() {
    this.terminated = true;
    this.handler.dispose();
  }
}
function environmentWorker(t, Worker) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: Worker,
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else delete globalThis.Worker;
  });
}
async function until(predicate) {
  for (let i = 0; i < 200 && !predicate(); i++) await settle();
  assert.ok(predicate(), 'The bounded verification job should settle');
}
for (const family of ['academy', 'world'])
  test(`default ${family} worker proof enables only explicit unscored references and retains cleanup`, async (t) => {
    environmentWorker(t, ProofWorker);
    const data = referenceFixtures[family],
      identity = { ...data.referenceIdentity },
      split = [],
      visual = [];
    let report, workerOptions;
    const f = fixture(t, {
      key: family,
      course: data.course,
      referenceIdentity: identity,
      archivePackage: data.packet,
      Worker: ProofWorker,
      workerURL:
        family === 'world'
          ? new URL('../../optional-practice/fpv-worlds/advanced-worker.mjs', import.meta.url)
          : undefined,
      verifyCourse: async (packet, course, options) => {
        workerOptions = options;
        report = await verifyAircraftCourseArchiveInWorker(packet, course, options);
        return report;
      },
      onReference: (_session, value) => {
        split.push(value);
        return true;
      },
      onVisualReference: (_session, value) => {
        visual.push(value);
        return true;
      },
    });
    await prepareCourseArchive(f);
    const records = structuredClone([...f.records]);
    f.button('Verify course completion').click();
    await until(() => Boolean(report));
    await settle();
    assert.equal(
      Object.hasOwn(workerOptions, 'Worker'),
      false,
      'The host must retain the default executor boundary',
    );
    const eligibility = aircraftCourseComparisonEligibility(report, report);
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.scored, false);
    assert.equal(eligibility.defaultEligible, false);
    assert.deepEqual(report.course.referenceIdentity, identity);
    assert.equal(split.length, 0);
    assert.equal(visual.length, 0);
    for (const key of ['configurationClass', 'terrainIdentity']) {
      const original = identity[key];
      identity[key] = 'ffffffffffffffff';
      f.update();
      assert.equal(f.button('Use as split reference').disabled, true);
      assert.equal(f.button('Show reference aircraft').disabled, true);
      identity[key] = original;
    }
    f.update();
    assert.equal(f.button('Use as split reference').disabled, false);
    assert.equal(f.button('Show reference aircraft').disabled, false);
    f.button('Use as split reference').click();
    f.button('Show reference aircraft').click();
    assert.deepEqual(split[0].rows, report.course.splits);
    assert.equal(visual[0], report.course.presentation);
    identity.terrainIdentity = 'ffffffffffffffff';
    f.update();
    assert.equal(
      f.button('Clear split reference').disabled,
      false,
      'Cleanup stays available when compatibility is lost',
    );
    assert.equal(f.button('Hide reference aircraft').disabled, false);
    f.button('Clear split reference').click();
    f.button('Hide reference aircraft').click();
    assert.equal(split.at(-1), null);
    assert.equal(visual.at(-1), null);
    assert.deepEqual([...f.records], records);
    assert.deepEqual(f.calls, []);
    assert.equal(f.pauses, 1);
    const worker = ProofWorker.instances.at(-1);
    assert.equal(worker.terminated, true);
    assert.equal(worker.listeners.size, 0);
    assert.equal(
      worker.messages.filter((message) => message.type === 'verify-course-archive').length,
      1,
    );
  });

test('an explicitly different worker stays diagnostic-only even when it completes genuine replay', async (t) => {
  environmentWorker(t, ProofWorker);
  class InjectedWorker extends ProofWorker {}
  const data = referenceFixtures.academy;
  let report,
    selected = 0;
  const f = fixture(t, {
    course: data.course,
    referenceIdentity: data.referenceIdentity,
    archivePackage: data.packet,
    Worker: InjectedWorker,
    verifyCourse: async (packet, course, options) => {
      assert.equal(options.Worker, InjectedWorker);
      report = await verifyAircraftCourseArchiveInWorker(packet, course, options);
      return report;
    },
    onReference: () => {
      selected++;
      return true;
    },
    onVisualReference: () => {
      selected++;
      return true;
    },
  });
  await prepareCourseArchive(f);
  f.button('Verify course completion').click();
  await until(() => Boolean(report));
  await settle();
  assert.equal(report.course.verified, true);
  assert.equal(aircraftCourseComparisonEligibility(report, report).reason, 'custom-course-worker');
  for (const label of ['Use as split reference', 'Show reference aircraft']) {
    assert.equal(f.button(label).disabled, true);
    f.button(label).emit('click');
  }
  assert.equal(selected, 0);
  assert.equal(ProofWorker.instances.at(-1).terminated, true);
  assert.deepEqual(f.calls, []);
});

test('cancelled default-worker course verification releases ownership and cannot select late results', async (t) => {
  class DeferredWorker extends ProofWorker {
    postMessage(message) {
      if (message.type === 'verify-course-archive') this.deliver = () => super.postMessage(message);
      else super.postMessage(message);
    }
  }
  environmentWorker(t, DeferredWorker);
  const data = referenceFixtures.academy;
  let selected = 0;
  const f = fixture(t, {
    course: data.course,
    referenceIdentity: data.referenceIdentity,
    archivePackage: data.packet,
    Worker: DeferredWorker,
    onReference: () => {
      selected++;
      return true;
    },
    onVisualReference: () => {
      selected++;
      return true;
    },
  });
  await prepareCourseArchive(f);
  f.button('Verify course completion').click();
  await until(() => Boolean(ProofWorker.instances.at(-1)?.deliver));
  const worker = ProofWorker.instances.at(-1);
  f.button('Cancel archive operation').click();
  await settle();
  worker.deliver();
  await worker.pending;
  await settle();
  assert.equal(worker.terminated, true);
  assert.equal(worker.listeners.size, 0);
  assert.match(f.ui.root.textContent, /Course verification cancelled/);
  for (const label of ['Use as split reference', 'Show reference aircraft']) {
    assert.ok(f.button(label).hidden || f.button(label).disabled);
    f.button(label).emit('click');
  }
  assert.equal(selected, 0);
  assert.deepEqual(f.calls, []);
});

test('visual capture prepares bounded data but requires separate explicit Show/Hide and retains split choice', async (t) => {
  const visual = [],
    splits = [],
    report = visualReport();
  const f = fixture(t, {
    course: referenceFixtures.academy.course,
    archivePackage: referenceFixtures.academy.packet,
    referenceIdentity,
    verifyCourse: async (_archive, _course, options) => {
      assert.equal(options.collectReference, true);
      return report;
    },
    onReference: (_session, value) => {
      splits.push(value);
      return true;
    },
    onVisualReference: (_session, value) => {
      visual.push(value);
      return true;
    },
  });
  await prepareCourseArchive(f);
  f.button('Show reference aircraft').emit('click');
  assert.equal(visual.length, 0);
  f.button('Verify course completion').click();
  await settle();
  assert.equal(visual.length, 0);
  f.button('Use as split reference').click();
  assert.equal(splits.length, 1);
  assert.equal(visual.length, 0);
  f.button('Show reference aircraft').click();
  assert.equal(visual[0], report.course.presentation);
  assert.match(
    f.ui.root.textContent,
    /REF marks an unscored recorded aircraft, without collisions/,
  );
  f.update();
  assert.equal(visual.length, 1);
  f.setLocale('uk');
  f.update();
  assert.ok(f.button('Сховати еталонний дрон'));
  f.button('Сховати еталонний дрон').click();
  assert.equal(visual.at(-1), null);
  assert.equal(splits.length, 1, 'hiding the ghost preserves independently selected splits');
});
for (const change of ['selection', 'recovery', 'owner', 'verification', 'disposal']) {
  test(`visual reference clears on ${change}`, async (t) => {
    const applied = [];
    const f = fixture(t, {
      course: referenceFixtures.academy.course,
      archivePackage: referenceFixtures.academy.packet,
      referenceIdentity,
      verifyCourse: async () => visualReport(),
      onVisualReference: (session, value) => {
        applied.push({ session, value });
        return true;
      },
    });
    await prepareCourseArchive(f);
    f.button('Verify course completion').click();
    await settle();
    f.button('Show reference aircraft').click();
    if (change === 'selection') {
      const select = f.ui.root.querySelector('select');
      select.value = '';
      select.emit('change');
    }
    if (change === 'recovery') {
      f.setGeneration('1');
      f.update();
    }
    if (change === 'owner') {
      f.replaceSession();
      f.update();
    }
    if (change === 'verification') f.button('Verify course completion').click();
    if (change === 'disposal') f.ui.dispose();
    await settle();
    assert.equal(applied.length, 2);
    assert.equal(applied[1].value, null);
    assert.equal(applied[1].session, applied[0].session);
  });
}
test('failed visual rendering remains optional and a mismatched archive cannot show it', async (t) => {
  let calls = 0;
  const f = fixture(t, {
    course: referenceFixtures.academy.course,
    archivePackage: referenceFixtures.academy.packet,
    referenceIdentity,
    verifyCourse: async () => visualReport(),
    onVisualReference: () => {
      calls++;
      throw new Error('WebGL unavailable');
    },
    onReference: () => true,
  });
  await prepareCourseArchive(f);
  f.button('Verify course completion').click();
  await settle();
  assert.doesNotThrow(() => f.button('Show reference aircraft').click());
  assert.match(
    f.ui.root.textContent,
    /Visual reference unavailable; split timing remains available/,
  );
  f.button('Use as split reference').click();
  assert.ok(f.button('Clear split reference'));
  const wrong = fixture(t, {
    course: referenceFixtures.academy.course,
    archivePackage: referenceFixtures.academy.packet,
    referenceIdentity: { ...referenceIdentity, terrainIdentity: 'ffffffffffffffff' },
    verifyCourse: async () => visualReport(),
    onVisualReference: () => {
      calls++;
      return true;
    },
  });
  await prepareCourseArchive(wrong);
  wrong.button('Verify course completion').click();
  await settle();
  assert.equal(wrong.button('Show reference aircraft').disabled, true);
  wrong.button('Show reference aircraft').emit('click');
  assert.equal(calls, 1);
});

test('a reference lost by the renderer restores Show and reports unavailable without changing splits', async (t) => {
  let active = true;
  const f = fixture(t, {
    course: referenceFixtures.academy.course,
    archivePackage: referenceFixtures.academy.packet,
    referenceIdentity,
    verifyCourse: async () => visualReport(),
    onVisualReference: () => true,
    onReference: () => true,
    hasVisualReference: () => active,
  });
  await prepareCourseArchive(f);
  f.button('Verify course completion').click();
  await settle();
  f.button('Use as split reference').click();
  f.button('Show reference aircraft').click();
  assert.ok(f.button('Hide reference aircraft'));
  active = false;
  f.update();
  assert.ok(f.button('Show reference aircraft'));
  assert.ok(f.button('Clear split reference'));
  assert.match(
    f.ui.root.textContent,
    /Visual reference unavailable; split timing remains available/,
  );
});

for (const locale of ['en', 'uk'])
  for (const failure of ['discontinuity', 'presentation', 'presence query'])
    test(`split selection follows ${failure} in ${locale} without changing the visual or proof`, async (t) => {
      let splits,
        queryFailed = false,
        verifications = 0,
        visualCalls = 0;
      const applied = [],
        f = fixture(t, {
          course: referenceFixtures.academy.course,
          archivePackage: referenceFixtures.academy.packet,
          referenceIdentity,
          verifyCourse: async () => {
            verifications++;
            return visualReport();
          },
          onReference: (session, value) => {
            applied.push(value);
            return splits.setReference(session, value);
          },
          hasSplitReference: (session) => {
            if (queryFailed) throw new Error('optional presence query failed');
            return splits.hasReference(session);
          },
          onVisualReference: () => {
            visualCalls++;
            return true;
          },
        });
      splits = mountPracticeSplits({ parent: f.ui.root.ownerDocument.body, locale: () => locale });
      t.after(() => splits.dispose());
      const state = (ticks, step = 0) => ({ ticks, step, total: 1 });
      splits.update(f.session, state(0), { enabled: true });
      await prepareCourseArchive(f);
      f.button('Verify course completion').click();
      await settle();
      f.button('Use as split reference').click();
      f.button('Show reference aircraft').click();
      f.setLocale(locale);
      const use = locale === 'uk' ? 'Використати як орієнтир часу' : 'Use as split reference',
        clear = locale === 'uk' ? 'Прибрати орієнтир часу' : 'Clear split reference',
        hide = locale === 'uk' ? 'Сховати еталонний дрон' : 'Hide reference aircraft';
      f.update();
      f.update();
      assert.ok(f.button(clear), 'ordinary paused paints retain the selected split');
      const writes = f.calls.slice(),
        records = structuredClone([...f.records]),
        pauses = f.pauses;
      if (failure === 'discontinuity') splits.update(f.session, state(2), { enabled: true });
      if (failure === 'presentation') {
        const list = splits.root.querySelector('ol'),
          replace = list.replaceChildren;
        list.replaceChildren = () => {
          throw new Error('optional split presentation failed');
        };
        splits.consume(f.session, state(1, 1));
        splits.update(f.session, state(1, 1), { enabled: true });
        list.replaceChildren = replace;
      }
      if (failure === 'presence query') queryFailed = true;
      else assert.equal(splits.hasReference(f.session), false);
      assert.doesNotThrow(() => f.update());
      assert.ok(f.button(use), 'one paint reconciles the cleared or unknown split selection');
      assert.equal(f.button(use).disabled, false, 'the verified proof remains usable');
      assert.ok(f.button(hide), 'the independent visual reference stays selected');
      assert.equal(applied.length, 1, 'reconciliation never reapplies or clears a reference');
      assert.equal(visualCalls, 1);
      assert.equal(verifications, 1);
      assert.equal(f.pauses, pauses);
      assert.deepEqual(f.calls, writes);
      assert.deepEqual([...f.records], records);
      queryFailed = false;
      splits.update(f.session, state(2), { enabled: true });
      f.button(use).click();
      assert.ok(f.button(clear), 'one explicit action reselects after observer recovery');
      assert.equal(splits.hasReference(f.session), true);
      assert.equal(applied.length, 2);
      assert.equal(visualCalls, 1);
      assert.equal(verifications, 1);
    });

for (const change of ['selection', 'disposal'])
  test(`split cleanup survives a failed presence query before ${change}`, async (t) => {
    let splits,
      queryFailed = false;
    const f = fixture(t, {
      course: referenceFixtures.academy.course,
      archivePackage: referenceFixtures.academy.packet,
      referenceIdentity,
      verifyCourse: async () => referenceReport(),
      onReference: (session, value) => splits.setReference(session, value),
      hasSplitReference: (session) => {
        if (queryFailed) throw new Error('optional presence query failed');
        return splits.hasReference(session);
      },
    });
    splits = mountPracticeSplits({ parent: f.ui.root.ownerDocument.body });
    t.after(() => splits.dispose());
    splits.update(f.session, { ticks: 0, step: 0, total: 1 }, { enabled: true });
    await prepareCourseArchive(f);
    f.button('Verify course completion').click();
    await settle();
    f.button('Use as split reference').click();
    queryFailed = true;
    f.update();
    assert.ok(f.button('Use as split reference'));
    assert.equal(splits.hasReference(f.session), true, 'a failed query cannot clear during paint');
    if (change === 'selection') {
      const select = f.ui.root.querySelector('select');
      select.value = '';
      select.emit('change');
    } else f.ui.dispose();
    assert.equal(
      splits.hasReference(f.session),
      false,
      'cleanup owns the reference despite unknown display state',
    );
  });
