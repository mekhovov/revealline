import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareCouchChapter } from '../couch/couch-chapter.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { couchPage } from './helpers/couch-host.mjs';

const pack = JSON.parse(
  await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url), 'utf8'),
);
const originalFor = (id) =>
  pack.levelVisuals.find((v) => v.levelId === id).visualOverrides.background;
const change = (f, value) => {
  f.$('race-level').value = value;
  f.$('race-level').emit('change');
  f.frame();
};
function images({ failAt = -1, wrongSizeAt = -1, holdAt = -1 } = {}) {
  const seen = [];
  class Image {
    constructor() {
      this.index = seen.length;
      seen.push(this);
    }
    set src(source) {
      this.source = source;
      const bytes = Buffer.from(source.split(',')[1], 'base64');
      this.width = this.naturalWidth = bytes.readUInt32BE(16) + Number(this.index === wrongSizeAt);
      this.height = this.naturalHeight = bytes.readUInt32BE(20);
      queueMicrotask(() => this.onload?.());
    }
    async decode() {
      if (this.index === failAt) throw new Error('Modelled complete decode failure.');
      if (this.index === holdAt)
        await new Promise((resolve) => {
          this.finishDecode = resolve;
        });
      this.decoded = true;
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.released = (this.released || 0) + 1;
    }
  }
  return { Image, seen };
}

test('fresh couch uses exact wide Pressure Lines originals, authored Arcade controls and independent continuations', async (t) => {
  const f = await couchPage(t, { initialLevel: null, coarse: true });
  assert.equal(f.renders[0].level.id, 'orchard-crossing');
  const approvedLevel = applyGameplayTuning(
    pack.campaigns[0].levels[0],
    resolveGameplayTuning('standard'),
  );
  for (const run of f.renders)
    assert.deepEqual(
      run.level,
      approvedLevel,
      'Both boards use the exact authored map with its approved current Standard adaptation.',
    );
  assert.equal(f.renders[0].ruleset, 'xonix-core.v5');
  assert.equal(f.$('race-canvas-0').width, 1152);
  assert.equal(f.$('race-canvas-0').height, 576);
  assert.equal(f.$('race-canvas-1').width, 1152);
  assert.equal(f.$('race-canvas-1').height, 576);
  assert.match(f.$('race-summary').textContent, /Pressure Lines.*Orchard Crossing.*Arcade/);
  assert.equal(f.$('race-class-field').hidden, true);
  assert.equal(f.$('race-tap-field').hidden, true);
  assert.match(f.$('race-loadout').textContent, /Directions only/);
  assert.doesNotMatch(f.$('race-controller-help').textContent, /Scan|Boost|supply/);
  const backdrop = f.drawOptions[0].backdrop;
  assert.equal(f.drawOptions[1].backdrop, backdrop);
  assert.equal(backdrop.image.source, originalFor('orchard-crossing').dataUrl);
  assert.equal(backdrop.fit, 'contain');
  assert.equal(f.images.length, 3, 'one page decodes the three originals once, not once per board');
  assert.notEqual(f.renders[0], f.renders[1]);
  assert.notEqual(f.renders[0].cells, f.renders[1].cells);
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.key('ArrowLeft');
  f.frames(8);
  f.key('KeyD', false);
  f.key('ArrowLeft', false);
  assert.ok(f.renders[0].player.x > f.renders[0].level.spawn.x);
  assert.ok(f.renders[1].player.x < f.renders[1].level.spawn.x);
  f.$('race-pause').click();
  f.frame();
  const held = f.checkpoint();
  f.$('race-options').click();
  f.frames(4, 100);
  f.$('race-options-back').click();
  assert.deepEqual(f.checkpoint(), held);
  assert.equal(f.drawOptions[0].backdrop, backdrop);
  f.$('race-start').click();
  f.frame();
  const x = f.renders.map((run) => run.player.x);
  f.frames(4);
  assert.ok(f.renders[0].player.x > x[0]);
  assert.ok(f.renders[1].player.x < x[1]);
  assert.equal(f.drawOptions[1].backdrop, backdrop);
});

test('an offline optional featured download leaves base Couch maps playable and solo storage untouched', async (t) => {
  let attempts = 0;
  const f = await couchPage(t, {
    initialLevel: null,
    storage: {
      getItem: () => null,
      setItem() {
        assert.fail('Couch must not write solo state.');
      },
    },
    fetchResponse(path) {
      if (path === '../content/packs/fpv-arcade-r5.json') {
        attempts++;
        throw new TypeError('Offline optional download');
      }
    },
  });
  assert.equal(attempts, 1);
  assert.equal(f.renders[0].level.id, 'signal-01');
  assert.equal(f.$('race-start').disabled, false);
  assert.match(f.$('race-message').textContent, /Featured Pressure Lines.*unavailable/);
  assert.match(f.$('race-installed-status').textContent, /Featured Pressure Lines.*unavailable/);
  assert.ok(f.$('race-level').options.every((option) => !option.value.startsWith('shipped/')));
  assert.equal(f.drawOptions[0].backdrop.image, null);
  assert.equal(f.drawOptions[0].backdrop.choice.kind, 'authored');
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.frames(8);
  f.key('KeyD', false);
  assert.ok(f.renders[0].player.x > f.renders[0].level.spawn.x);
  assert.equal(f.renders[1].player.x, f.renders[1].level.spawn.x);
  f.$('race-pause').click();
  f.frame();
  const held = f.checkpoint();
  f.frames(4, 100);
  assert.deepEqual(f.checkpoint(), held);
});

test('all three exact map pictures change together; explicit Tactical legacy choice clears the original binding', async (t) => {
  const f = await couchPage(t, { initialLevel: null });
  for (const level of pack.campaigns[0].levels) {
    change(f, `shipped/fpv-arcade-r5/fpv-pressure-lines/${level.id}`);
    const binding = f.drawOptions[0].backdrop;
    assert.equal(binding.image.source, originalFor(level.id).dataUrl);
    assert.equal(f.drawOptions[1].backdrop, binding);
    assert.equal(f.renders[0].level.id, level.id);
    assert.equal(f.renders[0].tick, 0);
  }
  const firstSignal = f.$('race-level').options.find((option) => option.value === 'signal-01');
  assert.match(firstSignal.textContent, /First Signal.*Tactical/);
  change(f, firstSignal.value);
  assert.equal(f.renders[0].level.id, 'signal-01');
  assert.equal(f.renders[0].ruleset, 'xonix-core.v2');
  assert.equal(f.$('race-canvas-0').width, 768);
  assert.equal(f.$('race-class-field').hidden, false);
  assert.match(f.$('race-controller-help').textContent, /Scan.*Boost/);
  assert.equal(f.drawOptions[0].backdrop, null);
  assert.equal(f.drawOptions[1].backdrop, null);
  assert.equal(f.images.length, 3);
  f.win.emit('pagehide', { persisted: true });
  assert.ok(
    f.images.every((image) => !image.released),
    'bfcache pause retains owned originals',
  );
  f.win.emit('pagehide', { persisted: false });
  assert.ok(f.images.every((image) => image.released === 1));
  f.win.emit('pagehide', { persisted: false });
  assert.ok(f.images.every((image) => image.released === 1));
});

test('wrong decoded dimensions and complete decode failure release every allocated original', async () => {
  for (const options of [{ wrongSizeAt: 1 }, { failAt: 1 }]) {
    const { Image, seen } = images(options);
    await assert.rejects(
      prepareCouchChapter(pack, { ImageClass: Image }),
      /dimensions|decode failure/,
    );
    assert.equal(seen.length, 2);
    assert.ok(seen.every((image) => image.released === 1));
  }
});

test('shipped artwork requires explicit contain fit and an original for each exact known level', async () => {
  for (const [mutate, message] of [
    [
      (copy) => {
        delete copy.levelVisuals[0].visualOverrides.background.fit;
      },
      /authored contain fit/,
    ],
    [
      (copy) => {
        copy.levelVisuals[0].levelId = 'another-level';
      },
      /unknown or repeated level/,
    ],
    [
      (copy) => {
        copy.levelVisuals.splice(0, 1);
      },
      /original picture.*unavailable/,
    ],
  ]) {
    const copy = structuredClone(pack),
      { Image, seen } = images();
    mutate(copy);
    await assert.rejects(prepareCouchChapter(copy, { ImageClass: Image }), message);
    assert.ok(seen.every((image) => image.released === 1));
  }
});

test('cancellation during complete decode rejects promptly, disposes earlier images and ignores a late result', async () => {
  const { Image, seen } = images({ holdAt: 1 });
  const controller = new AbortController();
  const pending = prepareCouchChapter(pack, { ImageClass: Image, signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  for (let i = 0; i < 30 && !seen[1]?.finishDecode; i++) await new Promise(setImmediate);
  assert.equal(typeof seen[1]?.finishDecode, 'function');
  controller.abort();
  await rejected;
  assert.ok(seen.every((image) => image.released === 1));
  seen[1].finishDecode();
  await new Promise(setImmediate);
  assert.equal(seen.length, 2);
  assert.ok(seen.every((image) => image.released === 1));
});

test('failed original preparation leaves the real lobby Start disabled with its explicit error', async (t) => {
  const { Image, seen } = images({ failAt: 1 });
  const f = await couchPage(t, { ImageClass: Image, initialLevel: null, expectBootFailure: true });
  assert.equal(f.$('race-start').disabled, true);
  assert.match(f.$('race-message').textContent, /race could not load.*complete decode failure/);
  assert.equal(f.renders.length, 0);
  assert.ok(seen.every((image) => image.released === 1));
});

test('terminal pagehide during installed authority opening cannot publish released pictures or start a race', async (t) => {
  let transactions = 0;
  const db = {
    close() {},
    transaction() {
      transactions++;
      throw new Error('No reads or writes after terminal hide.');
    },
  };
  const assetDatabase = {
    open(name, version) {
      assert.equal(name, 'revealline-assets-v1');
      assert.equal(version, 1);
      const request = { result: db };
      queueMicrotask(() => {
        globalThis.window.emit('pagehide', { persisted: false });
        request.onsuccess();
      });
      return request;
    },
  };
  const f = await couchPage(t, {
    assetDatabase,
    initialLevel: null,
    expectBootFailure: true,
    storage: { getItem: () => null },
    lockManager: { request: async (_key, _options, action) => action({}) },
  });
  assert.equal(transactions, 0);
  assert.equal(f.$('race-start').disabled, true);
  assert.equal(f.renders.length, 0);
  assert.ok(f.images.every((image) => image.released === 1));
});
