import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mountPresentationPage } from '../presentation/page.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { Element } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';

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
    decodeHook = null,
    releaseHook = null;
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
      this.releaseCount = (this.releaseCount || 0) + 1;
      releaseHook?.(this);
    }
  }
  return {
    Image,
    URLImpl,
    images,
    blobs,
    revoked,
    setReleaseHook: (hook) => {
      releaseHook = hook;
    },
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
  {
    level = 'signal-01',
    onRead,
    onMount,
    unavailable = false,
    failDecode = false,
    audio,
    storage,
    pads = [],
  } = {},
) {
  const media = mediaBoundary(),
    memory = managedIndexedDB(),
    reads = [];
  const snapshot = { resolved: compiled.resolved, images: new Map(), canvas: {} };
  if (failDecode) media.fail();
  let lease,
    closed = 0;
  const page = await couchPage(t, {
    audio,
    storage,
    pads,
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
  const completedRuns = [...p.renders],
    completedCheckpoint = p.checkpoint();
  f.media.setDecodeHook(async () => {
    entered.resolve();
    await gate.promise;
  });
  p.$('race-start').focus();
  const next = action(p, 'race-start');
  await entered.promise;
  p.frame(0);
  assert.equal(p.state(), 'finished');
  assert.equal(
    p.renders.every((run, i) => run === completedRuns[i]),
    true,
  );
  assert.deepEqual(p.checkpoint(), completedCheckpoint);
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
    p.renders.every((run, i) => run !== completedRuns[i]),
    true,
  );
  const readyRuns = [...p.renders],
    readyCheckpoint = p.checkpoint();
  p.frames(20);
  assert.equal(
    p.renders.every((run, i) => run === readyRuns[i]),
    true,
  );
  assert.deepEqual(p.checkpoint(), readyCheckpoint);
  assert.equal(p.drawOptions[0].backdrop === p.drawOptions[1].backdrop, true);
  await action(p, 'race-start');
  assert.equal(p.state(), 'running', 'A new explicit Start can use the ready picture.');
  assert.deepEqual(f.memory.allPuts, []);
});

test('failed Next retains the completed round and its displayed original', async (t) => {
  const f = await fixture(t),
    p = f.page;
  await action(p, 'race-start');
  p.frames(151, 200);
  assert.equal(p.state(), 'finished');
  const checkpoint = p.checkpoint(),
    runs = [...p.renders],
    backdrop = p.drawOptions[0].backdrop,
    results = [0, 1].map((i) => p.$(`race-result-${i}`).textContent),
    wins = p.$('series-score').textContent;
  assert.ok(backdrop.image, 'The completed round has its original picture.');
  f.media.fail();
  p.$('race-start').focus();
  await action(p, 'race-start');
  assert.equal(p.state(), 'finished', 'A refused next picture must preserve Results.');
  assert.equal(
    p.renders.every((run, i) => run === runs[i]),
    true,
  );
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.deepEqual(
    [0, 1].map((i) => p.$(`race-result-${i}`).textContent),
    results,
  );
  assert.equal(
    p.drawOptions.every((options) => options.backdrop === backdrop),
    true,
  );
  assert.notEqual(backdrop.image.released, true);
  assert.equal(backdrop.image.releaseCount || 0, 0);
  assert.equal(p.$('series-score').textContent, wins);
  assert.equal(p.$('race-start').disabled, false);
  assert.equal(p.$('race-review').hidden, false);
  assert.match(p.$('race-message').textContent, /could not|unavailable|retry/i);
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

const completedResult = (p) => ({
  runs: [...p.renders],
  checkpoints: p.checkpoint(),
  picture: p.drawOptions[0].backdrop,
  results: [0, 1].map((i) => p.$(`race-result-${i}`).textContent),
  wins: p.$('series-score').textContent,
});
function retainedResult(p, before) {
  assert.equal(p.state(), 'finished');
  assert.equal(
    p.renders.every((run, i) => run === before.runs[i]),
    true,
  );
  assert.deepEqual(p.checkpoint(), before.checkpoints);
  assert.equal(
    p.drawOptions.every((options) => options.backdrop === before.picture),
    true,
  );
  assert.deepEqual(
    [0, 1].map((i) => p.$(`race-result-${i}`).textContent),
    before.results,
  );
  assert.equal(p.$('series-score').textContent, before.wins);
  assert.equal(before.picture.image.releaseCount || 0, 0);
  assert.equal(p.$('race-review').hidden, false);
}

test('failed Next original read keeps Results and keyboard View, then retry adopts one new round', async (t) => {
  let refuse = false;
  const readError = new Error(
      'Presentation file unavailable: ./assets/c1aedf89bc3433dc1cb60998fa1e2563480a590c38586332f444c4c12c772fce.png.',
    ),
    diagnostics = [];
  t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
  const f = await fixture(t, {
      onRead: () => {
        if (refuse) throw readError;
      },
    }),
    p = f.page;
  await action(p, 'race-start');
  p.frames(151, 200);
  const before = completedResult(p);
  refuse = true;
  p.$('race-start').focus();
  await action(p, 'race-start');
  retainedResult(p, before);
  assert.equal(
    p.$('race-message').textContent,
    'The rematch picture could not be prepared. Results are kept. Choose Rematch to retry.',
  );
  assert.doesNotMatch(p.$('race-message').textContent, /assets\/|[a-f0-9]{64}/);
  assert.deepEqual(diagnostics, [['Next picture preparation failed.', readError]]);
  assert.equal(p.doc.activeElement === p.$('race-start'), true);
  p.$('race-review').focus();
  const review = p.$('race-review');
  // Shared navigation leaves a current enabled button to native Enter default.
  // Only this exact, unmodified, unprevented activation gets the finite default.
  const enter = review.emit('keydown', {
    key: 'Enter',
    code: 'Enter',
    repeat: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
  });
  assert.equal(enter.defaultPrevented, false);
  if (
    !enter.defaultPrevented &&
    !enter.ctrlKey &&
    !enter.altKey &&
    !enter.metaKey &&
    !review.disabled &&
    p.doc.activeElement === review &&
    !review.closest('[hidden],[inert]')
  )
    review.click();
  review.emit('keyup', { key: 'Enter', code: 'Enter' });
  p.frame();
  assert.equal(
    p.$('race-boards').hidden,
    false,
    'Native button activation opens both completed boards after the shared handler.',
  );
  retainedResult(p, before);
  await action(p, 'race-pause');
  refuse = false;
  p.$('race-start').focus();
  await action(p, 'race-start');
  assert.equal(p.state(), 'running');
  assert.equal(
    p.renders.every((run, i) => run !== before.runs[i]),
    true,
  );
  assert.equal(before.picture.image.releaseCount, 1);
  assert.equal(p.drawOptions[0].backdrop === p.drawOptions[1].backdrop, true);
  assert.deepEqual(f.memory.allPuts, []);
});

for (const interruption of ['Cancel', 'Help', 'View', 'Setup confirmation', 'dispose'])
  test(`pending completed Next preserves Results through ${interruption}`, async (t) => {
    const f = await fixture(t),
      p = f.page,
      entered = deferred(),
      gate = deferred();
    await action(p, 'race-start');
    p.frames(151, 200);
    const before = completedResult(p);
    f.media.setDecodeHook(async () => {
      entered.resolve();
      await gate.promise;
    });
    p.$('race-start').focus();
    const next = action(p, 'race-start');
    await entered.promise;
    p.frame();
    retainedResult(p, before);
    assert.equal(p.$('race-start').disabled, true);
    const readCount = f.reads.length;
    await action(p, 'race-start');
    assert.equal(
      f.reads.length,
      readCount,
      'A duplicate pending Next does not acquire another candidate.',
    );
    if (interruption === 'Cancel') {
      p.$('race-picture-cancel').focus();
      await action(p, 'race-picture-cancel');
      assert.equal(p.doc.activeElement === p.$('race-start'), true);
    } else if (interruption === 'Help') {
      await action(p, 'race-help');
      await action(p, 'race-help-back');
    } else if (interruption === 'View') {
      await action(p, 'race-review');
    } else if (interruption === 'Setup confirmation') {
      await action(p, 'race-focus');
    } else p.win.emit('pagehide', { persisted: false });
    if (interruption !== 'dispose') retainedResult(p, before);
    gate.resolve();
    await next;
    if (interruption !== 'dispose') {
      retainedResult(p, before);
      assert.equal(p.$('race-start').disabled, false);
    } else
      assert.equal(
        before.picture.image.releaseCount,
        1,
        'Page disposal owns the old accepted image.',
      );
    assert.equal(
      f.media.images.at(-1).releaseCount,
      1,
      'Only the refused candidate is released by cancellation.',
    );
    assert.deepEqual(f.memory.allPuts, []);
  });

test('successful Next retires its original only after the new duel and picture are published', async (t) => {
  const f = await fixture(t),
    p = f.page;
  await action(p, 'race-start');
  p.frames(151, 200);
  const before = completedResult(p);
  let observed;
  f.media.setReleaseHook((image) => {
    if (image !== before.picture.image) return;
    p.frame(0);
    observed = {
      state: p.state(),
      newRuns: p.renders.every((run, i) => run !== before.runs[i]),
      newPicture: p.drawOptions[0].backdrop !== before.picture,
      shared: p.drawOptions[0].backdrop === p.drawOptions[1].backdrop,
    };
  });
  p.$('race-start').focus();
  await action(p, 'race-start');
  assert.deepEqual(observed, { state: 'ready', newRuns: true, newPicture: true, shared: true });
  assert.equal(p.state(), 'running');
  assert.equal(before.picture.image.releaseCount, 1);
  assert.deepEqual(f.memory.allPuts, []);
});

test('completed match wins reset only when an explicitly retried Next commits', async (t) => {
  const f = await fixture(t),
    p = f.page;
  await chooseFormat(p, 'first-to-two');
  await action(p, 'race-start');
  for (const [round, winner] of ['win', 'draw', 'win'].entries()) {
    completeRound(p, winner);
    assert.equal(
      p.$('series-score').textContent,
      `${round === 2 ? 2 : 1} : 0`,
      'Directional wins earn one point each; an identical-input timeout draw earns none.',
    );
    assert.match(p.$('race-format-note').textContent, /first to two/i);
    assert.match(p.$('race-format-help').textContent, /first to two/i);
    if (winner === 'draw') assert.match(p.$('race-message').textContent, /^Draw\b/);
    if (round < 2) {
      assert.equal(p.$('race-title').textContent, 'Round complete.');
      assert.equal(p.$('race-start').textContent, 'Next round: First Signal');
      const before = completedResult(p);
      if (round === 0) {
        f.media.fail();
        await action(p, 'race-start');
        retainedResult(p, before);
        assert.equal(
          p.$('race-message').textContent,
          'The next round picture could not be prepared. Results are kept. Choose Next round to retry.',
        );
      }
      p.frames(5, 200);
      retainedResult(p, before);
      await action(p, 'race-start');
    }
  }
  const before = completedResult(p);
  assert.equal(p.$('race-title').textContent, 'Match complete.');
  f.media.fail();
  await action(p, 'race-start');
  retainedResult(p, before);
  assert.equal(p.$('series-score').textContent, '2 : 0');
  assert.equal(p.$('race-start').textContent, 'Rematch: First Signal');
  await action(p, 'race-start');
  assert.equal(p.state(), 'running');
  assert.equal(p.$('series-score').textContent, '0 : 0');
  assert.equal(before.picture.image.releaseCount, 1);
  assert.deepEqual(f.memory.allPuts, []);
});

async function chooseFormat(p, value) {
  assert.equal(p.state(), 'ready');
  await action(p, 'race-focus');
  assert.equal(p.$('race-setup').hidden, false);
  const control = p.$('race-format');
  assert.ok(control, 'Race setup exposes the actual native format selector.');
  assert.equal(control.disabled, false);
  assert.equal(control.closest('[hidden],[inert]'), null);
  control.value = value;
  await action(p, 'race-format', 'change');
  assert.equal(control.value, value);
  await action(p, 'race-setup-back');
  assert.equal(p.state(), 'ready');
  assert.equal(p.$('race-start').disabled, false);
}

function completeRound(p, outcome) {
  assert.equal(p.state(), 'running');
  // Same shipped map and legal directional/timeout route as the retained
  // threshold test. No duel status, winner or player coordinates are injected.
  if (outcome === 'win') p.key('KeyS');
  p.frames(151, 200);
  if (outcome === 'win') p.key('KeyS', false);
  assert.equal(p.state(), 'finished');
}

const acceptedFormatCopy = (p) =>
  ['race-title', 'race-summary', 'race-format-note', 'race-format-help', 'race-start'].map(
    (id) => p.$(id).textContent,
  );

for (const outcome of ['win', 'draw'])
  test(`default One race ${outcome} settles once, retains Review and ignores a hidden format draft`, async (t) => {
    const f = await fixture(t),
      p = f.page;
    assert.equal(p.$('race-format').value, 'single');
    assert.deepEqual(
      p.$('race-format').options.map((option) => option.value),
      ['single', 'first-to-two'],
      'This slice exposes two formats; it does not claim an authored campaign tour.',
    );
    assert.match(p.$('race-format-note').textContent, /one race/i);
    assert.match(p.$('race-format-help').textContent, /one race/i);
    await action(p, 'race-start');
    completeRound(p, outcome);
    assert.equal(p.$('series-score').textContent, outcome === 'win' ? '1 : 0' : '0 : 0');
    assert.equal(p.$('race-title').textContent, 'Race complete.');
    assert.equal(p.$('race-start').textContent, 'Rematch: First Signal');
    if (outcome === 'draw') assert.match(p.$('race-message').textContent, /^Draw\b/);
    const before = completedResult(p);
    p.frames(12, 200);
    retainedResult(p, before);
    await action(p, 'race-review');
    assert.equal(p.$('race-boards').hidden, false);
    p.frames(12, 200);
    retainedResult(p, before);
    await action(p, 'race-pause');
    assert.equal(p.$('race-main').hidden, false);
    retainedResult(p, before);
    const copy = acceptedFormatCopy(p);
    assert.ok(p.$('race-format').closest('[hidden],[inert]'));
    p.$('race-format').value = 'first-to-two';
    p.frames(12, 200);
    assert.deepEqual(
      acceptedFormatCopy(p),
      copy,
      'Results, summary, help and footnote describe the accepted recipe, not a hidden draft.',
    );
    retainedResult(p, before);

    if (outcome === 'win') {
      f.media.fail();
      await action(p, 'race-start');
      retainedResult(p, before);
      assert.equal(
        p.$('race-message').textContent,
        'The rematch picture could not be prepared. Results are kept. Choose Rematch to retry.',
      );
      const entered = deferred(),
        gate = deferred();
      t.after(() => gate.resolve());
      f.media.setDecodeHook(async () => {
        entered.resolve();
        await gate.promise;
      });
      p.$('race-start').focus();
      const pending = action(p, 'race-start');
      await entered.promise;
      retainedResult(p, before);
      await action(p, 'race-picture-cancel');
      gate.resolve();
      await pending;
      retainedResult(p, before);
      assert.equal(p.$('race-start').textContent, 'Rematch: First Signal');
      f.media.setDecodeHook(null);
      await action(p, 'race-start');
      assert.equal(p.state(), 'running');
      assert.equal(p.$('series-score').textContent, '0 : 0');
      assert.equal(before.picture.image.releaseCount, 1);
      completeRound(p, 'win');
      assert.equal(p.$('series-score').textContent, '1 : 0');
      assert.equal(p.$('race-title').textContent, 'Race complete.');
      assert.equal(p.$('race-start').textContent, 'Rematch: First Signal');
      assert.match(p.$('race-format-note').textContent, /one race/i);
      assert.match(p.$('race-format-help').textContent, /one race/i);
    }
    assert.deepEqual(f.memory.allPuts, []);
  });

for (const initialFocus of ['BODY', 'race-help'])
  test(`a direct Rematch click from ${initialFocus} focus owns preparation without an extra Start`, async (t) => {
    const f = await fixture(t),
      p = f.page,
      entered = deferred(),
      gate = deferred();
    t.after(() => gate.resolve());
    await action(p, 'race-start');
    completeRound(p, 'win');
    const before = completedResult(p);
    f.media.setDecodeHook(async () => {
      entered.resolve();
      await gate.promise;
    });
    if (initialFocus === 'BODY') p.doc.body.focus();
    else p.$(initialFocus).focus();
    assert.notEqual(p.doc.activeElement, p.$('race-start'));
    // Dispatch the actual click without the browser choosing button focus.
    // This is a finite host boundary, not proof of physical touch behavior.
    const pending = action(p, 'race-start');
    await entered.promise;
    retainedResult(p, before);
    assert.equal(p.doc.activeElement, p.$('race-picture-cancel'));
    gate.resolve();
    await pending;
    assert.equal(p.state(), 'running');
    assert.equal(p.$('series-score').textContent, '0 : 0');
    assert.equal(p.drawOptions[0].backdrop === p.drawOptions[1].backdrop, true);
    assert.equal(before.picture.image.releaseCount, 1);
    assert.deepEqual(f.memory.allPuts, []);
  });

test('controller format draft can cancel or commit while preserving selector focus and never starting a round', async (t) => {
  const controller = {
    index: 0,
    id: 'Format test controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
  };
  const f = await fixture(t, { pads: [controller] }),
    p = f.page;
  p.join(0);
  p.focus('race-focus');
  p.pulse(0, 0);
  assert.equal(p.$('race-setup').hidden, false);
  p.focus('race-format');
  const reads = f.reads.length;
  assert.equal(p.$('race-format').value, 'single');
  p.pulse(0, 0);
  assert.equal(p.editors().length, 1);
  p.pulse(0, 13);
  assert.equal(p.$('race-format').value, 'single', 'A draft is not an accepted setup change.');
  p.pulse(0, 1);
  assert.equal(p.editors().length, 0);
  assert.equal(p.$('race-format').value, 'single');
  assert.equal(p.doc.activeElement, p.$('race-format'));
  assert.equal(f.reads.length, reads, 'Cancelling the draft cannot acquire a new original.');
  p.pulse(0, 0);
  p.pulse(0, 13);
  p.pulse(0, 0);
  await waitFor(() => !p.$('race-start').disabled, {
    message: 'The explicitly committed format did not finish preparing.',
  });
  p.frame();
  assert.equal(p.$('race-format').value, 'first-to-two');
  assert.equal(p.editors().length, 0);
  assert.equal(p.state(), 'ready');
  assert.equal(p.tick(), 0);
  assert.equal(p.doc.activeElement, p.$('race-format'));
  assert.match(p.$('race-format-note').textContent, /first to two/i);
  assert.match(p.$('race-format-help').textContent, /first to two/i);
  p.pulse(0, 1);
  assert.equal(p.$('race-main').hidden, false);
  assert.equal(p.state(), 'ready');
  assert.deepEqual(f.memory.allPuts, []);
});

test('pending Next respects a newer deliberate action focus when its picture completes', async (t) => {
  const f = await fixture(t),
    p = f.page,
    entered = deferred(),
    gate = deferred();
  await action(p, 'race-start');
  p.frames(151, 200);
  f.media.setDecodeHook(async () => {
    entered.resolve();
    await gate.promise;
  });
  p.$('race-start').focus();
  const next = action(p, 'race-start');
  await entered.promise;
  p.$('race-help').focus();
  gate.resolve();
  await next;
  assert.equal(
    p.state(),
    'ready',
    'A newer action choice requires a fresh Start after preparation.',
  );
  assert.equal(p.doc.activeElement === p.$('race-help'), true);
  assert.equal(p.$('race-start').disabled, false);
  assert.deepEqual(f.memory.allPuts, []);
});

test('Next restoration cannot revive its intent after a queued newer focus choice returns to BODY', async (t) => {
  const f = await fixture(t),
    p = f.page,
    entered = deferred(),
    gate = deferred();
  await action(p, 'race-start');
  p.frames(151, 200);
  f.media.setDecodeHook(async () => {
    entered.resolve();
    await gate.promise;
  });
  p.$('race-start').focus();
  const next = action(p, 'race-start');
  await entered.promise;
  let moved = false;
  const observe = (event) => {
    if (event.target !== p.$('race-start')) return;
    queueMicrotask(() => {
      p.$('race-help').focus();
      p.doc.body.focus();
      moved = true;
    });
  };
  p.doc.addEventListener('focusin', observe);
  gate.resolve();
  await next;
  p.doc.removeEventListener('focusin', observe);
  assert.equal(moved, true, 'The queued callback follows the real restored Start focus.');
  assert.equal(p.state(), 'ready');
  assert.equal(p.doc.activeElement === p.doc.body, true);
  assert.equal(p.$('race-start').disabled, false);
  assert.deepEqual(f.memory.allPuts, []);
});

test('confirmed new setup owns a fresh race after a cancelled Next decoder settles late', async (t) => {
  const f = await fixture(t),
    p = f.page,
    entered = deferred(),
    gate = deferred();
  await action(p, 'race-start');
  p.frames(151, 200);
  const completed = completedResult(p);
  f.media.setDecodeHook(async () => {
    entered.resolve();
    await gate.promise;
  });
  p.$('race-start').focus();
  const next = action(p, 'race-start');
  await entered.promise;
  await action(p, 'race-focus');
  retainedResult(p, completed);
  f.media.setDecodeHook(null);
  await action(p, 'race-confirm-reset');
  await waitFor(() => !p.$('race-start').disabled, {
    message: 'The explicitly confirmed new setup never became ready.',
  });
  p.frame(0);
  const freshRuns = [...p.renders],
    freshCheckpoint = p.checkpoint(),
    freshPicture = p.drawOptions[0].backdrop;
  assert.equal(p.state(), 'ready');
  assert.equal(
    p.renders.every((run, i) => run !== completed.runs[i]),
    true,
  );
  assert.equal(p.doc.body.dataset.couchScreen, 'setup');
  gate.resolve();
  await next;
  p.frames(12);
  assert.equal(
    p.renders.every((run, i) => run === freshRuns[i]),
    true,
  );
  assert.deepEqual(p.checkpoint(), freshCheckpoint);
  assert.equal(
    p.drawOptions.every((options) => options.backdrop === freshPicture),
    true,
  );
  assert.equal(p.state(), 'ready');
  assert.equal(p.doc.body.dataset.couchScreen, 'setup');
  assert.deepEqual(f.memory.allPuts, []);
});

for (const outcome of ['cancel', 'decode refusal'])
  test(`muted music and completed Results survive Next ${outcome}, Help reading and a fresh retry`, async (t) => {
    // A non-authored fallback makes any second transport owner observable;
    // choosing the authored track by chance would hide a queued-track mutation.
    t.mock.method(Math, 'random', () => 0);
    const a = audioHarness(),
      saved = new Map([[AUDIO_PREFERENCES_KEY, JSON.stringify({ muted: false, volume: 0.4 })]]),
      writes = [],
      originalEnable = Soundscape.prototype.enable,
      diagnostics = [];
    let sound = null,
      enables = 0,
      mediaElements = 0;
    // Observe the real host-owned sound producer; do not replace its methods or
    // issue test-only transport commands. Audio time/output is a finite boundary.
    t.mock.method(Soundscape.prototype, 'enable', function (...args) {
      sound = this;
      enables++;
      return originalEnable.apply(this, args);
    });
    t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
    const f = await fixture(t, {
        audio: {
          ...a,
          createElement(doc) {
            // The persistent player and library audition are distinct DOM media
            // elements. Preserve the primary harness's observable transport.
            const media = mediaElements++ === 0 ? a.media : audioHarness().media;
            const element = new Element(doc, 'audio');
            for (const [key, value] of Object.entries(element))
              if (!Object.hasOwn(media, key)) media[key] = value;
            Object.setPrototypeOf(media, Object.getPrototypeOf(element));
            return media;
          },
          Context: class {
            constructor() {
              return a.context;
            }
          },
        },
        storage: {
          getItem: (name) => saved.get(name) ?? null,
          setItem: (name, value) => {
            writes.push([name, value]);
            saved.set(name, value);
          },
        },
      }),
      p = f.page;
    const key = (value) => {
      const target = p.doc.activeElement,
        event = target.emit('keydown', { key: value, code: value, repeat: false });
      // Only the browser's unprevented native button activation is modeled.
      if (
        !event.defaultPrevented &&
        value === 'Enter' &&
        target.tagName === 'BUTTON' &&
        !target.disabled &&
        target.isConnected &&
        p.doc.activeElement === target &&
        !target.closest('[hidden],[inert]')
      )
        target.click();
      target.emit('keyup', { key: value, code: value });
      return event;
    };
    const enter = (id) => {
      p.$(id).focus();
      key('Enter');
      p.frame();
    };
    await action(p, 'race-start');
    await settleUntil(() => sound?.enabled && !sound.musicTransportPaused);
    assert.notEqual(
      sound.musicState().track.id,
      'signal-afterglow',
      'The selected fallback must differ from the map-authored track.',
    );
    p.frames(151, 200);
    const result = completedResult(p);
    assert.equal(p.state(), 'finished');
    enter('race-options');
    enter('race-settings-tab-audio');
    assert.equal(p.$('race-settings-panel-audio').hidden, false);
    assert.equal(p.$('race-audio').closest('[hidden],[inert]'), null);
    enter('race-audio');
    assert.deepEqual(JSON.parse(saved.get(AUDIO_PREFERENCES_KEY)), { muted: true, volume: 0.4 });
    enter('race-options-back');
    const audioBefore = {
      music: sound.musicState(),
      cursor: sound.cursor,
      enables,
      media: { src: a.media.src, time: a.media.currentTime, plays: a.media.plays },
      preferences: saved.get(AUDIO_PREFERENCES_KEY),
      writes: [...writes],
    };
    function expectRetainedAudio() {
      assert.equal(sound.master.gain.value, 0);
      assert.equal(a.media.muted, true);
      assert.equal(sound.musicTransportPaused, false);
      assert.deepEqual(sound.musicState(), audioBefore.music);
      assert.equal(sound.cursor, audioBefore.cursor);
      assert.equal(enables, audioBefore.enables);
      assert.deepEqual(
        { src: a.media.src, time: a.media.currentTime, plays: a.media.plays },
        audioBefore.media,
      );
      assert.equal(saved.get(AUDIO_PREFERENCES_KEY), audioBefore.preferences);
      assert.deepEqual(writes, audioBefore.writes);
      assert.equal(p.$('race-audio').textContent, 'Unmute sound');
      assert.equal(p.$('race-audio').getAttribute('aria-pressed'), null);
    }
    const entered = deferred(),
      gate = deferred();
    t.after(() => gate.resolve());
    f.media.setDecodeHook(async () => {
      entered.resolve();
      await gate.promise;
    });
    p.$('race-start').focus();
    const next = action(p, 'race-start');
    await entered.promise;
    p.frame();
    retainedResult(p, result);
    expectRetainedAudio();
    const failure = new Error('Owned test image decode refused.');
    if (outcome === 'cancel') {
      enter('race-picture-cancel');
      assert.equal(p.doc.activeElement, p.$('race-start'));
    } else {
      gate.reject(failure);
      await next;
      assert.match(p.$('race-message').textContent, /Results are kept/);
      assert.deepEqual(diagnostics, [['Next picture preparation failed.', failure]]);
    }
    retainedResult(p, result);
    enter('race-help');
    const region = p.$('race-help-reading');
    region.clientHeight = 100;
    region.scrollHeight = 600;
    enter('race-help-read');
    assert.equal(p.doc.activeElement, region);
    assert.equal(key('ArrowDown').defaultPrevented, true);
    assert.ok(region.scrollTop > 0);
    assert.equal(key('Escape').defaultPrevented, true);
    assert.equal(p.doc.activeElement, p.$('race-help-read'));
    assert.equal(p.$('race-help-reading-done').disabled, true);
    enter('race-help-back');
    if (outcome === 'cancel') {
      gate.resolve();
      await next;
      assert.deepEqual(diagnostics, []);
    }
    p.frames(20);
    retainedResult(p, result);
    expectRetainedAudio();
    assert.equal(p.$('race-start').disabled, false);
    assert.equal(p.$('race-start').hidden, false);
    assert.equal(f.media.images.at(-1).releaseCount, 1);

    const retryEntered = deferred(),
      retryGate = deferred();
    t.after(() => retryGate.resolve());
    f.media.setDecodeHook(async () => {
      retryEntered.resolve();
      await retryGate.promise;
    });
    p.$('race-start').focus();
    const retry = action(p, 'race-start');
    await retryEntered.promise;
    // Deliberately choosing another visible action removes automatic Start
    // permission; successful preparation must expose a fresh Ready action.
    p.$('race-help').focus();
    retryGate.resolve();
    await retry;
    p.frames(20);
    assert.equal(p.state(), 'ready');
    assert.equal(p.doc.activeElement, p.$('race-help'));
    assert.equal(p.$('race-start').disabled, false);
    assert.equal(
      p.renders.every((run, i) => run !== result.runs[i]),
      true,
    );
    assert.equal(result.picture.image.releaseCount, 1);
    expectRetainedAudio();
    assert.deepEqual(f.memory.allPuts, []);
  });
