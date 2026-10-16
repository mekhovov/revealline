import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { mountFlightApp } from '../../optional-practice/civilian-fpv/app.mjs';
import { COPY } from '../../optional-practice/civilian-fpv/copy.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import { createFlight, replayFlight } from '../../optional-practice/civilian-fpv/model.mjs';
import { FLIGHT_CONTROLS } from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const html = parse(
  await readFile(
    new URL('../../optional-practice/civilian-fpv/index.html', import.meta.url),
    'utf8',
  ),
);

async function fixture(t, locale = 'en') {
  const doc = new Document(),
    win = new Events(),
    frames = new Map(),
    renders = [],
    admissions = [];
  doc.createElementNS = (_namespace, name) => doc.createElement(name);
  const body = html.childNodes
    .find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  function copy(source, parent) {
    if (!source.tagName) return;
    const element = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs ?? []) {
      element.setAttribute(name, value);
      if (name === 'hidden') element.hidden = true;
      if (name === 'value') element.value = value;
    }
    parent.append(element);
    for (const child of source.childNodes ?? []) copy(child, element);
    if (source.tagName === 'select') element.value = element.children[0]?.value ?? '';
  }
  for (const child of body.childNodes) copy(child, doc.body);
  let serial = 0,
    now = 0;
  Object.assign(win, {
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    location: new URL(`https://example.test/optional-practice/civilian-fpv/?lang=${locale}`),
    performance: { now: () => 0 },
    navigator: {},
    requestAnimationFrame: (callback) => {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    matchMedia: () => ({ matches: false }),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  const app = mountFlightApp({
    document: doc,
    window: win,
    rendererFactory: () => ({
      available: true,
      draw: (state) => renders.push(state),
      dispose() {},
    }),
    notebookFactory: () => ({
      ready: Promise.resolve(),
      accept: (proof) => admissions.push(proof),
      dispose() {},
    }),
    studioFactory: null,
    reviewYieldControl: async () => {},
    onAttempt: (attempt) => admissions.push(attempt),
  });
  t.after(() => app.dispose());
  await app.settled();
  const $ = (id) => doc.getElementById(id);
  return {
    app,
    doc,
    win,
    $,
    renders,
    admissions,
    tick(count = 1, elapsed = 20) {
      for (let i = 0; i < count; i++) {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback(now);
        now += elapsed;
      }
    },
    rate(value) {
      $('replay-rate').value = String(value);
      $('replay-rate').emit('change');
    },
    last: () => renders.at(-1),
  };
}

for (const mode of ['self-level', 'acro']) {
  for (const rate of [0.5, 1]) {
    test(`${rate}x ${mode} review displays every fixed model step, reaches the verified outcome and cannot earn`, async (t) => {
      const f = await fixture(t),
        proof = FLIGHT_DEMONSTRATIONS.find(
          (item) => item.course === 'flight-01' && item.mode === mode,
        ),
        course = FLIGHT_COURSES[0];
      assert.equal(f.$('replay-controls').hidden, true);
      await f.app.review(proof);
      assert.equal(f.$('replay-controls').hidden, false);
      f.rate(rate);
      f.$('replay-rate').focus();
      f.renders.length = 0;
      f.tick(21);
      assert.equal(f.last().ticks, 20 * rate, 'rate changes elapsed playback time only');
      f.tick(Math.ceil(proof.frames.length / rate) + 2);
      const states = new Map(f.renders.map((state) => [state.ticks, state]));
      assert.equal(
        states.size,
        proof.frames.length + 1,
        'no recorded input is dropped or duplicated',
      );
      const expected = createFlight({ course, mode, response: proof.response });
      expected.arm();
      assert.deepEqual(states.get(0), expected.snapshot());
      for (const frame of proof.frames) {
        const state = expected.step(
          Object.fromEntries(FLIGHT_CONTROLS.map((key, index) => [key, frame[index]])),
          { quantized: true },
        );
        assert.deepEqual(states.get(state.ticks), state);
      }
      assert.deepEqual(f.last(), replayFlight(course, proof).state);
      assert.equal(f.doc.activeElement, f.$('replay-rate'), 'ending playback preserves focus');
      assert.equal(f.$('replay-controls').hidden, false, 'finished review keeps its controls');
      assert.match(f.$('status').textContent, /Replay finished/);
      assert.equal(f.app.exportAttempt().frames.length, 0);
      assert.deepEqual(f.admissions, []);
      f.$('try').click();
      await f.app.settled();
      assert.equal(f.$('replay-controls').hidden, true);
      assert.equal(
        f.doc.activeElement,
        f.$('viewport'),
        'reset never leaves focus in hidden controls',
      );
      f.app.arm();
      f.tick(21);
      assert.equal(
        f.app.snapshot().ticks,
        20,
        'practice runs at its original rate after a slow review',
      );
    });
  }
}

test('changing review speed preserves pause and blur recovery, rejects foreign rates, and never buffers a catch-up', async (t) => {
  const f = await fixture(t),
    proof = FLIGHT_DEMONSTRATIONS.find(
      (item) => item.course === 'flight-01' && item.mode === 'self-level',
    );
  await f.app.review(proof);
  f.rate(0.5);
  f.tick(21);
  const beforeRateChange = f.last();
  f.rate(1);
  f.tick();
  assert.deepEqual(
    f.last(),
    beforeRateChange,
    'a rate change does not consume an earlier wall interval',
  );
  f.tick(5);
  assert.equal(f.last().ticks, beforeRateChange.ticks + 5);
  f.app.pause();
  const paused = f.last();
  f.rate(0.5);
  f.tick(10);
  assert.deepEqual(f.last(), paused);
  f.rate(2);
  assert.equal(f.$('replay-rate').value, '0.5');
  assert.deepEqual(f.last(), paused);
  f.app.arm();
  f.tick(11);
  assert.equal(f.last().ticks, paused.ticks + 5);
  f.win.emit('blur');
  const blurred = f.last();
  f.rate(1);
  f.tick(10);
  assert.deepEqual(f.last(), blurred);
  assert.equal(f.app.arm(), false);
  f.win.emit('focus');
  f.tick(4);
  assert.deepEqual(f.last(), blurred);
  f.app.arm();
  f.tick(6);
  assert.equal(f.last().ticks, blurred.ticks + 5);
  f.win.emit('pagehide', { persisted: true });
  const cached = f.last();
  f.win.emit('pageshow', { persisted: true });
  f.tick(10);
  assert.deepEqual(f.last(), cached);
  assert.equal(f.$('replay-rate').value, '1');
  assert.deepEqual(f.admissions, []);
});

test('replay speed is localized and cannot change practice or start a replay by itself', async (t) => {
  for (const locale of ['en', 'uk']) {
    const f = await fixture(t, locale);
    assert.equal(
      f.$('replay-controls').querySelector('[data-copy="replayRate"]').textContent,
      COPY[locale].replayRate,
    );
    assert.equal(f.$('replay-rate').children[1].textContent, COPY[locale].replaySlow);
    f.rate(0.5);
    assert.equal(f.$('replay-rate').value, '1');
    assert.equal(f.$('replay-controls').hidden, true);
    assert.equal(f.app.snapshot().status, 'disarmed');
    assert.equal(f.app.arm(), false, 'The main menu still requires an explicit Start.');
    f.$('academy-shell-action-primary').click();
    assert.equal(f.$('academy-shell-briefing-dialog').open, false);
    assert.equal(f.app.snapshot().status, 'active');
    f.tick(21);
    assert.equal(f.app.snapshot().ticks, 20);
    assert.deepEqual(f.admissions, []);
  }
});
