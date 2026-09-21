import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
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
import { campaignKey } from '../library.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const profileKey = 'revealline.library.dev.v1';
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
async function setup(t, { journey = false } = {}) {
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

const statuses = (p) =>
  ['content-select-status', 'shell-featured-status'].map((id) => p.$(id).textContent);
async function selectFirst(p) {
  p.$('missions').children[0].click();
  await settle(() => statuses(p).every((text) => text.includes('first-cut selected')));
}

test('accepted Next retires the earlier selection notice before final Browse without changing the result', async (t) => {
  const { p } = await setup(t);
  await selectFirst(p);
  await win(p);
  const selectedNotice = statuses(p);
  p.$('retry-button').click();
  await running(p, 'first-cut');
  assert.deepEqual(statuses(p), selectedNotice, 'Same-mission Retry keeps selection ownership');
  await win(p);
  p.$('next-button').click();
  await running(p, 'next-cut');
  assert.deepEqual(statuses(p), ['', '']);
  await win(p);
  const run = p.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    profile = p.storage.getItem(profileKey);
  assert.equal(p.$('next-button').textContent, 'Browse campaigns →');
  p.$('next-button').focus();
  p.$('next-button').click();
  assert.equal(p.$('shell-missions').open, true);
  assert.deepEqual(statuses(p), ['', '']);
  assert.equal(p.$('missions').children[1].classList.contains('selected'), true);
  assert.equal(p.$('shell-deploy').disabled, true);
  p.$('shell-briefing').click();
  assert.equal(p.doc.activeElement.id, 'next-button');
  assert.equal(p.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(p.storage.getItem(profileKey), profile);
  assert.deepEqual(p.errors, []);
});

for (const outcome of ['cancel', 'failure'])
  test(`staged Next ${outcome} retains the accepted selection notice until successful adoption`, async (t) => {
    const { p, deferDecode } = await setup(t);
    await selectFirst(p);
    await win(p);
    const before = statuses(p),
      run = p.rendered.run,
      checkpoint = authoritativeCheckpoint(run),
      gate = deferred();
    let entered = false;
    deferDecode(() => {
      entered = true;
      return gate.promise;
    });
    p.$('next-button').click();
    await settle(() => entered);
    assert.deepEqual(statuses(p), before);
    if (outcome === 'cancel') {
      p.key('Escape');
      gate.resolve();
    } else gate.reject(new Error('Fixture destination decode failed'));
    await settle(() => !p.$('next-button').disabled);
    assert.equal(p.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual(statuses(p), before);
    p.$('next-button').click();
    await running(p, 'next-cut');
    assert.deepEqual(statuses(p), ['', '']);
    assert.deepEqual(p.errors, []);
  });

test('a later content error is not retired as if it were a successful selection notice', async (t) => {
  const { p } = await setup(t);
  await selectFirst(p);
  p.$('level-select').value = 'next-cut';
  await p.$('level-select').onchange();
  const warning = statuses(p);
  assert.ok(warning.every((text) => text.includes('still locked')));
  await win(p);
  p.$('next-button').click();
  await running(p, 'next-cut');
  assert.deepEqual(statuses(p), warning);
  assert.deepEqual(p.errors, []);
});
