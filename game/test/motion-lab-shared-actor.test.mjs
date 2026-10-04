import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSharedActorStudy } from '../../authoring/motion-lab/shared-actor-study.mjs';
import { mountSharedActorPanel } from '../../authoring/motion-lab/shared-actor-panel.mjs';
import {
  drawHuntActor,
  OVERHEAD_ACTOR_ART_REVISION,
  INDUSTRIAL_ROSTER_ART_REVISION,
  OVERHEAD_ACTOR_SAMPLES,
} from '../hunt/actor-art.mjs';
import { validateActorAnimation, sampleActorAnimation } from '../presentation/actor-animation.mjs';
import { pageActorArtPool } from '../presentation/actor-art-pool.mjs';
import { Document, Element } from './helpers/couch-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { waitFor } from './helpers/wait-for.mjs';

function context(canvas = null) {
  return new Proxy(
    { canvas, calls: [], globalAlpha: 1 },
    {
      get(target, name) {
        if (name in target) return target[name];
        return (...args) => target.calls.push({ name, args, fillStyle: target.fillStyle });
      },
    },
  );
}
function harness(t, artRevision = null) {
  const doc = new Document(),
    host = doc.defaultView,
    frames = new Map();
  if (artRevision)
    host.location = { href: `http://localhost/authoring/motion-lab/?artReview=${artRevision}` };
  let clock = 0,
    onPlay = 0;
  class CanvasElement extends Element {
    getContext() {
      return (this.context ??= context(this));
    }
  }
  doc.createElement = (tag) => new CanvasElement(doc, tag);
  host.requestAnimationFrame = (callback) => {
    frames.set(++clock, callback);
    return clock;
  };
  host.cancelAnimationFrame = (id) => frames.delete(id);
  const root = doc.createElement('details');
  doc.body.append(root);
  const panel = mountSharedActorPanel({ root, onPlay: () => onPlay++ });
  t.after(() => panel.dispose());
  const $ = (id) => doc.getElementById(`shared-actor-${id}`);
  const samples = root.querySelectorAll('canvas');
  return {
    doc,
    host,
    root,
    panel,
    frames,
    samples,
    $,
    pool: pageActorArtPool(doc),
    get onPlay() {
      return onPlay;
    },
    async open() {
      root.open = true;
      root.emit('toggle');
      await waitFor(() => !$('play').disabled);
    },
    change(id, value) {
      $(id).value = value;
      $(id).emit('change');
    },
    tick(time) {
      assert.equal(frames.size, 1);
      const [id, callback] = [...frames][0];
      frames.delete(id);
      callback(time);
    },
    lastPaint(index = 3) {
      const ctx = samples[index].getContext('2d');
      const start = ctx.calls.findLastIndex((call) => call.name === 'clearRect');
      return ctx.calls.slice(start);
    },
  };
}

test('shared drafts use admitted immutable descriptors and bounded edits retain their selected frame', () => {
  const study = createSharedActorStudy();
  study.seekFrame(2);
  study.editFrame({ durationMs: 2000, stride: -3, breath: 2, accessory: -2 });
  const value = study.snapshot();
  assert.equal(value.frameIndex, 2);
  assert.equal(value.frame.id, 'stride-2');
  assert.equal(value.frame.durationMs, 2000);
  assert.equal(value.timeMs, 200);
  assert.equal(
    sampleActorAnimation(value.descriptor, { clip: value.clip, timeMs: value.timeMs }),
    value.frame,
  );
  assert.ok(Object.isFrozen(value.descriptor.frames[2]));
  assert.equal(OVERHEAD_ACTOR_SAMPLES.courier.frames[2].durationMs, 100);
  study.selectFamily('runner');
  study.selectFamily('courier');
  assert.equal(
    study.snapshot().descriptor,
    value.descriptor,
    'Each family retains its own local draft',
  );
});

test('unknown motion fields and every out-of-bounds value are rejected before replacing the accepted draft', () => {
  const study = createSharedActorStudy(),
    before = study.exportJSON();
  for (const patch of [
    { durationMs: 15 },
    { durationMs: 2001 },
    { stride: -4 },
    { stride: 4 },
    { breath: -1 },
    { breath: 3 },
    { accessory: -3 },
    { accessory: 3 },
    { stride: 1.5 },
    { speed: 2 },
    { breath: NaN },
  ]) {
    assert.throws(() => study.editFrame(patch));
    assert.equal(study.exportJSON(), before);
  }
  assert.throws(() => study.selectClip('execute'));
  assert.throws(() => study.seekFrame(-1));
  assert.throws(() => study.advance(251));
});

test('clip occurrences, repeated frame references and non-looping end poses use the production sampler', () => {
  const study = createSharedActorStudy(),
    source = JSON.parse(study.exportJSON());
  source.clips.move = { frames: ['stride-1', 'stride-1', 'stride-2'], loop: false };
  delete source.clips.aim;
  delete source.clips.fire;
  study.importJSON(JSON.stringify(source));
  study.seekFrame(1);
  study.editFrame({ durationMs: 50 });
  assert.equal(study.snapshot().frameIndex, 1);
  assert.equal(study.snapshot().timeMs, 50);
  study.advance(250);
  assert.equal(study.snapshot().timeMs, 199);
  assert.equal(study.snapshot().frame.id, 'stride-2');
  study.stepFrame();
  assert.equal(study.snapshot().timeMs, 0);
  study.stepFrame(-1);
  assert.equal(study.snapshot().frameIndex, 2);
  study.setLoop(true);
  study.advance(100);
  assert.equal(study.snapshot().frameIndex, 0);
  assert.throws(
    () => study.selectClip('aim'),
    'An absent optional clip must not masquerade as Idle',
  );
});

test('exact descriptor import/export retains identity, immutable dependencies and frame bounds without a new pack format', () => {
  const study = createSharedActorStudy(),
    source = JSON.parse(study.exportJSON());
  source.id = 'community-courier';
  source.revision = 9;
  source.frames[1].accessory = 2;
  study.importJSON(JSON.stringify(source));
  assert.deepEqual(JSON.parse(study.exportJSON()), source);
  assert.deepEqual(validateActorAnimation(JSON.parse(study.exportJSON())), source);
  const accepted = study.exportJSON();
  for (const text of [
    '{broken',
    JSON.stringify({ ...source, script: 'execute' }),
    ' '.repeat(131073),
    JSON.stringify({ ...source, rig: 'sprite.v1' }),
  ]) {
    assert.throws(() => study.importJSON(text));
    assert.equal(study.exportJSON(), accepted);
  }
});

test('explicit Courier accessory offsets affect only the satchel and retain native heading and historical bounce', () => {
  function paint(size, accessory) {
    const ctx = context(),
      source = structuredClone(OVERHEAD_ACTOR_SAMPLES.courier);
    source.frames.forEach((frame) => {
      frame.accessory = accessory ?? 0;
    });
    drawHuntActor(ctx, 0, 0, size, 0, {
      family: 'courier',
      heading: 'right',
      state: 'walk',
      timeMs: 200,
      artRevision: OVERHEAD_ACTOR_ART_REVISION,
      ...(accessory == null ? {} : { animation: validateActorAnimation(source) }),
      shadow: false,
    });
    return ctx.calls;
  }
  for (const size of [16, 32]) {
    const lower = paint(size, 2),
      upper = paint(size, -2);
    const satchel = (calls) =>
      calls.find((call) => call.name === 'fillRect' && call.fillStyle === '#be9b65');
    assert.equal(satchel(lower).args[1] - satchel(upper).args[1], size === 16 ? 2 : 4);
    assert.deepEqual(
      lower.filter((call) => call.name !== 'fillRect'),
      upper.filter((call) => call.name !== 'fillRect'),
    );
    assert.ok(lower.some((call) => call.name === 'rotate' && call.args[0] === Math.PI / 2));
    assert.equal(
      satchel(paint(size)).args[1],
      size === 16 ? 7 : 18,
      'Default descriptor retains the old stride bounce',
    );
  }
});

test('the actual panel edits and exports valid frames, rejects invalid input and selects only admitted clips', async (t) => {
  const h = harness(t);
  await h.open();
  assert.equal(h.pool.stats().reservedBytes, 121088);
  const leases = h.pool.stats().leases;
  h.root.querySelector('details').emit('toggle');
  assert.equal(
    h.pool.stats().leases,
    leases,
    'Nested exchange details never reacquire the actor panel',
  );
  h.change('frame', '2');
  h.change('durationMs', '650');
  h.change('accessory', '-2');
  h.$('export').click();
  const edited = JSON.parse(h.$('source').value);
  assert.equal(edited.frames[2].durationMs, 650);
  assert.equal(edited.frames[2].accessory, -2);
  h.change('stride', '4');
  assert.equal(h.$('stride').value, String(edited.frames[2].stride));
  h.$('source').value = '{broken';
  h.$('import').click();
  h.$('export').click();
  assert.deepEqual(JSON.parse(h.$('source').value), edited);
  const lean = structuredClone(edited);
  delete lean.clips.aim;
  delete lean.clips.fire;
  h.$('source').value = JSON.stringify(lean);
  h.$('import').click();
  assert.ok(!h.$('clip').children.some((option) => option.value === 'aim'));
  h.change('family', 'runner');
  assert.equal(h.$('accessory').disabled, true);
  h.change('family', 'courier');
  h.$('export').click();
  assert.deepEqual(JSON.parse(h.$('source').value), lean);
});

test('the actual panel renders all headings at the same center, steps frames and freezes visible poses with Reduced effects', async (t) => {
  const h = harness(t);
  await h.open();
  h.change('heading', 'right');
  let paint = h.lastPaint();
  assert.ok(paint.some((call) => call.name === 'rotate' && call.args[0] === Math.PI / 2));
  assert.deepEqual(paint.filter((call) => call.name === 'lineTo').at(-1).args, [136, 72]);
  h.$('next').click();
  assert.equal(h.$('frame').value, '1');
  const moved = h.lastPaint();
  assert.notDeepEqual(moved, paint);
  h.panel.setReducedEffects(true);
  const reduced = h.lastPaint();
  h.$('next').click();
  assert.equal(h.$('frame').value, '2');
  assert.deepEqual(h.lastPaint(), reduced);
  h.panel.setReducedEffects(false);
  assert.notDeepEqual(h.lastPaint(), reduced);
  h.change('heading', 'left');
  paint = h.lastPaint();
  assert.deepEqual(paint.filter((call) => call.name === 'lineTo').at(-1).args, [8, 72]);
  assert.deepEqual(paint.filter((call) => call.name === 'moveTo').at(-1).args, [72, 72]);
});

test('playback pauses on blur, close and cached departure; return retains the draft without replay or leaked backing', async (t) => {
  const h = harness(t);
  assert.equal(h.frames.size, 0);
  assert.equal(h.pool.stats().reservedBytes, 0);
  await h.open();
  h.$('play').click();
  h.tick(0);
  h.tick(220);
  assert.equal(h.$('frame').value, '2');
  assert.equal(h.onPlay, 1);
  h.host.emit('blur');
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('frame').value, '2');
  h.host.emit('pageshow', { persisted: true });
  await waitFor(() => !h.$('play').disabled);
  assert.equal(h.frames.size, 0);
  h.$('play').click();
  h.host.emit('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.equal(h.pool.stats().reservedBytes, 0);
  h.host.emit('pageshow', { persisted: true });
  await waitFor(() => h.pool.stats().leases === 4);
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('frame').value, '2');
  h.root.open = false;
  h.root.emit('toggle');
  assert.equal(h.pool.stats().reservedBytes, 0);
  assert.ok(h.samples.every((canvas) => canvas.width === 0 && canvas.height === 0));
});

test('close and terminal disposal during acquisition retire all leases and cannot resurrect a preview', async (t) => {
  const h = harness(t);
  h.root.open = true;
  h.root.emit('toggle');
  h.root.open = false;
  h.root.emit('toggle');
  await h.open();
  assert.equal(h.pool.stats().leases, 4);
  h.host.emit('pagehide', { persisted: false });
  h.root.open = true;
  h.root.emit('toggle');
  h.host.emit('pageshow');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.pool.stats().reservedBytes, 0);
  assert.equal(h.frames.size, 0);
  assert.ok(h.samples.every((canvas) => canvas.width === 0));
});

test('EN/UK controls preserve valid drafts, and Asset Studio remains the existing staging destination', async (t) => {
  const previous = getLocale();
  t.after(() => setLocale(previous));
  const h = harness(t);
  await h.open();
  h.change('breath', '2');
  h.$('export').click();
  const exported = h.$('source').value;
  for (const locale of ['en', 'uk']) {
    setLocale(locale);
    h.panel.refresh();
    const labels = h.root
      .querySelectorAll('label')
      .map((label) => label.textContent)
      .join(' ');
    assert.doesNotMatch(labels, /tools:motionLab/);
    assert.match(labels, locale === 'uk' ? /Тривалість кадру/ : /Frame duration/);
    assert.equal(h.$('source').value, exported);
  }
  const link = h.root.querySelector('a');
  assert.equal(link.href, '../asset-studio/');
  const studio = await readFile(
    new URL('../../authoring/asset-studio/animation-controls.mjs', import.meta.url),
    'utf8',
  );
  assert.match(studio, /validateActorAnimation/);
  assert.match(studio, /Stage animation revision/);
});

test('production roster exposes non-Courier accessory edits in the actual Motion Lab panel', async (t) => {
  const h = harness(t, INDUSTRIAL_ROSTER_ART_REVISION);
  await h.open();
  h.change('family', 'patroller');
  h.change('clip', 'move');
  assert.equal(h.$('accessory').disabled, false);
  h.change('accessory', '-2');
  const first = h.lastPaint();
  h.change('accessory', '2');
  assert.notDeepEqual(
    h.lastPaint(),
    first,
    'The native baton gesture changes in the visible preview',
  );
  h.$('export').click();
  const value = JSON.parse(h.$('source').value);
  const frame = value.frames.find(({ id }) => id === value.clips.move.frames[0]);
  assert.equal(frame.accessory, 2);
  h.change('accessory', '3');
  assert.equal(h.$('accessory').value, '2', 'Bounds still apply');
});

test('late-mounted shared actor panel keeps its exact review in the fixed Asset Studio handoff', (t) => {
  const f = harness(t, INDUSTRIAL_ROSTER_ART_REVISION);
  const link = f.root.querySelector('[data-workshop-tool="asset-studio"]');
  const target = new URL(link.href);
  assert.equal(
    target.href,
    'http://localhost/authoring/asset-studio/?artReview=industrial-roster-v3',
  );
  assert.equal(f.frames.size, 0, 'A tool link does not activate the animation preview.');
  assert.equal(f.pool.stats().leases, 0);
});
