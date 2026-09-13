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

async function readyRetry(t, policy = 'immediate') {
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
  const gate = deferred();
  let held = false,
    waiting = 0;
  class Picture {
    constructor() {
      this.width = this.height = this.naturalWidth = this.naturalHeight = 1;
    }
    set src(value) {
      this.url = value;
      if (value) queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this.url;
    }
    decode() {
      if (!held) return Promise.resolve();
      waiting++;
      return gate.promise;
    }
    removeAttribute() {
      this.url = '';
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
  p.key('ArrowDown');
  for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
  p.key('ArrowDown', false);
  assert.equal(p.rendered.run.status, 'won', 'The first attempt must win through real input.');
  held = true;
  p.$('retry-button').click();
  await settle(() => waiting > 0);
  p.frame(0);
  assert.match(p.$('run-message').textContent, /^Preparing the chosen picture\./);
  assert.equal(p.doc.body.dataset.flightState, 'briefing');
  const checkpoint = authoritativeCheckpoint(p.rendered.run);
  for (let i = 0; i < 30; i++) p.frame();
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  return { p, gate, checkpoint };
}

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: legal win and delayed retry replace preparing status when flight really starts`, async (t) => {
    const { p, gate } = await readyRetry(t, policy);
    gate.resolve();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.frame(0);
    assert.equal(p.rendered.run.tick, 0, 'Decoding and auto-resume cannot advance a fixed tick.');
    assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
    assert.doesNotMatch(p.$('run-message').textContent, /Preparing|stays paused/);
    const readyMessage = p.$('run-message').textContent;
    assert.match(readyMessage, /Picture ready/);
    for (let i = 0; i < 30; i++) p.frame();
    assert.ok(p.rendered.run.tick > 0);
    assert.equal(p.doc.body.dataset.flightState, 'running');
    assert.equal(p.$('run-message').textContent, readyMessage);
    assert.deepEqual(p.errors, []);
  });

test('a failed retry decode retains its recovery warning and paused checkpoint', async (t) => {
  const { p, gate, checkpoint } = await readyRetry(t);
  gate.reject(new Error('Original decoder refused test image'));
  await settle(() => p.$('run-message').textContent.startsWith('Picture unavailable:'));
  for (let i = 0; i < 30; i++) p.frame();
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.match(p.$('run-message').textContent, /Original decoder refused test image/);
  assert.doesNotMatch(p.$('run-message').textContent, /Picture ready/);
});

test('backgrounding a pending retry cannot announce a running flight on late decode', async (t) => {
  const { p, gate, checkpoint } = await readyRetry(t);
  p.doc.hidden = true;
  p.doc.emit('visibilitychange');
  gate.resolve();
  await new Promise((resolve) => setTimeout(resolve, 10));
  p.doc.hidden = false;
  p.win.emit('focus');
  for (let i = 0; i < 30; i++) p.frame();
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  assert.doesNotMatch(p.$('run-message').textContent, /Picture ready/);
});
