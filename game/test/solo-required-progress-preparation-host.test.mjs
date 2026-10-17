import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

// Only request delivery is delayed in the existing finite IDB model; actual
// profile/backend/application code owns validation, cancellation and writes.
const source = await readFile(
  new URL(`${process.cwd()}/game/test/helpers/managed-idb.mjs`, 'file:'),
  'utf8',
);
const needle = 'queueMicrotask(() => {\n          if (finished) return;';
assert.equal(source.split(needle).length, 2);
const { managedIndexedDB } = await import(
  `data:text/javascript;base64,${Buffer.from(source.replace(needle, '(api.scheduleRequest ?? queueMicrotask)(() => {\n          if (finished) return;')).toString('base64')}`
);
class CandidateImage {
  width = 1774;
  height = 887;
  naturalWidth = 1774;
  naturalHeight = 887;
  set src(value) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
  removeAttribute() {
    this.source = '';
  }
}
const turn = () => new Promise((resolve) => setImmediate(resolve));
async function setup(t) {
  const model = managedIndexedDB(),
    queue = [],
    audio = audioHarness();
  let held = false,
    refused = false,
    resumes = 0;
  model.scheduleRequest = (fn) => (held ? queue.push(fn) : queueMicrotask(fn));
  const originalResume = audio.context.resume.bind(audio.context);
  audio.context.resume = () => {
    resumes++;
    return originalResume();
  };
  const p = await soloPage(t, {
    search: '?journey=opening',
    titleScreen: true,
    journeyIndexedDB: model.indexedDB,
    pictures: { Image: CandidateImage },
    audio,
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? refused
          ? new Response('Unavailable', { status: 503 })
          : new Response(await readFile(path))
        : undefined,
  });
  return {
    p,
    model,
    queue,
    audio,
    get resumes() {
      return resumes;
    },
    hold() {
      held = true;
    },
    refuse(value) {
      refused = value;
    },
    release() {
      held = false;
      for (const fn of queue.splice(0)) queueMicrotask(fn);
    },
    read: () => createJourneyBackend(model).read(),
  };
}
async function running(p) {
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
}
async function start(f) {
  f.p.$('shell-featured').click();
  await running(f.p);
}

test('public Start activates audio in its gesture, settles required progress paused, then grants one fresh clock', async (t) => {
  const f = await setup(t),
    { p } = f;
  p.$('shell-sound').click();
  assert.equal(p.$('shell-home').emit('cancel').defaultPrevented, false);
  p.$('shell-home').close();
  assert.equal(p.$('shell-home').open, false);
  f.audio.context.state = 'suspended';
  const before = f.resumes;
  f.hold();
  p.$('start-button').click();
  assert(f.resumes > before, 'Original gesture activates audio before storage can settle.');
  await settle(() => f.queue.length > 0);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  p.frame(0);
  const run = p.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  for (let n = 0; n < 10; n++) p.frame(0);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  f.release();
  await running(p);
  assert.equal(p.rendered.run, run);
  assert.equal((await f.read()).generation, 1);
  p.$('pause-button').click();
  p.frame(0);
  const paused = authoritativeCheckpoint(run);
  p.$('start-button').click();
  await running(p);
  assert.deepEqual(authoritativeCheckpoint(run), paused);
  assert.equal((await f.read()).generation, 1, 'Resume does not record another select.');
  assert.deepEqual(p.errors, []);
});

test('cancelling a paused storage handoff prevents late automatic Start and keeps the accepted selection once', async (t) => {
  const f = await setup(t),
    { p } = f;
  assert.equal(p.$('shell-home').emit('cancel').defaultPrevented, false);
  p.$('shell-home').close();
  assert.equal(p.$('shell-home').open, false);
  f.hold();
  p.$('start-button').click();
  await settle(() => f.queue.length > 0);
  p.frame(0);
  const run = p.rendered.run;
  assert.equal(p.$('flight-preparation-status').dataset.state, 'busy');
  p.key('Escape');
  p.key('Escape', false);
  f.release();
  await turn();
  await turn();
  p.frame(0);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  assert.equal(p.rendered.run, run);
  p.$('start-button').click();
  await running(p);
  assert.equal(p.rendered.run, run);
  assert.equal((await f.read()).generation, 1);
  assert.deepEqual(p.errors, []);
});

test('required save timeout permits recoverable play; active online cannot restart I/O and Pause drains pending', async (t) => {
  const f = await setup(t),
    { p } = f;
  f.hold();
  p.$('shell-featured').click();
  await settle(() => f.queue.length > 0);
  await running(p);
  assert.equal(p.$('journey-save-status').hidden, false);
  const queued = f.queue.length,
    writes = f.model.allPuts.length;
  p.win.emit('online');
  await turn();
  assert.equal(f.queue.length, queued, 'Online during play starts no new required read.');
  f.release();
  await turn();
  await turn();
  assert.equal(f.model.allPuts.length, writes, 'Timed-out native requests cannot write late.');
  p.$('pause-button').click();
  await settle(() => p.$('journey-save-status').hidden);
  assert.equal((await f.read()).generation, 1);
  p.$('start-button').click();
  await running(p);
  assert.deepEqual(p.errors, []);
});

test('successful public Skip batches accepted selection and skip before the next active clock', async (t) => {
  const f = await setup(t),
    { p } = f;
  await start(f);
  const old = p.rendered.run,
    before = await f.read();
  p.$('journey-skip').click();
  assert.equal(p.$('journey-skip').textContent, 'Confirm skip');
  f.hold();
  p.$('journey-skip').click();
  await settle(() => f.queue.length > 0);
  p.frame(0);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  assert.notEqual(p.rendered.run, old, 'Only an accepted prepared replacement records the skip.');
  const replacement = p.rendered.run;
  f.release();
  await running(p);
  const after = await f.read();
  assert.equal(p.rendered.run, replacement);
  assert.equal(replacement.levelId, 'choose-your-share');
  assert.equal(after.skipped.solo.length, before.skipped.solo.length + 1);
  assert.equal(
    after.generation,
    before.generation + 2,
    'One select plus one skip, without a post-resume duplicate.',
  );
  assert.deepEqual(p.errors, []);
});

test('failed next-picture preparation keeps the exact flight and records no Skip', async (t) => {
  const f = await setup(t),
    { p } = f;
  await start(f);
  const before = await f.read(),
    run = p.rendered.run;
  f.refuse(true);
  p.$('journey-skip').click();
  p.$('journey-skip').click();
  await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
  p.frame(0);
  assert.equal(p.rendered.run, run);
  assert.equal(p.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(await f.read(), before);
  assert.deepEqual(p.errors, []);
});
