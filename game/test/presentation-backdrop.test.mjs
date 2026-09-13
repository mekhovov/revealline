import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { mediaFixture } from './helpers/media-fixtures.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const presets = read('../../authoring/motion-lab/presets.json');
const themes = read('../content/themes.json').themes;
const generated = { width: 384, height: 288, label: 'generated prior art' };
const authored = { width: 640, height: 360, label: 'exact authored prior art' };
const custom = { width: 320, height: 320, label: 'fully decoded managed still' };
const enemy = { width: 16, height: 16, label: 'independent enemy' };
const avatar = { width: 32, height: 32, label: 'independent player' };

// Observe actual BoardPainter Canvas2D commands. No image decoding, raster,
// browser storage, app adoption or physical device claim is made here.
function canvas(width) {
  const calls = [],
    stack = [],
    values = { globalAlpha: 1, imageSmoothingEnabled: true, fillStyle: '', strokeStyle: '' };
  const ctx = new Proxy(
    { canvas: { width, height: 576, clientWidth: 294 } },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in values) return values[key];
        return (...args) => {
          calls.push({ op: key, args, ...values });
          if (key === 'save') stack.push({ ...values });
          if (key === 'restore') Object.assign(values, stack.pop());
        };
      },
      set(_target, key, value) {
        values[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}
function painter(theme) {
  const result = new BoardPainter(presets);
  result.theme = theme;
  result.body = presets.characters['neutral-marker'];
  result.recipe = presets.animationRecipes[result.body.animationRecipe];
  result.background = generated;
  result.images = { background: authored, enemy, player: avatar };
  result.image = avatar;
  result.overrides = { background: { fit: 'cover' }, enemy: { dataUrl: 'owned legacy enemy' } };
  return result;
}
function runFor(classic, turnPolicy = 'immediate') {
  return createRun(mediaFixture(classic).campaign.levels[0], { turnPolicy });
}
function cut(run) {
  for (let i = 0; i < 13; i++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.player.cutting, true);
}
const backgroundCall = (surface) => surface.calls.find((call) => call.op === 'drawImage');
const withoutBackground = (surface) => {
  const first = backgroundCall(surface);
  return surface.calls.filter((call) => call !== first);
};

for (const classic of [false, true])
  for (const theme of themes)
    for (const fit of ['contain', 'cover'])
      test(`${classic ? 'Classic wide' : 'legacy'} ${theme.id} ${fit}: a decoded backdrop preserves opaque concealment, cues, separate actor art and authority`, () => {
        const run = runFor(classic);
        cut(run);
        const checkpoint = authoritativeCheckpoint(run),
          legacy = painter(theme),
          managed = painter(theme),
          baseline = canvas(run.width * 16),
          actual = canvas(run.width * 16);
        const binding = {
          image: custom,
          fit,
          sampling: 'nearest',
          get pin() {
            assert.fail('Renderer must not read authority');
          },
          release() {
            assert.fail('Renderer must not release the host binding');
          },
        };
        legacy.draw(baseline.ctx, run, 0, { paused: true, reduced: true });
        managed.draw(actual.ctx, run, 0, { paused: true, reduced: true, backdrop: binding });
        const call = backgroundCall(actual),
          W = run.width * 16,
          H = 576;
        const ratio = fit === 'contain' ? Math.min(W / 320, H / 320) : Math.max(W / 320, H / 320);
        assert.deepEqual(call.args, [
          custom,
          (W - 320 * ratio) / 2,
          (H - 320 * ratio) / 2,
          320 * ratio,
          320 * ratio,
        ]);
        assert.equal(call.imageSmoothingEnabled, false);
        assert.deepEqual(
          withoutBackground(actual),
          withoutBackground(baseline),
          'Only the picture draw changes; masks/live cut/actors/colliders remain identical',
        );
        assert.ok(
          actual.calls.some(
            (item) =>
              item.op === 'fillRect' && item.fillStyle === '#000000' && item.globalAlpha === 1,
          ),
        );
        assert.ok(actual.calls.some((item) => item.op === 'drawImage' && item.args[0] === avatar));
        assert.equal(managed.images.background, authored);
        assert.equal(managed.background, generated);
        assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      });

test('absent/null bindings exactly retain old drawing; clearing a temporary binding restores the same authored image and fit', () => {
  const run = runFor(true);
  cut(run);
  const p = painter(themes[0]),
    a = canvas(1152),
    b = canvas(1152),
    temporary = canvas(1152),
    restored = canvas(1152);
  p.effectsFor(
    [{ type: 'powerup.collected', kind: 'enemy-slow', x: 5, y: 7, tick: run.tick }],
    run,
  );
  p.effects[0].age = 0.2;
  p.draw(a.ctx, run, 0, { paused: true });
  p.draw(b.ctx, run, 0, { paused: true, backdrop: null });
  assert.deepEqual(a.calls, b.calls);
  const animation = p.animation,
    actors = p.actorPresentation,
    effects = p.effects,
    token = p.loadToken;
  p.setLook = () => assert.fail('Backdrop adoption cannot reload art or reset rigs');
  p.setLevel = () => assert.fail('Backdrop adoption cannot reset the flight presentation');
  p.makeArt = () => assert.fail('An existing fallback is already available');
  p.draw(temporary.ctx, run, 0, { paused: true, backdrop: { image: custom, fit: 'contain' } });
  p.draw(restored.ctx, run, 0, { paused: true });
  assert.deepEqual(restored.calls, a.calls);
  assert.deepEqual(p.animation, animation);
  assert.equal(p.actorPresentation, actors);
  assert.deepEqual(p.effects, effects);
  assert.equal(p.loadToken, token);
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: a legal win and Collection gallery use the same image/fit without awarding or advancing simulation`, () => {
    const run = runFor(true, turnPolicy),
      p = painter(themes[0]);
    while (run.status === 'running') {
      assert.ok(run.tick < 900);
      stepRun(run, { direction: 'down' }, FIXED_DT);
    }
    assert.equal(run.status, 'won');
    const before = authoritativeCheckpoint(run),
      binding = { image: custom, fit: 'contain', sampling: 'nearest' };
    const victory = canvas(1152),
      gallery = canvas(1152);
    p.draw(victory.ctx, run, 0, {
      fullReveal: true,
      reduced: true,
      paused: true,
      backdrop: binding,
    });
    p.drawGallery(gallery.ctx, {
      width: 1152,
      height: 576,
      image: binding.image,
      fit: binding.fit,
    });
    assert.deepEqual(backgroundCall(victory).args, backgroundCall(gallery).args);
    assert.equal(
      victory.calls.filter((c) => c.op === 'fillRect' && c.fillStyle === '#000000').length,
      0,
    );
    assert.deepEqual(authoritativeCheckpoint(run), before);
    const celebration = p.celebration;
    p.draw(canvas(1152).ctx, run, 1, {
      fullReveal: true,
      reduced: true,
      paused: true,
      celebrationPaused: true,
      backdrop: binding,
    });
    assert.deepEqual(
      p.celebration,
      celebration,
      'Paused celebration does not change while picture binding remains active',
    );
    assert.deepEqual(authoritativeCheckpoint(run), before);
  });
