import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { pngBytes, provenance, libraryRecord, deferred } from './helpers/media-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { campaignKey } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'picture-ready-message',
  revision: '1',
  title: 'Picture retry status',
  classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
  levels: [{ ...retryFixture('self-contact').level, goal: { coverage: 0.1 }, rules: { lives: 3 } }],
};
const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;

const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const ticks = (p, n) => {
  for (let i = 0; i < n; i++) p.frame();
};

async function readyRetry(t, policy = 'immediate') {
  const diagnostics = [];
  t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
  const memory = memoryIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true });
  t.after(() => manager.close());
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  const prepared = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const library = libraryRecord({
    baseCampaignKey: campaignKey(campaign),
    levelId: campaign.levels[0].id,
    levelRevision: campaign.levels[0].revision,
    themeId: 'fpv',
  });
  library.assets = [prepared.asset];
  await store.commit(
    await store.prepare(library, [{ sha256: prepared.asset.sha256, blob: prepared.blob }], {
      executionCatalog: createExecutionCatalog([{ campaign, themes }]),
    }),
    { expectedGeneration: 0 },
  );
  let nextDecode = null;
  class Picture {
    constructor() {
      this.width = this.height = this.naturalWidth = this.naturalHeight = 1;
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
    }
  }
  const p = await soloPage(t, {
    campaign,
    soundtrackIndexedDB: memory.indexedDB,
    pictures: { Image: Picture },
  });
  if (policy !== 'immediate') {
    p.change('turn-select', policy);
    await settle(() => p.doc.body.dataset.pictureState === 'ready');
  }
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
  assert.equal(p.rendered.run.status, 'won', 'The first attempt must win through real input.');
  if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
  p.frame(0);
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
  await settle(() =>
    [...p.$('missions').children].every((button) => button.dataset.pictureState !== 'loading'),
  );
  const before = {
    run: p.rendered.run,
    checkpoint: authoritativeCheckpoint(p.rendered.run),
    image: p.rendered.backdrop.image,
    pin: structuredClone(p.rendered.backdrop.pin),
    profile: p.storage.getItem(profileKey),
    saved: p.storage.getItem(sessionKey),
  };
  const retained = () => {
    p.frame(0);
    assert.equal(p.rendered.run, before.run);
    assert.equal(p.rendered.run.status, 'won');
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before.checkpoint);
    assert.equal(p.rendered.backdrop.image, before.image);
    assert.deepEqual(p.rendered.backdrop.pin, before.pin);
    assert.equal(before.image.releases, 0, 'The earned drawable stays owned until adoption.');
    assert.equal(p.storage.getItem(profileKey), before.profile);
    assert.equal(p.storage.getItem(sessionKey), before.saved);
    assert.equal(p.$('game-overlay').hidden, false);
    assert.equal(p.$('game-overlay').dataset.kind, 'won');
  };
  const begin = async () => {
    const gate = deferred();
    let waiting = false;
    nextDecode = () => {
      waiting = true;
      return gate.promise;
    };
    p.$('retry-button').focus();
    p.$('retry-button').click();
    await settle(() => waiting);
    ticks(p, 30);
    retained();
    assert.equal(p.$('retry-button').disabled, true);
    assert.equal(p.$('flight-preparation-cancel').hidden, false);
    assert.equal(p.doc.activeElement.id, 'flight-preparation-cancel');
    assert.equal(p.$('flight-preparation-status').dataset.state, 'busy');
    assert.match(p.$('flight-preparation-status').textContent, new RegExp(campaign.levels[0].name));
    return gate;
  };
  return { p, before, retained, begin, diagnostics, gate: await begin() };
}

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: delayed Retry retains results through Cancel and a fresh ready Retry starts directly`, async (t) => {
    const { p, gate, before, retained, begin, diagnostics } = await readyRetry(t, policy);
    p.$('flight-preparation-cancel').click();
    retained();
    assert.equal(
      p.$('flight-preparation-status').textContent,
      'Preparation cancelled. Your result is kept.',
    );
    assert.equal(p.$('flight-preparation-status').dataset.state, 'cancelled');
    assert.equal(p.doc.activeElement.id, 'retry-button');
    assert.equal(p.$('retry-button').disabled, false);
    assert.equal(p.$('flight-preparation-cancel').hidden, true);
    gate.resolve();
    await new Promise((resolve) => setTimeout(resolve, 15));
    ticks(p, 30);
    retained();
    assert.equal(p.doc.activeElement.id, 'retry-button');
    const fresh = await begin();
    fresh.resolve();
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
    assert.notEqual(p.rendered.run, before.run);
    assert.equal(
      p.rendered.run.tick,
      0,
      'Preparation and direct Start cannot advance a fixed tick.',
    );
    assert.equal(p.rendered.run.status, 'running');
    assert.equal(p.rendered.run.turnPolicy, policy);
    assert.deepEqual(p.rendered.backdrop.pin, before.pin);
    assert.equal(before.image.releases, 1, 'The earned drawable releases once after adoption.');
    assert.equal(p.$('game-overlay').hidden, true, 'Ready does not require a second Start.');
    assert.equal(
      p.$('flight-preparation-status').hidden,
      true,
      'Adoption clears stale preparing feedback.',
    );
    assert.equal(p.doc.activeElement.id, 'game-canvas');
    assert.equal(p.$('flight-preparation-cancel').hidden, true);
    assert.doesNotMatch(
      p.$('run-message').textContent,
      /Preparing the chosen picture|stays paused/,
    );
    const runningMessage = p.$('run-message').textContent;
    ticks(p, 30);
    assert.ok(p.rendered.run.tick > 0);
    assert.equal(p.doc.body.dataset.flightState, 'running');
    assert.equal(p.$('run-message').textContent, runningMessage);
    assert.equal(p.storage.getItem(profileKey), before.profile, 'Retry grants no second reward.');
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(p.errors, []);
  });

test('failed Retry decode retains its won checkpoint and exact art with friendly actionable feedback', async (t) => {
  const { p, gate, retained, diagnostics } = await readyRetry(t);
  const failure = new Error(`Presentation file unavailable: ./assets/${'0233'.repeat(16)}.png`);
  gate.reject(failure);
  await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
  ticks(p, 30);
  retained();
  assert.equal(
    p.$('flight-preparation-status').textContent,
    'Could not prepare this mission. Your result is kept. Try again.',
  );
  assert.doesNotMatch(
    p.$('flight-preparation-status').textContent,
    /0233|assets|Presentation file/,
  );
  assert.equal(p.$('flight-preparation-cancel').hidden, true);
  assert.equal(p.$('retry-button').disabled, false);
  assert.equal(p.doc.activeElement.id, 'retry-button');
  assert.deepEqual(diagnostics, [['Mission preparation failed.', failure]]);
  assert.deepEqual(p.errors, []);
});

test('grid-center: foreground return cannot adopt or resume a cancelled Retry after late decode', async (t) => {
  const { p, gate, retained, before, diagnostics } = await readyRetry(t, 'grid-center');
  p.doc.hidden = true;
  p.doc.emit('visibilitychange');
  gate.resolve();
  await settle(() => !p.$('retry-button').disabled);
  await new Promise((resolve) => setTimeout(resolve, 15));
  p.doc.hidden = false;
  p.win.emit('focus');
  ticks(p, 30);
  retained();
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  assert.equal(p.$('flight-preparation-cancel').hidden, true);
  assert.equal(p.$('flight-preparation-status').hidden, true);
  assert.equal(p.$('flight-preparation-status').textContent, '');
  assert.equal(p.$('flight-preparation-status').dataset.state, undefined);
  assert.notEqual(p.doc.activeElement.id, 'game-canvas');
  p.$('retry-button').focus();
  p.$('retry-button').click();
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running';
  });
  assert.notEqual(p.rendered.run, before.run);
  assert.equal(p.rendered.run.tick, 0);
  assert.deepEqual(p.rendered.backdrop.pin, before.pin);
  assert.equal(p.doc.activeElement.id, 'game-canvas');
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(p.errors, []);
});
