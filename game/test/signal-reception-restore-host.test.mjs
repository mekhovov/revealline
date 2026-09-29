import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'signal-reception-restore',
  revision: '1',
  title: 'Signal reception restore',
  classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
  levels: [retryFixture('self-contact').level],
};
const slot = 'revealline.suspended.dev.v1';

// The actual host, replay restore, core and BoardPainter execute. Only browser
// canvas commands are modeled; no run status or saved checkpoint is fabricated.
function rendering() {
  const surfaces = new Map();
  let frame;
  return {
    contextFor(canvas) {
      if (surfaces.has(canvas)) return surfaces.get(canvas).context;
      const calls = [],
        stack = [],
        surface = { writes: 0 };
      let values = { globalAlpha: 1, globalCompositeOperation: 'source-over' };
      const context = new Proxy(
        { canvas, calls },
        {
          get(target, key) {
            if (key in target) return target[key];
            if (key in values) return values[key];
            if (key === 'createImageData')
              return (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) });
            if (key === 'getImageData')
              return (_x, _y, width, height) => ({
                data: new Uint8ClampedArray(width * height * 4),
              });
            if (key === 'putImageData') return () => surface.writes++;
            if (key === 'measureText') return (text) => ({ width: String(text).length * 7 });
            return (...args) => {
              if (key === 'clearRect') calls.length = 0;
              calls.push({ key, args, ...values });
              if (key === 'save') stack.push({ ...values });
              if (key === 'restore') values = stack.pop();
            };
          },
          set(_, key, value) {
            values[key] = value;
            return true;
          },
        },
      );
      surfaces.set(canvas, {
        ...surface,
        context,
        get writes() {
          return surface.writes;
        },
      });
      return context;
    },
    onDraw(value) {
      frame = value;
    },
    noiseDraws() {
      return frame.context.calls.filter(
        ({ key, args }) => key === 'drawImage' && surfaces.get(args[0])?.writes > 0,
      );
    },
  };
}

for (const savedTick of [1, 30])
  test(`Solo restore at tick ${savedTick} skips acquisition before and after Resume but retains terminal loss`, async (t) => {
    const surface = rendering(),
      page = await soloPage(t, { campaign, rendering: surface });
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let tick = 0; tick < savedTick; tick++) page.frame();
    assert.equal(page.rendered.run.tick, savedTick);
    assert.ok(surface.noiseDraws().length > 0, 'The original Start really acquires its signal.');
    page.$('pause-button').click();
    page.frame(0);
    const original = page.rendered.run,
      checkpoint = authoritativeCheckpoint(original),
      saved = JSON.parse(page.storage.getItem(slot));
    assert.equal(saved.replay.ticks, savedTick);
    assert.equal(verifyReplay(saved.replay).match, true);
    assert.deepEqual(saved.replay.checkpoint, checkpoint);

    page.$('continue-saved').click();
    await settle(() => {
      page.frame(0);
      return page.rendered.run !== original && !page.$('continue-saved').disabled;
    });
    const restored = page.rendered.run;
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.equal(restored.status, 'running');
    assert.deepEqual(authoritativeCheckpoint(restored), checkpoint);
    for (let frame = 0; frame < 3; frame++) {
      page.frame(100);
      assert.equal(page.rendered.signalReception, 'off');
      assert.deepEqual(surface.noiseDraws(), []);
      assert.deepEqual(authoritativeCheckpoint(restored), checkpoint);
    }

    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    assert.equal(page.rendered.signalReception, 'off');
    assert.deepEqual(surface.noiseDraws(), []);
    assert.deepEqual(authoritativeCheckpoint(restored), checkpoint);
    while (restored.tick < 30) {
      page.frame();
      assert.equal(page.rendered.signalReception, 'off');
      assert.deepEqual(surface.noiseDraws(), []);
    }
    assert.ok(restored.trail.length > 0, 'Resume preserves and advances the genuine open cut.');
    page.key('ArrowUp');
    page.key('ArrowUp', false);
    for (let tick = 0; tick < 60 && restored.status === 'running'; tick++) page.frame();
    assert.equal(restored.status, 'lost');
    assert.equal(restored.failureCause, 'self-contact');
    assert.equal(page.rendered.signalReception, 'lost');
    assert.equal(page.rendered.signalEffectsRunning, true);
    const lost = authoritativeCheckpoint(restored);
    for (let frame = 0; frame < 7; frame++) page.frame(100);
    assert.equal(page.$('game-overlay').dataset.kind, 'lost');
    assert.equal(page.rendered.signalReception, 'lost');
    assert.equal(surface.noiseDraws().at(-1)?.globalAlpha, 0.8);
    assert.deepEqual(authoritativeCheckpoint(restored), lost);
    page.frame(0);
    assert.equal(page.rendered.signalEffectsRunning, false);
    assert.deepEqual(page.errors, []);
  });
