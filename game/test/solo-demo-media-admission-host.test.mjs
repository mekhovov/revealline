import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage, demoKey, DEMO_HOST_READY_TIMEOUT_MS } from './helpers/demo-host-fixture.mjs';
import { memoryStorage, settle } from './helpers/solo-dom.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const microtasks = () => new Promise((resolve) => setImmediate(resolve));

async function mounted(t, { gameSounds = false, ...options } = {}) {
  let sound;
  const original = Soundscape.prototype.setActorPresentation;
  t.mock.method(Soundscape.prototype, 'setActorPresentation', function (...args) {
    sound = this;
    return original.apply(this, args);
  });
  const storage = memoryStorage();
  storage.setItem(
    'revealline.demo.dev.v1',
    JSON.stringify({ version: 1, auto: false, collect: false, gameSounds }),
  );
  storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ muted: true, volume: 0.65 }));
  const audio = { ...audioHarness(), URLImpl: undefined };
  const page = await demoPage(t, { storage, audio, ...options });
  assert(sound, 'Observe the real app-owned shared queue without replacing its implementation.');
  return { page, queue: sound.mediaPreparation, sound };
}

function queueTask(t, queue, kind, work, options = {}) {
  const controller = new AbortController();
  let settled = false;
  const promise = queue.run(kind, work, { ...options, signal: controller.signal });
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  t.after(() => controller.abort());
  return { promise, settled: () => settled };
}

async function finishTask(task) {
  await settle(
    task.settled,
    'Injected media task must settle within the existing fixture deadline.',
  );
  return task.promise;
}

function pendingMain(t, queue) {
  let calls = 0;
  const task = queueTask(t, queue, 'main', () => ++calls);
  return { ...task, calls: () => calls };
}

async function movingAdmission(t, queue) {
  const work = pendingMain(t, queue);
  let background = 0;
  const optional = queueTask(t, queue, 'fetch', () => ++background, { priority: 'background' });
  await assert.rejects(finishTask(optional), { name: 'AbortError' });
  const required = queueTask(t, queue, 'fetch', () => 'required', { priority: 'required' });
  const demand = queueTask(t, queue, 'fetch', () => 'demand', { priority: 'demand' });
  assert.equal(await finishTask(required), 'required');
  assert.equal(await finishTask(demand), 'demand');
  await microtasks();
  assert.equal(background, 0, 'Optional prewarming cannot enter moving Demo.');
  assert.equal(work.calls(), 0, 'Bulk main work remains pending while required transport works.');
  return work;
}

for (const gameSounds of [false, true])
  test(`Demo owns shared media admission independently of gameSounds=${gameSounds} and mute`, async (t) => {
    const { page, queue, sound } = await mounted(t, { gameSounds });
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    await page.open();
    assert.equal(page.$('demo-audio-sounds').value, gameSounds ? 'game' : 'music');
    assert.equal(page.$('demo-audio-mute').getAttribute('aria-pressed'), 'true');
    const changes = t.mock.method(sound, 'setPreparationPhase');
    const work = await movingAdmission(t, queue);
    page.$('demo-details-toggle').click();
    for (let frame = 0; frame < 6; frame++) page.frame(1000 / 60);
    assert.equal(work.calls(), 0, 'Opening details does not pause the advancing spectator.');
    assert.equal(
      changes.mock.callCount(),
      0,
      'Stable callbacks do not drain admission repeatedly.',
    );
    page.$('demo-interrupt').click();
    await finishTask(work);
    assert.equal(work.calls(), 1, 'Explicit visible Pause admits exactly the parked work.');
    const raced = pendingMain(t, queue);
    page.$('demo-resume').click();
    await microtasks();
    assert.equal(raced.calls(), 0, 'Resume closes admission before already-scheduled microtasks.');
    page.$('demo-back').click();
    await finishTask(raced);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    page.$('overlay-brief').click();
    page.$('shell-briefing').click();
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    const main = await movingAdmission(t, queue);
    page.$('pause-button').click();
    await finishTask(main);
    assert.deepEqual(page.errors, []);
  });

for (const lifecycle of ['hidden', 'unfocused'])
  test(`background spectator keeps required transport but parks bulk work while ${lifecycle}`, async (t) => {
    const { page, queue } = await mounted(t);
    await page.open();
    const ordinary = authoritativeCheckpoint(page.rendered.run);
    if (lifecycle === 'hidden') {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    } else {
      page.doc.focused = false;
      page.win.emit('blur');
    }
    const work = await movingAdmission(t, queue);
    page.frame(1000 / 60);
    page.doc.hidden = false;
    page.doc.focused = true;
    page.doc.emit('visibilitychange');
    page.win.emit('focus');
    await microtasks();
    assert.equal(work.calls(), 0, 'Parent focus restoration cannot reopen active Demo admission.');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ordinary);
    page.$('demo-interrupt').click();
    await finishTask(work);
    assert.deepEqual(page.errors, []);
  });

for (const lifecycle of ['hidden', 'unfocused'])
  test(`practice suspends all shared preparation while ${lifecycle} until an explicit safe transition`, async (t) => {
    const { page, queue } = await mounted(t);
    await page.open();
    const ordinary = authoritativeCheckpoint(page.rendered.run);
    demoKey(page, 'ArrowDown');
    demoKey(page, 'ArrowDown', false);
    await settle(() => !page.$('demo-practice-controls').hidden);
    page.frame(0);
    const work = await movingAdmission(t, queue);
    if (lifecycle === 'hidden') {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    } else {
      page.doc.focused = false;
      page.win.emit('blur');
    }
    let demanded = 0;
    const request = queueTask(t, queue, 'fetch', () => ++demanded, { priority: 'required' });
    await microtasks();
    assert.equal(demanded, 0);
    assert.equal(work.calls(), 0);
    const practice = authoritativeCheckpoint(page.demoFrame.run);
    page.doc.hidden = false;
    page.doc.focused = true;
    page.win.emit('focus');
    page.doc.emit('visibilitychange');
    page.frame(1000 / 60);
    await microtasks();
    assert.equal(work.calls(), 0, 'Focus alone does not release lifecycle-suspended practice.');
    assert.equal(demanded, 0);
    assert.deepEqual(authoritativeCheckpoint(page.demoFrame.run), practice);
    page.$('demo-resume').click();
    await finishTask(work);
    await finishTask(request);
    assert.equal(demanded, 1);
    assert.deepEqual(authoritativeCheckpoint(page.demoFrame.run), practice);
    demoKey(page, 'ArrowRight');
    demoKey(page, 'ArrowRight', false);
    const resumed = await movingAdmission(t, queue);
    page.$('demo-back').click();
    await finishTask(resumed);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ordinary);
    assert.deepEqual(page.errors, []);
  });

test('Demo loading admits visible preparation, then preserves background demand and explicit handoff cancellation', async (t) => {
  const { page, queue } = await mounted(t, { clipId: 'crosswind-openings' });
  let release,
    catalogueWaiting = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/demo-data/catalog.json')) {
      catalogueWaiting = true;
      await gate;
    }
    return originalFetch(url, options);
  };
  try {
    page.$('shell-demo').click();
    assert.equal(page.$('demo-dialog').open, true);
    await settle(() => catalogueWaiting, 'Hold the real Demo catalogue request.', {
      timeoutMs: DEMO_HOST_READY_TIMEOUT_MS,
    });
    assert.equal(page.$('demo-dialog').dataset.scene, 'loading');
    const preparing = queueTask(t, queue, 'main', () => 'visible-preparation');
    assert.equal(await finishTask(preparing), 'visible-preparation');
    page.doc.hidden = true;
    page.doc.emit('visibilitychange');
    const work = await movingAdmission(t, queue);
    release();
    page.doc.hidden = false;
    page.doc.emit('visibilitychange');
    await page.ready();
    // A visible loading transition may consume the parked work before playback.
    // Once the ready scene is active, new work must again remain parked.
    const ready = await movingAdmission(t, queue);
    page.$('demo-interrupt').click();
    await finishTask(work);
    await finishTask(ready);
    page.$('demo-fresh').click();
    page.doc.focused = false;
    page.win.emit('blur');
    const cancelled = pendingMain(t, queue);
    await microtasks();
    assert.equal(cancelled.calls(), 0);
    page.doc.focused = true;
    page.win.emit('focus');
    await microtasks();
    assert.equal(cancelled.calls(), 0, 'Cancelled handoff cannot regain admission on focus.');
    page.$('demo-back').click();
    await finishTask(cancelled);
    assert.deepEqual(page.errors, []);
  } finally {
    release();
    globalThis.fetch = originalFetch;
  }
});
