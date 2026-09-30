import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { FIXED_DT, stepRun } from '../core/index.mjs';
import { classicView } from '../ui/classic-view.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const pack = read('../content/packs/classic-lab.json');
const originalBytes = JSON.stringify(pack);
const saveSlot = 'revealline.suspended.dev.v1';
const enemy = (run) => run.enemies.find(({ id }) => id === 'field-seed');

// Real Solo entry, preparation, replay/save and BoardPainter. Only browser DOM,
// Phaser, Canvas2D and PNG decoding are modeled by the established host boundary.
function rendering() {
  const contexts = new WeakMap();
  let frame;
  return {
    displayCSSWidth: 600,
    contextFor(canvas) {
      if (contexts.has(canvas)) return contexts.get(canvas);
      const calls = [],
        stack = [];
      let values = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
      const context = new Proxy(
        { canvas, calls },
        {
          get(target, key) {
            if (key in target) return target[key];
            if (key in values) return values[key];
            return (...args) => {
              if (key === 'clearRect') calls.length = 0;
              calls.push({ op: key, args, ...values });
              if (key === 'save') stack.push({ ...values });
              if (key === 'restore') values = stack.pop();
              if (key === 'measureText') return { width: String(args[0]).length * 8 };
            };
          },
          set(_target, key, value) {
            values[key] = value;
            return true;
          },
        },
      );
      contexts.set(canvas, context);
      return context;
    },
    onDraw(value) {
      frame = value;
    },
    get frame() {
      return frame;
    },
  };
}

function bodyPaint(surface) {
  const { painter, context } = surface.frame,
    sprite = painter.presentation.image('enemy.bouncer'),
    calls = context.calls,
    index = calls.findIndex(({ op, args }) => op === 'drawImage' && args[0] === sprite.image);
  assert(index >= 0, 'The real prepared bouncer image must be painted.');
  assert.match(sprite.asset.file.sha256, /^[0-9a-f]{64}$/);
  const prior = calls.slice(0, index),
    marks = calls
      .slice(index + 1)
      .filter(({ op, globalAlpha }) => op === 'fillRect' && globalAlpha === 0.55);
  assert.equal(marks.length, 2, 'Both admitted bouncer travel accents must be painted.');
  return {
    imageHash: sprite.asset.file.sha256,
    image: calls[index].args.slice(1),
    rotate: prior.findLast(({ op }) => op === 'rotate').args,
    scale: prior.findLast(({ op }) => op === 'scale').args,
    marks: marks.map(({ args, fillStyle, globalAlpha }) => ({ args, fillStyle, globalAlpha })),
  };
}

async function pageWithArt(t, storage, surface, assetIndexedDB, titleScreen = true) {
  const page = await soloPage(t, {
    storage,
    titleScreen,
    assetIndexedDB,
    rendering: surface,
    // The ordinary harness supplies JSON objects; the real bounded enemy reader
    // needs a Response, retaining its original bytes/schema/hash validation.
    fetchResponse: (url) =>
      String(url).endsWith('/content/enemy-presentations.json')
        ? new Response(
            readFileSync(new URL('../content/enemy-presentations.json', import.meta.url)),
          )
        : undefined,
  });
  await settle(() => surface.frame?.painter.presentation?.image('enemy.bouncer'));
  return page;
}

test(
  'Solo save/Continue during an actual freeze retains prepared actor hold through exact expiry',
  { timeout: 120000 },
  async (t) => {
    const storage = memoryStorage(),
      assetIndexedDB = managedIndexedDB().indexedDB;
    let savedBytes, savedCheckpoint, savedImageHash;
    await t.test(
      'collect the authored pickup with real steering and suspend the active effect',
      async (t) => {
        const surface = rendering(),
          page = await pageWithArt(t, storage, surface, assetIndexedDB, false);
        page.$('library-button').click();
        page.doc.querySelector('[data-library-panel="packs"]').click();
        page.$('pack-json').value = originalBytes;
        page.$('install-pack').click();
        await settle(
          () => !page.$('install-pack').disabled,
          'The original Classic Lab pack must install.',
        );
        assert.match(page.$('pack-status').textContent, /Validated and installed/);
        const play = page
          .$('installed-packs')
          .querySelectorAll('button')
          .find((button) => button.textContent === `Play ${pack.campaigns[0].title}`);
        assert(play);
        await play.onclick();
        await settle(
          () =>
            page.$('pack-select').value === pack.id &&
            page.doc.body.dataset.pictureState === 'ready',
        );
        page.frame(0);
        page.$('start-button').click();
        await settle(() => page.doc.body.dataset.flightState === 'running');
        page.key('ArrowDown');
        page.key('ArrowDown', false);
        for (
          let count = 0;
          count < 700 && !classicView(page.rendered.run).enemies[0].frozen;
          count++
        )
          page.frame();
        const run = page.rendered.run,
          effect = run.classic.effects['enemy-freeze'];
        assert.equal(run.levelId, 'four-pickups');
        assert.equal(run.status, 'running');
        assert(run.tick >= effect.from && run.tick < effect.until);
        assert(run.classic.powerups.find(({ kind }) => kind === 'enemy-freeze').collectedTick > 0);
        assert(classicView(run).enemies[0].frozen);
        await settle(() =>
          surface.frame.painter.enemyBodies.record({ type: 'bouncer', themeId: 'fpv' }),
        );
        page.frame(0);
        savedImageHash = bodyPaint(surface).imageHash;
        savedCheckpoint = authoritativeCheckpoint(run);
        page.$('pause-button').click();
        page.frame(100);
        assert.deepEqual(authoritativeCheckpoint(run), savedCheckpoint);
        savedBytes = storage.getItem(saveSlot);
        const saved = JSON.parse(savedBytes),
          verified = verifyReplay(saved.replay);
        assert.equal(verified.match, true);
        assert.deepEqual(verified.actual.checkpoint, savedCheckpoint);
        assert.equal(saved.continuation.direction, 'down');
        assert.deepEqual(page.errors, []);
      },
    );
    assert(savedBytes, 'The first actual page must persist an unfinished flight.');
    const { savedAt: pausedAt, ...pausedSave } = JSON.parse(savedBytes),
      { savedAt: departedAt, ...departedSave } = JSON.parse(storage.getItem(saveSlot));
    assert(pausedAt && departedAt);
    // The actual pagehide handler saves once more with a new timestamp only.
    assert.deepEqual(departedSave, pausedSave);
    savedBytes = storage.getItem(saveSlot);

    await t.test(
      'fresh-page Continue holds its prepared pose, then resumes only at authoritative expiry',
      async (t) => {
        const surface = rendering(),
          page = await pageWithArt(t, storage, surface, assetIndexedDB),
          saved = JSON.parse(savedBytes),
          reference = verifyReplay(saved.replay).state;
        assert.equal(page.$('shell-continue').hidden, false);
        assert.equal(page.$('shell-continue').disabled, false);
        page.$('shell-continue').click();
        try {
          await settle(() => {
            page.frame(0);
            return page.rendered.run.tick === reference.tick && !page.rendered.paused;
          }, 'The explicit Home Continue action must adopt and resume the saved attempt.');
        } catch (error) {
          error.message += JSON.stringify({
            tick: page.rendered.run.tick,
            expected: reference.tick,
            paused: page.rendered.paused,
            home: page.$('shell-home').open,
            pack: page.$('pack-select').value,
            packStatus: page.$('pack-status').textContent,
            message: page.$('run-message').textContent,
            preparation: page.$('shell-flight-status').textContent,
            flight: page.doc.body.dataset.flightState,
            errors: page.errors.map(String),
          });
          throw error;
        }
        const run = page.rendered.run,
          effect = run.classic.effects['enemy-freeze'];
        assert.deepEqual(authoritativeCheckpoint(run), savedCheckpoint);
        assert.equal(storage.getItem(saveSlot), savedBytes);
        page.$('pause-button').click();
        await settle(() =>
          surface.frame.painter.enemyBodies.record({ type: 'bouncer', themeId: 'fpv' }),
        );
        page.frame(0);
        const held = bodyPaint(surface),
          location = [enemy(run).x, enemy(run).y],
          frozenActorTime = classicView(run).actorTime;
        assert.equal(held.imageHash, savedImageHash);
        for (const ms of [0, 16, 100, 1000]) {
          page.frame(ms);
          assert.deepEqual(bodyPaint(surface), held);
          assert.deepEqual(authoritativeCheckpoint(run), savedCheckpoint);
        }
        page.$('start-button').click();
        await settle(() => page.doc.body.dataset.flightState === 'running');
        // The cosmetic phase may reset when a page is recreated; it is not saved
        // simulation. Its newly prepared frozen pose must remain held while active.
        while (run.tick < effect.until - 1) {
          const beforeTick = run.tick;
          page.frame();
          assert.equal(run.tick, beforeTick + 1);
          stepRun(reference, { direction: saved.continuation.direction }, FIXED_DT);
          assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
          assert(classicView(run).enemies[0].frozen);
          assert.equal(classicView(run).actorTime, frozenActorTime);
          assert.deepEqual([enemy(run).x, enemy(run).y], location);
          assert.deepEqual(bodyPaint(surface), held);
        }
        const finalFrozenTick = run.tick;
        page.frame();
        stepRun(reference, { direction: saved.continuation.direction }, FIXED_DT);
        assert.equal(run.tick, effect.until);
        assert.equal(finalFrozenTick, effect.until - 1);
        assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
        assert.equal(classicView(run).enemies[0].frozen, false);
        assert.equal(classicView(run).enemies[0].slowed, true);
        const expiryPaint = bodyPaint(surface);
        assert.equal(expiryPaint.imageHash, held.imageHash);
        assert.notDeepEqual(expiryPaint.marks, held.marks);
        for (let count = 0; count < 4; count++) {
          page.frame();
          stepRun(reference, { direction: saved.continuation.direction }, FIXED_DT);
        }
        assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
        assert.notDeepEqual([enemy(run).x, enemy(run).y], location);
        assert.notDeepEqual(bodyPaint(surface).marks, expiryPaint.marks);
        assert.equal(bodyPaint(surface).imageHash, held.imageHash);
        assert.equal(run.status, 'running');
        assert.deepEqual(page.errors, []);
      },
    );
    assert.equal(JSON.stringify(pack), originalBytes, 'The authored pack stays unchanged.');
  },
);
