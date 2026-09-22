// Actual app/core/store source. DOM, IndexedDB and image dimensions are finite
// modeled boundaries; original compiler bytes/hashes are real, not native browser proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { buildSentinelTheme } from '../../authoring/library/sentinel-theme-chapters/build.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { loadLibrary } from '../library.mjs';
import { EXTERNAL_CATALOG } from '../external-chapter-catalog.mjs';
const allEditions = await Promise.all(['ukraine', 'retro', 'coupa'].map(buildSentinelTheme));
const proof = JSON.parse(
  await readFile(
    new URL('../../authoring/library/sentinel-circuit-external/routes.json', import.meta.url),
  ),
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
      playDisabled: playControl(p, e)?.disabled,
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
            version: '0.36.0',
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
  const installedFetch = globalThis.fetch;
  t.after(() => {
    // The outer page fixture may already have restored browser globals.
    if (globalThis.fetch === installedFetch) globalThis.fetch = prior;
  });
  return Object.assign(p, { fixture: f, requests });
}
const id = (e, kind) => `optional-worlds-source-${e.descriptor.id}-${kind}`;
const playControl = (p, e) => p.$(id(e, 'download')) ?? p.$(id(e, 'choose'));
async function open(p) {
  p.$('shell-menu').click();
  p.$('shell-play').click();
  p.$('shell-mode-choice').open = true;
  p.$('shell-worlds').click();
  await waitInventory(p, 'Open More worlds and authenticate installed Sentinel originals', {
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
async function play(p, e, { replaceFlight = false } = {}) {
  showCard(p, e);
  const phase = `Play and authenticate exact ${e.descriptor.id}`,
    opener = playControl(p, e),
    previousRun = p.rendered.run,
    previousCheckpoint = authoritativeCheckpoint(previousRun);
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
    () =>
      !p.$('optional-worlds-dialog').open &&
      p.doc.body.dataset.pictureState === 'ready' &&
      p.doc.body.dataset.flightState === 'running',
  );
  p.frame(0);
  assert.equal(p.$('pack-select').value, e.descriptor.id);
  assert.equal(p.rendered.paused, false);
  assert.equal(p.rendered.run.tick, 0);
  assert.notEqual(p.rendered.run, previousRun);
  assert.deepEqual(authoritativeCheckpoint(previousRun), previousCheckpoint);
}
function direction(p, d) {
  const k = 'Arrow' + d[0].toUpperCase() + d.slice(1);
  p.key(k);
  p.key(k, false);
}
function ticks(p, n) {
  for (let i = 0; i < n; i++) p.frame();
}

test('three Sentinel Download & play choices preserve an unrelated cut through Stay and retain distinct earned owners through backup/restart', async (t) => {
  const f = {};
  let receipts,
    stories,
    setupComplete = false;
  await t.test(
    'three explicit downloads, independent real wins and exact metadata backup',
    async (t) => {
      const p = await page(t, f, true);
      p.$('start-button').click();
      await settle(() => p.doc.body.dataset.flightState === 'running');
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
        showCard(p, e);
        const opener = playControl(p, e);
        assert.match(opener.textContent, /Download & play/i);
        opener.focus();
        await waitInventory(p, `Download, authenticate and review exact ${e.descriptor.id}`, {
          operation: clickOperation(p, opener.id),
          ready: () =>
            !p.$('optional-worlds-reload').disabled &&
            p.$('mission-replace-dialog').open &&
            !p.$('mission-replace-confirm').disabled,
        });
        assert.match(p.$('mission-replace-status').textContent, /saved and verified/);
        const saved = new Map(p.fixture.storage.map);
        p.$('mission-replace-stay').click();
        assert.equal(playControl(p, e).disabled, false, p.$('optional-worlds-status').textContent);
        assert.match(playControl(p, e).textContent, /^Play/);
        assert.equal(p.doc.activeElement, opener);
        assert.deepEqual(p.fixture.storage.map, saved);
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
      const route = proof.routes.find((r) => r.id === 'fpv/standard/immediate/court-upper');
      for (const e of allEditions) {
        if (!p.$('optional-worlds-dialog').open) await open(p);
        await play(p, e, { replaceFlight: e === allEditions[0] });
        assert.equal(p.rendered.backdrop.pin.identity.baseCampaignKey, e.descriptor.campaignKey);
        assert.equal(p.rendered.backdrop.pin.sha256, e.descriptor.originals[0].sha256);
        for (const step of route.segments) {
          if (step.input.direction) direction(p, step.input.direction);
          if (step.input.action) p.key('KeyE');
          ticks(p, step.ticks);
          if (step.input.action) p.key('KeyE', false);
        }
        p.frame(0);
        assert.equal(p.rendered.run.status, 'won');
        assert.equal(p.rendered.run.score, route.expected.score);
        assert.equal(p.rendered.run.lives, route.expected.lives);
      }
      const library = loadLibrary(f.storage, 'revealline.library.release-0.36.0.v1').library;
      receipts = library.pictureReceipts;
      stories = library.storyReceipts;
      assert.equal(receipts.length, 3);
      assert.equal(stories.length, 3);
      for (const e of allEditions) {
        const earned = receipts.find(
          (r) => r.presentationPin.identity.baseCampaignKey === e.descriptor.campaignKey,
        );
        assert.equal(earned.presentationPin.sha256, e.descriptor.originals[0].sha256);
      }
      assert(stories.every((r) => r.storyPin === null));
      p.$('library-button').click();
      await p.$('export-backup').onclick();
      assert.match(p.$('save-status').textContent, /Game data prepared/);
      const backup = JSON.parse(p.$('save-json').value);
      assert.equal(backup.format, 'xonix-backup.v2');
      assert.deepEqual(
        backup.externalChapters.chapters,
        allEditions.map((e) => e.descriptor),
      );
      assert(!p.$('save-json').value.includes('data:image'));
      assert.deepEqual(p.errors, []);
      setupComplete = true;
    },
  );
  await t.test(
    'new app retains exact first-earned still/null-story pins and authenticates all three editions',
    {
      skip: setupComplete
        ? false
        : 'The prior download/win/backup setup failed; restart has no complete fixture to verify.',
    },
    async (t) => {
      const p = await page(t, f, true);
      await open(p);
      for (const e of allEditions) assert.equal(playControl(p, e).disabled, false);
      const library = loadLibrary(f.storage, 'revealline.library.release-0.36.0.v1').library;
      assert.deepEqual(library.pictureReceipts, receipts);
      assert.deepEqual(library.storyReceipts, stories);
      await play(p, allEditions[0]);
      assert.equal(
        p.rendered.backdrop.pin.identity.baseCampaignKey,
        allEditions[0].descriptor.campaignKey,
      );
      assert.equal(p.rendered.backdrop.pin.sha256, allEditions[0].descriptor.originals[1].sha256);
      assert.deepEqual(p.errors, []);
    },
  );
});
