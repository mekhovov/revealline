import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createJourneyBackend, inspectJourneyBackup } from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { JOURNEY_PREFERENCES_KEY, JOURNEY_PREFERENCES_VERSION } from '../journey/preferences.mjs';

const href = 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox';
const source = createTeamJourneyCandidates();
const navigation = createCandidateTeamHost(source, {
  corePackIds: source.packs.map((pack) => pack.id),
});
const keys = [
  { up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' },
  { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' },
];
const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const routes = [
  ...(await read('team-opening-routes')).routes,
  ...(await read('team-foundation-routes')).clear,
  ...(await read('team-material-routes')).routes,
  ...(await read('team-roamer-routes')).routes,
];
function storage(difficulty) {
  return {
    getItem(key) {
      return key === JOURNEY_PREFERENCES_KEY
        ? JSON.stringify({ format: JOURNEY_PREFERENCES_VERSION, difficulty })
        : null;
    },
    setItem() {
      throw new Error('Opening a candidate route must not write preferences.');
    },
  };
}
async function journeyPage(t, options = {}) {
  return page(t, {
    href,
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    ...options,
  });
}
function clear(f, missionId, difficulty = 'standard') {
  const route = routes.find((row) => row.missionId === missionId && row.difficulty === difficulty);
  assert(route, `${missionId}/${difficulty} requires a recorded command route`);
  f.tick(2);
  for (const segment of route.log) {
    for (const [seat, direction] of [segment.a, segment.b].entries())
      if (direction) f.tap(keys[seat][direction]);
    for (let tick = 0; tick < segment.ticks && f.$('coop-overlay').hidden; tick++) f.tick();
    if (!f.$('coop-overlay').hidden) break;
  }
  assert.equal(
    f.$('coop-overlay-kicker').textContent,
    'A WORLD YOU REVEALED TOGETHER',
    `${missionId}: ${f.$('coop-message').textContent}, ${f.$('coop-coverage').textContent}`,
  );
}
async function next(f) {
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
}

test('explicit Team Journey earns twelve consecutive clears across all five campaigns with one Next and no lobby', async (t) => {
  const f = await journeyPage(t);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.match(f.$('coop-pack-status').textContent, /Geometry test.*not human validated/);
  assert.match(f.$('coop-boot').textContent, /human validation and original artwork pending/);
  assert.match(f.$('coop-boot').textContent, /only to this session/);
  assert.equal(f.$('coop-journey-save').hidden, false);
  assert.match(
    f.$('coop-journey-save-message').textContent,
    /Team Journey progress is session-only/,
  );
  f.$('coop-start').focus();
  f.tap('Enter');
  for (const [index, mission] of source.missions.entries()) {
    assert.equal(f.$('coop-level').value, mission.id);
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.$('coop-coverage').textContent, '0.0%');
    assert.equal(f.$('coop-clock').textContent, '0:00');
    assert.equal(f.$('coop-difficulty').value, 'standard');
    assert.equal(f.$('coop-difficulty').disabled, true);
    clear(f, mission.id);
    assert.equal(f.$('coop-reserves').textContent, '2 reserves');
    assert.deepEqual(f.visits, []);
    assert.equal(f.$('coop-discard-dialog').open, false);
    if (index < source.missions.length - 1) {
      assert.equal(f.doc.activeElement.id, 'coop-next');
      assert.equal(f.$('coop-next').textContent, `Next: ${source.missions[index + 1].name}`);
      f.$('coop-difficulty').value = 'expert';
      f.$('coop-experiment').value = 'independent';
      await next(f);
      assert.equal(f.doc.activeElement.id, 'coop-canvas');
      assert.equal(f.$('coop-experiment').value, 'full');
    } else {
      assert.equal(f.$('coop-next').hidden, true);
      assert.match(f.$('coop-overlay-copy').textContent, /Team Journey test complete/);
    }
  }
  t.diagnostic(
    'Real host, command-earned clears and modeled DOM/Canvas; not native performance or human enjoyment evidence.',
  );
});

for (const difficulty of ['gentle', 'expert'])
  test(`Team candidate entry reads shared ${difficulty} preference without changing legacy choices`, async (t) => {
    const f = await journeyPage(t, {
      beforeImport({ install }) {
        install('localStorage', { value: storage(difficulty) });
      },
    });
    assert.equal(f.$('coop-difficulty').value, difficulty);
    assert.doesNotMatch(f.$('coop-boot').textContent, /only to this session/);
    f.$('coop-start').click();
    assert.equal(
      f.$('coop-reserves').textContent,
      difficulty === 'gentle' ? '4 reserves' : '1 reserve',
    );
  });

test('a native arena selector claimed during loading keeps its options and choice ahead of the candidate entry', async (t) => {
  let originalOptions;
  const f = await journeyPage(t, {
    beforeImport({ $ }) {
      originalOptions = [...$('coop-level').querySelectorAll('option')];
      $('coop-level').value = 'relay-yard';
      $('coop-level').emit('pointerdown', { button: 0, isPrimary: true });
    },
  });
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.deepEqual([...f.$('coop-level').querySelectorAll('option')], originalOptions);
  assert.doesNotMatch(f.$('coop-pack-status').textContent, /Geometry test/);
});

for (const query of ['journey=unknown', 'journey=team-greybox&journey=team-greybox'])
  test(`ambiguous or unknown candidate entry stays on legacy Team: ${query}`, async (t) => {
    const f = await page(t, { href: `http://localhost/game/couch/relay-rescue.html?${query}` });
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.doesNotMatch(f.$('coop-boot').textContent, /Team Journey/);
  });

test('identical imported Team mission IDs never join the code-owned Journey route', async (t) => {
  const f = await journeyPage(t);
  await f.selectFile(JSON.stringify(createTeamTestPack(source, 'twin-landings', 'standard')));
  f.$('coop-start').click();
  clear(f, 'twin-landings');
  assert.equal(f.$('coop-next').hidden, true);
  assert.match(f.$('coop-overlay-copy').textContent, /Pack complete/);
  assert.doesNotMatch(f.$('coop-overlay-copy').textContent, /Team Journey test complete/);
});

test('optional chooser offers all twelve Team candidates and starts any selected campaign without an extra lobby', async (t) => {
  const f = await journeyPage(t, {
    beforeImport({ install }) {
      install('localStorage', { value: storage('expert') });
    },
  });
  f.$('coop-discovery-open').focus();
  f.tap('Enter');
  const cards = [...f.$('coop-discovery-list').querySelectorAll('.team-discovery-play')];
  for (const mission of source.missions)
    assert(cards.some((card) => card.textContent === `Play ${mission.name}`));
  const selected = cards.find((card) => card.textContent === 'Play Shared lookout');
  selected.focus();
  f.tap('Enter');
  await waitFor(
    () => !f.$('coop-discovery-dialog').open,
    () => f.$('coop-discovery-status').textContent,
  );
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-level').value, 'shared-lookout');
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(f.$('coop-difficulty').value, 'expert');
  clear(f, 'shared-lookout', 'expert');
  assert.equal(f.$('coop-next').textContent, 'Next: Twin depots');
  await next(f);
  assert.equal(f.$('coop-level').value, 'twin-depots');
  assert.equal(f.$('coop-difficulty').value, 'expert');
});

for (const failure of ['loading', 'first-paint', 'adoption'])
  test(`cross-campaign ${failure} failure retains the earned result and exact setup, then Next can retry`, async (t) => {
    let rejectRead = false;
    const errors = [];
    t.mock.method(console, 'error', (error) => errors.push(error));
    const f = await journeyPage(t, {
      capturePaint: true,
      presentation: {
        async decode() {
          if (rejectRead) {
            rejectRead = false;
            throw new Error('Test successor image failure');
          }
        },
      },
    });
    f.$('coop-start').click();
    clear(f, 'twin-landings');
    const before = {
      copy: f.$('coop-overlay-copy').textContent,
      coverage: f.$('coop-coverage').textContent,
      status: f.$('coop-pack-status').textContent,
      image: f.drawImages.at(-1),
      options: [...f.$('coop-level').querySelectorAll('option')].map((option) => option.value),
    };
    if (failure === 'loading') rejectRead = true;
    if (failure === 'first-paint') f.failNextPaint();
    if (failure === 'adoption') {
      const select = f.$('coop-level'),
        original = select.replaceChildren;
      let fail = true;
      t.mock.method(select, 'replaceChildren', function (...children) {
        original.apply(this, children);
        if (fail) {
          fail = false;
          throw new Error('Test successor setup paint failure');
        }
      });
    }
    f.$('coop-next').focus();
    f.tap('Enter');
    await waitFor(
      () => /Could not start/.test(f.$('coop-next-status').textContent),
      () => f.$('coop-next-status').textContent,
    );
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.$('coop-level').value, 'twin-landings');
    assert.equal(f.$('coop-overlay-copy').textContent, before.copy);
    assert.equal(f.$('coop-coverage').textContent, before.coverage);
    assert.equal(f.$('coop-pack-status').textContent, before.status);
    assert.equal(f.drawImages.at(-1), before.image);
    assert.deepEqual(
      [...f.$('coop-level').querySelectorAll('option')].map((option) => option.value),
      before.options,
    );
    assert.equal(errors.length, 1);
    await next(f);
    assert.equal(f.$('coop-level').value, 'stepping-exchange');
    assert.equal(f.$('coop-coverage').textContent, '0.0%');
  });

test('cancelled cross-campaign preparation cannot replace the completed run when decoding finishes later', async (t) => {
  let held = false,
    entered = false;
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await journeyPage(t, {
    presentation: {
      async decode() {
        if (held) {
          entered = true;
          await gate.promise;
        }
      },
    },
  });
  f.$('coop-start').click();
  clear(f, 'twin-landings');
  const copy = f.$('coop-overlay-copy').textContent;
  held = true;
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(() => entered);
  f.$('coop-next-cancel').click();
  held = false;
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  f.tick(3);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-copy').textContent, copy);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.match(f.$('coop-next-status').textContent, /cancelled/);
  await next(f);
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
});

test('real Team host restores the next mission from a legally earned cross-release profile without writing on entry', async (t) => {
  const memory = managedIndexedDB(),
    backend = createJourneyBackend(memory);
  const mission = navigation.catalog.missions[0];
  await t.test('earn the opening clear, retain its cursor on failed Next', async (t) => {
    const f = await journeyPage(t, {
      beforeImport({ install }) {
        install('indexedDB', { value: memory.indexedDB });
      },
    });
    assert.equal(memory.allPuts.length, 0);
    assert.equal(f.$('coop-journey-save').hidden, true);
    f.$('coop-start').click();
    clear(f, 'twin-landings');
    await new Promise((resolve) => setImmediate(resolve));
    const profile = await backend.read();
    assert.equal(profile.cursors.team, mission.id);
    assert.equal(
      profile.clears.team[mission.id].gameplayId,
      navigation.row(mission).simulationIdentity,
    );
    const errors = [];
    t.mock.method(console, 'error', (error) => errors.push(error));
    f.failNextPaint();
    f.$('coop-next').click();
    await waitFor(() => /Could not start/.test(f.$('coop-next-status').textContent));
    assert.deepEqual(await backend.read(), profile);
    assert.equal(errors.length, 1);
  });
  await t.test(
    'new page restores the successor, Start records only the admitted mission',
    async (t) => {
      const count = memory.allPuts.length;
      const f = await journeyPage(t, {
        beforeImport({ install }) {
          install('indexedDB', { value: memory.indexedDB });
        },
      });
      assert.equal(f.$('coop-level').value, 'stepping-exchange');
      assert.equal(memory.allPuts.length, count);
      f.$('coop-start').focus();
      f.tap('Enter');
      assert.equal(f.$('coop-menu').hidden, true);
      await new Promise((resolve) => setImmediate(resolve));
      const profile = await backend.read();
      assert.equal(profile.cursors.team, navigation.catalog.missions[1].id);
      assert.deepEqual(Object.keys(profile.clears.team), [mission.id]);
    },
  );
});

test('denied Team saving stays playable, exports pending progress and Retry saves it without changing the paused run', async (t) => {
  const memory = managedIndexedDB();
  let allowStorage = false;
  const f = await journeyPage(t, {
    beforeImport({ install }) {
      install('indexedDB', {
        get() {
          if (!allowStorage) throw new Error('Test denied Team storage');
          return memory.indexedDB;
        },
      });
    },
  });
  f.$('coop-start').click();
  clear(f, 'twin-landings');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-journey-save').hidden, false);
  const blobs = [],
    create = URL.createObjectURL;
  const exportTimers = [],
    schedule = setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => {
    const timer = schedule(callback, ms, ...args);
    if (ms === 60000) {
      timer.unref();
      exportTimers.push(timer);
    }
    return timer;
  });
  t.after(() => exportTimers.forEach(clearTimeout));
  t.mock.method(URL, 'createObjectURL', (blob) => {
    blobs.push(blob);
    return create(blob);
  });
  await f.$('coop-journey-save-export').onclick();
  const exported = blobs.find((blob) => blob.type === 'application/json');
  assert(exported);
  const backup = inspectJourneyBackup(JSON.parse(await exported.text()));
  assert(backup.profile.clears.team[navigation.catalog.missions[0].id]);
  assert.match(f.$('coop-journey-save-message').textContent, /Download requested/);
  const copy = f.$('coop-overlay-copy').textContent;
  allowStorage = true;
  f.$('coop-journey-save-retry').focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-journey-save').hidden);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.equal(f.$('coop-overlay-copy').textContent, copy);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  const profile = await createJourneyBackend(memory).read();
  assert(profile.clears.team[navigation.catalog.missions[0].id]);
  await next(f);
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
});
