import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { teamImage } from './helpers/coop-win.mjs';
import { candidateTeamPictureTransport } from './helpers/candidate-team-picture-transport.mjs';
import { playCurrentTeamRoute } from './helpers/current-team-route.mjs';
import { dataIdentity } from '../data-json.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createJourneyBackend, inspectJourneyBackup } from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { JOURNEY_PREFERENCES_KEY, JOURNEY_PREFERENCES_VERSION } from '../journey/preferences.mjs';

const href = 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox';
const source = createTeamJourneyCandidates();
const installCandidatePicture = await candidateTeamPictureTransport(
  createTeamJourneyCandidates({ artwork: true }),
);
const navigation = createCandidateTeamHost(source, {
  corePackIds: source.packs.map((pack) => pack.id),
});
const keys = [
  { up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' },
  { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' },
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
  return playCurrentTeamRoute(f, source, missionId, difficulty);
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
  assert.match(
    f.$('coop-advanced-note').textContent,
    /human validation and original artwork pending/,
  );
  assert.match(f.$('coop-journey-preferences-message').textContent, /only to this session/);
  assert.equal(f.$('coop-journey-save').hidden, false);
  assert.equal(f.$('coop-pause').dataset.journeyUnsaved, 'true');
  assert.equal(f.$('coop-journey-save-options').hidden, false);
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
      assert.match(f.$('coop-overlay-copy').textContent, /End of the Team Journey test route/);
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
  assert.match(f.$('coop-overlay-copy').textContent, /End of this pack/);
  assert.doesNotMatch(f.$('coop-overlay-copy').textContent, /End of the Team Journey test route/);
});

test('optional chooser offers all twelve Team candidates and starts any selected campaign without an extra lobby', async (t) => {
  const f = await journeyPage(t, {
    beforeImport({ install }) {
      install('localStorage', { value: storage('expert') });
    },
  });
  f.$('coop-discovery-open').focus();
  f.tap('Enter');
  await waitFor(() => f.$('journey-chooser')?.open);
  const cards = [...f.$('journey-cards').querySelectorAll('.journey-card')];
  for (const mission of source.missions)
    assert(cards.some((card) => card.querySelector('strong').textContent === mission.name));
  const selected = cards.find(
    (card) => card.querySelector('strong').textContent === 'Shared lookout',
  );
  selected.focus();
  f.tap('Enter');
  await waitFor(
    () => !f.$('journey-chooser').open && f.$('coop-menu').hidden,
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
      image: teamImage(f),
      options: [...f.$('coop-level').querySelectorAll('option')].map((option) => option.value),
    };
    assert.ok(before.image, 'The accepted attempt has a decoded original to preserve.');
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
    assert.equal(teamImage(f), before.image);
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
      dataIdentity({
        ruleset: navigation.row(mission).pack.ruleset,
        level: applyGameplayTuning(
          navigation.row(mission).level,
          resolveGameplayTuning('standard'),
        ),
      }),
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
  f.$('coop-journey-save-options').focus();
  f.tap('Enter');
  assert.equal(f.doc.activeElement.id, 'coop-journey-save-retry');
  assert.equal(f.$('coop-overlay-copy').textContent, copy);
  allowStorage = true;
  f.$('coop-journey-save-retry').focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-journey-save').hidden);
  assert.equal(f.$('coop-pause').dataset.journeyUnsaved, 'false');
  assert.equal(f.$('coop-journey-save-options').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.equal(f.$('coop-overlay-copy').textContent, copy);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  const profile = await createJourneyBackend(memory).read();
  assert(profile.clears.team[navigation.catalog.missions[0].id]);
  await next(f);
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
});

function armSkip(f, button = 'coop-journey-skip') {
  f.$(button).focus();
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-journey-skip-confirm');
  assert.equal(f.$('coop-journey-skip-confirm').textContent, 'Confirm skip');
  assert.match(f.$('coop-overlay-copy').textContent, /No clear is awarded/);
}
async function confirmSkip(f) {
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
}

test('two deliberate Skip activations traverse every Team campaign without awarding clears or opening another menu', async (t) => {
  const memory = managedIndexedDB();
  const f = await journeyPage(t, {
    beforeImport({ install }) {
      install('indexedDB', { value: memory.indexedDB });
    },
  });
  f.$('coop-start').click();
  for (let index = 0; index < source.missions.length - 1; index++) {
    assert.equal(f.$('coop-level').value, source.missions[index].id);
    assert.equal(f.$('coop-journey-skip').hidden, false);
    armSkip(f);
    assert.equal(f.$('coop-level').value, source.missions[index].id);
    assert.equal(f.$('coop-discard-dialog').open, false);
    await confirmSkip(f);
    assert.equal(f.$('coop-level').value, source.missions[index + 1].id);
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.$('coop-coverage').textContent, '0.0%');
    assert.equal(f.$('coop-clock').textContent, '0:00');
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
  }
  assert.equal(
    f.$('coop-journey-skip').hidden,
    true,
    'The finale never wraps into another assignment.',
  );
  await new Promise((resolve) => setImmediate(resolve));
  const profile = await createJourneyBackend(memory).read();
  assert.deepEqual(
    profile.skipped.team,
    navigation.catalog.missions.slice(0, -1).map((mission) => mission.id),
  );
  assert.equal(profile.cursors.team, navigation.catalog.missions.at(-1).id);
  assert.deepEqual(profile.clears.team, {});
  assert.deepEqual(f.visits, []);
});

for (const interruption of ['focus', 'foreground'])
  test(`unconfirmed Team Skip is revoked by ${interruption} and requires two fresh activations`, async (t) => {
    const f = await journeyPage(t);
    f.$('coop-start').click();
    armSkip(f);
    if (interruption === 'focus') f.$('coop-resume').focus();
    else {
      f.win.emit('blur');
      f.win.emit('focus');
    }
    assert.equal(f.$('coop-journey-skip-confirm').textContent, 'Skip mission');
    armSkip(f, 'coop-journey-skip-confirm');
    assert.equal(f.$('coop-level').value, 'twin-landings');
    await confirmSkip(f);
    assert.equal(f.$('coop-level').value, 'stepping-exchange');
  });

for (const failure of ['loading', 'first-paint', 'adoption'])
  test(`failed ${failure} during confirmed Team Skip preserves the attempt and awards neither skip nor clear`, async (t) => {
    const memory = managedIndexedDB(),
      backend = createJourneyBackend(memory);
    let reject = false;
    const errors = [];
    t.mock.method(console, 'error', (error) => errors.push(error));
    const f = await journeyPage(t, {
      beforeImport({ install }) {
        install('indexedDB', { value: memory.indexedDB });
      },
      presentation: {
        async decode() {
          if (reject) {
            reject = false;
            throw new Error('Skip picture failure');
          }
        },
      },
    });
    f.$('coop-start').click();
    armSkip(f);
    await new Promise((resolve) => setImmediate(resolve));
    const before = await backend.read();
    if (failure === 'loading') reject = true;
    if (failure === 'first-paint') f.failNextPaint();
    if (failure === 'adoption') {
      const select = f.$('coop-level'),
        original = select.replaceChildren;
      let fail = true;
      t.mock.method(select, 'replaceChildren', function (...children) {
        original.apply(this, children);
        if (fail) {
          fail = false;
          throw new Error('Skip setup failure');
        }
      });
    }
    f.tap('Enter');
    await waitFor(() => /Could not start/.test(f.$('coop-next-status').textContent));
    assert.equal(f.$('coop-level').value, 'twin-landings');
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(f.$('coop-resume').hidden, false);
    assert.equal(f.$('coop-coverage').textContent, '0.0%');
    assert.deepEqual(await backend.read(), before);
    assert.equal(f.doc.activeElement.id, 'coop-journey-skip-confirm');
    assert.equal(errors.length, 1);
    armSkip(f, 'coop-journey-skip-confirm');
    await confirmSkip(f);
    assert.equal(f.$('coop-level').value, 'stepping-exchange');
  });

test('Skip from a legitimately lost Team attempt keeps the result until deliberate confirmation', async (t) => {
  const f = await journeyPage(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-originals',
    beforeImport({ install }) {
      installCandidatePicture(install);
      install('localStorage', { value: storage('expert') });
    },
  });
  f.$('coop-start').click();
  f.tick(2);
  for (let cycle = 0; cycle < 2; cycle++) {
    for (const [a, b, ticks] of [
      ['right', 'left', 60],
      ['up', 'down', 30],
      ['left', 'right', 18],
      ['down', 'up', 30],
    ]) {
      f.tap(keys[0][a]);
      f.tap(keys[1][b]);
      f.tick(ticks);
    }
    if (cycle === 0) f.tick(180);
  }
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.doesNotMatch(f.$('coop-overlay-copy').textContent, /starts shortly/);
  armSkip(f, 'coop-journey-skip-confirm');
  f.tick(150);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  await confirmSkip(f);
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
  assert.equal(f.$('coop-difficulty').value, 'expert');
});

test('cancelling a held Team Skip keeps the unfinished cuts; a later confirmed skip consumes held directions separately', async (t) => {
  const memory = managedIndexedDB(),
    backend = createJourneyBackend(memory),
    gate = deferred();
  let held = false,
    entered = false;
  t.after(() => gate.resolve());
  const f = await journeyPage(t, {
    beforeImport({ install }) {
      install('indexedDB', { value: memory.indexedDB });
    },
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
  f.tick(2);
  f.press('KeyD');
  f.press('ArrowLeft');
  f.tick(42);
  assert.equal(f.$('coop-state-0').textContent, 'Line exposed');
  assert.equal(f.$('coop-state-1').textContent, 'Line exposed');
  armSkip(f);
  await new Promise((resolve) => setImmediate(resolve));
  const before = await backend.read();
  held = true;
  f.tap('Enter');
  await waitFor(() => entered);
  f.$('coop-next-cancel').click();
  held = false;
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  f.tick(3);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.equal(f.$('coop-state-0').textContent, 'Line exposed');
  assert.equal(f.$('coop-state-1').textContent, 'Line exposed');
  assert.match(f.$('coop-next-status').textContent, /Skip cancelled/);
  assert.deepEqual(await backend.read(), before);
  armSkip(f, 'coop-journey-skip-confirm');
  await confirmSkip(f);
  f.tick(120);
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  assert.equal(f.$('coop-state-0').textContent, 'On reclaimed ground');
  assert.equal(f.$('coop-state-1').textContent, 'On reclaimed ground');
});

test('a skipped Team mission remains selectable and a later command-earned clear removes its skip marker', async (t) => {
  const memory = managedIndexedDB(),
    backend = createJourneyBackend(memory);
  const f = await journeyPage(t, {
    beforeImport({ install }) {
      install('indexedDB', { value: memory.indexedDB });
    },
  });
  f.$('coop-start').click();
  armSkip(f);
  await confirmSkip(f);
  f.$('coop-pause').click();
  f.$('coop-discovery-paused').focus();
  f.tap('Enter');
  await waitFor(() => f.$('journey-chooser')?.open);
  const card = [...f.$('journey-cards').querySelectorAll('.journey-card')].find(
    (button) => button.querySelector('strong').textContent === 'Twin landings',
  );
  card.focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-discard-dialog').open);
  f.$('coop-discard-confirm').focus();
  f.tap('Enter');
  await waitFor(() => !f.$('journey-chooser').open && f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  clear(f, 'twin-landings');
  await new Promise((resolve) => setImmediate(resolve));
  const profile = await backend.read();
  assert(profile.clears.team[navigation.catalog.missions[0].id]);
  assert.deepEqual(profile.skipped.team, []);
});

test('a joined controller can reach Team Skip, confirm twice and continue without returning to setup', async (t) => {
  const f = await journeyPage(t);
  f.$('coop-start').click();
  f.tick(2);
  f.$('coop-pause').click();
  const pad = {
    index: 0,
    id: 'Team skip test controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  const press = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    f.tick(2);
  };
  f.tick(2);
  press(0);
  assert.equal(f.$('coop-overlay').hidden, false);
  for (let tries = 0; tries < 40 && f.doc.activeElement.id !== 'coop-journey-skip-confirm'; tries++)
    press(13);
  assert.equal(f.doc.activeElement.id, 'coop-journey-skip-confirm');
  press(0);
  assert.equal(f.$('coop-journey-skip-confirm').textContent, 'Confirm skip');
  assert.equal(f.$('coop-level').value, 'twin-landings');
  press(0);
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  f.tick(120);
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  t.diagnostic('Finite gamepad input model, not physical-controller qualification.');
});

test('touch-style Team Skip activation pauses then confirms without introducing a discard dialog', async (t) => {
  const f = await journeyPage(t, { touch: true });
  const touch = (button) => {
    button.emit('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0 });
    button.emit('pointerup', { pointerId: 1, pointerType: 'touch', button: 0 });
    button.click();
  };
  touch(f.$('coop-start'));
  touch(f.$('coop-journey-skip'));
  assert.equal(f.$('coop-journey-skip-confirm').textContent, 'Confirm skip');
  assert.equal(f.$('coop-level').value, 'twin-landings');
  touch(f.$('coop-journey-skip-confirm'));
  await waitFor(() => f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.$('coop-menu').hidden, true);
});
