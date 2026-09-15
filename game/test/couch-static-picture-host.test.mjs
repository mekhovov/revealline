import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mountPresentationPage } from '../presentation/page.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

const compiled = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url), 'utf8'),
);
const owners = Object.fromEntries(
  ['signal-01', 'orchard-crossing'].map((levelId) => [
    levelId,
    CURRENT_PICTURES.find((row) => row.owner.levelId === levelId && row.owner.themeId === 'fpv'),
  ]),
);
const originals = new Map();
for (const owner of Object.values(owners)) {
  const asset = compiled.resolved.assets[owner.id];
  assert.equal(asset.quality.stage, 'reviewed');
  const bytes = await readFile(
    new URL(`../presentation/compiled/assets/${asset.file.sha256}.png`, import.meta.url),
  );
  assert.equal(bytes.length, asset.file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.file.sha256);
  originals.set(owner.id, { asset, bytes });
}

// Original-byte authority is real committed art. Image and URL are finite browser
// boundary models: these tests do not assert native decoding, layout or appearance.
function mediaBoundary() {
  const blobs = new Map(),
    images = [],
    revoked = [];
  let count = 0,
    failNext = false,
    decodeHook = null;
  class URLImpl extends URL {
    static createObjectURL(blob) {
      const url = `blob:picture-${++count}`;
      blobs.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      revoked.push(url);
      blobs.delete(url);
    }
  }
  class Image {
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.source = value;
      this.ready = (async () => {
        const bytes = value.startsWith('data:')
          ? Buffer.from(value.split(',')[1], 'base64')
          : Buffer.from(await blobs.get(value).arrayBuffer());
        this.width = this.naturalWidth = bytes.readUInt32BE(16);
        this.height = this.naturalHeight = bytes.readUInt32BE(20);
        this.onload?.();
      })();
    }
    async decode() {
      await this.ready;
      await decodeHook?.(this);
      if (failNext && this.source.startsWith('blob:')) {
        failNext = false;
        throw new Error('Injected complete image decode refusal.');
      }
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.released = true;
    }
  }
  return {
    Image,
    URLImpl,
    images,
    blobs,
    revoked,
    setDecodeHook: (hook) => {
      decodeHook = hook;
    },
    fail: () => {
      failNext = true;
    },
  };
}
async function action(page, id, type = 'click') {
  const element = page.$(id),
    handler = element[`on${type}`];
  let operation;
  element[`on${type}`] = (event) => (operation = handler?.(event));
  try {
    element.emit(type);
    await operation;
  } finally {
    element[`on${type}`] = handler;
  }
  page.frame();
}
async function fixture(
  t,
  { level = 'signal-01', onRead, onMount, unavailable = false, failDecode = false } = {},
) {
  const media = mediaBoundary(),
    memory = managedIndexedDB(),
    reads = [];
  const snapshot = { resolved: compiled.resolved, images: new Map(), canvas: {} };
  if (failDecode) media.fail();
  let lease,
    closed = 0;
  const page = await couchPage(t, {
    initialLevel: null,
    ImageClass: media.Image,
    URLImpl: media.URLImpl,
    assetDatabase: memory.indexedDB,
    fetchResponse(path) {
      // Base tests deliberately omit the optional featured cohort. Wide tests
      // use its actual original pack and the unchanged authored map preparation.
      if (level === 'signal-01' && path === '../content/packs/fpv-arcade-r5.json')
        return { ok: false };
    },
    beforeImport({ document, window }) {
      onMount?.({ document, window });
      lease = mountPresentationPage({
        document,
        window,
        createHost: () => ({
          async load() {
            if (unavailable) throw new Error('Optional release snapshot unavailable.');
            return snapshot;
          },
          apply() {},
          close() {
            closed++;
          },
          async readPicture(slot, options) {
            reads.push({ slot, snapshot: options.snapshot, signal: options.signal });
            assert.equal(options.snapshot, snapshot);
            await onRead?.({ slot, ...options });
            const original = originals.get(slot);
            assert.ok(original, `Only the two finite approved originals may be read: ${slot}`);
            return {
              asset: original.asset,
              blob: new Blob([original.bytes], { type: 'image/png' }),
            };
          },
        }),
      });
    },
  });
  t.after(() => lease.close());
  return { page, media, memory, reads, snapshot, closed: () => closed };
}

for (const level of ['signal-01', 'orchard-crossing'])
  test(`actual Versus ${level} shares one exact approved picture and fit through Start and paused continuation`, async (t) => {
    const f = await fixture(t, { level }),
      p = f.page;
    const picture = p.drawOptions[0].backdrop;
    assert.ok(picture.image);
    assert.equal(p.drawOptions[1].backdrop === picture, true);
    assert.equal(picture.fit, 'contain');
    assert.equal(picture.sampling, 'nearest');
    assert.equal(picture.image.naturalWidth, originals.get(owners[level].id).asset.file.width);
    assert.equal(picture.image.naturalHeight, 576);
    assert.deepEqual(
      f.reads.map((read) => read.slot),
      [owners[level].id],
    );
    assert.equal(p.$('race-start').disabled, false);
    await action(p, 'race-start');
    p.key('KeyD');
    p.frames(8);
    p.key('KeyD', false);
    await action(p, 'race-pause');
    const checkpoint = p.checkpoint();
    p.$('race-text-face').value = 'plain';
    await action(p, 'race-text-face', 'change');
    assert.deepEqual(p.checkpoint(), checkpoint);
    assert.equal(p.drawOptions[0].backdrop === picture, true);
    assert.equal(p.drawOptions[1].backdrop === picture, true);
    assert.equal(f.reads.length, 1, 'Pause and display preferences must not resolve new art.');
    assert.deepEqual(f.memory.allPuts, [], 'Fresh Versus must not commit media/progress records.');
  });

test('required decode failure blocks Start; Retry retains the same attempt and chosen original', async (t) => {
  const f = await fixture(t, { failDecode: true }),
    p = f.page;
  assert.equal(p.$('race-start').disabled, true);
  assert.equal(p.$('race-chapter-retry').hidden, false);
  assert.match(p.$('race-message').textContent, /decode refusal/);
  const runs = [...p.renders],
    checkpoints = p.checkpoint();
  await action(p, 'race-start');
  assert.deepEqual(p.checkpoint(), checkpoints);
  await action(p, 'race-chapter-retry');
  assert.equal(p.$('race-start').disabled, false);
  assert.equal(
    p.renders.every((run, i) => run === runs[i]),
    true,
  );
  assert.deepEqual(p.checkpoint(), checkpoints);
  assert.deepEqual(
    f.reads.map((read) => read.slot),
    [owners['signal-01'].id, owners['signal-01'].id],
  );
  assert.equal(p.drawOptions[0].backdrop === p.drawOptions[1].backdrop, true);
  assert.equal(
    f.media.revoked.length,
    1,
    'Only the rejected decode URL is released before success.',
  );
});

for (const outcome of ['ready', 'error', 'deliberate focus', 'background return', 'scope return'])
  test(`pending Retry owns Cancel and respects ${outcome}`, async (t) => {
    const f = await fixture(t, { failDecode: true }),
      p = f.page,
      entered = deferred(),
      gate = deferred();
    f.media.setDecodeHook(async () => {
      entered.resolve();
      await gate.promise;
    });
    const before = p.checkpoint(),
      runs = [...p.renders],
      retry = p.$('race-chapter-retry'),
      cancel = p.$('race-picture-cancel');
    retry.focus();
    const loading = action(p, 'race-chapter-retry');
    await entered.promise;
    assert.equal(
      p.doc.activeElement === cancel,
      true,
      'Pending Retry transfers its own focus to Cancel.',
    );
    assert.equal(cancel.hidden, false);
    assert.equal(cancel.disabled, false);
    assert.equal(p.$('race-start').disabled, true);
    assert.equal(p.state(), 'ready');
    let expected = p.$('race-start');
    if (outcome === 'error') {
      f.media.fail();
      expected = retry;
    } else if (outcome === 'deliberate focus') {
      expected = p.$('race-help');
      expected.focus();
    } else if (outcome === 'background return') {
      p.doc.hidden = true;
      p.doc.emit('visibilitychange');
      p.doc.body.focus();
      p.doc.hidden = false;
      p.doc.emit('visibilitychange');
      expected = p.doc.body;
    } else if (outcome === 'scope return') {
      p.$('race-help').click();
      p.$('race-help-back').click();
      expected = p.$('race-help');
      assert.equal(p.doc.activeElement === expected, true);
    }
    gate.resolve();
    await loading;
    assert.equal(
      p.doc.activeElement === expected,
      true,
      'Completion respects the action’s remaining focus ownership.',
    );
    assert.equal(
      p.renders.every((run, index) => run === runs[index]),
      true,
    );
    assert.deepEqual(p.checkpoint(), before);
    assert.equal(p.state(), 'ready');
    assert.equal(p.$('race-start').disabled, ['error', 'scope return'].includes(outcome));
    assert.deepEqual(f.memory.allPuts, []);
  });

test('interrupted async Next stays ready after blur and return until a fresh Start', async (t) => {
  const f = await fixture(t),
    p = f.page,
    entered = deferred(),
    gate = deferred();
  await action(p, 'race-start');
  p.frames(151, 200);
  assert.equal(p.state(), 'finished');
  f.media.setDecodeHook(async () => {
    entered.resolve();
    await gate.promise;
  });
  p.$('race-start').focus();
  const next = action(p, 'race-start');
  await entered.promise;
  p.frame(0);
  const runs = [...p.renders],
    checkpoint = p.checkpoint();
  p.doc.focused = false;
  p.win.emit('blur');
  p.doc.body.focus();
  p.doc.focused = true;
  p.frame(0);
  gate.resolve();
  await next;
  assert.equal(p.state(), 'ready', 'The interrupted Next gesture cannot start on return.');
  assert.equal(p.$('race-start').disabled, false, 'Picture preparation can complete.');
  assert.equal(p.doc.activeElement === p.doc.body, true);
  assert.equal(
    p.renders.every((run, index) => run === runs[index]),
    true,
  );
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.equal(p.drawOptions[0].backdrop === p.drawOptions[1].backdrop, true);
  await action(p, 'race-start');
  assert.equal(p.state(), 'running', 'A new explicit Start can use the ready picture.');
  assert.deepEqual(f.memory.allPuts, []);
});

test('whole optional snapshot failure retains explicit authored fallback with a visible notice', async (t) => {
  const f = await fixture(t, { level: 'orchard-crossing', unavailable: true }),
    p = f.page;
  assert.equal(p.$('race-start').disabled, false);
  assert.equal(p.$('race-message').hidden, false);
  assert.match(p.$('race-message').textContent, /Release artwork is unavailable.*authored/);
  const picture = p.drawOptions[0].backdrop;
  assert.ok(picture.image.source.startsWith('data:image/png'));
  assert.equal(p.drawOptions[1].backdrop === picture, true);
  assert.equal(f.reads.length, 0);
  await action(p, 'race-start');
  assert.equal(p.state(), 'running');
  assert.equal(p.drawOptions[0].paused, false);
  assert.deepEqual(f.memory.allPuts, []);
});

test('Back cancels a pending required picture and late completion cannot resume or replace the accepted attempt', async (t) => {
  const gate = deferred();
  let delay = false,
    started;
  const f = await fixture(t, {
      onRead: async ({ signal }) => {
        if (!delay) return;
        started = signal;
        await gate.promise;
      },
    }),
    p = f.page;
  p.$('race-focus').click();
  delay = true;
  p.$('race-class').value = 'bomber';
  const loading = action(p, 'race-class', 'change');
  for (let i = 0; i < 100 && !started; i++) await new Promise((resolve) => setTimeout(resolve, 1));
  assert.ok(started, 'The selected required picture read started.');
  p.frame();
  const checkpoint = p.checkpoint();
  p.$('race-setup-back').click();
  assert.equal(started.aborted, true);
  gate.resolve();
  await loading;
  assert.equal(p.$('race-start').disabled, true);
  assert.match(p.$('race-message').textContent, /cancelled/i);
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.equal(p.drawOptions[0].backdrop, null);
  assert.equal(p.drawOptions[1].backdrop, null);
  assert.deepEqual(f.memory.allPuts, []);
});

test('page disposal releases the owned picture URL once and preserves the original bytes', async (t) => {
  const f = await fixture(t),
    picture = f.page.drawOptions[0].backdrop;
  f.page.win.emit('pagehide', { persisted: true });
  assert.equal(picture.image.released, undefined);
  f.page.win.emit('pagehide', { persisted: false });
  assert.equal(picture.image.released, true);
  assert.equal(f.media.revoked.length, 1);
  assert.equal(f.media.blobs.size, 0);
  assert.equal(f.closed(), 1);
  for (const original of originals.values())
    assert.equal(
      createHash('sha256').update(original.bytes).digest('hex'),
      original.asset.file.sha256,
    );
});

test('initial required-picture loading leaves the actual lobby Cancel keyboard reachable', async (t) => {
  const started = deferred(),
    gate = deferred();
  let document;
  const opening = fixture(t, {
    onMount(value) {
      document = value.document;
    },
    async onRead({ signal }) {
      started.resolve(signal);
      await gate.promise;
    },
  });
  const signal = await started.promise;
  const cancel = document.getElementById('race-picture-cancel');
  assert.equal(document.getElementById('couch-app').inert, false);
  assert.equal(document.documentElement.dataset.toolState, 'ready');
  assert.equal(cancel.hidden, false);
  assert.equal(document.getElementById('race-start').disabled, true);
  const first = document.getElementById('race-coop');
  first.focus();
  first.emit('keydown', { key: 'Tab' });
  assert.equal(
    document.activeElement === cancel,
    true,
    'The actual navigation skips disabled Start.',
  );
  cancel.click();
  assert.equal(signal.aborted, true);
  gate.resolve();
  const { page } = await opening;
  assert.equal(page.$('race-start').disabled, true);
  assert.equal(page.doc.activeElement === page.$('race-chapter-retry'), true);
  assert.match(page.$('race-message').textContent, /cancelled/i);
  assert.equal(page.renders[0].tick, 0);
});

for (const outcome of ['untouched', 'deliberate mode link', 'blur and return', 'decode failure'])
  test(`combined ready focus after a required picture respects ${outcome}`, async (t) => {
    const entered = deferred(),
      gate = deferred();
    let document, window;
    const opening = fixture(t, {
      failDecode: outcome === 'decode failure',
      onMount(value) {
        ({ document, window } = value);
      },
      async onRead() {
        entered.resolve();
        await gate.promise;
      },
    });
    await entered.promise;
    const start = document.getElementById('race-start'),
      team = document.getElementById('race-coop');
    assert.equal(document.documentElement.dataset.toolState, 'ready');
    assert.equal(document.getElementById('couch-app').inert, false);
    assert.equal(start.disabled, true);
    assert.equal(document.activeElement === document.body, true);
    if (outcome === 'deliberate mode link') team.focus();
    if (outcome === 'blur and return') {
      document.focused = false;
      window.emit('blur');
      document.focused = true;
    }
    gate.resolve();
    const f = await opening;
    assert.equal(
      document.activeElement ===
        (outcome === 'untouched'
          ? start
          : outcome === 'deliberate mode link'
            ? team
            : document.body),
      true,
      'Only the untouched, successful initial preparation may choose Start.',
    );
    assert.equal(start.disabled, outcome === 'decode failure');
    assert.equal(f.page.state(), 'ready');
    assert.equal(f.page.tick(), 0);
    assert.deepEqual(f.memory.allPuts, []);
    assert.deepEqual(
      document.getElementById('race-mode-choices').children.map((item) => item.dataset.gameMode),
      ['solo', 'versus', 'team'],
    );
    assert.equal(document.getElementById('race-solo-return').getAttribute('href'), '../');
    assert.equal(team.getAttribute('href'), 'relay-rescue.html?return=versus');
  });
