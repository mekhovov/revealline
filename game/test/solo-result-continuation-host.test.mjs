import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';
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

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'result-continuation',
  revision: '1',
  title: 'Owned result transitions',
  classRecipes: classes,
  levels: ['first-cut', 'next-cut'].map((id) => ({
    ...retryFixture('self-contact').level,
    id,
    name: id,
    goal: { coverage: 0.1 },
    rules: { lives: 3 },
  })),
};
const catalog = createExecutionCatalog([{ campaign, themes }]);
const ticks = (p, n) => {
  for (let i = 0; i < n; i++) p.frame();
};
async function setup(t, { journey = false } = {}) {
  const diagnostics = [];
  let diagnosticAction = null;
  t.mock.method(console, 'warn', (...args) => {
    diagnostics.push(args);
    diagnosticAction?.();
  });
  const memory = memoryIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true, soundtrackCatalogue: true });
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  const asset = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const identities = campaign.levels.map((level) => ({
    baseCampaignKey: campaignKey(campaign),
    levelId: level.id,
    levelRevision: level.revision,
    themeId: 'fpv',
  }));
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
  const p = await soloPage(t, {
    campaign,
    ...(journey
      ? { search: '?journey=1', titleScreen: true, journeyIndexedDB: managedIndexedDB().indexedDB }
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
async function win(p) {
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
  assert.equal(p.rendered.run.status, 'won');
  if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
  p.frame(0);
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
  await settle(
    () =>
      [...p.$('missions').children].every((button) => button.dataset.pictureState !== 'loading'),
    'Earned thumbnail acquisition finishes before the destination decoder is deliberately held.',
  );
}
async function running(p, id) {
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === id;
  });
}

test('Journey chooser can supersede a held result picture without waiting for its stale decode', async (t) => {
  const { p, deferDecode } = await setup(t, { journey: true });
  p.$('shell-featured').click();
  await running(p, 'first-cut');
  p.key('ArrowDown');
  for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
  assert.equal(
    p.rendered.run.status,
    'won',
    JSON.stringify({
      tick: p.rendered.run.tick,
      player: p.rendered.run.player,
      coverage: p.rendered.run.coverage,
      lives: p.rendered.run.lives,
      message: p.$('run-message').textContent,
    }),
  );
  p.key('ArrowDown', false);
  await settle(() =>
    [...p.$('missions').children].every((button) => button.dataset.pictureState !== 'loading'),
  );
  const held = deferred();
  let began = false;
  deferDecode(() => {
    began = true;
    return held.promise;
  });
  p.$('next-button').click();
  await settle(() => began);
  p.$('shell-packs').click();
  p.$('journey-search').value = 'first-cut';
  p.$('journey-search').emit('input');
  p.$('journey-cards').children[0].click();
  await running(p, 'first-cut');
  const accepted = p.rendered.run;
  held.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  p.frame(0);
  assert.equal(p.rendered.run, accepted);
  assert.equal(p.doc.body.dataset.flightState, 'running');
  assert.deepEqual(p.errors, []);
});
function snapshot(p) {
  p.frame(0);
  return {
    run: p.rendered.run,
    checkpoint: authoritativeCheckpoint(p.rendered.run),
    image: p.rendered.backdrop.image,
    profile: p.storage.getItem(profileKey),
    saved: p.storage.getItem(sessionKey),
    information: readFlightInformation(p.$('run-message')),
  };
}
function kept(p, before) {
  p.frame(0);
  assert.equal(p.rendered.run, before.run);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before.checkpoint);
  assert.equal(p.rendered.backdrop.image, before.image);
  assert.equal(before.image.releases, 0, 'The accepted drawable remains owned');
  assert.equal(p.storage.getItem(profileKey), before.profile);
  assert.equal(p.storage.getItem(sessionKey), before.saved);
  const information = readFlightInformation(p.$('run-message'));
  assert.deepEqual(information.owner, before.information.owner);
  assert.deepEqual(information.lastWarning, before.information.lastWarning);
}

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: Next stages behind the completed result and starts directly only when ready`, async (t) => {
    const { p, deferDecode } = await setup(t);
    if (policy === 'grid-center') {
      p.change('turn-select', policy);
      await settle(() => p.doc.body.dataset.pictureState === 'ready');
    }
    await win(p);
    const before = snapshot(p),
      gate = deferred();
    let entered = false;
    deferDecode(() => {
      entered = true;
      return gate.promise;
    });
    p.$('next-button').focus();
    p.$('next-button').click();
    await settle(() => entered);
    ticks(p, 30);
    kept(p, before);
    assert.equal(p.$('game-overlay').dataset.kind, 'won');
    assert.equal(p.$('next-button').disabled, true);
    assert.equal(p.$('flight-preparation-cancel').hidden, false);
    assert.equal(p.doc.activeElement.id, 'flight-preparation-cancel');
    assert.match(p.$('flight-preparation-status').textContent, /next-cut/);
    gate.resolve();
    await running(p, 'next-cut');
    assert.notEqual(p.rendered.run, before.run);
    const information = readFlightInformation(p.$('run-message'));
    assert.ok(information.owner.generation > before.information.owner.generation);
    assert.notEqual(information.owner.attempt, before.information.owner.attempt);
    assert.equal(information.snapshot.tick, 0);
    assert.equal(before.image.releases, 1, 'The accepted drawable releases once after adoption');
    assert.equal(p.rendered.run.tick, 0);
    assert.equal(p.rendered.paused, false);
    assert.equal(p.$('game-overlay').hidden, true);
    assert.equal(p.doc.activeElement.id, 'game-canvas');
    assert.equal(
      loadLibrary(p.storage, profileKey, { campaigns: [campaign] }).library.pictureReceipts.length,
      1,
    );
    assert.deepEqual(p.errors, []);
  });

for (const outcome of [
  'cancel',
  'failure',
  'failure-log-throw',
  'failure-log-reentry',
  'hidden',
  'picture',
  'reentry',
])
  test(`Next ${outcome} retains the complete result and rejects late adoption`, async (t) => {
    const { p, deferDecode, diagnostics, onDiagnostic } = await setup(t);
    await win(p);
    const failed = outcome.startsWith('failure'),
      privatePath = `./assets/${'0233'.repeat(16)}.png`,
      failure = new Error(`Presentation file unavailable: ${privatePath}`),
      before = snapshot(p),
      gate = deferred();
    if (outcome === 'failure-log-throw')
      onDiagnostic(() => {
        throw new Error('Owned diagnostic adapter failed');
      });
    if (outcome === 'failure-log-reentry') onDiagnostic(() => p.$('view-picture').click());
    let entered = false;
    deferDecode(() => {
      entered = true;
      if (outcome === 'reentry') p.$('view-picture').click();
      return gate.promise;
    });
    p.$('next-button').focus();
    p.$('next-button').click();
    await settle(() => entered);
    if (outcome === 'cancel') p.key('Escape');
    if (outcome === 'hidden') {
      p.doc.hidden = true;
      p.doc.emit('visibilitychange');
    }
    if (outcome === 'picture') p.$('view-picture').click();
    if (failed) gate.reject(failure);
    else gate.resolve();
    await settle(() => !p.$('next-button').disabled);
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (outcome === 'hidden') {
      p.doc.hidden = false;
      p.win.emit('focus');
    }
    ticks(p, 20);
    kept(p, before);
    assert.equal(p.$('flight-preparation-cancel').hidden, true);
    if (outcome === 'cancel' || outcome === 'failure' || outcome === 'failure-log-throw')
      assert.equal(p.doc.activeElement.id, 'next-button');
    if (failed) {
      assert.deepEqual(diagnostics, [['Mission preparation failed.', failure]]);
      assert.ok(!p.$('flight-preparation-status').textContent.includes(privatePath));
      if (outcome !== 'failure-log-reentry')
        assert.equal(
          p.$('flight-preparation-status').textContent,
          'Could not prepare this mission. Your result is kept. Try again.',
        );
    } else assert.deepEqual(diagnostics, []);
    if (['picture', 'reentry', 'failure-log-reentry'].includes(outcome)) {
      assert.equal(p.doc.activeElement.id, 'show-result');
      p.$('show-result').click();
    }
    p.$('next-button').click();
    await running(p, 'next-cut');
    assert.deepEqual(p.errors, []);
  });

test('Retry supersedes held Next without allowing its late result to clear newer controls or award again', async (t) => {
  const { p, deferDecode } = await setup(t);
  await win(p);
  const before = snapshot(p),
    gate = deferred();
  let entered = false;
  deferDecode(() => {
    entered = true;
    return gate.promise;
  });
  p.$('next-button').click();
  await settle(() => entered);
  p.$('retry-button').click();
  await running(p, 'first-cut');
  assert.notEqual(p.rendered.run, before.run);
  assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
  gate.resolve();
  await new Promise((resolve) => setTimeout(resolve, 15));
  p.frame(0);
  assert.equal(p.rendered.run.levelId, 'first-cut');
  assert.equal(p.doc.body.dataset.flightState, 'running');
  assert.equal(p.$('flight-preparation-cancel').hidden, true);
  assert.equal(
    loadLibrary(p.storage, profileKey, { campaigns: [campaign] }).library.pictureReceipts.length,
    1,
  );
  assert.deepEqual(p.errors, []);
});

test('a rejected result authority read gives actionable feedback without replacing its run or media', async (t) => {
  const { p, diagnostics } = await setup(t);
  await win(p);
  const before = snapshot(p),
    read = p.storage.getItem,
    failure = new Error('Owned storage read denied');
  let armed = true;
  p.storage.getItem = (key) => {
    if (armed && key.endsWith('.backup-lock')) {
      armed = false;
      throw failure;
    }
    return read(key);
  };
  p.$('next-button').click();
  await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
  p.storage.getItem = read;
  kept(p, before);
  assert.equal(
    p.$('flight-preparation-status').textContent,
    'Could not prepare this mission. Your result is kept. Try again.',
  );
  assert.deepEqual(diagnostics, [['Mission preparation failed.', failure]]);
  assert.ok(!p.$('flight-preparation-status').textContent.includes(failure.message));
  assert.equal(p.$('next-button').disabled, false);
  p.$('next-button').click();
  await running(p, 'next-cut');
  assert.deepEqual(p.errors, []);
});

test('a result authority read that reenters Retry cannot install the older Next ticket afterward', async (t) => {
  const { p } = await setup(t);
  await win(p);
  const before = snapshot(p),
    read = p.storage.getItem;
  let armed = true;
  p.storage.getItem = (key) => {
    if (armed && key.endsWith('.backup-lock')) {
      armed = false;
      p.$('retry-button').click();
    }
    return read(key);
  };
  p.$('next-button').click();
  await running(p, 'first-cut');
  p.storage.getItem = read;
  assert.notEqual(p.rendered.run, before.run);
  assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
  assert.equal(p.$('flight-preparation-cancel').hidden, true);
  assert.equal(p.$('next-button').disabled, false);
  assert.equal(p.storage.getItem(profileKey), before.profile);
  assert.deepEqual(p.errors, []);
});

test('Next outside a real won result does not change a ready or running attempt', async (t) => {
  const { p } = await setup(t);
  const before = snapshot(p);
  p.$('next-button').onclick(); // Exercise the defensive host boundary, not visible navigation.
  kept(p, before);
  p.$('start-button').click();
  await running(p, 'first-cut');
  const runningBefore = snapshot(p);
  p.$('next-button').onclick();
  kept(p, runningBefore);
  assert.deepEqual(p.errors, []);
});

test('a newer Missions difficulty choice cancels held Next and a subsequent Next uses that choice', async (t) => {
  const { p, deferDecode } = await setup(t);
  await win(p);
  const before = snapshot(p),
    gate = deferred();
  let entered = false;
  deferDecode(() => {
    entered = true;
    return gate.promise;
  });
  p.$('next-button').click();
  await settle(() => entered);
  p.$('shell-packs').click();
  p.$('shell-prepare').click();
  assert.equal(p.$('mission-picker-setup').open, true);
  p.change('difficulty-select', 'gentle');
  gate.resolve();
  await new Promise((resolve) => setTimeout(resolve, 15));
  p.frame(0);
  assert.equal(p.rendered.run, before.run);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before.checkpoint);
  assert.equal(p.rendered.backdrop.image, before.image);
  assert.equal(p.$('difficulty-select').value, 'gentle');
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  p.$('shell-missions-back').click();
  p.$('next-button').click();
  await running(p, 'next-cut');
  assert.equal(p.rendered.run.lives, 5);
  assert.deepEqual(p.errors, []);
});

for (const departure of ['missions', 'another-mission'])
  test(`post-adoption drawable release hands input to ${departure} without automatic Resume`, async (t) => {
    const { p, onRelease } = await setup(t);
    await win(p);
    const before = snapshot(p);
    let released = false;
    onRelease(before.image, () => {
      released = true;
      p.$('shell-packs').click();
      if (departure === 'another-mission') p.$('missions').children[0].click();
    });
    p.$('next-button').click();
    await settle(() => released);
    await settle(() => {
      p.frame(0);
      return (
        p.doc.body.dataset.pictureState === 'ready' &&
        p.rendered.run.levelId === (departure === 'missions' ? 'next-cut' : 'first-cut')
      );
    });
    assert.equal(p.$('shell-missions').open, true);
    assert.notEqual(p.rendered.run, before.run);
    assert.equal(p.rendered.paused, true);
    assert.equal(p.rendered.run.tick, 0);
    assert.equal(p.$('game-overlay').dataset.kind, 'ready');
    assert.notEqual(p.doc.activeElement.id, 'game-canvas');
    assert.equal(before.image.releases, 1);
    ticks(p, 20);
    assert.equal(p.rendered.run.tick, 0);
    assert.deepEqual(p.errors, []);
  });
