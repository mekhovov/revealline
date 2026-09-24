// Real Solo host and simulation; only browser/media boundaries are modeled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { pngBytes, provenance, libraryRecord, deferred } from './helpers/media-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { campaignKey, emptyLibrary } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { BACKUP_FORMAT } from '../backup.mjs';
import { acceptGameDataReplacement } from './helpers/backup-preflight.mjs';
const slot = 'revealline.suspended.dev.v1';
const ticks = (h, n = 1) => {
  for (let i = 0; i < n; i++) h.frame();
};
const snapshot = (h) => {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
};
const menu = (h) => h.$('shell-menu').click();
// A programmatic click does not focus a control. These journeys model an
// already-focused keyboard action, independently of the minimal boot DOM.
const activateTitle = (h, id) => {
  h.$(id).focus();
  assert.equal(h.doc.activeElement.id, id);
  h.$(id).click();
};
const start = async (h) => {
  h.$('shell-featured').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
};
async function flying(t, { policy = 'immediate', ...options } = {}) {
  const h = await soloPage(t, { ...options, titleScreen: true });
  if (policy !== 'immediate') {
    h.change('turn-select', policy);
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
  }
  await start(h);
  h.key('ArrowDown');
  ticks(h, 12);
  h.key('ArrowDown', false);
  h.key('ArrowRight');
  ticks(h);
  h.key('ArrowRight', false);
  assert.equal(h.rendered.run.player.cutting, true);
  return h;
}
test('one title Start launches the actual named selected mission without opening Missions', async (t) => {
  const h = await soloPage(t, { titleScreen: true }),
    run = h.rendered.run;
  assert.match(h.$('shell-destination').textContent, /Start · First Signal/);
  assert.equal(h.doc.activeElement, h.$('shell-featured'));
  await start(h);
  h.frame(0);
  assert.equal(h.rendered.run, run);
  assert.equal(h.rendered.run.tick, 0);
  assert.equal(h.$('shell-home').open, false);
  assert.equal(h.$('shell-missions').open, false);
  assert.equal(h.doc.activeElement.id, 'game-canvas');
  assert.equal(h.storage.getItem(slot), null);
  assert.deepEqual(h.errors, []);
});
for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: named memory Continue preserves the exact cut, queue and saved bytes`, async (t) => {
    const h = await flying(t, { policy });
    menu(h);
    const run = h.rendered.run,
      before = snapshot(h),
      beforeTick = h.rendered.run.tick,
      bytes = h.storage.getItem(slot);
    assert.equal(h.$('shell-continue').hidden, false);
    h.$('shell-continue').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    assert.equal(h.rendered.run, run);
    assert.deepEqual(snapshot(h), before);
    assert.equal(h.storage.getItem(slot), bytes);
    assert.equal(h.$('shell-home').open, false);
    ticks(h, 4);
    assert.ok(h.rendered.run.tick > beforeTick);
    assert.deepEqual(h.errors, []);
  });
  test(`${policy}: title Continue restores a real saved cut and starts once; ordinary Load stays paused`, async (t) => {
    const storage = memoryStorage();
    let before, bytes;
    await t.test('create a real saved flight', async (t) => {
      const h = await flying(t, { policy, storage });
      h.$('pause-button').click();
      before = snapshot(h);
      bytes = storage.getItem(slot);
      assert.ok(bytes);
    });
    bytes = storage.getItem(slot); // Actual final seed-page save after its pagehide boundary.
    await t.test('explicit title Continue', async (t) => {
      const h = await soloPage(t, { storage, titleScreen: true });
      assert.equal(h.$('shell-continue').hidden, false);
      assert.equal(h.doc.activeElement, h.$('shell-continue'));
      h.$('shell-continue').click();
      await settle(() => h.doc.body.dataset.flightState === 'running');
      assert.deepEqual(snapshot(h), before);
      assert.equal(storage.getItem(slot), bytes);
      assert.equal(h.$('shell-home').open, false);
      assert.deepEqual(h.errors, []);
    });
    await t.test('ordinary saved-flight load', async (t) => {
      const h = await soloPage(t, { storage });
      await h.$('continue-saved').onclick();
      h.frame(0);
      assert.equal(h.rendered.paused, true);
      assert.deepEqual(snapshot(h), before);
      assert.deepEqual(h.errors, []);
    });
  });
}
test('corrupt saved bytes are retained and a title Start offers Library recovery', async (t) => {
  const storage = memoryStorage({ [slot]: '{not-json' }),
    h = await soloPage(t, { storage, titleScreen: true });
  const before = snapshot(h);
  h.$('shell-featured').click();
  await settle(() => !h.$('shell-featured').hasAttribute('aria-busy'));
  assert.deepEqual(snapshot(h), before);
  assert.equal(h.$('shell-home').open, true);
  assert.equal(storage.getItem(slot), '{not-json');
  assert.match(h.$('shell-flight-status').textContent, /saved flight.*Library/i);
});
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
async function media(t) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      storyMedia: true,
      soundtrackCatalogue: true,
    });
  const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
  const themes = JSON.parse(
    readFileSync(new URL('../content/themes.json', import.meta.url)),
  ).themes;
  const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
  const catalog = createExecutionCatalog([{ campaign, classRecipes: classes, themes }]);
  const identity = {
    baseCampaignKey: campaignKey(campaign),
    levelId: campaign.levels[0].id,
    levelRevision: campaign.levels[0].revision,
    themeId: 'fpv',
  };
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  const asset = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const library = libraryRecord(identity);
  library.assets = [asset.asset];
  await store.commit(
    await store.prepare(library, [{ sha256: asset.asset.sha256, blob: asset.blob }], {
      executionCatalog: catalog,
    }),
    { expectedGeneration: 0 },
  );
  t.after(() => manager.close());
  return { memory, campaign };
}
for (const action of [
  'complete',
  'cancel',
  'missions',
  'settings',
  'blur',
  'hidden',
  'pagehide',
  'new-save',
])
  test(`delayed real picture: ${action} keeps title intent scoped to its original visit`, async (t) => {
    const f = await media(t),
      gate = deferred();
    let decoding = 0;
    class SlowPicture extends Picture {
      decode() {
        decoding++;
        return gate.promise;
      }
    }
    const h = await soloPage(t, {
      titleScreen: true,
      campaign: f.campaign,
      soundtrackIndexedDB: f.memory.indexedDB,
      pictures: { Image: SlowPicture },
      waitForPictures: false,
    });
    await settle(() => decoding > 0);
    const before = snapshot(h);
    activateTitle(h, 'shell-featured');
    assert.equal(h.$('shell-flight-cancel').hidden, false);
    assert.equal(h.doc.activeElement.id, 'shell-featured');
    assert.equal(h.$('shell-featured').getAttribute('aria-busy'), 'true');
    assert.equal(h.$('shell-flight-status').closest('dialog').id, 'shell-home');
    if (action === 'cancel') h.$('shell-flight-cancel').click();
    if (action === 'missions') {
      h.$('shell-play').click();
      h.$('shell-missions-back').click();
    }
    if (action === 'settings') h.$('shell-options').click();
    if (action === 'blur') h.win.emit('blur');
    if (action === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (action === 'pagehide') h.win.emit('pagehide', { persisted: true });
    if (action === 'new-save') h.storage.setItem(slot, 'newer-slot');
    gate.resolve();
    await settle(() => !h.$('shell-featured').hasAttribute('aria-busy'));
    if (action === 'hidden') {
      h.doc.hidden = false;
      h.win.emit('focus');
    }
    h.frame(0);
    assert.equal(h.rendered.paused, action !== 'complete');
    assert.deepEqual(snapshot(h), before);
    if (action === 'settings') assert.equal(h.$('settings-dialog').open, true);
    if (action === 'new-save') assert.equal(h.storage.getItem(slot), 'newer-slot');
    if (action === 'cancel') assert.equal(h.doc.activeElement.id, 'shell-featured');
    assert.deepEqual(h.errors, []);
  });

test('held Confirm stays on Start and cannot turn into Stop loading', async (t) => {
  const f = await media(t),
    gate = deferred();
  let decoding = 0;
  class SlowPicture extends Picture {
    decode() {
      decoding++;
      return gate.promise;
    }
  }
  const h = await soloPage(t, {
    titleScreen: true,
    campaign: f.campaign,
    soundtrackIndexedDB: f.memory.indexedDB,
    pictures: { Image: SlowPicture },
    waitForPictures: false,
  });
  await settle(() => decoding > 0);
  activateTitle(h, 'shell-featured');
  assert.equal(h.doc.activeElement.id, 'shell-featured');
  assert.equal(h.$('shell-featured').getAttribute('aria-busy'), 'true');
  assert.equal(h.$('shell-flight-cancel').hidden, false);

  // Model repeat events from one held keyboard/controller activation. The
  // stable action remains the owner and no replacement launch is created.
  h.$('shell-featured').click();
  h.$('shell-featured').click();
  assert.equal(h.doc.activeElement.id, 'shell-featured');
  assert.equal(h.$('shell-featured').getAttribute('aria-busy'), 'true');
  assert.equal(h.$('shell-flight-cancel').hidden, false);

  gate.resolve();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  assert.equal(h.$('shell-featured').hasAttribute('aria-busy'), false);
  assert.equal(h.$('shell-flight-cancel').hidden, true);
  assert.deepEqual(h.errors, []);
});

for (const action of ['complete', 'cancel', 'escape', 'new-save', 'missions', 'blur'])
  test(`saved original restore: ${action} is checked before adopting a new run`, async (t) => {
    const f = await media(t),
      storage = memoryStorage();
    let expected;
    await t.test('save actual picture and cut', async (t) => {
      const h = await flying(t, {
        storage,
        campaign: f.campaign,
        soundtrackIndexedDB: f.memory.indexedDB,
        pictures: { Image: Picture },
      });
      h.$('pause-button').click();
      expected = snapshot(h);
      assert.ok(JSON.parse(storage.getItem(slot)).presentationPins);
    });
    const capturedRaw = storage.getItem(slot);
    await t.test('verified title restore', async (t) => {
      const gate = deferred();
      let decodes = 0;
      class RestorePicture extends Picture {
        decode() {
          decodes++;
          return decodes === 1 ? Promise.resolve() : gate.promise;
        }
      }
      const h = await soloPage(t, {
        storage,
        titleScreen: true,
        campaign: f.campaign,
        soundtrackIndexedDB: f.memory.indexedDB,
        pictures: { Image: RestorePicture },
      });
      const old = h.rendered.run,
        before = snapshot(h);
      activateTitle(h, 'shell-continue');
      await settle(() => decodes >= 2);
      assert.equal(h.$('shell-flight-cancel').hidden, false);
      assert.equal(h.doc.activeElement.id, 'shell-continue');
      assert.equal(h.$('shell-continue').getAttribute('aria-busy'), 'true');
      assert.equal(h.$('shell-home').open, true);
      if (action === 'cancel') {
        h.$('shell-flight-cancel').click();
        assert.equal(
          h.$('flight-preparation-cancel').hidden,
          true,
          'Title cancellation settles field status before a held decoder finishes',
        );
        assert.match(h.$('flight-preparation-status').textContent, /Preparation cancelled/);
      }
      if (action === 'escape') {
        const event = new Event('cancel', { cancelable: true });
        h.$('shell-home').dispatchEvent(event);
        assert.equal(
          event.defaultPrevented,
          true,
          'Back cancels preparation without closing title',
        );
        assert.equal(h.$('shell-home').open, true);
        assert.equal(h.doc.activeElement.id, 'shell-continue');
        assert.equal(h.$('flight-preparation-cancel').hidden, true);
      }
      if (action === 'new-save') storage.setItem(slot, 'newer-saved-flight');
      if (action === 'missions') {
        h.$('shell-play').click();
        h.$('shell-missions-back').click();
      }
      if (action === 'blur') h.win.emit('blur');
      gate.resolve();
      await settle(() => !h.$('shell-continue').hasAttribute('aria-busy'));
      // Let cancelled asynchronous verification reach its actual cleanup boundary.
      await settle(() => !h.$('continue-saved').disabled);
      h.frame(0);
      if (action === 'complete') {
        assert.notEqual(h.rendered.run, old);
        assert.equal(h.rendered.paused, false);
        assert.deepEqual(snapshot(h), expected);
      } else {
        assert.equal(h.rendered.run, old);
        assert.equal(h.rendered.paused, true);
        assert.deepEqual(snapshot(h), before);
      }
      assert.equal(
        storage.getItem(slot),
        action === 'new-save' ? 'newer-saved-flight' : capturedRaw,
      );
      assert.equal(
        h.$('flight-preparation-cancel').hidden,
        true,
        'Settled title restore cannot leave a stale preparation action behind',
      );
      assert.doesNotMatch(
        h.$('flight-preparation-status').textContent,
        /Verifying your saved flight|Preparing the chosen picture/,
        'Both title and field status must settle after completion or cancellation',
      );
      assert.deepEqual(h.errors, []);
    });
  });
for (const outcome of ['won', 'lost'])
  test(`title Start remains actionable after a real ${outcome} result`, async (t) => {
    const source = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
    const level = {
      ...source.levels[0],
      goal: { coverage: 0.01 },
      enemies: [],
      rules: { lives: 1, ...(outcome === 'lost' ? { timeLimitSeconds: 0.1 } : {}) },
    };
    const campaign = {
      ...source,
      id: `title-terminal-${outcome}`,
      briefs: [source.briefs[0]],
      levels: [level],
    };
    const h = await soloPage(t, { campaign, titleScreen: true });
    await start(h);
    if (outcome === 'lost') ticks(h, 20);
    else {
      h.key('ArrowDown');
      ticks(h, 30);
      h.key('ArrowDown', false);
      h.key('ArrowRight');
      ticks(h, 12);
      h.key('ArrowRight', false);
      h.key('ArrowUp');
      ticks(h, 50);
      h.key('ArrowUp', false);
    }
    assert.equal(h.rendered.run.status, outcome);
    h.$('skip-celebration').click();
    menu(h);
    const prior = h.rendered.run;
    assert.equal(h.$('shell-featured').hidden, false);
    await start(h);
    h.frame(0);
    assert.notEqual(h.rendered.run, prior);
    assert.equal(h.rendered.run.levelId, prior.levelId);
    assert.equal(h.rendered.run.tick, 0);
    assert.equal(h.rendered.run.status, 'running');
    assert.deepEqual(h.errors, []);
  });
test('a storage refusal inside restore status cleans up and a fresh Continue still works', async (t) => {
  const storage = memoryStorage();
  await t.test('create saved flight', async (t) => {
    const h = await flying(t, { storage });
    h.$('pause-button').click();
  });
  await t.test('fail while restore owns its busy state, then retry', async (t) => {
    const h = await soloPage(t, { storage, titleScreen: true });
    const before = storage.getItem(slot),
      get = storage.getItem;
    let refused = false;
    storage.getItem = (key) => {
      if (key === slot && h.$('continue-saved').disabled && !refused) {
        refused = true;
        throw new Error('Storage refused during status');
      }
      return get(key);
    };
    activateTitle(h, 'shell-continue');
    await settle(() => !h.$('shell-continue').hasAttribute('aria-busy'));
    assert.equal(refused, true);
    assert.equal(h.$('continue-saved').disabled, false);
    assert.match(h.$('shell-flight-status').textContent, /Storage refused/);
    assert.equal(h.doc.activeElement.id, 'shell-continue');
    assert.equal(storage.getItem(slot), before);
    assert.equal(h.rendered.paused, true);
    h.$('shell-continue').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    assert.equal(storage.getItem(slot), before);
    assert.deepEqual(h.errors, []);
  });
});

for (const outcome of ['cancel', 'error'])
  for (const focusChange of ['other-action', 'background'])
    test(`title ${outcome} cleanup preserves ${focusChange} during native Cancel hiding`, async (t) => {
      const f = await media(t),
        gate = deferred();
      let decoding = false;
      class HeldPicture extends Picture {
        decode() {
          decoding = true;
          return gate.promise;
        }
      }
      const h = await soloPage(t, {
        titleScreen: true,
        campaign: f.campaign,
        soundtrackIndexedDB: f.memory.indexedDB,
        pictures: { Image: HeldPicture },
        waitForPictures: false,
      });
      await settle(() => decoding);
      const before = snapshot(h),
        saved = h.storage.getItem(slot),
        cancel = h.$('shell-flight-cancel');
      activateTitle(h, 'shell-featured');
      assert.equal(h.doc.activeElement.id, 'shell-featured');
      assert.equal(h.$('shell-featured').getAttribute('aria-busy'), 'true');

      // A deliberate focus change or browser backgrounding during preparation
      // must remain authoritative when the secondary Stop loading control hides.
      let hidden = cancel.hidden,
        changed = false;
      Object.defineProperty(cancel, 'hidden', {
        configurable: true,
        get: () => hidden,
        set(value) {
          hidden = value;
          if (value) changed = true;
        },
      });
      if (focusChange === 'other-action') h.$('shell-options').focus();
      else {
        h.doc.activeElement = h.doc.body;
        h.doc.focused = false;
        h.win.emit('blur');
      }
      if (outcome === 'cancel') {
        cancel.click();
        gate.resolve();
      } else gate.reject(new Error('Held original decode refused'));
      await settle(() => !h.$('shell-featured').hasAttribute('aria-busy'));
      assert.equal(changed, true);
      assert.equal(
        h.doc.activeElement ===
          (focusChange === 'other-action' ? h.$('shell-options') : h.doc.body),
        true,
        `Cleanup must preserve ${focusChange}; actual focus is ${h.doc.activeElement.id || 'BODY'}.`,
      );
      h.doc.focused = true;
      h.win.emit('focus');
      ticks(h, 4);
      assert.deepEqual(snapshot(h), before);
      assert.equal(h.rendered.paused, true);
      assert.equal(h.$('shell-home').open, true);
      assert.equal(h.storage.getItem(slot), saved);
      assert.deepEqual(h.errors, []);
    });

test('an unavailable visual pin preserves flight and recovery without current-theme substitution', async (t) => {
  const storage = memoryStorage();
  await t.test('create an ordinary saved attempt', async (t) => {
    const h = await flying(t, { storage });
    h.$('pause-button').click();
  });
  const saved = JSON.parse(storage.getItem(slot));
  assert.equal(saved.format, 'xonix-session.v6');
  const originalVisualPin = saved.visualThemePin;
  const choice = saved.presentationPins.choices.find(
    (row) => (row.picture ?? row).identity.themeId === saved.themeId,
  );
  const identity = (choice.picture ?? choice).identity;
  // Exercise the historical v5 reader by explicitly down-converting the
  // current v6 fixture after proving what the live writer emitted.
  saved.format = 'xonix-session.v5';
  delete saved.actorAppearancePin;
  saved.visualThemePin = {
    format: 'revealline-visual-theme-pin.v1',
    content: {
      editionId: 'field-kit',
      contentThemeId: saved.themeId,
      mode: 'solo',
      owner: { kind: 'campaign', baseCampaignKey: identity.baseCampaignKey },
      level: {
        id: identity.levelId,
        revision: identity.levelRevision,
        sha256: originalVisualPin.content.level.sha256,
      },
    },
    selection: { id: 'field-kit', revision: 1 },
    presentation: {
      source: { id: 'field-kit', revision: 1 },
      theme: { id: 'fpv', revision: 1 },
      collection: null,
      sha256: 'b'.repeat(64),
    },
  };
  const bytes = JSON.stringify(saved);
  storage.setItem(slot, bytes);
  const h = await soloPage(t, { storage, titleScreen: true }),
    before = snapshot(h);
  activateTitle(h, 'shell-continue');
  await settle(
    () =>
      !h.$('shell-continue').hasAttribute('aria-busy') &&
      /saved theme/i.test(h.$('shell-flight-status').textContent),
  );
  assert.deepEqual(snapshot(h), before);
  assert.equal(storage.getItem(slot), bytes);
  assert.equal(h.$('shell-home').open, true);
  assert.notEqual(h.doc.body.dataset.flightState, 'running');
  h.$('shell-gallery').click();
  h.$('collection-records').click();
  h.doc.querySelector('button[data-library-panel="saves"]').click();
  h.$('save-file').files = [
    new Blob(
      [
        JSON.stringify({
          format: BACKUP_FORMAT,
          library: emptyLibrary(),
          packs: emptyPackLibrary(),
          session: saved,
        }),
      ],
      { type: 'application/json' },
    ),
  ];
  const replacement = h.$('save-file').onchange();
  assert.equal(storage.getItem(slot), bytes, 'Preparing replacement preserves the saved flight.');
  await acceptGameDataReplacement(h);
  await replacement;
  assert.match(h.$('save-status').textContent, /Game data restored/);
  assert.match(
    h.$('save-status').textContent,
    /Loading verifies its required artwork and visual collection/,
  );
  assert.doesNotMatch(h.$('save-status').textContent, /ready to load/);
  assert.deepEqual(JSON.parse(storage.getItem(slot)), saved);
  assert.notEqual(h.doc.body.dataset.flightState, 'running');
  const retained = storage.getItem(slot);
  h.$('save-file').files = [new Blob([JSON.stringify(saved)], { type: 'application/json' })];
  await h.$('save-file').onchange();
  assert.match(h.$('save-status').textContent, /saved theme/i);
  assert.equal(h.$('library-dialog').open, true);
  assert.equal(storage.getItem(slot), retained);
  assert.notEqual(h.doc.body.dataset.flightState, 'running');
  assert.deepEqual(h.errors, []);
});
