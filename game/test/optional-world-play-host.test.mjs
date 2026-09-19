// Actual Solo app, authenticated published pack bytes and managed-media stores.
// DOM, IndexedDB and image decoding are finite boundaries, not native art proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { deferred, pngBytes, provenance, presentationRecord } from './helpers/media-fixtures.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { campaignKey, loadLibrary } from '../library.mjs';
import {
  preparePack,
  resolvePackCampaign,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
} from '../packs.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const root = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const optional = await json('game/content/optional-worlds.json');
const chapter = optional.packs[0];
const originalBytes = await readFile(new URL(chapter.path, root));
const dimensions = (source) => {
  const bytes = Buffer.from(source.split(',')[1], 'base64');
  return { naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20) };
};
const { pack } = await preparePack(originalBytes.toString('utf8'), {
  decodeImage: async (source) => dimensions(source),
});
const destination = resolvePackCampaign(pack, pack.campaigns[0].id);
const classes = await json('game/content/classes.json');
const themes = (await json('game/content/themes.json')).themes;
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'optional-world-play-host',
  revision: '1',
  title: 'Retained world launch',
  classRecipes: classes,
  levels: [
    {
      ...retryFixture('self-contact').level,
      id: 'retained-first-cut',
      name: 'Retained first cut',
      goal: { coverage: 0.1 },
      rules: { lives: 3 },
    },
  ],
};
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const packsKey = 'revealline.packs.dev.v1';
const primaryId = `optional-worlds-install-${chapter.id}`;
const settle = (predicate, message) => waitFor(predicate, { timeoutMs: 30000, message });

async function seedInstalled(assets, installedPacks) {
  const db = await new Promise((resolve, reject) => {
    const request = assets.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const library = installedPacks.reduce(installPack, emptyPackLibrary());
      tx.objectStore('assets').put(exportPackLibrary(library), packsKey);
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function setup(
  t,
  { installed = false, installedPacks = [pack], destinationPicture = true } = {},
) {
  const assets = managedIndexedDB();
  if (installed) await seedInstalled(assets, installedPacks);
  const media = managedIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: media.indexedDB, storyMedia: true });
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  const picture = await prepareStillAsset(
    new Blob([pngBytes()]),
    {
      id: 'world-play-picture',
      provenance: provenance(),
    },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const entries = [{ campaign, themes }, destination];
  const identities = (destinationPicture ? entries : entries.slice(0, 1)).map((entry) => ({
    baseCampaignKey: campaignKey(entry.campaign),
    levelId: entry.campaign.levels[0].id,
    levelRevision: entry.campaign.levels[0].revision,
    themeId: 'fpv',
  }));
  const library = {
    format: 'revealline-media-library.v1',
    assets: [picture.asset],
    presentations: identities.map((identity, i) => ({
      ...presentationRecord(identity, 1, picture.asset.id),
      id: `world-play-${i}`,
    })),
    assignments: identities.map((identity, i) => ({
      identity,
      presentationId: `world-play-${i}`,
      revision: 1,
    })),
  };
  await store.commit(
    await store.prepare(library, [{ sha256: picture.asset.sha256, blob: picture.blob }], {
      executionCatalog: createExecutionCatalog(entries),
    }),
    { expectedGeneration: 0 },
  );
  t.after(() => manager.close());
  let nextDecode = null,
    nextAuthoredDecode = null;
  const images = [];
  class Picture {
    constructor() {
      this.width = this.height = this.naturalWidth = this.naturalHeight = 1;
      this.releases = 0;
      images.push(this);
    }
    set src(value) {
      this.url = value;
      if (value.startsWith('data:image/png;base64,')) {
        const size = dimensions(value);
        this.width = this.naturalWidth = size.naturalWidth;
        this.height = this.naturalHeight = size.naturalHeight;
      }
      if (value) queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this.url;
    }
    decode() {
      if (nextAuthoredDecode?.source === this.url) {
        const action = nextAuthoredDecode.action;
        nextAuthoredDecode = null;
        return action(this);
      }
      // Pack validation authenticates real embedded originals independently.
      // Only an acquired managed-media drawable owns this held decode.
      if (!this.url.startsWith('blob:')) return Promise.resolve();
      const action = nextDecode;
      nextDecode = null;
      return action ? action(this) : Promise.resolve();
    }
    removeAttribute() {
      this.url = '';
      this.releases++;
    }
  }
  const p = await soloPage(t, {
    campaign,
    assetIndexedDB: assets.indexedDB,
    soundtrackIndexedDB: media.indexedDB,
    pictures: { Image: Picture },
  });
  const fetchBefore = globalThis.fetch;
  const requests = [];
  let holdBody = null;
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith('http')) return fetchBefore(url, options);
    requests.push(String(url));
    if (String(url).endsWith('game/content/optional-worlds.json'))
      return new Response(JSON.stringify(optional));
    assert.ok(String(url).endsWith(chapter.path), `Unexpected optional request: ${url}`);
    if (holdBody) await holdBody();
    return new Response(originalBytes);
  };
  t.after(() => {
    globalThis.fetch = fetchBefore;
  });
  return {
    p,
    assets,
    images,
    requests,
    deferDecode(action) {
      nextDecode = action;
    },
    deferAuthoredDecode(source, action) {
      nextAuthoredDecode = { source, action };
    },
    deferBody(action) {
      holdBody = action;
    },
  };
}

async function openWorlds(p) {
  p.$('shell-menu').click();
  p.$('shell-play').click();
  p.$('shell-mode-choice').open = true;
  p.$('shell-worlds').click();
  try {
    await settle(() => p.$(primaryId) && !p.$(primaryId).disabled, 'World card is ready.');
  } catch (error) {
    error.message += ` ${JSON.stringify({
      status: p.$('optional-worlds-status')?.textContent,
      dialogOpen: p.$('optional-worlds-dialog')?.open,
      busy: p.$('optional-worlds-dialog')?.getAttribute('aria-busy'),
      primary: p.$(primaryId)?.textContent,
      disabled: p.$(primaryId)?.disabled,
      errors: p.errors.map(String),
    })}`;
    throw error;
  }
  return p.$(primaryId);
}
function activate(button) {
  assert.equal(button.disabled, false);
  button.focus();
  return button.onclick();
}
function snapshot(p) {
  p.frame(0);
  return {
    run: p.rendered.run,
    checkpoint: authoritativeCheckpoint(p.rendered.run),
    image: p.rendered.backdrop.image,
    profile: p.storage.getItem(profileKey),
    saved: p.storage.getItem(sessionKey),
  };
}
function kept(p, before) {
  for (let i = 0; i < 12; i++) p.frame();
  assert.equal(p.rendered.run, before.run);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before.checkpoint);
  assert.equal(p.rendered.backdrop.image, before.image);
  assert.equal(before.image.releases, 0);
  assert.equal(p.storage.getItem(profileKey), before.profile);
  assert.equal(p.storage.getItem(sessionKey), before.saved);
  assert.equal(p.rendered.paused, true);
}
function installedPack(h) {
  const text = h.assets.contents().get('assets')?.get(packsKey);
  return text ? JSON.parse(text).packs.find((item) => item.id === chapter.id) : null;
}
async function running(p) {
  await settle(
    () => {
      p.frame(0);
      return (
        p.doc.body.dataset.flightState === 'running' &&
        p.rendered.run.levelId === destination.campaign.levels[0].id
      );
    },
    `One Play must start ${destination.campaign.levels[0].id}: ${p.$('optional-worlds-status').textContent}`,
  );
}
async function win(p) {
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
  assert.equal(p.rendered.run.status, 'won');
  if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
  await settle(() =>
    [...p.$('missions').children].every((b) => b.dataset.pictureState !== 'loading'),
  );
}

test('one Download & play authenticates the exact installed pack, stages its picture and starts once', async (t) => {
  const h = await setup(t),
    { p } = h;
  const button = await openWorlds(p),
    before = snapshot(p),
    gate = deferred();
  t.after(gate.resolve);
  let decoding = false;
  h.deferDecode(() => {
    decoding = true;
    return gate.promise;
  });
  assert.match(button.textContent, /Download & play/i);
  const pending = activate(button);
  assert.equal(p.$('optional-worlds-dialog').getAttribute('aria-busy'), 'true');
  await settle(() => decoding, 'The real destination picture decoder must be reached.');
  assert.deepEqual(installedPack(h), pack);
  kept(p, before);
  gate.resolve();
  await pending;
  await running(p);
  assert.equal(p.$('pack-select').value, chapter.id);
  assert.equal(p.rendered.backdrop.pin.identity.baseCampaignKey, campaignKey(destination.campaign));
  assert.equal(p.rendered.backdrop.pin.assetId, 'world-play-picture');
  assert.equal(p.rendered.run.tick, 0);
  assert.equal(before.image.releases, 1);
  assert.equal(p.$('optional-worlds-dialog').open, false);
  assert.equal(p.doc.activeElement.id, 'game-canvas');
  assert.equal(h.requests.filter((url) => url.endsWith(chapter.path)).length, 1);
  assert.equal((loadLibrary(p.storage, profileKey).library.pictureReceipts ?? []).length, 0);
  assert.deepEqual(p.errors, []);
});

test('installed Play starts directly without downloading the already authenticated pack', async (t) => {
  const h = await setup(t, { installed: true }),
    { p } = h;
  const button = await openWorlds(p);
  assert.match(button.textContent, /^Play/);
  await activate(button);
  await running(p);
  assert.equal(h.requests.filter((url) => url.endsWith(chapter.path)).length, 0);
  assert.equal(p.$('pack-select').value, chapter.id);
  assert.deepEqual(p.errors, []);
});

for (const outcome of ['failure', 'cancel', 'hidden'])
  test(`completed install plus ${outcome} during picture preparation preserves the earned result`, async (t) => {
    const h = await setup(t),
      { p } = h;
    await win(p);
    const button = await openWorlds(p),
      before = snapshot(p),
      gate = deferred();
    t.after(gate.resolve);
    let decoding = false;
    h.deferDecode(() => {
      decoding = true;
      return gate.promise;
    });
    const pending = activate(button);
    await settle(() => decoding);
    assert.ok(installedPack(h), 'Installation committed before launch cancellation.');
    kept(p, before);
    if (outcome === 'cancel') p.$('optional-worlds-cancel').click();
    if (outcome === 'hidden') {
      p.doc.hidden = true;
      p.doc.emit('visibilitychange');
    }
    if (outcome === 'failure') gate.reject(new Error('Fixture destination decode failed'));
    else gate.resolve();
    await pending;
    if (outcome === 'hidden') {
      p.doc.hidden = false;
      p.win.emit('focus');
    }
    kept(p, before);
    assert.ok(installedPack(h), 'Cancelling launch retains authenticated installed content.');
    assert.equal(loadLibrary(p.storage, profileKey).library.pictureReceipts.length, 1);
    if (outcome === 'failure') {
      assert.equal(p.$(primaryId).disabled, false);
      assert.match(p.$('optional-worlds-status').textContent, /could not|failed|retry|try again/i);
      await activate(p.$(primaryId));
      await running(p);
      assert.equal(loadLibrary(p.storage, profileKey).library.pictureReceipts.length, 1);
    }
    assert.deepEqual(p.errors, []);
  });

test('unfinished flight keeps its exact cut through Stay, then one Replace completes Play without another Start', async (t) => {
  const h = await setup(t),
    { p } = h;
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) p.frame();
  assert.equal(p.rendered.run.player.cutting, true);
  const button = await openWorlds(p),
    before = snapshot(p);
  await activate(button);
  assert.equal(p.$('mission-replace-dialog').open, true);
  // The deliberate checked-save preflight refreshes its timestamp. Every
  // retained simulation/presentation field must remain byte-for-byte equivalent.
  const verifiedSave = p.storage.getItem(sessionKey);
  const original = JSON.parse(before.saved),
    verified = JSON.parse(verifiedSave);
  delete original.savedAt;
  delete verified.savedAt;
  assert.deepEqual(verified, original);
  before.saved = verifiedSave;
  p.$('mission-replace-stay').click();
  kept(p, before);
  assert.equal(p.doc.activeElement.id, primaryId);
  assert.equal(p.$('mission-replace-dialog').open, false);
  assert.match(p.$(primaryId).textContent, /^Play/);
  const stayedStatus = p.$('optional-worlds-status').textContent;
  assert.match(stayedStatus, /kept.*paused|paused.*kept/i);
  assert.match(stayedStatus, /Play/);
  assert.doesNotMatch(stayedStatus, /Review Replace & play|Stay keeps/i);
  const calls = h.requests.length;
  await activate(p.$(primaryId));
  assert.equal(p.$('mission-replace-dialog').open, true);
  assert.equal(p.$('mission-replace-confirm').disabled, false);
  await activate(p.$('mission-replace-confirm'));
  await running(p);
  assert.equal(h.requests.length, calls, 'Replace uses the completed installation.');
  assert.deepEqual(p.errors, []);
});

test('late cancelled picture cannot release or refocus a newer Play operation', async (t) => {
  const h = await setup(t, { installed: true }),
    { p } = h;
  const button = await openWorlds(p),
    before = snapshot(p);
  const first = deferred(),
    second = deferred();
  t.after(first.resolve);
  t.after(second.resolve);
  let firstEntered = false,
    secondEntered = false;
  h.deferDecode(() => {
    firstEntered = true;
    return first.promise;
  });
  const stale = activate(button);
  await settle(() => firstEntered);
  p.$('optional-worlds-cancel').click();
  await stale;
  assert.equal(p.$(primaryId).disabled, false);
  h.deferDecode(() => {
    secondEntered = true;
    return second.promise;
  });
  const current = activate(p.$(primaryId));
  await settle(() => secondEntered);
  const newerFocus = p.doc.activeElement;
  const newerStatus = p.$('optional-worlds-status').textContent;
  assert.ok(newerStatus.trim(), 'New preparation has a visible current status.');
  assert.equal(p.$('optional-worlds-dialog').getAttribute('aria-busy'), 'true');
  assert.equal(p.$(primaryId).disabled, true);
  first.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  kept(p, before);
  assert.equal(p.$('optional-worlds-dialog').getAttribute('aria-busy'), 'true');
  assert.equal(p.$(primaryId).disabled, true);
  assert.equal(p.doc.activeElement, newerFocus);
  assert.equal(p.$('optional-worlds-status').textContent, newerStatus);
  second.resolve();
  await current;
  await running(p);
  assert.equal(before.image.releases, 1);
  assert.equal(h.requests.filter((url) => url.endsWith(chapter.path)).length, 0);
  assert.equal((loadLibrary(p.storage, profileKey).library.pictureReceipts ?? []).length, 0);
  assert.deepEqual(p.errors, []);
});

for (const storageKey of [sessionKey, `${profileKey}.backup-lock`])
  test(`cancellation reentry from ${storageKey} reads cannot revive a stale Play ticket`, async (t) => {
    const h = await setup(t, { installed: true }),
      { p } = h;
    const button = await openWorlds(p),
      before = snapshot(p);
    const get = p.storage.getItem.bind(p.storage);
    let tripped = false;
    p.storage.getItem = (key) => {
      const value = get(key);
      if (
        !tripped &&
        key === storageKey &&
        p.$('optional-worlds-dialog').getAttribute('aria-busy') === 'true'
      ) {
        tripped = true;
        p.$('optional-worlds-cancel').click();
      }
      return value;
    };
    await activate(button);
    assert.equal(tripped, true, 'The real host must cross the selected storage boundary.');
    kept(p, before);
    assert.equal(p.$(primaryId).disabled, false);
    assert.equal(p.$('optional-worlds-dialog').getAttribute('aria-busy'), 'false');
    assert.equal(p.doc.activeElement.id, primaryId);
    await activate(p.$(primaryId));
    await running(p);
    assert.deepEqual(p.errors, []);
  });

test('Back reentry while retiring the old accepted drawable keeps the new attempt paused', async (t) => {
  const h = await setup(t, { installed: true }),
    { p } = h;
  const button = await openWorlds(p),
    before = snapshot(p);
  const release = before.image.removeAttribute.bind(before.image);
  let left = false,
    returnFocus;
  before.image.removeAttribute = () => {
    release();
    assert.equal(left, false, 'The previous accepted image is retired once.');
    left = true;
    p.$('optional-worlds-back').click();
    returnFocus = p.doc.activeElement;
  };
  await activate(button);
  assert.equal(left, true);
  p.frame(0);
  assert.notEqual(
    p.rendered.run,
    before.run,
    'The accepted new attempt is not falsely rolled back.',
  );
  assert.equal(p.$('pack-select').value, chapter.id);
  assert.equal(p.rendered.run.levelId, destination.campaign.levels[0].id);
  assert.equal(p.rendered.run.tick, 0);
  assert.equal(p.rendered.paused, true);
  assert.equal(before.image.releases, 1);
  assert.equal(p.$('optional-worlds-dialog').open, false);
  assert.equal(p.$('shell-home').open, true);
  assert.equal(p.doc.activeElement, returnFocus);
  assert.equal(p.storage.getItem(profileKey), before.profile);
  assert.deepEqual(p.errors, []);
});

test('same campaign identity with conflicting imported pack artwork fails visibly without choosing the first owner', async (t) => {
  const duplicate = structuredClone(pack);
  duplicate.id = 'world-play-art-conflict';
  duplicate.name = 'Conflicting imported edition fixture';
  duplicate.levelVisuals[0].visualOverrides.background.dataUrl = `data:image/png;base64,${pngBytes().toString('base64')}`;
  const conflict = (
    await preparePack(duplicate, {
      decodeImage: async (source) => dimensions(source),
    })
  ).pack;
  const conflictingEntry = resolvePackCampaign(conflict, conflict.campaigns[0].id);
  assert.equal(campaignKey(conflictingEntry.campaign), campaignKey(destination.campaign));
  assert.notEqual(
    conflict.levelVisuals[0].visualOverrides.background.dataUrl,
    pack.levelVisuals[0].visualOverrides.background.dataUrl,
  );
  const h = await setup(t, { installed: true, installedPacks: [pack, conflict] }),
    { p } = h;
  await openWorlds(p);
  const id = `optional-worlds-installed-choose-${conflict.id}`;
  const button = p.$(id);
  assert.ok(button, 'The ordinary installed-content path must expose the imported edition.');
  for (let i = 0; button.closest('[hidden]') && i < 20; i++) {
    assert.equal(p.$('optional-worlds-next').disabled, false);
    p.$('optional-worlds-next').click();
  }
  assert.equal(button.closest('[hidden]'), null, 'The selected edition is actually on the page.');
  const before = snapshot(p);
  await activate(button);
  kept(p, before);
  assert.match(
    p.$('optional-worlds-status').textContent,
    /share a campaign identity.*different artwork/i,
  );
  assert.equal(button.disabled, false);
  assert.equal(p.doc.activeElement, button);
  assert.equal(h.requests.filter((url) => url.endsWith(chapter.path)).length, 0);
  assert.deepEqual(p.errors, []);
});

test('Back while the download body is held rejects its late response without installing or starting', async (t) => {
  const h = await setup(t),
    { p } = h;
  const button = await openWorlds(p),
    before = snapshot(p),
    gate = deferred();
  t.after(gate.resolve);
  let downloading = false;
  h.deferBody(() => {
    downloading = true;
    return gate.promise;
  });
  const pending = activate(button);
  await settle(() => downloading);
  p.$('optional-worlds-back').click();
  const focus = p.doc.activeElement;
  gate.resolve();
  await pending;
  kept(p, before);
  assert.equal(installedPack(h), null);
  assert.equal(p.doc.activeElement, focus);
  assert.equal(p.$('optional-worlds-dialog').open, false);
  assert.deepEqual(p.errors, []);
});

test('modeled Settings and return during download retire launch intent before any picture ticket exists', async (t) => {
  const h = await setup(t),
    { p } = h;
  const button = await openWorlds(p),
    before = snapshot(p),
    gate = deferred();
  t.after(gate.resolve);
  let downloading = false;
  h.deferBody(() => {
    downloading = true;
    return gate.promise;
  });
  const pending = activate(button);
  await settle(() => downloading);
  // Explicit host reentry boundary, not a claim that a native pointer can reach
  // a control behind the current modal. Real shared Settings handlers must
  // invalidate earlier launch intent even when the original panel stays open.
  p.$('settings-button').click();
  assert.equal(p.$('settings-dialog').open, true);
  p.doc.querySelector('[data-close="settings-dialog"]').click();
  assert.equal(p.$('settings-dialog').open, false);
  const returnFocus = p.doc.activeElement;
  gate.resolve();
  await pending;
  kept(p, before);
  assert.ok(installedPack(h), 'A completed background installation remains usable.');
  assert.equal(p.doc.activeElement, returnFocus);
  assert.equal(p.$('optional-worlds-dialog').open, true);
  assert.equal(p.$(primaryId).disabled, false);
  assert.deepEqual(p.errors, []);
});

for (const outcome of ['success', 'failure'])
  test(`unassigned embedded original ${outcome} is fully decoded before the old attempt can change`, async (t) => {
    const h = await setup(t, { installed: true, destinationPicture: false }),
      { p } = h;
    const button = await openWorlds(p),
      before = snapshot(p),
      gate = deferred();
    t.after(gate.resolve);
    const source = pack.levelVisuals[0].visualOverrides.background.dataUrl;
    let drawable;
    // Ordinary boot already decoded the persisted pack for structural import.
    // Arm after card readiness: Play's installed verifier only hashes the pack,
    // so this is the separate owned drawable prepared for the actual attempt.
    h.deferAuthoredDecode(source, (image) => {
      drawable = image;
      return gate.promise;
    });
    const pending = activate(button);
    await settle(
      () => !!drawable,
      'The exact unassigned authored original must reach a complete attempt decode.',
    );
    kept(p, before);
    assert.equal(drawable.releases, 0);
    if (outcome === 'failure') gate.reject(new Error('Fixture embedded original decode failed'));
    else gate.resolve();
    await pending;
    if (outcome === 'failure') {
      kept(p, before);
      assert.equal(drawable.releases, 1, 'Failed tentative original releases once.');
      assert.equal(p.$(primaryId).disabled, false);
      assert.match(p.$('optional-worlds-status').textContent, /could not|failed|retry|try again/i);
      await activate(p.$(primaryId));
    }
    await running(p);
    assert.equal(p.rendered.backdrop.image.url, source);
    assert.equal(p.rendered.backdrop.image.releases, 0, 'The adopted original stays live.');
    if (outcome === 'success') assert.equal(p.rendered.backdrop.image, drawable);
    assert.equal(before.image.releases, 1);
    assert.equal(p.$('pack-select').value, chapter.id);
    assert.equal(h.requests.filter((url) => url.endsWith(chapter.path)).length, 0);
    assert.deepEqual(p.errors, []);
  });
