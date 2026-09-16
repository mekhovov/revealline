// Actual app/core/store source. DOM, IndexedDB and image dimensions are finite
// modeled boundaries; original compiler bytes/hashes are real, not native browser proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { buildFractureTheme } from '../../authoring/library/fracture-theme-chapters/build.mjs';
import { buildFractureChapter } from '../../authoring/library/fracture-lines-chapter/build.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { loadLibrary } from '../library.mjs';
import { EXTERNAL_CATALOG } from '../external-chapter-catalog.mjs';
const allEditions = [
  await buildFractureChapter(),
  ...(await Promise.all(['ukraine', 'retro', 'coupa'].map(buildFractureTheme))),
];
const proof = JSON.parse(
  await readFile(new URL('../../authoring/library/fracture-lines/routes.json', import.meta.url)),
);
const settle = (fn) => waitFor(fn, { timeoutMs: 90000 });
// Full retained-original verification is substantially slower in shared CI.
// This test allowance does not change any runtime deadline or storage lease.
const INVENTORY_TIMEOUT_MS = 180000;
const CANCEL_JOIN_TIMEOUT_MS = 15000;
function inventoryDiagnostic(p, phase) {
  return JSON.stringify({
    phase,
    status: p.$('optional-worlds-status')?.textContent,
    reloadDisabled: p.$('optional-worlds-reload')?.disabled,
    rows: allEditions.map((e) => ({
      id: e.descriptor.id,
      state: p.$(id(e, 'state'))?.textContent,
      chooseDisabled: p.$(id(e, 'choose'))?.disabled,
    })),
    errors: p.errors.map((error) => String(error?.stack ?? error)),
  });
}
function clickOperation(p, control) {
  const button = p.$(control),
    original = button.onclick;
  assert.equal(button.disabled, false, `${control} must be enabled`);
  let operation;
  button.onclick = function (...args) {
    operation = original.apply(this, args);
    return operation;
  };
  try {
    button.click();
  } finally {
    button.onclick = original;
  }
  assert.equal(typeof operation?.then, 'function', `${control} must expose its action promise`);
  return operation;
}
async function waitInventory(
  p,
  phase,
  {
    operation,
    ready = () => !p.$('optional-worlds-reload').disabled,
    timeoutMs = INVENTORY_TIMEOUT_MS,
    cancelJoinTimeoutMs = CANCEL_JOIN_TIMEOUT_MS,
  } = {},
) {
  let completed = !operation,
    rejected = false,
    failure;
  operation?.then(
    () => {
      completed = true;
    },
    (error) => {
      completed = rejected = true;
      failure = error;
    },
  );
  try {
    await waitFor(() => completed && (operation || ready()), { timeoutMs, message: phase });
    if (rejected) throw failure;
    // A fulfilled panel handler can still report a refused installation.
    assert.ok(ready(), `Completed action is not ready: ${inventoryDiagnostic(p, phase)}`);
  } catch (error) {
    const beforeCancel = inventoryDiagnostic(p, phase);
    let cleanup = 'No pending action to cancel.';
    if (!completed || (!operation && p.$('optional-worlds-reload')?.disabled)) {
      const cancel = p.$('optional-worlds-cancel');
      if (p.$('optional-worlds-dialog')?.open && cancel && !cancel.hidden) {
        cancel.click();
        cleanup = 'Actual panel Cancel requested.';
      }
      if (operation) {
        try {
          await waitFor(() => completed, { timeoutMs: cancelJoinTimeoutMs });
          cleanup += ' Action promise settled after cancellation.';
        } catch {
          cleanup += ' Action promise did not settle within the cleanup allowance.';
        }
      } else {
        // The shell's open callback exposes no promise. Its native Cancel path
        // still aborts the panel; this cannot claim all async unwind has joined.
        cleanup += ' Shell open exposes no promise to join.';
      }
    }
    assert.fail(`${phase}: ${error?.message ?? error}\n${beforeCancel}\n${cleanup}`);
  }
}
class Locks {
  held = new Set();
  async request(name, options, callback) {
    const fn = callback ?? options;
    if (this.held.has(name)) return fn(null);
    this.held.add(name);
    try {
      return await fn({ name });
    } finally {
      this.held.delete(name);
    }
  }
}
async function page(t, f = {}, release = false) {
  f.storage ??= memoryStorage();
  f.assets ??= managedIndexedDB();
  f.media ??= managedIndexedDB();
  f.locks ??= new Locks();
  const urls = new Map(),
    make = URL.createObjectURL,
    revoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => {
    const u = make(blob);
    urls.set(u, blob);
    return u;
  };
  URL.revokeObjectURL = (u) => {
    urls.delete(u);
    revoke(u);
  };
  t.after(() => {
    URL.createObjectURL = make;
    URL.revokeObjectURL = revoke;
  });
  class Picture {
    set src(value) {
      this.url = value;
      if (value)
        this.decode().then(
          () => this.onload?.(),
          (e) => this.onerror?.(e),
        );
    }
    get src() {
      return this.url;
    }
    async decode() {
      const blob = urls.get(this.url);
      if (blob) {
        const b = Buffer.from(await blob.arrayBuffer());
        this.width = this.naturalWidth = b.readUInt32BE(16);
        this.height = this.naturalHeight = b.readUInt32BE(20);
      } else {
        this.width = this.naturalWidth = 1774;
        this.height = this.naturalHeight = 887;
      }
    }
    removeAttribute() {
      this.url = '';
    }
  }
  const p = await soloPage(t, {
    initialReadyTimeoutMs: INVENTORY_TIMEOUT_MS,
    storage: f.storage,
    assetIndexedDB: f.assets.indexedDB,
    soundtrackIndexedDB: f.media.indexedDB,
    lockManager: f.locks,
    pictures: { Image: Picture },
    ...(release
      ? {
          buildInfo: {
            formatVersion: 1,
            version: '0.37.0',
            sourceRevision: 'a'.repeat(40),
            entry: 'game/index.html',
          },
        }
      : {}),
  });
  const prior = globalThis.fetch,
    requests = [];
  globalThis.fetch = async (url, options) => {
    const u = String(url);
    requests.push({ url: u, options });
    if (u.endsWith('content/external-worlds.json'))
      return new Response(JSON.stringify(EXTERNAL_CATALOG));
    if (u.endsWith('content/optional-worlds.json'))
      return new Response(
        await readFile(new URL('../content/optional-worlds.json', import.meta.url)),
      );
    const e = allEditions.find((e) => u.includes('/' + e.descriptor.id + '/'));
    if (e) return new Response(u.endsWith('/pack.json') ? e.payloads.pack : e.payloads.media);
    return prior(url, options);
  };
  t.after(() => {
    globalThis.fetch = prior;
  });
  return Object.assign(p, { fixture: f, requests });
}
const id = (e, kind) => `optional-worlds-source-${e.descriptor.id}-${kind}`;
async function open(p) {
  p.$('shell-menu').click();
  p.$('shell-play').click();
  p.$('shell-mode-choice').open = true;
  p.$('shell-worlds').click();
  await waitInventory(p, 'Open More worlds and authenticate installed Fracture originals', {
    ready: () => !!p.$('optional-worlds-source-install') && !p.$('optional-worlds-reload').disabled,
  });
}
function showCard(p, e) {
  const filter = p.$('optional-worlds-theme');
  filter.value = e.descriptor.themeId;
  filter.onchange();
  const card = p.$(id(e, 'card'));
  for (let n = 0; card.hidden && n < 9; n++) {
    assert.equal(p.$('optional-worlds-next').disabled, false);
    p.$('optional-worlds-next').click();
  }
  assert.equal(card.hidden, false, 'the exact owner is visibly reachable');
}
async function choose(p, e, { replaceFlight = false } = {}) {
  showCard(p, e);
  const phase = `Choose and authenticate exact ${e.descriptor.id}`,
    opener = p.$(id(e, 'choose'));
  opener.focus();
  if (replaceFlight) {
    const run = p.rendered.run,
      checkpoint = authoritativeCheckpoint(run);
    assert.equal(
      run.player.cutting,
      true,
      'The initial retained cut requires an explicit decision.',
    );
    await waitInventory(p, `${phase}: checked replacement`, {
      operation: clickOperation(p, opener.id),
      ready: () => p.$('mission-replace-dialog').open && !p.$('mission-replace-confirm').disabled,
      timeoutMs: 90000,
    });
    assert.equal(p.$('optional-worlds-dialog').open, true);
    assert.match(p.$('mission-replace-status').textContent, /saved and verified/);
    const saved = new Map(p.fixture.storage.map);
    p.$('mission-replace-stay').click();
    p.frame(0);
    assert.equal(p.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual(p.fixture.storage.map, saved);
    assert.equal(p.rendered.paused, true);
    assert.equal(p.doc.activeElement, opener);
    await waitInventory(p, `${phase}: fresh replacement choice`, {
      operation: clickOperation(p, opener.id),
      ready: () => p.$('mission-replace-dialog').open && !p.$('mission-replace-confirm').disabled,
      timeoutMs: 90000,
    });
    await clickOperation(p, 'mission-replace-confirm');
    await settle(() => !p.$('optional-worlds-dialog').open);
  } else
    await waitInventory(p, phase, {
      operation: clickOperation(p, opener.id),
      ready: () => !p.$('optional-worlds-dialog').open,
      timeoutMs: 90000,
    });
  await settle(
    () => !p.$('optional-worlds-dialog').open && p.doc.body.dataset.pictureState === 'ready',
  );
  p.frame(0);
  assert.equal(p.$('pack-select').value, e.descriptor.id);
}
function direction(p, d) {
  const k = 'Arrow' + d[0].toUpperCase() + d.slice(1);
  p.key(k);
  p.key(k, false);
}
function ticks(p, n) {
  for (let i = 0; i < n; i++) p.frame();
}

const profile = 'revealline.library.release-0.37.0.v1';
// Reuse the existing shorter legal route for integration. The full independent
// north/south/difficulty/policy geometry proof remains unchanged and separate.
const routeFor = (levelId) =>
  proof.routes.find(
    (r) =>
      r.levelId === levelId &&
      r.difficulty === 'standard' &&
      r.turnPolicy === 'immediate' &&
      r.route === 'south',
  );
function playPrefix(p, route, maximum = Infinity) {
  let consumed = 0;
  for (const step of route.segments) {
    if (consumed >= maximum) break;
    assert.equal(step.input.action, false);
    assert.equal(step.input.pickup, false);
    assert.equal(step.input.switchClass, null);
    if (step.input.direction) direction(p, step.input.direction);
    const count = Math.min(step.ticks, maximum - consumed);
    ticks(p, count);
    consumed += count;
  }
  p.frame(0);
}

test('four Fracture owners explicitly download and Choose without replacing an unrelated cut; exact earned and saved data recover', async (t) => {
  const f = {};
  let receipts,
    stories,
    backup,
    cut,
    cutPins,
    selected,
    setupComplete = false,
    saveComplete = false;
  await t.test(
    'four Arcade downloads retain the paused base run and earn separate exact first pictures',
    async (t) => {
      const p = await page(t, f, true);
      p.$('start-button').click();
      direction(p, 'down');
      ticks(p, 13);
      p.$('pause-button').click();
      p.frame(0);
      const run = p.rendered.run,
        before = authoritativeCheckpoint(run);
      await open(p);
      assert.equal(
        p.requests.filter((r) => r.url.includes('/optional/external-chapters/')).length,
        0,
      );
      for (const e of allEditions) {
        assert.deepEqual(
          SOURCE_EXTERNAL_CHAPTERS.find((d) => d.id === e.descriptor.id),
          e.descriptor,
        );
        const card = p.$(id(e, 'card'));
        assert(card.children.some((n) => n.textContent === 'Arcade · 3 original pictures'));
        await waitInventory(p, `Download exact ${e.descriptor.id}`, {
          operation: clickOperation(p, id(e, 'download')),
          ready: () => !p.$('optional-worlds-reload').disabled && !p.$(id(e, 'choose')).disabled,
        });
        p.frame(0);
        assert.equal(p.rendered.run, run);
        assert.deepEqual(authoritativeCheckpoint(run), before);
        assert.equal(p.rendered.paused, true);
        assert.equal(p.$('pack-select').value, '');
      }
      assert.deepEqual(
        p.requests.filter((r) => r.url.includes('/optional/external-chapters/')).map((r) => r.url),
        allEditions.flatMap((e) =>
          ['pack.json', 'media.rlmedia'].map(
            (name) => `http://localhost/optional/external-chapters/${e.descriptor.id}/${name}`,
          ),
        ),
      );
      let prior = [];
      for (const e of allEditions) {
        if (!p.$('optional-worlds-dialog').open) await open(p);
        await choose(p, e, { replaceFlight: e === allEditions[0] });
        assert.equal(p.rendered.backdrop.pin.identity.baseCampaignKey, e.descriptor.campaignKey);
        assert.equal(p.rendered.backdrop.pin.sha256, e.descriptor.originals[0].sha256);
        const route = routeFor(e.descriptor.originals[0].levelId);
        p.$('start-button').click();
        playPrefix(p, route);
        assert.equal(p.rendered.run.status, 'won');
        assert.equal(p.rendered.run.score, route.expected.score);
        assert.equal(p.rendered.run.lives, route.expected.lives);
        const earned = loadLibrary(f.storage, profile).library.pictureReceipts;
        assert.deepEqual(earned.slice(0, prior.length), prior);
        prior = structuredClone(earned);
      }
      const library = loadLibrary(f.storage, profile).library;
      receipts = structuredClone(library.pictureReceipts);
      stories = structuredClone(library.storyReceipts);
      assert.equal(receipts.length, 4);
      assert.equal(stories.length, 4);
      for (const e of allEditions)
        assert.equal(
          receipts.find(
            (r) => r.presentationPin.identity.baseCampaignKey === e.descriptor.campaignKey,
          ).presentationPin.sha256,
          e.descriptor.originals[0].sha256,
        );
      assert(stories.every((r) => r.storyPin === null));
      assert.deepEqual(p.errors, []);
      setupComplete = true;
    },
  );
  await t.test(
    'restart authenticates all owners and exports the exact next-mission unfinished cut',
    { skip: setupComplete ? false : 'Initial install/win setup failed.' },
    async (t) => {
      const p = await page(t, f, true);
      await open(p);
      for (const e of allEditions) assert.equal(p.$(id(e, 'choose')).disabled, false);
      const library = loadLibrary(f.storage, profile).library;
      assert.deepEqual(library.pictureReceipts, receipts);
      assert.deepEqual(library.storyReceipts, stories);
      selected = allEditions[0];
      await choose(p, selected);
      assert.equal(
        p.rendered.backdrop.pin.identity.baseCampaignKey,
        selected.descriptor.campaignKey,
      );
      assert.equal(p.rendered.backdrop.pin.sha256, selected.descriptor.originals[1].sha256);
      const route = routeFor(selected.descriptor.originals[1].levelId);
      const boundary = route.saved.find((s) => s.trailCells > 0 && s.tick < route.expected.tick);
      assert.ok(boundary);
      p.$('start-button').click();
      playPrefix(p, route, boundary.tick);
      p.$('pause-button').click();
      p.frame(0);
      assert(p.rendered.run.trail.length > 0);
      assert.equal(p.rendered.paused, true);
      cut = authoritativeCheckpoint(p.rendered.run);
      cutPins = structuredClone(p.rendered.backdrop.pin);
      p.$('library-button').click();
      await p.$('export-backup').onclick();
      assert.match(p.$('save-status').textContent, /Game data prepared/);
      backup = JSON.parse(p.$('save-json').value);
      assert.equal(backup.format, 'xonix-backup.v2');
      assert.deepEqual(
        backup.externalChapters.chapters,
        allEditions.map((e) => e.descriptor),
      );
      assert(!p.$('save-json').value.includes('data:image'));
      assert.deepEqual(p.errors, []);
      saveComplete = true;
    },
  );
  await t.test(
    'fresh profile refuses missing originals without writes, then exact downloads allow explicit backup recovery',
    { skip: saveComplete ? false : 'No completed saved-cut backup fixture.' },
    async (t) => {
      const p = await page(t, {}, true);
      p.$('library-button').click();
      const local = new Map(p.storage.map),
        assets = p.fixture.assets.contents(),
        writes = p.fixture.assets.allPuts.length;
      p.$('save-json').value = JSON.stringify(backup);
      await p.$('import-save').onclick();
      assert.match(p.$('save-status').textContent, /original|presentation|missing/i);
      assert.doesNotMatch(p.$('save-status').textContent, /Game data restored/);
      assert.deepEqual(p.storage.map, local);
      assert.deepEqual(p.fixture.assets.contents(), assets);
      assert.equal(p.fixture.assets.allPuts.length, writes);
      p.$('library-dialog').close();
      await open(p);
      for (const e of allEditions)
        await waitInventory(p, `Restore exact originals ${e.descriptor.id}`, {
          operation: clickOperation(p, id(e, 'download')),
          ready: () => !p.$('optional-worlds-reload').disabled && !p.$(id(e, 'choose')).disabled,
        });
      assert.equal(p.$('pack-select').value, '');
      p.$('optional-worlds-dialog').close();
      p.$('library-button').click();
      p.$('save-json').value = JSON.stringify(backup);
      await p.$('import-save').onclick();
      assert.match(p.$('save-status').textContent, /Game data restored/);
      assert.match(p.$('save-status').textContent, /saved flight is ready to load/);
      p.$('library-dialog').close();
      p.$('continue-saved').click();
      await settle(
        () =>
          p.$('pack-select').value === selected.descriptor.id &&
          p.doc.body.dataset.pictureState === 'ready',
      );
      p.frame(0);
      assert.deepEqual(authoritativeCheckpoint(p.rendered.run), cut);
      assert.equal(p.rendered.paused, true);
      assert.deepEqual(p.rendered.backdrop.pin, cutPins);
      const library = loadLibrary(p.fixture.storage, profile).library;
      assert.deepEqual(library.pictureReceipts, receipts);
      assert.deepEqual(library.storyReceipts, stories);
      assert.equal(
        p.rendered.backdrop.pin.identity.baseCampaignKey,
        selected.descriptor.campaignKey,
      );
      assert.deepEqual(p.errors, []);
    },
  );
});
