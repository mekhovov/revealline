import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import { COMBAT_PREFERENCES_KEY, COMBAT_PREFERENCES_VERSION } from '../combat-preferences.mjs';

const combatRoutes = JSON.parse(
  await readFile(new URL('./fixtures/combat-candidate-routes.json', import.meta.url), 'utf8'),
).routes;
const workshopRoute = combatRoutes.find(
  (route) =>
    route.id === 'workshop-sweep' &&
    route.difficulty === 'standard' &&
    route.turnPolicy === 'immediate' &&
    route.seed === 1,
);
const sentryRoute = combatRoutes.find(
  (route) =>
    route.id === 'sentry-detour' &&
    route.difficulty === 'standard' &&
    route.turnPolicy === 'immediate' &&
    route.seed === 1,
);
const playerOneKeys = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };

const preference = (mode = 'authored', showScrap = true) =>
  JSON.stringify({ format: COMBAT_PREFERENCES_VERSION, mode, showScrap });

async function setup(
  t,
  { mode = 'authored', showScrap = true, format = 'single', beforeImport, ...options } = {},
) {
  const memory = managedIndexedDB();
  const storage = memoryStorage({
    [JOURNEY_PREFERENCES_KEY]: JSON.stringify({
      format: 'JourneyPreferencesV1',
      difficulty: 'standard',
    }),
    [COMBAT_PREFERENCES_KEY]: preference(mode, showScrap),
  });
  const page = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=combat-study',
    initialLevel: null,
    assetDatabase: memory.indexedDB,
    storage,
    seconds: '90',
    ...options,
    beforeImport: async (context) => {
      context.document.getElementById('race-format').value = format;
      await beforeImport?.(context);
    },
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) return new Response(await readFile(url));
    },
  });
  page.preferencesStorage = storage;
  return page;
}

function steer(page, direction) {
  const code = playerOneKeys[direction];
  if (!code) return;
  page.key(code);
  page.key(code, false);
}

function winWorkshopRound(page) {
  for (const { direction, ticks } of workshopRoute.segments) {
    steer(page, direction);
    for (let elapsed = 0; elapsed < ticks && page.renders[0].status !== 'won'; ) {
      const batch = Math.min(12, ticks - elapsed);
      page.frame((batch * 1000) / 120);
      elapsed += batch;
      if (
        direction &&
        page.renders[0].events.some((event) => event.type === 'capture.stopped') &&
        elapsed < ticks
      )
        steer(page, direction);
    }
  }
  for (let tick = 0; tick < 120 && page.renders[0].status !== 'won'; tick++) {
    steer(page, workshopRoute.segments.at(-1).direction);
    page.frame(1000 / 120);
  }
  assert.equal(page.renders[0].status, 'won');
  assert.equal(page.renders[1].status, 'running');
  assert.equal(page.$('race-pause').disabled, true);
}

function runUntilCombatCaption(page, route) {
  for (const { direction, ticks } of route.segments) {
    steer(page, direction);
    for (let elapsed = 0; elapsed < ticks; ) {
      const batch = Math.min(12, ticks - elapsed);
      page.frame((batch * 1000) / 120);
      elapsed += batch;
      if (!page.$('racer-combat-0').hidden) return;
      if (
        direction &&
        page.renders[0].events.some((event) => event.type === 'capture.stopped') &&
        elapsed < ticks
      )
        steer(page, direction);
    }
  }
  assert.fail('Expected a public combat event before the verified route ended.');
}

test('combat-study Versus exposes one filtered party choice and equal exact editions', async (t) => {
  const page = await setup(t);
  assert.equal(page.$('race-combat-mode-field').hidden, false);
  assert.equal(page.$('race-combat-scrap-field').hidden, false);
  page.$('race-options').click();
  page.$('race-settings-tab-controls').click();
  assert.equal(page.$('race-settings-panel-controls').hidden, false);
  assert.equal(
    page.$('race-combat-mode').closest('#race-settings-panel-controls'),
    page.$('race-settings-panel-controls'),
  );
  assert.equal(page.$('race-combat-mode').closest('#race-setup'), null);
  page.$('race-options-back').click();
  assert.equal(
    page.$('race-level').options.length,
    3,
    'one row per mission, not edition duplicates',
  );
  assert.equal(page.renders[0].levelId, 'workshop-sweep');
  assert.notEqual(page.renders[0], page.renders[1]);
  assert.deepEqual(page.renders[0], page.renders[1]);
  assert.equal(page.renders[0].level.classic.combatPatrols.enabled, true);
  assert.match(page.$('race-combat-note').textContent, /Current selected.*robots on/i);
  assert.match(page.$('race-journey-difficulty-note').textContent, /enemies 40% faster/i);
  assert.doesNotMatch(page.$('race-journey-difficulty-note').textContent, /authored enemy tier/i);
  assert.equal(page.drawOptions[0].showCombatScrap, true);
  assert.equal(page.drawOptions[1].showCombatScrap, true);

  const authored = page.renders[0];
  page.$('race-combat-mode').value = 'off';
  page.$('race-combat-mode').onchange();
  await waitFor(() => {
    page.frame(0);
    return page.renders[0] !== authored && !page.$('race-start').disabled;
  });
  page.frame(0);
  assert.equal(page.renders[0].level.classic.combatPatrols.enabled, false);
  assert.equal(page.renders[1].level.classic.combatPatrols.enabled, false);
  assert.deepEqual(page.renders[0], page.renders[1]);
  assert.equal(page.$('race-level').options.length, 3);
  assert.match(page.$('race-combat-note').textContent, /Next fresh race: robots off/i);

  const off = page.renders[0];
  page.$('race-combat-scrap').checked = false;
  page.$('race-combat-scrap').onchange();
  page.frame(0);
  assert.equal(page.renders[0], off, 'cosmetic choice does not replace either run');
  assert.equal(page.drawOptions[0].showCombatScrap, false);
  assert.equal(page.drawOptions[1].showCombatScrap, false);
});

test('pending robot choice waits through an unfinished first-to-two series and applies to rematch', async (t) => {
  const page = await setup(t, { format: 'first-to-two' });
  page.$('race-start').click();
  await waitFor(() => {
    page.frame(0);
    return !page.$('race-pause').disabled;
  });
  assert.equal(page.renders[0].level.classic.combatPatrols.enabled, true);
  page.$('race-combat-mode').value = 'off';
  page.$('race-combat-mode').onchange();
  assert.match(
    page.$('race-combat-note').textContent,
    /Current selected.*robots on.*Next fresh race: robots off/i,
  );
  assert.equal(
    page.renders[0].level.classic.combatPatrols.enabled,
    true,
    'pending choice cannot mutate either active board',
  );

  winWorkshopRound(page);
  assert.match(page.$('race-start').textContent, /^Next round:/);
  const first = page.renders[0];
  page.$('race-start').click();
  await waitFor(() => {
    page.frame(0);
    return page.renders[0] !== first && !page.$('race-pause').disabled;
  });
  assert.equal(
    page.renders[0].level.classic.combatPatrols.enabled,
    true,
    'round two retains the edition selected for this series',
  );

  winWorkshopRound(page);
  assert.match(page.$('race-start').textContent, /^Rematch:/);
  assert.equal(page.$('series-score').textContent, '2 : 0');
  const second = page.renders[0];
  page.$('race-start').click();
  await waitFor(() => {
    page.frame(0);
    return page.renders[0] !== second && !page.$('race-pause').disabled;
  });
  assert.equal(page.renders[0].level.classic.combatPatrols.enabled, false);
  assert.equal(page.renders[1].level.classic.combatPatrols.enabled, false);
  assert.equal(page.$('series-score').textContent, '0 : 0');
});

test('prospective mission decode is cancelled by a changed robot intent without replacing active boards', async (t) => {
  let held = false,
    entered = false,
    release;
  const images = [];
  class HeldImage {
    constructor() {
      images.push(this);
    }
    set src(value) {
      const bytes = Buffer.from(value.split(',')[1], 'base64');
      this.width = this.naturalWidth = bytes.readUInt32BE(16);
      this.height = this.naturalHeight = bytes.readUInt32BE(20);
      queueMicrotask(() => this.onload?.());
    }
    async decode() {
      if (held) {
        entered = true;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
    }
    removeAttribute() {
      this.released = (this.released ?? 0) + 1;
    }
  }
  const page = await setup(t, { ImageClass: HeldImage });
  page.$('race-start').click();
  await waitFor(() => {
    page.frame(0);
    return !page.$('race-pause').disabled;
  });
  const previous = [...page.renders],
    picture = page.drawOptions[0].backdrop;
  held = true;
  page.$('race-journey-find').click();
  const next = [...page.$('journey-cards').children].find((card) =>
    card.dataset.missionId.endsWith('/sentry-detour'),
  );
  next.click();
  await waitFor(() => entered);
  page.$('race-combat-mode').value = 'off';
  page.$('race-combat-mode').onchange();
  held = false;
  release();
  await waitFor(() => images.at(-1).released === 1);
  page.frame(0);
  assert.equal(page.renders[0], previous[0]);
  assert.equal(page.renders[1], previous[1]);
  assert.equal(page.drawOptions[0].backdrop, picture);
  assert.equal(picture.image.released, undefined);

  page.$('race-journey-find').click();
  [...page.$('journey-cards').children]
    .find((card) => card.dataset.missionId.endsWith('/sentry-detour'))
    .click();
  await waitFor(() => {
    page.frame(0);
    return page.renders[0] !== previous[0] && !page.$('race-pause').disabled;
  });
  assert.equal(page.renders[0].levelId, 'sentry-detour');
  assert.equal(page.renders[0].level.classic.combatPatrols.enabled, false);
  assert.equal(page.renders[1].level.classic.combatPatrols.enabled, false);
});

test('actual paired board events publish a bounded per-board combat caption', async (t) => {
  const page = await setup(t);
  page.$('race-journey-find').click();
  [...page.$('journey-cards').children]
    .find((card) => card.dataset.missionId.endsWith('/sentry-detour'))
    .click();
  await waitFor(() => {
    page.frame(0);
    return page.renders[0].levelId === 'sentry-detour' && !page.$('race-pause').disabled;
  });
  runUntilCombatCaption(page, sentryRoute);
  assert.equal(page.$('racer-combat-0').hidden, false);
  assert.match(page.$('racer-combat-0').textContent, /SENTRY LOCK|SHOT FIRED|PATROL REMOVED/);
  assert(
    page.observedEvents.some((event) =>
      ['combat.locked', 'combat.fired', 'combat.eliminated'].includes(event.type),
    ),
  );
  assert.equal(page.$('racer-combat-1').hidden, true, 'idle peer has no fabricated warning');
});

test('renderer failure visibly freezes the whole race before further simulation', async (t) => {
  let fail = false;
  const page = await setup(t, {
    beforeImport() {
      const draw = BoardPainter.prototype.draw;
      BoardPainter.prototype.draw = function (...args) {
        const result = draw.apply(this, args);
        if (fail) throw new Error('malformed optional combat projection');
        return result;
      };
    },
  });
  page.$('race-start').click();
  await waitFor(() => {
    page.frame(0);
    return !page.$('race-pause').disabled;
  });
  fail = true;
  page.frame(1000 / 120);
  const ticks = page.renders.map((run) => run.tick);
  page.frame(1000 / 120);
  assert.deepEqual(
    page.renders.map((run) => run.tick),
    ticks,
  );
  assert.equal(page.$('race-start').disabled, true);
  assert.equal(page.$('race-pause').disabled, true);
  assert.equal(page.$('race-message').hidden, false);
  assert.match(page.$('race-message').textContent, /Race stopped.*malformed optional combat/i);
  assert.equal(page.$('racer-state-0').textContent, 'paused');
  assert.equal(page.$('racer-state-1').textContent, 'paused');
});

test('failed combat preference save is truthful, exportable and retryable without replacing a race', async (t) => {
  const page = await setup(t);
  const storage = page.preferencesStorage,
    write = storage.setItem.bind(storage);
  let refuse = true,
    exported;
  storage.setItem = (key, value) => {
    if (refuse && key === COMBAT_PREFERENCES_KEY) throw new Error('Combat quota test.');
    write(key, value);
  };
  t.mock.method(URL, 'createObjectURL', (blob) => {
    exported = blob;
    return 'blob:combat-preferences';
  });
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) =>
    schedule(callback, ms === 60000 ? 0 : ms, ...args),
  );
  const previous = page.renders[0];
  page.$('race-combat-mode').value = 'off';
  page.$('race-combat-mode').onchange();
  assert.equal(page.$('race-combat-preferences-recovery').hidden, false);
  assert.match(
    page.$('race-combat-preferences-message').textContent,
    /session-only.*Combat quota test/i,
  );
  assert.equal(JSON.parse(storage.getItem(COMBAT_PREFERENCES_KEY)).mode, 'authored');
  page.$('race-combat-preferences-export').click();
  await waitFor(() =>
    page.$('race-combat-preferences-message').textContent.includes('Download requested'),
  );
  assert.deepEqual(JSON.parse(await exported.text()), {
    format: COMBAT_PREFERENCES_VERSION,
    mode: 'off',
    showScrap: true,
  });
  refuse = false;
  page.$('race-combat-preferences-retry').focus();
  page.$('race-combat-preferences-retry').click();
  assert.equal(page.$('race-combat-preferences-recovery').hidden, true);
  assert.equal(page.doc.activeElement, page.$('race-combat-mode'));
  assert.equal(JSON.parse(storage.getItem(COMBAT_PREFERENCES_KEY)).mode, 'off');
  await waitFor(() => {
    page.frame(0);
    return page.renders[0] !== previous && !page.$('race-start').disabled;
  });
  assert.equal(page.renders[0].level.classic.combatPatrols.enabled, false);
});
