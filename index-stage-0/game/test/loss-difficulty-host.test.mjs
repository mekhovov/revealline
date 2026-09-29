import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import {
  pngBytes,
  provenance,
  libraryRecord,
  presentationRecord,
  deferred,
} from './helpers/media-fixtures.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { campaignKey, loadLibrary } from '../library.mjs';
import { entryScenario } from '../playground/model.mjs';
import { prepareScenario } from '../imports.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'failure-difficulty',
  revision: '1',
  title: 'Failure difficulty access',
  classRecipes: classes,
  levels: ['first-cut'].map((id) => ({
    ...retryFixture('self-contact').level,
    id,
    name: id,
    goal: { coverage: 0.99 },
    rules: { lives: 1 },
  })),
};
const customCampaign = { ...campaign, id: 'failure-custom', title: 'Custom failure campaign' };
const catalog = createExecutionCatalog(
  [campaign, customCampaign].map((item) => ({ campaign: item, themes })),
);
const ticks = (p, n) => {
  for (let i = 0; i < n; i++) p.frame();
};
async function setup(t, { journey = false, practice = false } = {}) {
  const diagnostics = [];
  let diagnosticAction = null;
  t.mock.method(console, 'warn', (...args) => {
    diagnostics.push(args);
    diagnosticAction?.();
  });
  const memory = memoryIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  const asset = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const identities = [campaign, customCampaign].flatMap((owner) =>
    owner.levels.map((level) => ({
      baseCampaignKey: campaignKey(owner),
      levelId: level.id,
      levelRevision: level.revision,
      themeId: 'fpv',
    })),
  );
  const library = libraryRecord(identities[0]);
  library.assets = [asset.asset];
  library.presentations = identities.map((identity, i) => ({
    ...presentationRecord(identity),
    id: `picture-${i}`,
  }));
  library.assignments = identities.map((identity, i) => ({
    identity,
    presentationId: `picture-${i}`,
    revision: 1,
  }));
  await store.commit(
    await store.prepare(library, [{ sha256: asset.asset.sha256, blob: asset.blob }], {
      executionCatalog: catalog,
    }),
    { expectedGeneration: 0 },
  );
  t.after(() => manager.close());
  const images = [],
    releaseCallbacks = new WeakMap();
  let nextDecode = null;
  class Picture {
    constructor() {
      this.width = this.height = this.naturalWidth = this.naturalHeight = 1;
      images.push(this);
      this.releases = 0;
    }
    set src(value) {
      this.url = value;
      if (value) queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this.url;
    }
    decode() {
      const action = nextDecode;
      nextDecode = null;
      return action ? action() : Promise.resolve();
    }
    removeAttribute() {
      this.url = '';
      this.releases++;
      const callback = releaseCallbacks.get(this);
      releaseCallbacks.delete(this);
      callback?.();
    }
  }
  const scenario = practice
    ? await prepareScenario(
        entryScenario(
          {
            campaign,
            classRecipes: classes,
            themes: [themes.find((item) => item.id === 'fpv')],
            visualOverrides: {},
            levelVisuals: [],
          },
          'first-cut',
        ),
      )
    : null;
  const p = await soloPage(t, {
    campaign,
    ...(journey
      ? { search: '?journey=1', titleScreen: true, journeyIndexedDB: managedIndexedDB().indexedDB }
      : {}),
    ...(scenario
      ? {
          search: '?practice=1',
          previewStorage: memoryStorage({
            'revealline.playground.current': JSON.stringify(scenario.scenario),
          }),
        }
      : {}),
    soundtrackIndexedDB: memory.indexedDB,
    pictures: { Image: Picture },
  });
  return {
    p,
    images,
    diagnostics,
    onDiagnostic(action) {
      diagnosticAction = action;
    },
    onRelease(image, callback) {
      releaseCallbacks.set(image, callback);
    },
    deferDecode(action) {
      nextDecode = action;
    },
  };
}

function key(p, value) {
  const target = p.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value });
  if (!event.defaultPrevented && value === 'Enter' && target.tagName === 'BUTTON') target.click();
  if (!event.defaultPrevented && value === 'Escape') {
    const dialog = target.closest('dialog[open]');
    if (dialog && !dialog.emit('cancel').defaultPrevented) dialog.close();
  }
  // These are finite DOM native default actions, not game-handler calls.
  if (!event.defaultPrevented && target.tagName === 'SELECT' && value === 'ArrowDown') {
    const options = [...target.options];
    const index = options.findIndex((option) => option.value === target.value);
    target.value = options[Math.min(options.length - 1, index + 1)].value;
    target.emit('change');
  }
  target.emit('keyup', { key: value, code: value });
}
function controller(p, t) {
  let now = 1000;
  const previous = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    previous ? Object.defineProperty(performance, 'now', previous) : delete performance.now,
  );
  const pad = {
    index: 0,
    id: 'Loss difficulty controls',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const frame = () => {
    now += 16;
    p.frame(16);
  };
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    frame();
  };
  frame();
  frame();
  return pulse;
}
async function lose(p, { available = true } = {}) {
  assert.ok(p.$('loss-difficulty-field'), 'Shipped failure difficulty control exists');
  assert.equal(p.$('loss-difficulty-field').hidden, true, 'Ready has no failure selector');
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0); // Render the newly selected host run before observing it.
  const run = p.rendered.run;
  p.$('pause-button').click();
  p.frame(0);
  assert.equal(p.$('loss-difficulty-field').hidden, true, 'Pause has no failure selector');
  if (available)
    assert.ok(p.storage.getItem(sessionKey), 'Retain a real saved flight before losing');
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  for (let remaining = run.lives - 1; remaining >= 0; remaining--) {
    p.key('ArrowDown');
    ticks(p, 30);
    p.key('ArrowDown', false);
    p.key('ArrowUp');
    ticks(p, 1);
    p.key('ArrowUp', false);
    assert.equal(
      run.lives,
      remaining,
      JSON.stringify({
        level: run.levelId,
        status: run.status,
        paused: p.rendered.paused,
        modal: p.doc.querySelector('dialog[open]')?.id,
        player: run.player,
      }),
    );
    assert.equal(run.failureCause, 'self-contact');
    if (remaining) ticks(p, 240);
  }
  assert.equal(run.status, 'lost');
  ticks(p, 80);
  p.frame(0);
  assert.equal(p.$('game-overlay').dataset.kind, 'lost');
  assert.equal(p.doc.activeElement.id, 'retry-button');
  assert.equal(p.$('loss-difficulty-field').hidden, !available);
  assert.equal(p.$('loss-difficulty-select').disabled, !available);
  assert.deepEqual(
    [...p.$('loss-difficulty-select').options].map((item) => item.value),
    ['standard', 'gentle'],
  );
  if (available) {
    assert.equal(p.$('loss-difficulty-select').closest('[hidden],[inert]'), null);
    assert.equal(p.$('loss-difficulty-select').getClientRects().length > 0, true);
  }
  return {
    run,
    checkpoint: authoritativeCheckpoint(run),
    image: p.rendered.backdrop?.image,
    pin: structuredClone(p.rendered.backdrop?.pin),
    saved: p.storage.getItem(sessionKey),
  };
}
function kept(p, before) {
  p.frame(0);
  assert.equal(p.rendered.run, before.run);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before.checkpoint);
  assert.equal(p.rendered.backdrop.image, before.image);
  assert.deepEqual(p.rendered.backdrop.pin, before.pin);
  assert.equal(before.image.releases, 0);
  assert.equal(p.storage.getItem(sessionKey), before.saved);
  assert.equal(p.$('game-overlay').dataset.kind, 'lost');
  assert.equal(p.rendered.paused, true);
}
function choose(p, value) {
  const control = p.$('loss-difficulty-select');
  assert.equal(control.closest('[hidden],[inert]'), null);
  assert.equal(control.disabled, false);
  p.change(control.id, value);
  assert.equal(p.doc.activeElement, control);
  assert.equal(p.$('difficulty-select').value, value);
  assert.equal(control.value, value);
}
async function retried(p, before, lives) {
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running';
  });
  assert.notEqual(p.rendered.run, before.run);
  assert.equal(p.rendered.run.levelId, before.run.levelId);
  assert.equal(p.rendered.run.seed, before.run.seed);
  assert.equal(p.rendered.run.turnPolicy, before.run.turnPolicy);
  assert.equal(p.rendered.run.lives, lives);
  assert.equal(p.rendered.run.tick, 0);
  assert.equal(p.rendered.run.score, 0);
  assert.equal(p.rendered.run.coverage, 0);
  assert.equal(p.rendered.backdrop.pin.assetId, before.pin.assetId);
  assert.match(before.pin.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(p.rendered.backdrop.pin, before.pin);
  assert.equal(before.image.releases, 1);
  assert.equal(p.$('loss-difficulty-field').hidden, true);
  assert.deepEqual(
    loadLibrary(p.storage, profileKey, { campaigns: [campaign] }).library.pictureReceipts ?? [],
    [],
  );
  assert.deepEqual(p.errors, []);
}
for (const device of ['keyboard', 'controller'])
  test(`${device}: visible failure difficulty keeps the accepted result until deliberate Gentle Retry`, async (t) => {
    const { p } = await setup(t),
      before = await lose(p);
    const pulse = device === 'controller' ? controller(p, t) : null;
    for (let i = 0; i < 20 && p.doc.activeElement !== p.$('loss-difficulty-select'); i++)
      pulse ? pulse(13) : key(p, 'ArrowDown');
    assert.equal(p.doc.activeElement, p.$('loss-difficulty-select'));
    if (pulse) {
      pulse(0);
      pulse(13);
      pulse(0);
    } else key(p, 'ArrowDown');
    assert.equal(p.$('loss-difficulty-select').value, 'gentle');
    assert.equal(p.$('difficulty-select').value, 'gentle');
    assert.match(p.$('overlay-difficulty').textContent, /Retry.*Gentle/);
    kept(p, before);
    for (let i = 0; i < 30 && p.doc.activeElement !== p.$('retry-button'); i++)
      pulse ? pulse(13) : key(p, 'Tab');
    assert.equal(p.doc.activeElement, p.$('retry-button'));
    pulse ? pulse(0) : key(p, 'Enter');
    await retried(p, before, 5);
  });

test('a Journey-enabled shell still exposes failure difficulty for an unowned Legacy campaign', async (t) => {
  const { p } = await setup(t, { journey: true });
  const source = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  const importedCampaign = structuredClone(customCampaign);
  delete importedCampaign.classRecipes;
  const pack = {
    ...source,
    id: 'failure-custom-pack',
    name: 'Custom failure pack',
    themes: [themes.find((item) => item.id === 'fpv')],
    classRecipes: classes,
    campaigns: [importedCampaign],
    visualOverrides: {},
    levelVisuals: [],
  };
  p.$('shell-featured').focus();
  key(p, 'Escape');
  assert.equal(p.$('shell-home').open, false);
  p.$('library-button').click();
  p.doc.querySelector('[data-library-panel="packs"]').click();
  p.$('pack-json').value = JSON.stringify(pack);
  p.$('install-pack').click();
  await settle(() => !p.$('install-pack').disabled);
  assert.match(p.$('pack-status').textContent, /Validated and installed/);
  const play = p
    .$('installed-packs')
    .querySelectorAll('button')
    .find((button) => button.textContent === 'Play Custom failure campaign');
  assert.ok(play);
  play.click();
  await settle(() => !p.$('library-dialog').open && p.doc.body.dataset.pictureState === 'ready');
  const before = await lose(p);
  choose(p, 'gentle');
  kept(p, before);
  p.$('retry-button').click();
  await retried(p, before, 5);
});

for (const outcome of ['cancel', 'failure', 'new choice'])
  test(`Retry ${outcome} preserves loss and artwork, and the next explicit Retry uses current difficulty`, async (t) => {
    const { p, deferDecode } = await setup(t),
      before = await lose(p);
    choose(p, 'gentle');
    const gate = deferred();
    let entered = false;
    deferDecode(() => {
      entered = true;
      return gate.promise;
    });
    p.$('retry-button').focus();
    p.$('retry-button').click();
    await settle(() => entered);
    kept(p, before);
    assert.equal(p.$('flight-preparation-cancel').hidden, false);
    assert.equal(p.$('loss-difficulty-select').disabled, false);
    if (outcome === 'cancel') p.$('flight-preparation-cancel').click();
    if (outcome === 'new choice') {
      choose(p, 'standard');
      kept(p, before);
      assert.equal(p.doc.activeElement.id, 'loss-difficulty-select');
      p.$('retry-button').click();
      await retried(p, before, 1);
      const accepted = p.rendered.run,
        image = p.rendered.backdrop.image;
      gate.resolve();
      await new Promise((resolve) => setImmediate(resolve));
      p.frame(0);
      assert.equal(p.rendered.run, accepted);
      assert.equal(p.rendered.backdrop.image, image);
      assert.equal(image.releases, 0);
      assert.equal(p.doc.activeElement.id, 'game-canvas');
      assert.deepEqual(p.errors, []);
      return;
    }
    if (outcome === 'failure') gate.reject(new Error('Deliberate picture decoding failure'));
    else gate.resolve();
    await settle(() => p.$('flight-preparation-cancel').hidden);
    await new Promise((resolve) => setTimeout(resolve, 15));
    kept(p, before);
    assert.equal(p.$('retry-button').disabled, false);
    if (outcome === 'new choice') assert.equal(p.doc.activeElement.id, 'loss-difficulty-select');
    if (outcome === 'failure')
      assert.match(p.$('flight-preparation-status').textContent, /result is kept/);
    p.$('retry-button').click();
    await retried(p, before, outcome === 'new choice' ? 1 : 5);
  });

test('denied preference persistence retains session-only Gentle intent without touching the saved flight', async (t) => {
  const { p } = await setup(t),
    before = await lose(p),
    write = p.storage.setItem;
  const raw = p.storage.getItem(profileKey);
  p.storage.setItem = (key, value) => {
    if (key === profileKey) throw new Error('Preference storage denied');
    write(key, value);
  };
  choose(p, 'gentle');
  kept(p, before);
  assert.equal(p.storage.getItem(profileKey), raw);
  assert.equal(p.$('save-warning').hidden, false);
  p.$('retry-button').click();
  await retried(p, before, 5);
});

test('a legally lost imported practice never exposes or applies campaign difficulty', async (t) => {
  const { p } = await setup(t, { practice: true });
  const before = await lose(p, { available: false });
  const profile = p.storage.getItem(profileKey),
    writes = p.storage.writes.length;
  // Defensive handler boundary only; this disabled hidden field is not a player action.
  p.$('loss-difficulty-select').value = 'gentle';
  p.$('loss-difficulty-select').onchange();
  p.frame(0);
  assert.equal(p.rendered.run, before.run);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before.checkpoint);
  assert.equal(p.storage.getItem(profileKey), profile);
  assert.equal(p.storage.writes.length, writes);
  assert.deepEqual(p.errors, []);
});

test('First Flight training never offers the campaign loss preference', async (t) => {
  const p = await soloPage(t, {
    search: '?course=first-flight&lesson=close-line',
    parentWindow: {},
  });
  assert.equal(p.$('loss-difficulty-field').hidden, true);
  p.$('start-button').click();
  const before = p.rendered.run,
    profile = p.storage.getItem(profileKey);
  p.$('loss-difficulty-select').value = 'gentle';
  p.$('loss-difficulty-select').onchange(); // Defensive unavailable-control boundary.
  p.frame(0);
  assert.equal(p.rendered.run, before);
  assert.equal(p.$('loss-difficulty-select').disabled, true);
  assert.equal(p.storage.getItem(profileKey), profile);
  assert.deepEqual(p.errors, []);
});
