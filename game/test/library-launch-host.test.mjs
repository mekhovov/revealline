import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  loadLibrary,
  emptyLibrary,
  saveLibrary,
  updatePreferences,
  recordLibraryCompletion,
} from '../library.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { BoardPainter } from '../ui/render.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const source = await read('../content/campaign.json');
const campaign = {
  ...source,
  id: 'library-launch-host',
  revision: '1',
  briefs: [source.briefs[0]],
  classRecipes: await read('../content/classes.json'),
  levels: [
    {
      ...source.levels[0],
      id: 'library-launch-level',
      revision: '1',
      enemies: [],
      objectives: [],
      supplies: [],
      walls: [],
      spawn: { x: 24.5, y: 0.5 },
      width: 48,
      height: 36,
      goal: { coverage: 0.5 },
    },
  ],
};
const slot = 'revealline.suspended.dev.v1',
  profile = 'revealline.library.dev.v1';
function nativeDialogs(t) {
  const show = SoloElement.prototype.showModal,
    close = SoloElement.prototype.close,
    focus = SoloElement.prototype.focus,
    opened = [];
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    show.call(this);
    opened.push(this);
    this.querySelector('button:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    if (this.contains(this.ownerDocument.activeElement))
      this.ownerDocument.activeElement = this.ownerDocument.body;
    close.call(this);
  });
  t.mock.method(SoloElement.prototype, 'focus', function (...args) {
    const top = opened.filter((e) => e.open).at(-1);
    if (!this.closest('[hidden],[inert],dialog:not([open])') && (!top || top.contains(this)))
      focus.apply(this, args);
  });
}
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
function press(h, key) {
  const target = h.doc.activeElement,
    event = target.emit('keydown', { key, code: key, repeat: false });
  if (!event.defaultPrevented && key === 'Escape') {
    const dialog = target.closest('dialog[open]');
    if (dialog && !dialog.emit('cancel', { bubbles: false }).defaultPrevented) dialog.close();
  }
  if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'BUTTON') target.click();
  target.emit('keyup', { key, code: key });
}
function frames(h, n = 12) {
  for (let i = 0; i < n; i++) h.frame();
}
function checkpoint(h) {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
}
function fixture() {
  let library = emptyLibrary();
  // Synthetic, verified-core completion feeds the public profile writer. This
  // fixture proves navigation/difficulty identity, not a native earned picture.
  const context = createDifficultyContext(campaign, 'gentle');
  const run = createRun(context.campaign.levels[0], {
    seed: 37,
    classId: 'scout',
    classRecipes: campaign.classRecipes,
  });
  for (let i = 0; i < 3000 && run.status === 'running'; i++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won');
  library = recordLibraryCompletion(library, {
    campaign: context.campaign,
    result: getSummary(run),
    runId: 'fixture-picture',
    themeId: 'fpv',
    bodyId: 'fpv-body',
    completedAt: '2026-09-15T00:00:00.000Z',
  });
  const storage = memoryStorage();
  assert.equal(
    saveLibrary(storage, profile, updatePreferences(library, { turnPolicy: 'grid-center' })).ok,
    true,
  );
  return storage;
}
async function setup(t, options = {}) {
  nativeDialogs(t);
  t.mock.method(BoardPainter.prototype, 'drawGallery', () => {});
  const context = SoloElement.prototype.getContext;
  t.mock.method(SoloElement.prototype, 'getContext', function (...args) {
    return { ...context.apply(this, args), drawImage() {} };
  });
  return soloPage(t, { campaign, storage: fixture(), ...options });
}
async function flight(h) {
  h.change('level-select', campaign.levels[0].id);
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.key('ArrowDown');
  frames(h, 27);
  h.key('ArrowDown', false);
  h.key('ArrowRight');
  h.frame();
  h.key('ArrowRight', false);
  assert.equal(h.rendered.run.player.cutting, true);
  assert.equal(h.rendered.run.player.queuedDirection, 'right');
  h.$('pause-button').click();
  h.frame(0);
}
async function install(h) {
  h.change('pack-select', 'night-shift');
  await settle(
    () =>
      h.$('pack-select').value === 'night-shift' &&
      h.doc.body.dataset.pictureState === 'ready' &&
      !h.$('pack-select').disabled,
  );
  h.change('pack-select', '');
  await settle(
    () =>
      h.$('pack-select').value === '' &&
      h.doc.body.dataset.pictureState === 'ready' &&
      !h.$('pack-select').disabled,
  );
}
function workshop(h, panel) {
  h.$('overlay-menu').click();
  h.$('shell-workshop').click();
  h.$('shell-library').click();
  assert.equal(h.$('shell-workshop-dialog').open, true);
  h.doc.querySelector(`[data-library-panel="${panel}"]`).click();
  assert.equal(h.$('library-dialog').open, true);
}
function settingsLibrary(h, panel) {
  h.$('settings-button').click();
  h.$('settings-tab-data').click();
  const trigger = h.$(panel === 'saves' ? 'settings-saves' : 'settings-packs');
  trigger.focus();
  trigger.click();
  h.doc.querySelector(`[data-library-panel="${panel}"]`).click();
  assert.equal(h.$('settings-dialog').open, true);
  assert.equal(h.$('library-dialog').open, true);
}
async function opener(h, kind, parent = 'workshop') {
  if (kind === 'picture') {
    h.$('overlay-menu').click();
    h.$('shell-collection').click();
    await settle(() => h.$('gallery-grid').querySelector('.gallery-card'));
    const card = h.$('gallery-grid').querySelector('.gallery-card');
    await action(card);
    try {
      await settle(() => !h.$('gallery-replay').disabled);
    } catch (error) {
      error.message += h.$('gallery-view-meta').textContent;
      throw error;
    }
    h.$('gallery-replay').focus();
    return h.$('gallery-replay');
  }
  (parent === 'settings' ? settingsLibrary : workshop)(
    h,
    kind === 'installed' ? 'packs' : 'challenges',
  );
  if (kind === 'installed') {
    const play = h
      .$('installed-packs')
      .querySelectorAll('button')
      .find((e) => e.textContent.startsWith('Play '));
    assert.ok(play);
    play.focus();
    return play;
  }
  h.$('challenge-date').value = '2026-09-15';
  h.$('challenge-kind').value = 'calm';
  h.$('launch-challenge').focus();
  return h.$('launch-challenge');
}
function preserved(h, run, before, saved) {
  frames(h);
  assert.equal(h.rendered.run, run);
  assert.deepEqual(checkpoint(h), before);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.storage.getItem(slot), saved);
  assert.deepEqual(h.errors, []);
}
for (const kind of ['installed', 'challenge'])
  test(`ready ${kind} selection leaves Settings and Library without starting flight`, async (t) => {
    const h = await setup(t);
    if (kind === 'installed') await install(h);
    const trigger = await opener(h, kind, 'settings');
    await action(trigger);
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
    h.frame(0);
    assert.equal(h.$('library-dialog').open, false);
    assert.equal(h.$('settings-dialog').open, false);
    assert.equal(h.doc.activeElement.id, 'start-button');
    assert.equal(h.rendered.paused, true);
    assert.equal(h.rendered.run.tick, 0);
    assert.deepEqual(h.errors, []);
  });
test('passive Library Back returns to Settings and preserves the paused cut', async (t) => {
  const h = await setup(t);
  await flight(h);
  const run = h.rendered.run,
    before = checkpoint(h);
  settingsLibrary(h, 'packs');
  // Opening Settings may refresh the paused save; passive Back must not rewrite it.
  const saved = h.storage.getItem(slot);
  press(h, 'Escape');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.$('library-dialog').open, false);
  assert.equal(h.$('settings-dialog').open, true);
  assert.equal(h.doc.activeElement.id, 'settings-packs');
  preserved(h, run, before, saved);
});
for (const [kind, parent] of [
  ['installed', 'workshop'],
  ['challenge', 'workshop'],
  ['picture', 'workshop'],
  ['installed', 'settings'],
  ['challenge', 'settings'],
])
  test(`actual ${kind} launch from ${parent}: Stay retains exact opener/cut; explicit Replace closes owned parents and prepares without Resume`, async (t) => {
    const h = await setup(t);
    if (kind === 'installed') await install(h);
    await flight(h);
    const trigger = await opener(h, kind, parent),
      run = h.rendered.run,
      before = checkpoint(h);
    await action(trigger);
    assert.equal(h.$('mission-replace-dialog').open, true);
    assert.equal(h.doc.activeElement.id, 'mission-replace-stay');
    assert.match(h.$('mission-replace-status').textContent, /saved and verified/);
    const saved = h.storage.getItem(slot);
    preserved(h, run, before, saved);
    press(h, 'Escape');
    assert.equal(h.doc.activeElement, trigger);
    if (parent === 'settings') assert.equal(h.$('settings-dialog').open, true);
    preserved(h, run, before, saved);
    await action(trigger);
    const selectedSave = h.storage.getItem(slot);
    await action(h.$('mission-replace-confirm'));
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
    h.frame(0);
    assert.notEqual(h.rendered.run, run);
    assert.equal(h.rendered.run.tick, 0);
    assert.equal(h.rendered.paused, true);
    assert.equal(h.storage.getItem(slot), selectedSave);
    for (const id of [
      'mission-replace-dialog',
      'library-dialog',
      'collection-dialog',
      'gallery-view-dialog',
      'shell-workshop-dialog',
      'shell-home',
      'settings-dialog',
    ])
      assert.equal(h.$(id).open, false, id);
    assert.equal(h.doc.activeElement.id, 'start-button');
    if (kind === 'picture') {
      assert.equal(h.rendered.run.seed, 37);
      assert.equal(
        h.rendered.run.revision,
        createDifficultyContext(campaign, 'gentle').campaign.levels[0].revision,
      );
      assert.equal(h.rendered.run.lives, 5);
    }
    assert.deepEqual(h.errors, []);
  });
for (const kind of ['installed', 'challenge'])
  test(`${kind} same selection is inert while unfinished and while ready`, async (t) => {
    const h = await setup(t);
    if (kind === 'installed') await install(h);
    let trigger = await opener(h, kind);
    await action(trigger);
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
    h.frame(0);
    const ready = h.rendered.run;
    trigger = await opener(h, kind);
    const writes = h.storage.writes.length;
    await action(trigger);
    h.frame(0);
    assert.equal(h.rendered.run, ready);
    assert.equal(h.storage.writes.length, writes);
    assert.equal(h.$('library-dialog').open, true);
    assert.equal(h.$('mission-replace-dialog').open, false);
    h.$('library-dialog').close();
    h.$('shell-workshop-dialog').close();
    h.$('shell-home').close();
    h.$('start-button').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    frames(h, 12);
    h.$('pause-button').click();
    trigger = await opener(h, kind);
    const run = h.rendered.run,
      before = checkpoint(h),
      saved = h.storage.getItem(slot);
    await action(trigger);
    preserved(h, run, before, saved);
    assert.equal(h.$('mission-replace-dialog').open, false);
  });
for (const kind of ['challenge', 'picture'])
  test(`${kind} closed/reopened origin during retained-save waiting cannot adopt or close its successor`, async (t) => {
    const h = await setup(t);
    await flight(h);
    const trigger = await opener(h, kind),
      run = h.rendered.run,
      before = checkpoint(h),
      saved = h.storage.getItem(slot);
    let release;
    navigator.locks.request = async (_name, _options, work) => {
      await new Promise((r) => {
        release = r;
      });
      return work();
    };
    const pending = action(trigger);
    await settle(() => release);
    if (kind === 'challenge') {
      h.$('library-dialog').close();
      h.$('library-button').click();
    } else {
      h.$('gallery-view-dialog').close();
      await action(h.$('gallery-grid').querySelector('.gallery-card'));
    }
    release();
    await pending;
    await action(h.$('mission-replace-confirm'));
    preserved(h, run, before, saved);
    assert.equal(h.$(kind === 'challenge' ? 'library-dialog' : 'gallery-view-dialog').open, true);
    assert.match(h.$('mission-replace-status').textContent, /changed|choose again/);
  });
test('changed saved slot after verification requires another deliberate Replace and preserves the newer bytes', async (t) => {
  const h = await setup(t);
  await flight(h);
  const trigger = await opener(h, 'challenge');
  const run = h.rendered.run,
    before = checkpoint(h);
  await action(trigger);
  const newer = JSON.stringify({
    ...JSON.parse(h.storage.getItem(slot)),
    savedAt: '2026-09-15T23:00:00Z',
  });
  h.storage.setItem(slot, newer);
  await action(h.$('mission-replace-confirm'));
  assert.match(h.$('mission-replace-status').textContent, /changed.*Review/);
  preserved(h, run, before, newer);
  await action(h.$('mission-replace-confirm'));
  h.frame(0);
  assert.notEqual(h.rendered.run, run);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.storage.getItem(slot), newer);
});
test('unavailable saving gives truthful loss decision; Stay retains current checkpoint', async (t) => {
  const h = await setup(t);
  await flight(h);
  const trigger = await opener(h, 'challenge');
  const run = h.rendered.run,
    before = checkpoint(h),
    saved = h.storage.getItem(slot);
  t.mock.method(h.storage, 'setItem', () => {
    throw new Error('quota');
  });
  await action(trigger);
  assert.match(h.$('mission-replace-status').textContent, /not verified|unavailable/);
  assert.doesNotMatch(h.$('mission-replace-status').textContent, /saved and verified/);
  h.$('mission-replace-stay').click();
  assert.equal(h.doc.activeElement, trigger);
  preserved(h, run, before, saved);
});

for (const method of ['button', 'controller'])
  test(`${method} Stay cancels retained-save waiting; late work and other launch/setup owners stay inert`, async (t) => {
    let pad = null;
    const h = await setup(t, { readPads: () => (pad ? [pad] : []) });
    await flight(h);
    const trigger = await opener(h, 'challenge');
    const run = h.rendered.run,
      before = checkpoint(h),
      saved = h.storage.getItem(slot);
    let release;
    navigator.locks.request = async (_name, _options, work) => {
      await new Promise((r) => {
        release = r;
      });
      return work();
    };
    const pending = action(trigger);
    await settle(() => release);
    const title = h.$('mission-replace-target').textContent;
    for (const [id, value] of [
      ['class-select', 'bomber'],
      ['turn-select', 'immediate'],
      ['level-select', campaign.levels[0].id],
    ]) {
      h.$(id).value = value;
      await action(h.$(id), 'change');
    }
    await action(h.$('shell-team'));
    h.$('overlay-restart').click();
    await action(trigger);
    assert.equal(h.$('mission-replace-target').textContent, title);
    assert.equal(h.$('mode-leave-dialog').open, false);
    assert.equal(h.$('restart-dialog').open, false);
    if (method === 'button') press(h, 'Enter');
    else {
      pad = {
        index: 0,
        id: 'library-pad',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      h.frame();
      pad.buttons[1] = { pressed: true, value: 1 };
      h.frame();
      pad.buttons[1] = { pressed: false, value: 0 };
      h.frame();
    }
    release();
    await pending;
    assert.equal(h.$('mission-replace-dialog').open, false);
    assert.equal(h.doc.activeElement, trigger);
    preserved(h, run, before, saved);
  });

test('picture Replay is explicitly fresh even for the same earned selection and keeps seed/difficulty', async (t) => {
  const h = await setup(t);
  let trigger = await opener(h, 'picture');
  await action(trigger);
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  h.frame(0);
  const first = h.rendered.run;
  trigger = await opener(h, 'picture');
  await action(trigger);
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  h.frame(0);
  assert.notEqual(h.rendered.run, first);
  assert.equal(h.rendered.run.tick, 0);
  assert.equal(h.rendered.run.seed, 37);
  assert.equal(h.rendered.run.lives, 5);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.$('mission-replace-dialog').open, false);
});

test('practice challenge departure is session-only and never writes profile or suspended bytes', async (t) => {
  const { prepareScenario } = await import('../imports.mjs');
  const raw = await read('../content/scenarios/line-impact-demo.json');
  raw.settings.turnPolicy = 'grid-center';
  const previewStorage = memoryStorage({
    'revealline.playground.current': JSON.stringify((await prepareScenario(raw)).scenario),
  });
  const storage = memoryStorage({ sentinel: 'unchanged' });
  const h = await setup(t, { storage, previewStorage, search: '?practice=1&revision=2' });
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  frames(h, 5);
  h.$('pause-button').click();
  // The practice host exposes its Library shortcut, not the ordinary Workshop.
  h.$('library-button').click();
  h.doc.querySelector('[data-library-panel="challenges"]').click();
  h.$('challenge-date').value = '2026-09-15';
  h.$('challenge-kind').value = 'calm';
  const trigger = h.$('launch-challenge');
  trigger.focus();
  const run = h.rendered.run,
    before = checkpoint(h),
    writes = storage.writes.length,
    entries = [...storage.map];
  await action(trigger);
  assert.match(h.$('mission-replace-status').textContent, /session-only.*not saved/);
  h.$('mission-replace-stay').click();
  preserved(h, run, before, null);
  await action(trigger);
  await action(h.$('mission-replace-confirm'));
  h.frame(0);
  assert.notEqual(h.rendered.run, run);
  assert.equal(h.rendered.paused, true);
  assert.equal(storage.writes.length, writes);
  assert.deepEqual([...storage.map], entries);
});

test('a failure after approved selection does not claim rollback and cannot retry the partially adopted selection', async (t) => {
  const h = await setup(t);
  await flight(h);
  const trigger = await opener(h, 'challenge');
  await action(trigger);
  const saved = h.storage.getItem(slot);
  t.mock.method(BoardPainter.prototype, 'setLevel', () => {
    throw new Error('fixture paint setup failed');
  });
  await action(h.$('mission-replace-confirm'));
  assert.match(
    h.$('mission-replace-status').textContent,
    /field may have changed.*previous attempt was not restored/,
  );
  assert.equal(h.$('mission-replace-confirm').disabled, true);
  assert.equal(h.storage.getItem(slot), saved);
  h.$('mission-replace-stay').click();
  assert.equal(h.$('library-dialog').open, true);
  assert.equal(h.doc.activeElement, trigger);
});

for (const [restore, parent] of [
  ['resume-save', 'workshop'],
  ['import-save', 'workshop'],
  ['resume-save', 'settings'],
  ['import-save', 'settings'],
])
  test(`unchanged player export and ${restore} from ${parent} restore the saved cut after explicit Library selection`, async (t) => {
    const h = await setup(t);
    await flight(h);
    const trigger = await opener(h, 'challenge');
    const before = checkpoint(h);
    await action(trigger);
    const saved = h.storage.getItem(slot);
    await action(h.$('mission-replace-confirm'));
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
    (parent === 'settings' ? settingsLibrary : workshop)(h, 'saves');
    const prior = loadLibrary(h.storage, profile).library;
    await action(h.$('export-library'));
    const exported = JSON.parse(h.$('save-json').value);
    assert.deepEqual(exported.gallery, prior.gallery);
    assert.match(h.$('save-status').textContent, /Library prepared/);
    assert.equal(h.$('library-dialog').open, true);
    if (restore === 'import-save') h.$('save-json').value = saved;
    await action(h.$(restore));
    h.frame(0);
    assert.deepEqual(checkpoint(h), before);
    assert.equal(h.rendered.paused, true);
    assert.equal(h.$('library-dialog').open, false);
    assert.equal(h.$('shell-workshop-dialog').open, false);
    assert.equal(h.$('settings-dialog').open, false);
    assert.equal(h.doc.activeElement.id, 'start-button');
    assert.deepEqual(h.errors, []);
  });

for (const kind of ['challenge', 'picture'])
  for (const transition of ['blur', 'hidden', 'pagehide'])
    test(`${kind}: ${transition} retires a waiting launch without adoption or focus; a fresh foreground request works`, async (t) => {
      const h = await setup(t);
      await flight(h);
      const trigger = await opener(h, kind);
      const run = h.rendered.run,
        before = checkpoint(h),
        saved = h.storage.getItem(slot);
      let release,
        held = false;
      const originalLock = navigator.locks.request;
      navigator.locks.request = async (name, options, work) => {
        if (!held) {
          held = true;
          await new Promise((r) => {
            release = r;
          });
        }
        return originalLock(name, options, work);
      };
      const pending = action(trigger);
      await settle(() => release);
      if (transition === 'blur') {
        h.doc.focused = false;
        h.win.emit('blur');
      } else if (transition === 'hidden') {
        h.doc.hidden = true;
        h.doc.emit('visibilitychange');
      } else {
        h.doc.hidden = true;
        h.win.emit('pagehide', { persisted: true });
      }
      // A disabled or hidden page cannot authorize a new request either.
      await action(trigger);
      if (transition === 'blur') h.doc.focused = true;
      else h.doc.hidden = false;
      h.win.emit('focus');
      const selected = h.doc.activeElement;
      release();
      await pending;
      assert.equal(h.doc.activeElement, selected, 'settlement cannot reclaim focus');
      assert.equal(
        h.storage.getItem(slot) === saved,
        true,
        'late verification must not rewrite saved bytes',
      );
      if (h.$('mission-replace-dialog').open) await action(h.$('mission-replace-confirm'));
      preserved(h, run, before, saved);
      assert.equal(h.$(kind === 'challenge' ? 'library-dialog' : 'gallery-view-dialog').open, true);
      if (h.$('mission-replace-dialog').open) h.$('mission-replace-stay').click();
      trigger.focus();
      await action(trigger);
      assert.equal(h.$('mission-replace-dialog').open, true);
      assert.equal(h.$('mission-replace-confirm').disabled, false);
      assert.equal(h.doc.activeElement.id, 'mission-replace-stay');
      h.$('mission-replace-stay').click();
      assert.equal(h.doc.activeElement, trigger);
      assert.equal(h.rendered.run, run);
      assert.deepEqual(checkpoint(h), before);
      assert.equal(h.rendered.paused, true);
    });
