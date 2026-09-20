// Actual app/core/store source. DOM, IndexedDB and image dimensions are finite
// modeled boundaries; original compiler bytes/hashes are real, not native browser proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { buildRouteWorld } from '../../authoring/library/route-worlds/build.mjs';
import { buildExternalPilot } from '../../authoring/library/external-chapter-pilot/build.mjs';
import { buildExternalSentinel } from '../../authoring/library/sentinel-circuit-external/build.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { loadLibrary } from '../library.mjs';
import { EXTERNAL_CATALOG } from '../external-chapter-catalog.mjs';
const editions = await Promise.all(['ukraine', 'retro', 'coupa'].map(buildRouteWorld));
const [pilot, sentinel] = await Promise.all([buildExternalPilot(), buildExternalSentinel()]);
const allEditions = [pilot, ...editions, sentinel];
const sentinelProof = JSON.parse(
  await readFile(
    new URL('../../authoring/library/sentinel-circuit-external/routes.json', import.meta.url),
  ),
);
const proof = JSON.parse(
  await readFile(new URL('../../authoring/library/route-worlds/routes.json', import.meta.url)),
);
const settle = (fn) => waitFor(fn, { timeoutMs: 30000 });
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
  t.after(() => {
    globalThis.fetch = prior;
  });
  return Object.assign(p, { fixture: f, requests });
}
const id = (e, kind) =>
  `optional-worlds-${e.descriptor.id === pilot.descriptor.id ? 'source' : `source-${e.descriptor.id}`}-${kind}`;
const playControl = (p, e) => p.$(id(e, 'download')) ?? p.$(id(e, 'choose'));
async function open(p) {
  p.$('shell-menu').click();
  p.$('shell-play').click();
  p.$('shell-mode-choice').open = true;
  p.$('shell-worlds').click();
  await waitInventory(p, 'Open More worlds and authenticate installed originals', {
    ready: () => !!p.$('optional-worlds-source-install') && !p.$('optional-worlds-reload').disabled,
  });
}
async function install(p, e) {
  p.$(id(e, 'pack')).files = [e.payloads.pack];
  p.$(id(e, 'media')).files = [e.payloads.media];
  await waitInventory(p, `Install and authenticate exact ${e.descriptor.id}`, {
    operation: clickOperation(p, id(e, 'install')),
    ready: () => !p.$('optional-worlds-reload').disabled && !playControl(p, e).disabled,
  });
  assert.equal(playControl(p, e).disabled, false, p.$('optional-worlds-status').textContent);
  assert.match(playControl(p, e).textContent, /^Play/);
}
function showCard(p, e) {
  const filter = p.$('optional-worlds-theme');
  filter.value = e.descriptor.themeId;
  filter.onchange();
  const card = p.$(
    e.descriptor.id === pilot.descriptor.id ? 'optional-worlds-source-pilot' : id(e, 'card'),
  );
  for (let n = 0; card.hidden && n < 9; n++) {
    assert.equal(p.$('optional-worlds-next').disabled, false);
    p.$('optional-worlds-next').click();
  }
  assert.equal(card.hidden, false, 'the exact owner is visibly reachable');
}
async function play(p, e, { replaceFlight = false, sameCampaign = false } = {}) {
  showCard(p, e);
  const phase = `Play and authenticate exact ${e.descriptor.id}`,
    opener = playControl(p, e),
    previousRun = p.rendered.run,
    previousCheckpoint = authoritativeCheckpoint(previousRun);
  opener.focus();
  if (sameCampaign) assert.equal(p.$('pack-select').value, e.descriptor.id);
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
    });
    await clickOperation(p, 'mission-replace-confirm');
    await settle(() => !p.$('optional-worlds-dialog').open);
  } else
    await waitInventory(p, phase, {
      operation: clickOperation(p, opener.id),
      ready: () => !p.$('optional-worlds-dialog').open,
    });
  // The single accepted Play includes picture readiness and actual start.
  try {
    await settle(
      () =>
        p.doc.body.dataset.pictureState === 'ready' && p.doc.body.dataset.flightState === 'running',
    );
  } catch (error) {
    assert.fail(
      `${phase}: picture did not become ready: ${error.message}\n${inventoryDiagnostic(p, phase)}\n${JSON.stringify({ pack: p.$('pack-select').value, pictureState: p.doc.body.dataset.pictureState })}`,
    );
  }
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

test('five exact registered editions install together within unchanged budgets, preserve a paused cut, and Play/earn Route Choices and Sentinel originals', async (t) => {
  const f = {};
  let receipts,
    setupComplete = false;
  await t.test('five native pairs, three Route Choices wins and one Sentinel win', async (t) => {
    const p = await page(t, f);
    p.$('start-button').click();
    direction(p, 'down');
    ticks(p, 13);
    p.$('pause-button').click();
    p.frame(0);
    const run = p.rendered.run,
      before = authoritativeCheckpoint(run);
    await open(p);
    for (const e of allEditions) {
      assert.deepEqual(
        SOURCE_EXTERNAL_CHAPTERS.find((d) => d.id === e.descriptor.id),
        e.descriptor,
      );
      await install(p, e);
      p.frame(0);
      assert.equal(p.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), before);
      assert.equal(p.rendered.paused, true);
      assert.equal(p.$('pack-select').value, '');
    }
    assert.equal(
      p.requests.filter((r) => r.url.includes('/optional/external-chapters/')).length,
      0,
      'Native file installation never downloads bodies',
    );
    for (const e of editions) {
      if (!p.$('optional-worlds-dialog').open) await open(p);
      await play(p, e, { replaceFlight: e === editions[0] });
      assert.equal(p.rendered.backdrop.pin.sha256, e.descriptor.originals[0].sha256);
      const route = proof.routes.find(
        (r) =>
          r.packId === e.descriptor.id &&
          r.difficulty === 'standard' &&
          r.turnPolicy === 'immediate' &&
          r.expected.won &&
          r.levelId.endsWith('foundry'),
      );
      for (const s of route.segments) {
        direction(p, s.input.direction);
        ticks(p, s.ticks);
      }
      p.frame(0);
      assert.equal(p.rendered.run.status, 'won');
    }
    await open(p);
    await play(p, sentinel);
    assert.equal(p.rendered.backdrop.pin.sha256, sentinel.descriptor.originals[0].sha256);
    assert.equal(p.rendered.run.activeClassId, 'scout');
    const route = sentinelProof.routes.find((r) => r.id === 'fpv/standard/immediate/court-upper');
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
    const library = loadLibrary(f.storage, 'revealline.library.dev.v1').library;
    receipts = library.pictureReceipts;
    assert.equal(receipts.length, 4);
    for (const e of [...editions, sentinel])
      assert(receipts.some((r) => r.presentationPin.sha256 === e.descriptor.originals[0].sha256));
    assert(library.storyReceipts.every((r) => r.storyPin === null));
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
  });
  await t.test(
    'restart authenticates all five indexed editions and retains exact first-earned pictures',
    {
      skip: setupComplete
        ? false
        : 'The prior install/win/backup setup failed; restart has no complete fixture to verify.',
    },
    async (t) => {
      const p = await page(t, f);
      await open(p);
      for (const e of allEditions) assert.equal(playControl(p, e).disabled, false);
      assert.deepEqual(
        loadLibrary(f.storage, 'revealline.library.dev.v1').library.pictureReceipts,
        receipts,
      );
      await play(p, editions[0]);
      assert.equal(p.rendered.backdrop.pin.identity.levelId, 'route-worlds-ukraine-depot');
      assert.equal(p.rendered.backdrop.pin.sha256, editions[0].descriptor.originals[1].sha256);
      assert.deepEqual(p.errors, []);
    },
  );
});

test('foreign theme pair refuses before writes and cannot make the selected chapter available', async (t) => {
  const p = await page(t);
  await open(p);
  const writes = p.fixture.assets.allPuts.length;
  p.$(id(editions[0], 'pack')).files = [editions[1].payloads.pack];
  p.$(id(editions[0], 'media')).files = [editions[1].payloads.media];
  p.$(id(editions[0], 'install')).click();
  await settle(() => !p.$('optional-worlds-reload').disabled);
  assert.equal(p.fixture.assets.allPuts.length, writes);
  assert.equal(playControl(p, editions[0]).disabled, true);
  assert.match(p.$('optional-worlds-status').textContent, /differ|length|match/i);
});

test('released host reads the exact small catalog then explicitly downloads only one pair; restart resolves that released registry', async (t) => {
  const f = {};
  await t.test(
    'one Download & play authenticates the exact pair and starts its first mission',
    async (t) => {
      const p = await page(t, f, true);
      await open(p);
      showCard(p, editions[0]);
      const previousRun = p.rendered.run,
        before = authoritativeCheckpoint(previousRun);
      assert.equal(
        p.requests.filter((r) => r.url.includes('/optional/external-chapters/')).length,
        0,
      );
      await waitInventory(p, `Download and authenticate exact ${editions[0].descriptor.id}`, {
        operation: clickOperation(p, id(editions[0], 'download')),
        ready: () =>
          !p.$('optional-worlds-dialog').open &&
          p.doc.body.dataset.pictureState === 'ready' &&
          p.doc.body.dataset.flightState === 'running',
      });
      assert.equal(
        playControl(p, editions[0]).disabled,
        false,
        p.$('optional-worlds-status').textContent,
      );
      p.frame(0);
      assert.notEqual(p.rendered.run, previousRun);
      assert.deepEqual(authoritativeCheckpoint(previousRun), before);
      assert.equal(p.$('pack-select').value, editions[0].descriptor.id);
      assert.equal(p.rendered.paused, false);
      assert.equal(p.rendered.run.tick, 0);
      assert.deepEqual(
        p.requests.filter((r) => r.url.includes('/optional/external-chapters/')).map((r) => r.url),
        ['pack.json', 'media.rlmedia'].map(
          (n) => `http://localhost/optional/external-chapters/route-worlds-ukraine/${n}`,
        ),
      );
      assert.equal(p.rendered.backdrop.pin.sha256, editions[0].descriptor.originals[0].sha256);
    },
  );
  await t.test('fresh released app uses the same persistent authority', async (t) => {
    const p = await page(t, f, true);
    await open(p);
    assert.equal(playControl(p, editions[0]).disabled, false);
    const requests = p.requests.length;
    await play(p, editions[0], { sameCampaign: true });
    assert.equal(p.requests.length, requests, 'Installed Play does not download the pair again.');
    assert.equal(p.rendered.backdrop.pin.sha256, editions[0].descriptor.originals[0].sha256);
  });
});

function inventoryBoundary({ ready = false, status = 'Checking exact originals', cancel } = {}) {
  const nodes = {
    'optional-worlds-reload': { disabled: !ready },
    'optional-worlds-status': { textContent: status },
    'optional-worlds-dialog': { open: true },
    'optional-worlds-cancel': { hidden: false, click: () => cancel?.() },
  };
  return { $: (name) => nodes[name], errors: [] };
}

test('inventory completion still refuses a fulfilled action without verified readiness', async () => {
  const p = inventoryBoundary({ status: 'Exact original hash differs. Nothing was removed.' });
  await assert.rejects(
    waitInventory(p, 'refused original', { operation: Promise.resolve(), timeoutMs: 1000 }),
    /Completed action is not ready.*Exact original hash differs/s,
  );
  assert.equal(p.$('optional-worlds-reload').disabled, true);
});

test('inventory deadline cancels through the panel and joins the pending action before failure', async () => {
  let finish,
    cancelled = 0,
    joined = false;
  const operation = new Promise((resolve) => {
    finish = resolve;
  });
  const p = inventoryBoundary({
    cancel() {
      cancelled++;
      setTimeout(() => {
        joined = true;
        finish();
      }, 5);
    },
  });
  p.errors.push(new Error('retained diagnostic'));
  await assert.rejects(
    waitInventory(p, 'pending exact original', {
      operation,
      timeoutMs: 15,
      cancelJoinTimeoutMs: 1000,
    }),
    /pending exact original[\s\S]*retained diagnostic[\s\S]*Action promise settled after cancellation/,
  );
  assert.equal(cancelled, 1);
  assert.equal(joined, true);
});

test('inventory cleanup reports a still-pending action within its separate finite allowance', async () => {
  let cancelled = 0;
  const p = inventoryBoundary({
    cancel() {
      cancelled++;
    },
  });
  await assert.rejects(
    waitInventory(p, 'unsettled original', {
      operation: new Promise(() => {}),
      timeoutMs: 15,
      cancelJoinTimeoutMs: 15,
    }),
    /Action promise did not settle within the cleanup allowance/,
  );
  assert.equal(cancelled, 1);
});
