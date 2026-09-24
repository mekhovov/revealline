import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { stepRun } from '../core/index.mjs';
import { emptyLibrary, saveLibrary, updatePreferences, loadLibrary } from '../library.mjs';
import { prepareScenario } from '../imports.mjs';
const slot = 'revealline.suspended.dev.v1',
  profile = 'revealline.library.dev.v1';
const choices = [
  { id: 'class-select', field: 'classId', before: 'scout', after: 'bomber' },
  { id: 'turn-select', field: 'turnPolicy', before: 'grid-center', after: 'immediate' },
];
function action(element, type = 'click') {
  const fn = element[`on${type}`];
  let result;
  element[`on${type}`] = function (...args) {
    result = fn.apply(this, args);
    return result;
  };
  try {
    type === 'click' ? element.click() : element.emit(type);
  } finally {
    element[`on${type}`] = fn;
  }
  return Promise.resolve(result);
}
async function change(h, id, value) {
  h.$(id).focus();
  h.$(id).value = value;
  await action(h.$(id), 'change');
}
function frames(h, n = 8) {
  for (let i = 0; i < n; i++) h.frame();
}
function checkpoint(h) {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
}
async function setup(t, options = {}) {
  const storage = memoryStorage();
  saveLibrary(storage, profile, updatePreferences(emptyLibrary(), { turnPolicy: 'grid-center' }));
  return soloPage(t, { storage, ...options });
}
async function flight(h, { paused = true } = {}) {
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.key('ArrowDown');
  // The current 8.84-cell/s preset leaves a real cut before the next cell
  // centre; the queued turn must also survive the two later Resume ticks.
  frames(h, 8);
  h.key('ArrowDown', false);
  h.key('ArrowRight');
  h.frame();
  h.key('ArrowRight', false);
  assert.equal(h.rendered.run.player.queuedDirection, 'right');
  if (paused) {
    h.$('pause-button').click();
    await action(h.$('shell-packs'));
    assert.equal(h.$('journey-chooser').open, true);
    assert.equal(h.$('mission-picker-setup').closest('dialog'), h.$('journey-chooser'));
    // The finite DOM models native <summary> expansion only; the controls and
    // their setup/replacement handlers remain the actual host implementations.
    h.$('mission-picker-setup').open = true;
    h.$('mission-picker-setup').emit('toggle');
  }
  h.frame(0);
}
function preserved(h, run, before, { disposed = false } = {}) {
  // pagehide destroys Phaser and its DOM. Late storage callbacks must remain
  // harmless, but a real browser never runs another frame on that dead scene.
  if (!disposed) frames(h);
  assert.equal(h.rendered.run, run);
  assert.deepEqual(disposed ? authoritativeCheckpoint(run) : checkpoint(h), before);
  assert.equal(h.rendered.paused, true);
  assert.deepEqual(h.errors, []);
}
for (const choice of choices)
  for (const paused of [false, true])
    test(`${choice.id} ${paused ? 'paused' : 'running'}: Stay preserves replay/setup and Prepare creates one paused fresh attempt`, async (t) => {
      const h = await setup(t);
      await flight(h, { paused });
      const run = h.rendered.run,
        before = checkpoint(h),
        oldProfile = h.storage.getItem(profile);
      await change(h, choice.id, choice.after);
      assert.equal(h.$(choice.id).value, choice.before);
      assert.equal(h.$('mission-replace-dialog').open, true);
      assert.equal(h.doc.activeElement.id, 'mission-replace-stay');
      assert.equal(h.$('mission-replace-confirm').textContent, 'Prepare fresh attempt');
      assert.match(h.$('mission-replace-status').textContent, /saved and verified/);
      assert.equal(h.storage.getItem(profile), oldProfile);
      const saved = h.storage.getItem(slot),
        session = JSON.parse(saved);
      assert.equal(verifyReplay(session.replay).match, true);
      assert.equal(session.replay.options[choice.field], choice.before);
      preserved(h, run, before);
      await change(h, choice.id, choice.after); // repeated native changes do not create another owner
      assert.equal(h.storage.getItem(slot), saved);
      h.$('mission-replace-stay').click();
      assert.equal(h.doc.activeElement, h.$(choice.id));
      assert.equal(h.storage.getItem(profile), oldProfile);
      preserved(h, run, before);
      await change(h, choice.id, choice.after);
      const retained = h.storage.getItem(slot);
      await action(h.$('mission-replace-confirm'));
      await settle(() => h.doc.body.dataset.pictureState === 'ready');
      h.frame(0);
      assert.equal(h.$('mission-replace-dialog').open, false);
      assert.notEqual(h.rendered.run, run);
      assert.equal(h.rendered.run.tick, 0);
      assert.equal(h.rendered.run[choice.field], choice.after);
      assert.equal(
        h.rendered.run[choice.field === 'classId' ? 'turnPolicy' : 'classId'],
        choice.field === 'classId' ? 'grid-center' : 'scout',
      );
      assert.equal(h.rendered.run.seed, run.seed);
      assert.equal(h.rendered.run.levelId, run.levelId);
      assert.equal(h.rendered.paused, true);
      assert.equal(h.storage.getItem(slot), retained);
      assert.equal(loadLibrary(h.storage, profile).library.preferences[choice.field], choice.after);
      assert.equal(verifyReplay(JSON.parse(retained).replay).match, true);
      if (h.$('journey-chooser')?.open) h.$('journey-back').click();
      await action(h.$('continue-saved'));
      h.frame(0);
      assert.deepEqual(checkpoint(h), before);
      assert.equal(h.rendered.paused, true);
      assert.equal(h.rendered.run[choice.field], choice.before);
      assert.deepEqual(h.errors, []);
    });
for (const active of [false, true])
  test(`same setup values are a no-op in ${active ? 'running' : 'ready'} state`, async (t) => {
    const h = await setup(t);
    if (active) await flight(h, { paused: false });
    const run = h.rendered.run,
      before = checkpoint(h),
      writes = h.storage.writes.length;
    for (const c of choices) await change(h, c.id, c.before);
    assert.equal(h.rendered.run, run);
    assert.deepEqual(checkpoint(h), before);
    assert.equal(h.storage.writes.length, writes);
    assert.equal(h.$('mission-replace-dialog').open, false);
    if (active) assert.equal(h.rendered.paused, false);
  });
for (const choice of choices)
  test(`${choice.id}: ready selection is direct and invalid IDs cannot mutate setup`, async (t) => {
    const h = await setup(t);
    const run = h.rendered.run;
    await change(h, choice.id, choice.after);
    h.frame(0);
    assert.notEqual(h.rendered.run, run);
    assert.equal(h.rendered.run[choice.field], choice.after);
    assert.equal(h.$('mission-replace-dialog').open, false);
    assert.equal(h.rendered.paused, true);
    const ready = h.rendered.run,
      raw = h.storage.getItem(profile);
    await change(h, choice.id, '../arbitrary');
    h.frame(0);
    assert.equal(h.rendered.run, ready);
    assert.equal(h.$(choice.id).value, choice.after);
    assert.equal(h.storage.getItem(profile), raw);
  });
for (const method of ['button', 'Escape', 'controller', 'pagehide'])
  test(`pending setup retention ${method} cancels without changing profile/queue or a late write`, async (t) => {
    const h = await setup(t);
    await flight(h);
    const run = h.rendered.run,
      before = checkpoint(h),
      raw = h.storage.getItem(slot),
      prefs = h.storage.getItem(profile);
    let grant;
    navigator.locks.request = async (_n, _o, work) => {
      await new Promise((r) => (grant = r));
      return work();
    };
    h.$('turn-select').focus();
    h.$('turn-select').value = 'immediate';
    const pending = action(h.$('turn-select'), 'change');
    await settle(() => !!grant);
    assert.equal(h.$('mission-replace-confirm').disabled, true);
    if (method === 'button') h.$('mission-replace-stay').click();
    else if (method === 'Escape') {
      const e = h.$('mission-replace-stay').emit('keydown', { key: 'Escape', code: 'Escape' });
      if (!e.defaultPrevented) {
        const cancel = h.$('mission-replace-dialog').emit('cancel', { bubbles: false });
        if (!cancel.defaultPrevented) h.$('mission-replace-dialog').close();
      }
    } else if (method === 'pagehide') h.win.emit('pagehide', { persisted: false });
    else {
      const pad = {
        index: 0,
        id: 'Setup',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      navigator.getGamepads = () => [pad];
      h.frame();
      pad.buttons[1] = { pressed: true, value: 1 };
      h.frame();
      pad.buttons[1] = { pressed: false, value: 0 };
      h.frame();
    }
    grant();
    await pending;
    assert.equal(h.storage.getItem(slot), raw);
    assert.equal(h.storage.getItem(profile), prefs);
    preserved(h, run, before, { disposed: method === 'pagehide' });
    if (method !== 'pagehide') {
      assert.equal(h.$('mission-replace-dialog').open, false);
      assert.equal(h.doc.activeElement.id, 'turn-select');
      h.$('journey-back').click();
      const expected = verifyReplay(JSON.parse(raw).replay).state;
      const tick = run.tick;
      h.$('start-button').click();
      h.frame();
      h.frame();
      assert.equal(h.rendered.paused, false);
      assert.equal(run.tick, tick + 2);
      for (let i = 0; i < 2; i++) stepRun(expected, { direction: 'right' });
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(expected));
      assert.equal(run.player.queuedDirection, 'right');
    }
  });
for (const failure of ['quota', 'readback', 'newer-before', 'newer-after'])
  test(`setup ${failure}: truthful retained/loss boundary precedes any preference mutation`, async (t) => {
    const h = await setup(t);
    await flight(h);
    const run = h.rendered.run,
      before = checkpoint(h),
      prefs = h.storage.getItem(profile),
      raw = h.storage.getItem(slot);
    const get = h.storage.getItem.bind(h.storage),
      set = h.storage.setItem.bind(h.storage);
    let wrote = false;
    if (failure === 'newer-before') set(slot, raw + ' ');
    h.storage.setItem = (k, v) => {
      if (k === slot && failure === 'quota') throw new Error('quota');
      set(k, v);
      if (k === slot) wrote = true;
    };
    h.storage.getItem = (k) => (k === slot && wrote && failure === 'readback' ? '{}' : get(k));
    await change(h, 'class-select', 'bomber');
    if (failure === 'newer-after') {
      set(slot, get(slot) + ' ');
      await action(h.$('mission-replace-confirm'));
      assert.match(h.$('mission-replace-status').textContent, /changed.*Prepare again/);
    }
    assert.match(h.$('mission-replace-status').textContent, /not verified.*may lose/);
    assert.doesNotMatch(
      h.$('mission-replace-status').textContent,
      /saved and verified|older.*unchanged/i,
    );
    assert.equal(h.storage.getItem(profile), prefs);
    assert.equal(h.$('class-select').value, 'scout');
    preserved(h, run, before);
    if (failure === 'newer-after') {
      const newer = get(slot);
      await action(h.$('mission-replace-confirm'));
      h.frame(0);
      assert.equal(h.rendered.run.classId, 'bomber');
      assert.equal(h.rendered.paused, true);
      assert.equal(get(slot), newer);
    } else h.$('mission-replace-stay').click();
  });
for (const owner of ['setup', 'mission', 'team'])
  test(`${owner} prompt excludes the other navigation requests`, async (t) => {
    const h = await setup(t);
    await flight(h);
    const run = h.rendered.run,
      before = checkpoint(h),
      prefs = h.storage.getItem(profile);
    if (owner === 'setup') await change(h, 'turn-select', 'immediate');
    else if (owner === 'mission') await change(h, 'pack-select', 'night-shift');
    else await action(h.$('shell-team'));
    const dialog = owner === 'team' ? 'mode-leave-dialog' : 'mission-replace-dialog';
    assert.equal(h.$(dialog).open, true);
    const text = h.$(owner === 'team' ? 'mode-leave-status' : 'mission-replace-status').textContent;
    await change(h, 'class-select', 'bomber');
    await change(h, 'level-select', 'first-signal-01');
    if (owner !== 'team') await action(h.$('shell-team'));
    assert.equal(h.$(dialog).open, true);
    assert.equal(
      h.$(owner === 'team' ? 'mode-leave-status' : 'mission-replace-status').textContent,
      text,
    );
    assert.equal(h.storage.getItem(profile), prefs);
    assert.equal(h.$('class-select').value, 'scout');
    preserved(h, run, before);
    h.$(owner === 'team' ? 'mode-leave-stay' : 'mission-replace-stay').click();
    assert.equal(h.$('mission-replace-dialog').open, false);
    assert.equal(h.$('mode-leave-dialog').open, false);
  });
for (const course of [false, true])
  test(`${course ? 'course' : 'practice'} setup confirmation is session-only and never writes player progress or suspended flight`, async (t) => {
    const storage = memoryStorage({ sentinel: 'unchanged' }),
      previewStorage = memoryStorage();
    if (!course) {
      const raw = JSON.parse(
        await readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
      );
      raw.settings.turnPolicy = 'grid-center';
      previewStorage.setItem(
        'revealline.playground.current',
        JSON.stringify((await prepareScenario(raw)).scenario),
      );
    }
    const h = await soloPage(t, {
      storage,
      previewStorage,
      search: course
        ? '?course=first-flight&lesson=close-line&turn-policy=grid-center'
        : '?practice=1&revision=2',
    });
    h.$('start-button').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    frames(h, 5);
    h.$('pause-button').click();
    h.frame(0);
    const run = h.rendered.run,
      before = checkpoint(h),
      writes = storage.writes.length,
      preview = previewStorage.getItem('revealline.playground.current');
    await change(h, 'turn-select', 'immediate');
    assert.equal(
      h.$('mission-replace-confirm').textContent,
      course ? 'Prepare fresh lesson' : 'Prepare fresh attempt',
    );
    assert.match(h.$('mission-replace-status').textContent, /session-only.*not saved/);
    assert.doesNotMatch(h.$('mission-replace-status').textContent, /saved and verified/);
    preserved(h, run, before);
    assert.equal(storage.writes.length, writes);
    h.$('mission-replace-stay').click();
    assert.equal(h.$('turn-select').value, 'grid-center');
    await change(h, 'turn-select', 'immediate');
    await action(h.$('mission-replace-confirm'));
    h.frame(0);
    assert.notEqual(h.rendered.run, run);
    assert.equal(h.rendered.run.turnPolicy, 'immediate');
    assert.equal(h.rendered.run.tick, 0);
    assert.equal(h.rendered.paused, true);
    assert.equal(storage.writes.length, writes);
    assert.equal(previewStorage.getItem('revealline.playground.current'), preview);
    if (course) {
      assert.equal(h.$('class-select').disabled, true);
      const ready = h.rendered.run;
      await change(h, 'class-select', 'bomber');
      assert.equal(h.rendered.run, ready);
      assert.equal(h.rendered.run.classId, 'scout');
    }
    assert.deepEqual(h.errors, []);
  });

test('actual controller editor draft/Back and Confirm are separate from fresh-attempt confirmation', async (t) => {
  const h = await setup(t);
  await flight(h);
  const run = h.rendered.run,
    before = checkpoint(h),
    prefs = h.storage.getItem(profile);
  const pad = {
    index: 0,
    id: 'Setup editor',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  h.frame();
  h.frame();
  const set = (i, v) => (pad.buttons[i] = { pressed: v, value: v ? 1 : 0 });
  const pulse = (i) => {
    set(i, true);
    h.frame();
    set(i, false);
    h.frame();
  };
  h.$('class-select').focus();
  pulse(0);
  pulse(13);
  assert.equal(h.$('class-select').value, 'scout');
  assert.equal(h.$('mission-replace-dialog').open, false);
  pulse(1);
  assert.equal(h.$('class-select').value, 'scout');
  assert.equal(h.storage.getItem(profile), prefs);
  pulse(0);
  pulse(13);
  set(0, true);
  h.frame();
  assert.equal(h.$('mission-replace-dialog').open, true);
  assert.equal(h.doc.activeElement.id, 'mission-replace-stay');
  frames(h, 8);
  assert.equal(h.rendered.run, run);
  assert.equal(h.$('mission-replace-dialog').open, true);
  set(0, false);
  h.frame();
  await settle(() => !h.$('mission-replace-confirm').disabled);
  pulse(1);
  assert.equal(h.$('mission-replace-dialog').open, false);
  assert.equal(h.doc.activeElement.id, 'class-select');
  assert.equal(h.storage.getItem(profile), prefs);
  preserved(h, run, before);
});

test('Tactical Hangar changes active craft without changing starting identity or opening H', async (t) => {
  const h = await setup(t);
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.frame();
  const run = h.rendered.run,
    historyLength = run.classHistory.length;
  h.$('hangar-button').click();
  await change(h, 'switch-class-select', 'bomber');
  h.$('switch-class-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.frame();
  h.frame();
  assert.equal(h.rendered.run, run);
  assert.equal(run.classId, 'scout');
  assert.equal(run.activeClassId, 'bomber');
  assert.equal(run.classHistory.length, historyLength + 1);
  assert.equal(h.$('mission-replace-dialog').open, false);
  const writes = h.storage.writes.length;
  await change(h, 'class-select', 'scout');
  assert.equal(h.rendered.run, run);
  assert.equal(run.activeClassId, 'bomber');
  assert.equal(h.storage.writes.length, writes);
});

test('an actual secured capture remains stopped through setup Stay/Resume until fresh movement', async (t) => {
  const raw = JSON.parse(
    await readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
  );
  raw.level.id = 'setup-capture-stop';
  raw.level.enemies = [{ id: 'remote', type: 'bouncer', x: 60.5, y: 25.5, vx: 0, vy: 0 }];
  raw.level.goal.coverage = 0.99;
  raw.settings.turnPolicy = 'immediate';
  const previewStorage = memoryStorage({
    'revealline.playground.current': JSON.stringify((await prepareScenario(raw)).scenario),
  });
  const h = await soloPage(t, { previewStorage, search: '?practice=1&revision=2' });
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.key('ArrowDown');
  h.key('ArrowDown', false);
  let stopped = false;
  for (let i = 0; i < 900; i++) {
    h.frame();
    if (h.rendered.run.events.some((e) => e.type === 'capture.stopped')) {
      stopped = true;
      break;
    }
  }
  assert.equal(stopped, true);
  const run = h.rendered.run,
    position = [run.player.x, run.player.y];
  assert.ok(run.coverage > 0);
  assert.equal(run.status, 'running');
  await change(h, 'turn-select', 'grid-center');
  h.$('mission-replace-stay').click();
  h.$('start-button').click();
  frames(h, 30);
  assert.deepEqual([run.player.x, run.player.y], position);
  assert.equal(run.player.speed, 0);
  h.key('ArrowRight');
  h.key('ArrowRight', false);
  frames(h, 2);
  assert.ok(run.player.x > position[0]);
  assert.deepEqual(h.errors, []);
});

for (const state of ['respawning', 'lost'])
  test(`actual ${state} attempt ${state === 'respawning' ? 'requires confirmation' : 'keeps direct fresh setup'}`, async (t) => {
    const campaign = JSON.parse(
      await readFile(new URL('../content/campaign.json', import.meta.url)),
    );
    campaign.id = `setup-${state}`;
    const level = campaign.levels[0];
    level.rules = { ...level.rules, lives: state === 'lost' ? 1 : 3, respawnSeconds: 2 };
    const h = await setup(t, { campaign });
    await change(h, 'turn-select', 'immediate');
    h.$('start-button').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    h.key('ArrowDown');
    frames(h, 30);
    h.key('ArrowDown', false);
    h.key('ArrowUp');
    h.frame();
    h.key('ArrowUp', false);
    const run = h.rendered.run;
    assert.equal(run.status, state);
    await change(h, 'class-select', 'bomber');
    h.frame(0);
    if (state === 'respawning') {
      assert.equal(h.$('mission-replace-dialog').open, true);
      assert.equal(h.rendered.run, run);
      h.$('mission-replace-stay').click();
    } else {
      assert.equal(h.$('mission-replace-dialog').open, false);
      assert.notEqual(h.rendered.run, run);
      assert.equal(h.rendered.run.classId, 'bomber');
      assert.equal(h.rendered.run.tick, 0);
    }
    assert.equal(h.rendered.paused, true);
    assert.deepEqual(h.errors, []);
  });
