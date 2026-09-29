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
  deferred,
} from './helpers/media-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { presentationPicturePins } from '../flight-media-pins.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { campaignKey, loadLibrary } from '../library.mjs';
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
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
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

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: real cut saves chosen A; assignment B cannot change Resume, completion receipt or victory`, async (t) => {
    const f = await setup(t),
      p = await pageFor(t, f);
    if (policy === 'grid-center') {
      p.change('turn-select', policy);
      await settle(() => p.doc.body.dataset.pictureState === 'ready');
    }
    p.$('start-button').click();
    p.key('ArrowDown');
    ticks(p, 13);
    p.key('ArrowDown', false);
    p.$('pause-button').click();
    p.frame(0);
    const saved = JSON.parse(p.storage.getItem(sessionKey)),
      beforeTime = p.rendered.run.time;
    assert.equal(saved.format, 'xonix-session.v4');
    assert.equal(
      presentationPicturePins(saved.presentationPins).choices.find(
        (x) => x.identity.themeId === 'fpv',
      ).assetId,
      'picture-a',
    );
    assert.equal(p.rendered.backdrop.pin.sha256, f.a.asset.sha256);
    let image = p.rendered.backdrop.image;
    await f.replace();
    p.$('library-button').click();
    p.$('save-json').value = JSON.stringify(saved);
    p.$('import-save').click();
    await settle(() => !p.$('library-dialog').open);
    p.frame(0);
    assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
    assert.equal(p.doc.body.dataset.flightState, 'paused');
    assert.equal(verifyReplay(saved.replay).match, true);
    image = p.rendered.backdrop.image;
    p.$('start-button').click();
    ticks(p, 1);
    assert.equal(p.rendered.backdrop.image, image);
    assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
    assert.ok(p.rendered.run.time > beforeTime);
    for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
    assert.equal(p.rendered.run.status, 'won');
    const profile = loadLibrary(p.storage, 'revealline.library.dev.v1', {
      campaigns: [campaign],
    }).library;
    assert.equal(profile.pictureReceipts.length, 1);
    assert.equal(profile.pictureReceipts[0].presentationPin.assetId, 'picture-a');
    assert.equal(p.rendered.backdrop.image, image);
    p.$('retry-button').click();
    await settle(() => p.doc.body.dataset.pictureState === 'ready');
    p.frame(0);
    assert.equal(p.rendered.backdrop.pin.assetId, 'picture-b');
    assert.deepEqual(p.errors, []);
  });

test('pending decoded original blocks every fixed tick; background return never resumes it', async (t) => {
  const f = await setup(t),
    gate = deferred();
  let decoding = 0;
  class SlowPicture extends Picture {
    decode() {
      decoding++;
      return gate.promise;
    }
  }
  const p = await pageFor(t, f, { pictures: { Image: SlowPicture }, waitForPictures: false });
  await settle(() => decoding > 0);
  const before = authoritativeCheckpoint(p.rendered.run);
  p.$('start-button').click();
  p.key('ArrowDown');
  ticks(p, 30);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(decoding, 1, 'Start observes the existing prewarm instead of decoding again.');
  assert.equal(p.$('flight-preparation-status').dataset.state, 'busy');
  assert.equal(p.$('flight-preparation-cancel').hidden, false);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  p.doc.hidden = true;
  p.doc.emit('visibilitychange');
  gate.resolve();
  await new Promise((r) => setTimeout(r, 10));
  p.doc.hidden = false;
  p.win.emit('focus');
  ticks(p, 10);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
  assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
  assert.equal(p.rendered.run.tick, 0);
  assert.deepEqual(p.errors, []);
});

test('a failed picture prewarm can be retried without reusing its rejected promise', async (t) => {
  const f = await setup(t),
    gate = deferred();
  let decoding = 0;
  class RetryPicture extends Picture {
    decode() {
      decoding++;
      return decoding === 1 ? gate.promise : Promise.resolve();
    }
  }
  const p = await pageFor(t, f, { pictures: { Image: RetryPicture }, waitForPictures: false });
  await settle(() => decoding === 1);
  p.$('start-button').click();
  const before = authoritativeCheckpoint(p.rendered.run);
  gate.reject(new Error('Decoder temporarily unavailable'));
  await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
  assert.match(p.$('flight-preparation-status').textContent, /Decoder temporarily unavailable/);
  ticks(p, 10);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
  assert.equal(decoding, 2);
  assert.equal(p.rendered.backdrop.pin.assetId, 'picture-a');
  assert.deepEqual(p.errors, []);
});

test('cancelling picture preparation restores keyboard focus before native hiding drops it', async (t) => {
  const f = await setup(t),
    gate = deferred();
  let decoding = 0;
  class HeldPicture extends Picture {
    decode() {
      decoding++;
      return gate.promise;
    }
  }
  const p = await pageFor(t, f, { pictures: { Image: HeldPicture }, waitForPictures: false });
  await settle(() => decoding === 1);
  p.$('start-button').click();
  const before = authoritativeCheckpoint(p.rendered.run),
    cancel = p.$('flight-preparation-cancel');
  let hidden = cancel.hidden;
  Object.defineProperty(cancel, 'hidden', {
    configurable: true,
    get: () => hidden,
    set(value) {
      hidden = value;
      // A browser drops focus when its current action becomes display:none.
      if (value && p.doc.activeElement === cancel) p.doc.body.focus();
    },
  });
  cancel.focus();
  cancel.click();
  assert.equal(p.doc.activeElement, p.$('start-button'));
  assert.equal(p.$('flight-preparation-status').dataset.state, 'cancelled');
  gate.resolve();
  await new Promise((resolve) => setTimeout(resolve, 10));
  ticks(p, 10);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.equal(p.doc.activeElement, p.$('start-button'));
});

// Deliver through the mounted navigation listeners and the actual pad router.
// DOM, decoding and standard pad samples are modeled; no native layout claim.
function backInput(page, mode, pad) {
  if (mode === 'keyboard') {
    const target = page.doc.activeElement;
    const event = target.emit('keydown', { key: 'Escape', code: 'Escape', repeat: false });
    target.emit('keyup', { key: 'Escape', code: 'Escape' });
    assert.equal(event.defaultPrevented, true, 'The actual menu route handles Escape.');
  } else {
    pad.buttons[1] = { pressed: true, value: 1 };
    page.frame(16);
    pad.buttons[1] = { pressed: false, value: 0 };
    page.frame(16);
  }
}
function standardPad() {
  return {
    index: 0,
    id: 'Pending picture Back',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}
function joinPad(page, pad) {
  page.frame(16);
  pad.buttons[13] = { pressed: true, value: 1 };
  page.frame(16);
  pad.buttons[13] = { pressed: false, value: 0 };
  page.frame(16);
}
for (const launch of ['start', 'retry', 'restart'])
  for (const mode of ['keyboard', 'controller'])
    test(`${mode} Back cancels pending picture ${launch} without late resume`, async (t) => {
      const f = await setup(t),
        gate = deferred(),
        pad = standardPad();
      t.after(() => gate.resolve());
      let hold = launch === 'start',
        heldDecodes = 0;
      class HeldPicture extends Picture {
        decode() {
          if (!hold) return Promise.resolve();
          heldDecodes++;
          return gate.promise;
        }
      }
      const p = await pageFor(t, f, {
        pictures: { Image: HeldPicture },
        waitForPictures: launch !== 'start',
        readPads: () => [pad],
      });
      joinPad(p, pad);
      if (launch !== 'start') {
        p.$('start-button').click();
        p.key('ArrowDown');
        if (launch === 'retry') {
          for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
          p.key('ArrowDown', false);
          assert.equal(p.rendered.run.status, 'won');
          await settle(
            () =>
              !p.$('skip-celebration').hidden ||
              !p.$('show-result').hidden ||
              !p.$('retry-button').hidden,
          );
          if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
          if (!p.$('show-result').hidden) p.$('show-result').click();
          assert.equal(p.$('retry-button').hidden, false, 'Retry belongs to the settled results.');
          hold = true;
          p.$('retry-button').click();
        } else {
          ticks(p, 13);
          p.key('ArrowDown', false);
          p.$('pause-button').click();
          assert.equal(verifyReplay(JSON.parse(p.storage.getItem(sessionKey)).replay).match, true);
          hold = true;
          p.$('overlay-restart').click();
          assert.equal(p.$('restart-dialog').open, true);
          p.$('restart-confirm').click();
        }
      } else p.$('start-button').click();
      try {
        // Victory display and Retry may overlap; this gate holds every decode.
        await settle(() => heldDecodes > 0);
      } catch (error) {
        error.message += ` ${JSON.stringify({ heldDecodes, state: p.doc.body.dataset.flightState, picture: p.doc.body.dataset.pictureState, preparation: p.$('flight-preparation-status').dataset.state, text: p.$('flight-preparation-status').textContent, errors: p.errors.map(String) })}`;
        throw error;
      }
      // Render the newly prepared run and release the router's input-reset latch.
      p.frame(0);
      assert.equal(p.$('flight-preparation-status').dataset.state, 'busy');
      const before = authoritativeCheckpoint(p.rendered.run),
        saved = p.storage.getItem(sessionKey),
        library = p.storage.getItem('revealline.library.dev.v1'),
        selected = [p.$('pack-select').value, p.$('level-select').value, p.$('theme-select').value],
        media = await f.store.read();
      p.$('flight-preparation-cancel').focus();
      backInput(p, mode, pad);
      assert.equal(p.$('flight-preparation-status').dataset.state, 'cancelled');
      assert.equal(p.$('flight-preparation-cancel').hidden, true);
      assert.equal(p.doc.activeElement, p.$('start-button'));
      if (mode === 'keyboard') gate.resolve();
      else gate.reject(new Error('Late decoder failure after Back'));
      await new Promise((resolve) => setTimeout(resolve, 10));
      ticks(p, 30);
      assert.notEqual(p.doc.body.dataset.flightState, 'running');
      assert.equal(p.$('flight-preparation-status').dataset.state, 'cancelled');
      assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
      assert.equal(p.storage.getItem(sessionKey), saved);
      assert.equal(p.storage.getItem('revealline.library.dev.v1'), library);
      assert.deepEqual(
        [p.$('pack-select').value, p.$('level-select').value, p.$('theme-select').value],
        selected,
      );
      const after = await f.store.read();
      assert.deepEqual(after.document, media.document);
      assert.deepEqual(
        after.assets.map(({ sha256 }) => sha256),
        media.assets.map(({ sha256 }) => sha256),
      );
      assert.equal(p.doc.activeElement, p.$('start-button'));
      assert.deepEqual(p.errors, []);
    });

for (const mode of ['keyboard', 'controller'])
  test(`${mode} Back on an ordinary ready picture keeps the existing ready behavior`, async (t) => {
    const f = await setup(t),
      pad = standardPad(),
      p = await pageFor(t, f, { readPads: () => [pad] });
    joinPad(p, pad);
    const before = authoritativeCheckpoint(p.rendered.run),
      state = p.$('flight-preparation-status').dataset.state;
    p.$('start-button').focus();
    backInput(p, mode, pad);
    ticks(p, 5);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
    assert.notEqual(p.doc.body.dataset.flightState, 'running');
    assert.equal(p.$('flight-preparation-status').dataset.state, state);
    assert.equal(p.doc.activeElement, p.$('start-button'));
    assert.deepEqual(p.errors, []);
  });

test('old v2 saved flight remains legacy even when a current managed assignment exists', async (t) => {
  const f = await setup(t),
    p = await pageFor(t, f);
  p.$('start-button').click();
  p.key('ArrowDown');
  ticks(p, 13);
  p.key('ArrowDown', false);
  p.$('pause-button').click();
  const old = JSON.parse(p.storage.getItem(sessionKey));
  old.format = 'xonix-session.v2';
  delete old.presentationPins;
  p.$('library-button').click();
  p.$('save-json').value = JSON.stringify(old);
  p.$('import-save').click();
  await settle(() => !p.$('library-dialog').open);
  p.frame(0);
  assert.equal(p.rendered.backdrop, null);
  assert.equal(p.doc.body.dataset.flightState, 'paused');
  p.$('start-button').click();
  p.frame();
  p.$('pause-button').click();
  assert.equal(JSON.parse(p.storage.getItem(sessionKey)).format, 'xonix-session.v2');
  assert.equal(verifyReplay(JSON.parse(p.storage.getItem(sessionKey)).replay).match, true);
});

test('unavailable storage blocks a new flight until explicit original-art choice', async (t) => {
  const bad = {
    open() {
      throw new Error('Storage refused for test');
    },
  };
  const p = await soloPage(t, { campaign, soundtrackIndexedDB: bad, waitForPictures: false });
  await settle(() => !p.$('picture-use-legacy').hidden);
  p.$('start-button').click();
  ticks(p, 10);
  assert.equal(p.rendered.run.tick, 0);
  p.$('picture-use-legacy').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  ticks(p, 12);
  p.$('pause-button').click();
  const saved = JSON.parse(p.storage.getItem(sessionKey));
  assert.ok(
    presentationPicturePins(saved.presentationPins).choices.every((pin) => pin.kind === 'legacy'),
  );
  assert.equal(p.rendered.backdrop, null);
});

test('a missing saved original cannot adopt a different picture or overwrite the current paused attempt', async (t) => {
  const f = await setup(t),
    p = await pageFor(t, f);
  p.$('start-button').click();
  p.key('ArrowDown');
  ticks(p, 13);
  p.key('ArrowDown', false);
  p.$('pause-button').click();
  const savedA = JSON.parse(p.storage.getItem(sessionKey));
  await f.replace();
  p.$('overlay-restart').click();
  assert.equal(p.$('restart-dialog').open, true);
  p.$('restart-confirm').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowRight');
  ticks(p, 8);
  p.key('ArrowRight', false);
  p.$('pause-button').click();
  p.frame(0);
  const current = p.rendered.run,
    checkpoint = authoritativeCheckpoint(current),
    raw = p.storage.getItem(sessionKey),
    image = p.rendered.backdrop;
  assert.equal(image.pin.assetId, 'picture-b');
  // Model lost/corrupt user storage through the actual IDB transaction boundary.
  const db = await new Promise((resolve, reject) => {
    const r = f.memory.indexedDB.open('revealline-soundtrack-v1', 4);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const tx = db.transaction(['mediaBlobs'], 'readwrite');
  tx.objectStore('mediaBlobs').delete(f.a.asset.sha256);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  p.$('library-button').click();
  const beforeImport = p.storage.getItem(sessionKey);
  p.$('save-json').value = JSON.stringify(savedA);
  p.$('import-save').click();
  await settle(() => /original is missing/.test(p.$('save-status').textContent));
  p.frame(0);
  assert.equal(p.rendered.run, current);
  assert.deepEqual(authoritativeCheckpoint(current), checkpoint);
  assert.equal(p.rendered.backdrop, image);
  assert.equal(p.storage.getItem(sessionKey), beforeImport);
  assert.ok(raw);
  assert.equal(p.rendered.paused, true);
  assert.equal(p.$('library-dialog').open, true);
});

test('First Flight keeps legacy artwork and creates no managed or player progress writes', async (t) => {
  const f = await setup(t);
  f.memory.allPuts.length = 0;
  const before = f.memory.openCount;
  const p = await pageFor(t, f, { search: '?course=first-flight&lesson=close-line' });
  const writes = p.storage.writes.length;
  p.$('start-button').click();
  p.key('ArrowDown');
  ticks(p, 30);
  p.key('ArrowDown', false);
  p.$('pause-button').click();
  p.frame(0);
  assert.equal(p.rendered.backdrop, null);
  assert.equal(p.storage.writes.length, writes);
  assert.deepEqual(f.memory.allPuts, []);
  assert.equal(f.memory.openCount, before);
});

test('managed current attempt export and First Flight handoff preserve the exact pinned saved session', async (t) => {
  const f = await setup(t),
    p = await pageFor(t, f);
  let navigation = null;
  p.win.location.assign = (url) => {
    navigation = url;
  };
  p.change('turn-select', 'grid-center');
  await settle(() => p.doc.body.dataset.pictureState === 'ready');
  p.$('start-button').click();
  p.key('ArrowDown');
  ticks(p, 13);
  p.key('ArrowDown', false);
  p.key('ArrowRight');
  ticks(p, 1);
  p.key('ArrowRight', false);
  p.$('pause-button').click();
  p.frame(0);
  const raw = JSON.parse(p.storage.getItem(sessionKey)),
    checkpoint = authoritativeCheckpoint(p.rendered.run);
  p.$('library-button').click();
  p.$('export-session').click();
  await settle(() => p.$('save-json').value.startsWith('{'));
  const exported = JSON.parse(p.$('save-json').value);
  assert.equal(exported.format, 'xonix-session.v4');
  assert.deepEqual(exported.presentationPins, raw.presentationPins);
  assert.equal(verifyReplay(exported.replay).match, true);
  p.$('library-dialog').close();
  p.$('help-button').click();
  p.$('first-flight-help-enter').click();
  await settle(() => navigation !== null);
  const retained = JSON.parse(p.storage.getItem(sessionKey));
  assert.equal(retained.format, 'xonix-session.v4');
  assert.deepEqual(retained.presentationPins, raw.presentationPins);
  assert.deepEqual(retained.continuation, raw.continuation);
  assert.equal(verifyReplay(retained.replay).match, true);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.match(navigation, /course=first-flight/);
});

test('raw installed campaign plus retained normalized owner can export a complete pinned backup', async (t) => {
  const f = await setup(t),
    p = await pageFor(t, f);
  p.$('start-button').click();
  p.key('ArrowDown');
  ticks(p, 13);
  p.key('ArrowDown', false);
  p.$('pause-button').click();
  p.$('library-button').click();
  p.$('export-backup').click();
  await settle(() => p.$('save-json').value.startsWith('{'));
  const backup = JSON.parse(p.$('save-json').value);
  assert.equal(backup.session.format, 'xonix-session.v4');
  assert.equal(
    presentationPicturePins(backup.session.presentationPins).choices.find(
      (x) => x.identity.themeId === 'fpv',
    ).assetId,
    'picture-a',
  );
  assert.equal(verifyReplay(backup.session.replay).match, true);
});

for (const outcome of ['ready', 'error', 'background'])
  test(`confirmed Workshop Restart with ${outcome} picture completion has no retained modal or stale auto-start`, async (t) => {
    const f = await setup(t),
      gate = deferred();
    let delayed = false,
      entered = 0,
      released = 0;
    class RestartPicture extends Picture {
      decode() {
        if (!delayed) return Promise.resolve();
        entered++;
        return gate.promise;
      }
      removeAttribute() {
        if (delayed) released++;
        super.removeAttribute();
      }
    }
    const p = await pageFor(t, f, { pictures: { Image: RestartPicture } });
    p.$('start-button').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.key('ArrowDown');
    ticks(p, 13);
    p.key('ArrowDown', false);
    p.$('pause-button').click();
    p.$('overlay-menu').click();
    p.$('shell-workshop').click();
    p.$('restart-button').closest('details').open = true;
    p.$('restart-button').focus();
    const previous = p.rendered.run,
      saved = p.storage.getItem(sessionKey);
    p.$('restart-button').click();
    assert.equal(p.$('restart-dialog').open, true);
    delayed = true;
    p.$('restart-confirm').click();
    await settle(() => entered === 1);
    p.frame(0);
    const next = p.rendered.run;
    assert.notEqual(next, previous);
    assert.equal(p.$('shell-workshop-dialog').open, false);
    assert.equal(p.$('shell-home').open, false);
    assert.equal(p.$('restart-dialog').open, false);
    assert.equal(next.tick, 0);
    assert.equal(p.rendered.paused, true);
    assert.equal(p.storage.getItem(sessionKey), saved);
    ticks(p, 20);
    assert.equal(next.tick, 0);
    if (outcome === 'background') globalThis.window.emit('blur');
    if (outcome === 'error') gate.reject(new Error('Modeled fresh picture decode failure'));
    else gate.resolve();
    if (outcome === 'background') await settle(() => released > 0);
    else
      await settle(() =>
        outcome === 'error'
          ? p.$('flight-preparation-status').dataset.state === 'error'
          : p.doc.body.dataset.pictureState === 'ready',
      );
    if (outcome === 'ready') await settle(() => p.doc.body.dataset.flightState === 'running');
    p.frame(0);
    assert.equal(p.rendered.run, next);
    assert.equal(p.rendered.paused, outcome !== 'ready');
    assert.equal(next.tick, 0);
    assert.equal(p.storage.getItem(sessionKey), saved);
    if (outcome === 'error') assert.match(p.$('run-message').textContent, /picture.*unavailable/i);
    if (outcome === 'background') {
      globalThis.window.emit('focus');
      ticks(p, 20);
      assert.equal(p.rendered.paused, true);
      assert.equal(next.tick, 0);
    }
  });
