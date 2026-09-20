import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

const catalogue = JSON.parse(
  await readFile(new URL('../content/optional-worlds.json', import.meta.url), 'utf8'),
);
const chapter = catalogue.packs.find((item) => item.id === 'original-fpv-pressure');
assert.ok(chapter, 'Use the real published optional chapter descriptor.');
const original = await readFile(new URL(`../../${chapter.path}`, import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(original.length, chapter.bytes);
assert.equal(sha(original), chapter.sha256);
const authored = JSON.parse(original.toString('utf8'));
const firstLevel = authored.campaigns[0].levels[0].id;
const firstPicture = Buffer.from(
  authored.levelVisuals
    .find((row) => row.levelId === firstLevel)
    .visualOverrides.background.dataUrl.split(',')[1],
  'base64',
);
const playId = `optional-worlds-install-${chapter.id}`;
const packKey = 'revealline.packs.dev.v1';
const hostTest = (name, run) => test(name, { timeout: 120000 }, run);

class Locks {
  held = new Set();
  async request(name, _options, callback) {
    if (this.held.has(name)) return callback(null);
    this.held.add(name);
    try {
      return await callback({ name });
    } finally {
      this.held.delete(name);
    }
  }
}

// Only DOM, IndexedDB, transport and native pixels are modeled. Runtime handlers,
// catalogue authentication, installation, picture ownership and duels are real.
function mediaBoundary() {
  const urls = new Map();
  let sequence = 0;
  const media = { onDecode: null };
  media.URLImpl = class extends URL {
    static createObjectURL(blob) {
      const url = `blob:couch-catalogue/${++sequence}`;
      urls.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      urls.delete(url);
    }
  };
  media.ImageClass = class {
    set src(source) {
      this.source = source;
      this.ready = Promise.resolve().then(async () => {
        this.bytes = source.startsWith('data:')
          ? Buffer.from(source.split(',')[1], 'base64')
          : Buffer.from(await urls.get(source).arrayBuffer());
        assert.equal(this.bytes.subarray(1, 4).toString(), 'PNG');
        this.width = this.naturalWidth = this.bytes.readUInt32BE(16);
        this.height = this.naturalHeight = this.bytes.readUInt32BE(20);
        this.onload?.();
      });
    }
    async decode() {
      await this.ready;
      await media.onDecode?.(this);
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.released = (this.released || 0) + 1;
    }
  };
  return media;
}

async function fixture(t, { beforeImport, pads = [] } = {}) {
  const media = mediaBoundary();
  const databases = new Map();
  const solo = new Map([
    ['revealline.library.dev.v1', 'retained solo library bytes'],
    ['revealline.session.dev.v1', 'retained unfinished solo flight bytes'],
    ['revealline.progress.dev.v1', 'retained solo progress bytes'],
  ]);
  const controls = { onDownload: null, downloadCount: 0, failDownload: false };
  const page = await couchPage(t, {
    initialLevel: null,
    seconds: '30',
    nativeKeyboard: true,
    beforeImport,
    pads,
    ImageClass: media.ImageClass,
    URLImpl: media.URLImpl,
    lockManager: new Locks(),
    storage: {
      getItem: (key) => solo.get(key) ?? null,
      setItem() {
        assert.fail('Couch catalogue must not write Solo localStorage.');
      },
      removeItem() {
        assert.fail('Couch catalogue must not remove Solo localStorage.');
      },
    },
    assetDatabase: {
      open(name, ...args) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, ...args);
      },
    },
    async fetchResponse(path, options) {
      const url = new URL(path, 'http://localhost/game/couch/');
      if (url.pathname.endsWith('/game/content/optional-worlds.json'))
        return new Response(JSON.stringify({ ...catalogue, packs: [chapter] }));
      if (url.pathname.endsWith(`/${chapter.path}`)) {
        controls.downloadCount++;
        await controls.onDownload?.(options);
        return controls.failDownload
          ? new Response('Offline fixture', { status: 503 })
          : new Response(original, { headers: { 'content-length': String(original.length) } });
      }
      // Keep the ordinary base map as the original attempt. The optional chapter
      // still uses its exact published body; no synthetic authored pictures.
      if (url.pathname.endsWith('/content/packs/fpv-arcade-r5.json'))
        return { ok: false, status: 404 };
    },
  });
  const originalSolo = [...solo];
  return {
    page,
    media,
    controls,
    writes: () => [...databases.values()].flatMap((db) => db.allPuts),
    assertSoloKept() {
      assert.deepEqual([...solo], originalSolo);
      for (const [store, key] of [...databases.values()].flatMap((db) => db.allPuts)) {
        assert.equal(store, 'assets', 'Only the installed-pack store may be written.');
        assert.equal(key, packKey, 'Installation must not write Solo saves or progress.');
      }
    },
  };
}

async function settled(page, predicate, message) {
  await waitFor(
    () => {
      page.frame(0);
      return predicate();
    },
    { timeoutMs: 45000, message },
  );
}
function activate(page, id) {
  const element = page.$(id);
  assert.ok(element, `Missing public control ${id}`);
  assert.equal(element.disabled, false, `${id} must be available.`);
  assert.ok(element.getClientRects().length, `${id} must be visible.`);
  element.focus();
  // Observe the promise returned by the actual DOM handler, as the existing
  // Couch host fixtures do. Native activation still invokes that handler once.
  const handler = element.onclick;
  let operation;
  if (handler) element.onclick = (event) => (operation = handler.call(element, event));
  try {
    page.key('Enter', true, element);
    page.key('Enter', false, element);
  } finally {
    element.onclick = handler;
  }
  return operation;
}
function tap(page, id) {
  const element = page.$(id);
  assert.ok(element, `Missing public control ${id}`);
  assert.equal(element.disabled, false, `${id} must be available.`);
  assert.ok(element.getClientRects().length, `${id} must be visible.`);
  // Touch activation need not move native focus. Observe the same public click
  // handler without supplying focus that the production host must admit itself.
  const handler = element.onclick;
  let operation;
  if (handler) element.onclick = (event) => (operation = handler.call(element, event));
  try {
    element.click();
  } finally {
    element.onclick = handler;
  }
  return operation;
}
async function openCatalogue(page) {
  activate(page, 'race-chapters');
  await settled(
    page,
    () => page.$('optional-worlds-dialog')?.open && page.$(playId)?.disabled === false,
    'The real Couch chapter catalogue must load its published Play action.',
  );
  return page.$(playId);
}
async function closeCatalogue(page) {
  activate(page, 'optional-worlds-top-back');
  await settled(page, () => !page.$('optional-worlds-dialog').open, 'Back must close Chapters.');
}
async function start(page) {
  activate(page, 'race-start');
  await settled(page, () => page.state() === 'running', 'Start must run the accepted race.');
}
async function prepareState(page, state) {
  if (state === 'ready') return;
  await start(page);
  page.key('KeyS');
  page.frames(state === 'finished' ? 151 : 10, state === 'finished' ? 200 : undefined);
  page.key('KeyS', false);
  if (state === 'paused') page.$('race-pause').click();
  page.frame(0);
  assert.equal(page.state(), state);
}
function snapshot(page) {
  page.frame(0);
  return {
    state: page.state(),
    runs: [...page.renders],
    checkpoints: page.checkpoint(),
    pictures: page.drawOptions.map((options) => options.backdrop),
    results: [0, 1].map((seat) => page.$(`race-result-${seat}`).textContent),
    score: page.$('series-score').textContent,
    selection: page.$('race-level').value,
  };
}
function assertRetained(page, before) {
  page.frame(0);
  assert.equal(page.state(), before.state);
  page.renders.forEach((run, seat) =>
    assert.ok(run === before.runs[seat], 'The accepted run identity is retained.'),
  );
  assert.deepEqual(page.checkpoint(), before.checkpoints);
  page.drawOptions.forEach((options, seat) =>
    assert.ok(
      options.backdrop === before.pictures[seat],
      'The accepted picture identity is retained.',
    ),
  );
  assert.deepEqual(
    [0, 1].map((seat) => page.$(`race-result-${seat}`).textContent),
    before.results,
  );
  assert.equal(page.$('series-score').textContent, before.score);
  assert.equal(page.$('race-level').value, before.selection);
}

hostTest(
  'Couch main Chapters and Back retain the ready boards and restore the exact keyboard opener',
  async (t) => {
    const f = await fixture(t),
      p = f.page,
      before = snapshot(p);
    await openCatalogue(p);
    assert.equal(p.$('optional-worlds-manage')?.getClientRects().length ?? 0, 0);
    assert.ok(p.doc.activeElement === p.$('optional-worlds-top-back'), 'Back retains exact focus.');
    await closeCatalogue(p);
    assert.ok(
      p.doc.activeElement === p.$('race-chapters'),
      'Focus returns to the exact Chapters opener.',
    );
    assertRetained(p, before);
    assert.deepEqual(f.writes(), []);
    f.assertSoloKept();
  },
);

for (const state of ['ready', 'paused', 'finished'])
  hostTest(
    `failed catalogue download retains the accepted ${state} race, artwork and results`,
    async (t) => {
      const f = await fixture(t),
        p = f.page;
      await prepareState(p, state);
      const before = snapshot(p);
      await openCatalogue(p);
      f.controls.failDownload = true;
      activate(p, playId);
      await settled(
        p,
        () =>
          !p.$(playId).disabled &&
          /503|unavailable/i.test(p.$('optional-worlds-status').textContent),
        'A failed download must surface recovery and re-enable its action.',
      );
      assert.ok(p.doc.activeElement === p.$(playId), 'Focus returns to the exact Play action.');
      assertRetained(p, before);
      await closeCatalogue(p);
      assertRetained(p, before);
      assert.ok(
        p.doc.activeElement === p.$('race-chapters'),
        'Focus returns to the exact Chapters opener.',
      );
      assert.deepEqual(f.writes(), []);
      f.assertSoloKept();
    },
  );

for (const state of ['paused', 'finished'])
  hostTest(
    `Cancel fences a late transport completion without replacing the ${state} race`,
    async (t) => {
      const f = await fixture(t),
        p = f.page,
        entered = deferred(),
        gate = deferred(),
        returned = deferred();
      t.after(() => gate.resolve());
      await prepareState(p, state);
      const before = snapshot(p);
      await openCatalogue(p);
      f.controls.onDownload = async () => {
        entered.resolve();
        await gate.promise;
        returned.resolve();
      };
      const pending = activate(p, playId);
      assert.equal(
        p.doc.activeElement,
        p.$('optional-worlds-cancel'),
        'The real catalogue activation hook must retain the panel-owned Cancel focus.',
      );
      await entered.promise;
      assert.equal(p.$('optional-worlds-cancel').hidden, false);
      assert.equal(p.doc.activeElement, p.$('optional-worlds-cancel'));
      assertRetained(p, before);
      activate(p, 'optional-worlds-cancel');
      assert.ok(p.doc.activeElement === p.$(playId), 'Focus returns to the exact Play action.');
      gate.resolve();
      await returned.promise;
      await pending;
      await settled(p, () => !p.$(playId).disabled, 'Cancel must release the chapter action.');
      await closeCatalogue(p);
      assertRetained(p, before);
      assert.deepEqual(f.writes(), []);
      f.assertSoloKept();
    },
  );

hostTest(
  'one deliberate Download & play starts once with the same authenticated original on both boards',
  async (t) => {
    const f = await fixture(t),
      p = f.page,
      before = snapshot(p);
    await openCatalogue(p);
    activate(p, playId);
    await settled(
      p,
      () => p.state() === 'running',
      'Catalogue Play must start without another Start.',
    );
    assert.equal(p.$('optional-worlds-dialog').open, false);
    assert.equal(p.$('race-chapter-replace')?.open ?? false, false);
    const accepted = [...p.renders],
      picture = p.drawOptions[0].backdrop;
    accepted.forEach((run, seat) => {
      assert.ok(run !== before.runs[seat], 'Replacement creates a new run.');
      assert.equal(run.level.id, firstLevel);
    });
    assert.ok(picture?.image);
    assert.ok(p.drawOptions[1].backdrop === picture, 'Both boards share the accepted picture.');
    assert.equal(sha(picture.image.bytes), sha(firstPicture));
    assert.equal(f.controls.downloadCount, 1);
    p.frames(5);
    p.renders.forEach((run, seat) =>
      assert.ok(run === accepted[seat], 'Frames retain the one accepted run.'),
    );
    assert.ok(p.tick() > 0, 'Ordinary frames advance the one accepted race.');
    assert.equal(f.writes().length, 1);
    f.assertSoloKept();
  },
);

hostTest(
  'paused installed Play Stay returns to the same action; Replace & play starts only once without redownload',
  async (t) => {
    const f = await fixture(t),
      p = f.page;
    await openCatalogue(p);
    activate(p, playId);
    await settled(p, () => p.state() === 'running', 'The chapter must start first.');
    p.key('KeyS');
    p.frames(12);
    p.key('KeyS', false);
    p.$('race-pause').click();
    const before = snapshot(p),
      writes = f.writes().length;
    await openCatalogue(p);
    assert.equal(p.$(playId).textContent, 'Play');
    activate(p, playId);
    await settled(
      p,
      () => p.$('race-chapter-replace')?.open,
      'Paused replacement requires a decision.',
    );
    assertRetained(p, before);
    activate(p, 'race-chapter-stay');
    await settled(
      p,
      () => !p.$('race-chapter-replace').open && !p.$(playId).disabled,
      'Stay releases Play.',
    );
    assert.ok(p.doc.activeElement === p.$(playId), 'Focus returns to the exact Play action.');
    assert.match(p.$('optional-worlds-status').textContent, /race.*kept|kept.*race/i);
    assertRetained(p, before);
    activate(p, playId);
    await settled(p, () => p.$('race-chapter-replace').open, 'A new Play asks again.');
    activate(p, 'race-chapter-play');
    await settled(
      p,
      () => p.state() === 'running',
      'Explicit replacement starts the selected chapter.',
    );
    assert.equal(p.$('optional-worlds-dialog').open, false);
    const accepted = [...p.renders];
    accepted.forEach((run, seat) =>
      assert.ok(run !== before.runs[seat], 'Replacement creates a new run.'),
    );
    assert.ok(
      p.drawOptions[0].backdrop === p.drawOptions[1].backdrop,
      'Both boards share the accepted picture.',
    );
    assert.equal(sha(p.drawOptions[0].backdrop.image.bytes), sha(firstPicture));
    p.frames(5);
    p.renders.forEach((run, seat) =>
      assert.ok(run === accepted[seat], 'Frames retain the one accepted run.'),
    );
    assert.equal(f.controls.downloadCount, 1);
    assert.equal(f.writes().length, writes);
    f.assertSoloKept();
  },
);

for (const interruption of ['Back then setup', 'foreground loss'])
  hostTest(
    `late picture preparation after ${interruption} cannot adopt or start the catalogue race`,
    async (t) => {
      const f = await fixture(t),
        p = f.page,
        gate = deferred(),
        returned = deferred();
      t.after(() => gate.resolve());
      const before = snapshot(p);
      await openCatalogue(p);
      let heldImage;
      f.media.onDecode = async (image) => {
        // Embedded originals decode from data URLs. Hold the first actual
        // picture preparation after the durable pack commit, not installation
        // validation and not an assumed URL transport representation.
        if (heldImage || !f.writes().length || sha(image.bytes) !== sha(firstPicture)) return;
        heldImage = image;
        await gate.promise;
        returned.resolve();
      };
      const pending = activate(p, playId);
      await settled(p, () => heldImage, 'The committed chapter must begin picture preparation.');
      assert.equal(
        p.doc.activeElement,
        p.$('optional-worlds-cancel'),
        'Cancel stays actionable through actual installed-picture decoding.',
      );
      assertRetained(p, before);
      let focus;
      if (interruption === 'Back then setup') {
        await closeCatalogue(p);
        activate(p, 'race-focus');
        assert.equal(p.$('race-setup').hidden, false);
        focus = p.doc.activeElement;
      } else {
        p.doc.focused = false;
        p.win.emit('blur');
        p.doc.body.focus();
        p.doc.focused = true;
        focus = p.doc.body;
      }
      gate.resolve();
      await returned.promise;
      await pending;
      await settled(
        p,
        () => heldImage.released && (!p.$('optional-worlds-dialog').open || !p.$(playId).disabled),
        'Retired preparation must settle without taking back the view.',
      );
      assertRetained(p, before);
      assert.ok(p.doc.activeElement === focus, 'Late preparation preserves the newer focus owner.');
      if (interruption === 'Back then setup') assert.equal(p.$('race-setup').hidden, false);
      assert.equal(f.controls.downloadCount, 1);
      f.assertSoloKept();
    },
  );

hostTest(
  'finished results catalogue Play starts the new chapter without a discard prompt or a second Start',
  async (t) => {
    const f = await fixture(t),
      p = f.page;
    await prepareState(p, 'finished');
    const before = snapshot(p);
    await openCatalogue(p);
    assertRetained(p, before);
    activate(p, playId);
    await settled(
      p,
      () => p.state() === 'running',
      'Results may deliberately start another chapter.',
    );
    assert.equal(p.$('race-chapter-replace')?.open ?? false, false);
    p.renders.forEach((run, seat) => {
      assert.ok(run !== before.runs[seat], 'Replacement creates a new run.');
      assert.equal(run.level.id, firstLevel);
    });
    assert.ok(
      p.drawOptions[0].backdrop === p.drawOptions[1].backdrop,
      'Both boards share the accepted picture.',
    );
    assert.equal(p.$('series-score').textContent, '0 : 0');
    assert.equal(f.controls.downloadCount, 1);
    f.assertSoloKept();
  },
);

hostTest(
  'foreground loss releases catalogue actions while picture decoding is still unresolved',
  async (t) => {
    const f = await fixture(t),
      p = f.page,
      gate = deferred(),
      before = snapshot(p);
    let heldImage,
      decoded = false;
    t.after(() => gate.resolve());
    await openCatalogue(p);
    f.media.onDecode = async (image) => {
      if (heldImage || !f.writes().length || sha(image.bytes) !== sha(firstPicture)) return;
      heldImage = image;
      await gate.promise;
      decoded = true;
    };
    const pending = activate(p, playId);
    try {
      await settled(p, () => heldImage, 'The committed chapter must begin picture preparation.');
      assert.equal(p.$(playId).disabled, true);
      p.doc.focused = false;
      p.win.emit('blur');
      p.doc.body.focus();
      p.doc.focused = true;
      await waitFor(
        () => {
          p.frame(0);
          return !p.$(playId).disabled && p.$('optional-worlds-cancel').hidden;
        },
        {
          timeoutMs: 1000,
          message:
            'Foreground loss must release catalogue actions without waiting for image decode.',
        },
      );
      assert.equal(decoded, false, 'The decoder is deliberately still unresolved.');
      assert.equal(p.$('optional-worlds-dialog').open, true);
      assert.ok(p.doc.activeElement === p.doc.body, 'Cancellation must not reclaim focus.');
      assertRetained(p, before);
      f.assertSoloKept();
    } finally {
      gate.resolve();
      await pending;
    }
    assertRetained(p, before);
    assert.ok(p.doc.activeElement === p.doc.body, 'Late preparation does not reclaim focus.');
    assert.equal(f.controls.downloadCount, 1);
  },
);

hostTest(
  'moving focus to Back retires late preparation with a terminal race-kept status',
  async (t) => {
    const f = await fixture(t),
      p = f.page,
      gate = deferred();
    t.after(() => gate.resolve());
    await prepareState(p, 'finished');
    const before = snapshot(p);
    await openCatalogue(p);
    let heldImage;
    f.media.onDecode = async (image) => {
      if (heldImage || !f.writes().length || sha(image.bytes) !== sha(firstPicture)) return;
      heldImage = image;
      await gate.promise;
    };
    const pending = activate(p, playId);
    try {
      await settled(p, () => heldImage, 'The committed chapter must begin picture preparation.');
      p.$('optional-worlds-top-back').focus();
      assert.equal(p.$('optional-worlds-dialog').open, true);
      assertRetained(p, before);
    } finally {
      gate.resolve();
      await pending;
    }
    await settled(
      p,
      () => !p.$(playId).disabled && p.$('optional-worlds-cancel').hidden,
      'A retired preparation must leave a terminal catalogue state.',
    );
    assert.equal(p.$('optional-worlds-dialog').open, true);
    assert.ok(p.doc.activeElement === p.$('optional-worlds-top-back'), 'Back retains exact focus.');
    assert.match(p.$('optional-worlds-status').textContent, /cancelled|race.*kept|kept.*race/i);
    assert.doesNotMatch(p.$('optional-worlds-status').textContent, /preparing|checking/i);
    assertRetained(p, before);
    assert.equal(f.controls.downloadCount, 1);
    f.assertSoloKept();
  },
);

hostTest(
  'touch Play from Back focus keeps a paused race on Stay and a fresh Replace starts once',
  async (t) => {
    const f = await fixture(t),
      p = f.page;
    await prepareState(p, 'paused');
    const before = snapshot(p);
    await openCatalogue(p);
    assert.ok(
      p.doc.activeElement === p.$('optional-worlds-top-back'),
      'Back owns initial touch focus.',
    );
    const pending = tap(p, playId);
    await settled(
      p,
      () => p.$('race-chapter-replace')?.open,
      'Touch Play must ask before replacement.',
    );
    assertRetained(p, before);
    tap(p, 'race-chapter-stay');
    await pending;
    await settled(p, () => !p.$(playId).disabled, 'Stay must release the original Play action.');
    assertRetained(p, before);
    assert.equal(p.$('race-chapter-replace').open, false);
    assert.ok(p.doc.activeElement === p.$(playId), 'Stay restores the exact Play action.');
    assert.match(p.$('optional-worlds-status').textContent, /race.*kept|kept.*race/i);
    const writes = f.writes().length;
    p.$('optional-worlds-top-back').focus();
    const retry = tap(p, playId);
    await settled(p, () => p.$('race-chapter-replace').open, 'Fresh touch Play must ask again.');
    tap(p, 'race-chapter-play');
    await retry;
    p.frame(0);
    assert.equal(p.state(), 'running');
    const accepted = [...p.renders];
    accepted.forEach((run, seat) =>
      assert.ok(run !== before.runs[seat], 'Replacement creates a new run.'),
    );
    assert.ok(
      p.drawOptions[0].backdrop === p.drawOptions[1].backdrop,
      'Both boards share the accepted picture.',
    );
    assert.equal(sha(p.drawOptions[0].backdrop.image.bytes), sha(firstPicture));
    p.frames(5);
    p.renders.forEach((run, seat) =>
      assert.ok(run === accepted[seat], 'Frames retain the one accepted run.'),
    );
    assert.equal(f.controls.downloadCount, 1);
    assert.equal(f.writes().length, writes);
    f.assertSoloKept();
  },
);

hostTest(
  'touch Replace starts one prepared race when catalogue Play began with Back still focused',
  async (t) => {
    const f = await fixture(t),
      p = f.page;
    await prepareState(p, 'paused');
    const before = snapshot(p);
    await openCatalogue(p);
    assert.ok(
      p.doc.activeElement === p.$('optional-worlds-top-back'),
      'Back owns initial touch focus.',
    );
    const pending = tap(p, playId);
    await settled(
      p,
      () => p.$('race-chapter-replace')?.open,
      'Touch Play must prepare its decision.',
    );
    assertRetained(p, before);
    tap(p, 'race-chapter-play');
    await pending;
    p.frame(0);
    assert.equal(p.state(), 'running');
    assert.equal(p.$('optional-worlds-dialog').open, false);
    assert.equal(p.$('race-chapter-replace').open, false);
    const accepted = [...p.renders];
    accepted.forEach((run, seat) => {
      assert.ok(run !== before.runs[seat], 'Replacement creates a new run.');
      assert.equal(run.level.id, firstLevel);
    });
    assert.ok(
      p.drawOptions[0].backdrop === p.drawOptions[1].backdrop,
      'Both boards share the accepted picture.',
    );
    assert.equal(sha(p.drawOptions[0].backdrop.image.bytes), sha(firstPicture));
    p.frames(5);
    p.renders.forEach((run, seat) =>
      assert.ok(run === accepted[seat], 'Frames retain the one accepted run.'),
    );
    assert.equal(f.controls.downloadCount, 1);
    assert.equal(f.writes().length, 1);
    f.assertSoloKept();
  },
);

hostTest(
  'denied storage getter leaves shipped Couch races playable and explains unavailable chapters',
  async (t) => {
    const f = await fixture(t, {
      beforeImport() {
        Object.defineProperty(globalThis, 'localStorage', {
          configurable: true,
          get() {
            throw new DOMException('Storage denied', 'SecurityError');
          },
        });
      },
    });
    const p = f.page;
    assert.ok(p.pendingFrames() > 0, 'Storage denial must not stop shipped-map boot.');
    assert.equal(p.state(), 'ready');
    assert.equal(p.$('race-start').disabled, false);
    assert.equal(p.$('race-chapters').disabled, true);
    assert.match(
      p.$('race-installed-status').textContent,
      /chapters.*unavailable|storage.*denied/i,
    );
    await start(p);
    p.frames(5);
    assert.equal(p.state(), 'running');
    assert.ok(p.tick() > 0, 'The ordinary shipped race remains playable.');
    assert.deepEqual(f.writes(), []);
    f.assertSoloKept();
  },
);

hostTest(
  'a newer Back focus during touch admission cancels before download or adoption',
  async (t) => {
    const f = await fixture(t),
      p = f.page;
    await prepareState(p, 'paused');
    const before = snapshot(p);
    await openCatalogue(p);
    const dialog = p.$('optional-worlds-dialog'),
      back = p.$('optional-worlds-top-back');
    let redirects = 0;
    const chooseBack = (event) => {
      if (event.target !== dialog || redirects) return;
      redirects++;
      back.focus();
    };
    p.doc.addEventListener('focusin', chooseBack);
    t.after(() => p.doc.removeEventListener('focusin', chooseBack));
    await tap(p, playId);
    p.frame(0);
    assert.equal(redirects, 1, 'The host admitted touch focus through the real open dialog.');
    assert.ok(p.doc.activeElement === back, 'A newer Back focus retains authority.');
    assert.equal(dialog.open, true);
    assert.equal(p.$('race-chapter-replace').open, false);
    assert.equal(p.$(playId).disabled, false);
    assert.match(p.$('optional-worlds-status').textContent, /cancelled|race.*kept|kept.*race/i);
    assertRetained(p, before);
    assert.equal(f.controls.downloadCount, 0);
    assert.deepEqual(f.writes(), []);
    f.assertSoloKept();
  },
);

hostTest(
  'the claimed controller opens Chapters and returns with East without replacing either ready board',
  async (t) => {
    const pads = [0, 1].map((index) => ({
      index,
      id: `Catalogue standard pad ${index}`,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    }));
    const f = await fixture(t, { pads }),
      p = f.page,
      before = snapshot(p);
    p.join(0);
    assert.equal(p.doc.activeElement.id, 'race-start');
    assert.match(p.$('race-menu-status').textContent, /Player 1 controller has the menu/);
    p.pulse(0, 13);
    assert.equal(p.doc.activeElement.id, 'race-chapters');
    p.pulse(0, 0);
    await settled(
      p,
      () => p.$('optional-worlds-dialog')?.open && p.$(playId)?.disabled === false,
      'South must open the real Chapters catalogue.',
    );
    assert.equal(p.doc.activeElement.id, 'optional-worlds-top-back');
    assertRetained(p, before);
    p.pulse(1, 1);
    assert.equal(p.$('optional-worlds-dialog').open, true, 'The other pad does not own this menu.');
    assert.match(p.$('race-menu-status').textContent, /Player 1 controller has the menu/);
    p.pulse(0, 1);
    await settled(p, () => !p.$('optional-worlds-dialog').open, 'Owner East returns to Versus.');
    assert.ok(p.doc.activeElement === p.$('race-chapters'), 'Back restores the exact opener.');
    assert.match(p.$('race-menu-status').textContent, /Player 1 controller has the menu/);
    assertRetained(p, before);
    assert.equal(p.tick(), 0, 'Menu gestures never start either flight.');
    assert.equal(f.controls.downloadCount, 0);
    assert.deepEqual(f.writes(), []);
    f.assertSoloKept();
  },
);
