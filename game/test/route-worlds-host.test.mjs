// Actual app/core/store source. DOM, IndexedDB and image dimensions are finite
// modeled boundaries; original compiler bytes/hashes are real, not native browser proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { buildRouteWorld } from '../../authoring/library/route-worlds/build.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { loadLibrary } from '../library.mjs';
import { EXTERNAL_CATALOG } from '../external-chapter-catalog.mjs';
const editions = await Promise.all(['ukraine', 'retro', 'coupa'].map(buildRouteWorld));
const proof = JSON.parse(
  await readFile(new URL('../../authoring/library/route-worlds/routes.json', import.meta.url)),
);
const settle = (fn) => waitFor(fn, { timeoutMs: 30000 });
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
    const e = editions.find((e) => u.includes('/' + e.descriptor.id + '/'));
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
  p.$('shell-worlds').click();
  await settle(
    () => !!p.$('optional-worlds-source-install') && !p.$('optional-worlds-reload').disabled,
  );
}
async function install(p, e) {
  p.$(id(e, 'pack')).files = [e.payloads.pack];
  p.$(id(e, 'media')).files = [e.payloads.media];
  p.$(id(e, 'install')).click();
  await settle(() => !p.$('optional-worlds-reload').disabled);
  assert.equal(p.$(id(e, 'choose')).disabled, false, p.$('optional-worlds-status').textContent);
}
async function choose(p, e) {
  p.$(id(e, 'choose')).click();
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

test('three exact registered new worlds install together within unchanged budgets, preserve a paused cut, and separately Choose/earn their own originals', async (t) => {
  const f = {};
  let receipts;
  await t.test('three native pairs and three real route wins', async (t) => {
    const p = await page(t, f);
    p.$('start-button').click();
    direction(p, 'down');
    ticks(p, 13);
    p.$('pause-button').click();
    p.frame(0);
    const run = p.rendered.run,
      before = authoritativeCheckpoint(run);
    await open(p);
    for (const e of editions) {
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
      await choose(p, e);
      assert.equal(p.rendered.backdrop.pin.sha256, e.descriptor.originals[0].sha256);
      p.$('start-button').click();
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
    const library = loadLibrary(f.storage, 'revealline.library.dev.v1').library;
    receipts = library.pictureReceipts;
    assert.equal(receipts.length, 3);
    for (const e of editions)
      assert(receipts.some((r) => r.presentationPin.sha256 === e.descriptor.originals[0].sha256));
    assert(library.storyReceipts.every((r) => r.storyPin === null));
    p.$('library-button').click();
    await p.$('export-backup').onclick();
    assert.match(p.$('save-status').textContent, /Game data prepared/);
    const backup = JSON.parse(p.$('save-json').value);
    assert.equal(backup.format, 'xonix-backup.v2');
    assert.deepEqual(
      backup.externalChapters.chapters,
      editions.map((e) => e.descriptor),
    );
    assert(!p.$('save-json').value.includes('data:image'));
    assert.deepEqual(p.errors, []);
  });
  await t.test(
    'restart authenticates all three indexed editions and retains exact first-earned pictures',
    async (t) => {
      const p = await page(t, f);
      await open(p);
      for (const e of editions) assert.equal(p.$(id(e, 'choose')).disabled, false);
      assert.deepEqual(
        loadLibrary(f.storage, 'revealline.library.dev.v1').library.pictureReceipts,
        receipts,
      );
      await choose(p, editions[0]);
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
  assert.equal(p.$(id(editions[0], 'choose')).disabled, true);
  assert.match(p.$('optional-worlds-status').textContent, /differ|length|match/i);
});

test('released host reads the exact small catalog then explicitly downloads only one pair; restart resolves that released registry', async (t) => {
  const f = {};
  await t.test('explicit download retains current ready flight until Choose', async (t) => {
    const p = await page(t, f, true);
    await open(p);
    const before = authoritativeCheckpoint(p.rendered.run);
    assert.equal(
      p.requests.filter((r) => r.url.includes('/optional/external-chapters/')).length,
      0,
    );
    p.$(id(editions[0], 'download')).click();
    await settle(() => !p.$('optional-worlds-reload').disabled);
    assert.equal(
      p.$(id(editions[0], 'choose')).disabled,
      false,
      p.$('optional-worlds-status').textContent,
    );
    p.frame(0);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
    assert.equal(p.$('pack-select').value, '');
    assert.deepEqual(
      p.requests.filter((r) => r.url.includes('/optional/external-chapters/')).map((r) => r.url),
      ['pack.json', 'media.rlmedia'].map(
        (n) => `http://localhost/optional/external-chapters/route-worlds-ukraine/${n}`,
      ),
    );
    await choose(p, editions[0]);
    assert.equal(p.rendered.backdrop.pin.sha256, editions[0].descriptor.originals[0].sha256);
  });
  await t.test('fresh released app uses the same persistent authority', async (t) => {
    const p = await page(t, f, true);
    await open(p);
    assert.equal(p.$(id(editions[0], 'choose')).disabled, false);
    await choose(p, editions[0]);
    assert.equal(p.rendered.backdrop.pin.sha256, editions[0].descriptor.originals[0].sha256);
  });
});
