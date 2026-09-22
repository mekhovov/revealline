import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import {
  pngBytes,
  provenance,
  libraryRecord,
  presentationRecord,
} from './helpers/media-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { verifyReplay } from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const sessionKey = 'revealline.suspended.dev.v1';
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'picture-host',
  revision: '1',
  title: 'Picture host journey',
  classRecipes: classes,
  levels: [{ ...retryFixture('self-contact').level, goal: { coverage: 0.1 }, rules: { lives: 3 } }],
};
const catalog = createExecutionCatalog([{ campaign, themes }]);
const identity = {
  baseCampaignKey: campaignKey(campaign),
  levelId: campaign.levels[0].id,
  levelRevision: campaign.levels[0].revision,
  themeId: 'fpv',
};
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
    return Promise.resolve();
  }
  removeAttribute() {
    this.url = '';
  }
}
const ticks = (p, n) => {
  for (let i = 0; i < n; i++) p.frame();
};
async function setup(t) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      storyMedia: true,
      soundtrackCatalogue: true,
    });
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  const a = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const library = libraryRecord(identity);
  library.assets = [a.asset];
  await store.commit(
    await store.prepare(library, [{ sha256: a.asset.sha256, blob: a.blob }], {
      executionCatalog: catalog,
    }),
    { expectedGeneration: 0 },
  );
  t.after(() => manager.close());
  async function replace() {
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const b = await prepareStillAsset(
      new Blob([bytes]),
      { id: 'picture-b', provenance: provenance() },
      { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
    );
    const prior = await store.read(),
      next = structuredClone(prior.document.library);
    next.assets.push(b.asset);
    next.presentations.push(presentationRecord(identity, 2, 'picture-b'));
    next.assignments[0].revision = 2;
    await store.commit(
      await store.prepare(next, [...prior.assets, { sha256: b.asset.sha256, blob: b.blob }], {
        executionCatalog: catalog,
        previous: prior.document,
      }),
      { expectedGeneration: prior.generation },
    );
    return b;
  }
  return { memory, manager, store, a, replace };
}
async function pageFor(t, f, options = {}) {
  return soloPage(t, {
    campaign,
    soundtrackIndexedDB: f.memory.indexedDB,
    pictures: { Image: Picture },
    ...options,
  });
}

for (const format of ['xonix-session.v4', 'xonix-session.v2'])
  test(`confirmed Restart retains ${format} picture ownership after assignment changes`, async (t) => {
    const f = await setup(t),
      p = await pageFor(t, f);
    p.$('start-button').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.key('ArrowDown');
    ticks(p, 13);
    p.key('ArrowDown', false);
    p.$('pause-button').click();
    const accepted = JSON.parse(p.storage.getItem(sessionKey));
    assert.equal(accepted.format, 'xonix-session.v4');
    assert.equal(
      accepted.visualThemePin,
      undefined,
      'This regression covers attempts without complete-theme pins.',
    );
    const restored = structuredClone(accepted);
    restored.format = format;
    if (format === 'xonix-session.v2') delete restored.presentationPins;
    p.$('library-button').click();
    p.$('save-json').value = JSON.stringify(restored);
    p.$('import-save').click();
    await settle(() => !p.$('library-dialog').open);
    p.frame(0);
    assert.equal(p.rendered.paused, true);
    if (format === 'xonix-session.v2') assert.equal(p.rendered.backdrop, null);
    else assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
    await f.replace();
    const assignment = (await f.store.read()).document.library.assignments[0];
    assert.equal(assignment.revision, 2, 'Fresh attempts now select picture B.');
    p.$('start-button').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.$('pause-button').click();
    const previous = p.rendered.run;
    p.$('overlay-restart').click();
    assert.equal(p.$('restart-dialog').open, true);
    p.$('restart-confirm').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.frame(0);
    assert.notEqual(p.rendered.run, previous);
    assert.equal(p.rendered.run.tick, 0);
    if (format === 'xonix-session.v2') assert.equal(p.rendered.backdrop, null);
    else assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
    p.$('pause-button').click();
    const restarted = JSON.parse(p.storage.getItem(sessionKey));
    assert.equal(restarted.format, format);
    assert.deepEqual(restarted.presentationPins, restored.presentationPins);
    assert.equal(restarted.visualThemePin, undefined);
    assert.equal(verifyReplay(restarted.replay).match, true);
    assert.equal((await f.store.read()).document.library.assignments[0].revision, 2);
    assert.deepEqual(p.errors, []);
  });
