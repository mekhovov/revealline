import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage } from './helpers/solo-dom.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { entryScenario } from '../playground/model.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { attachControllerPracticeExit } from '../ui/controller-practice-exit.mjs';

function key(page, value, extra = {}) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value, repeat: false, ...extra });
  const dialog = target.closest('dialog[open]');
  if (!event.defaultPrevented && value === 'Enter' && target.tagName === 'BUTTON') target.click();
  if (
    !event.defaultPrevented &&
    value === 'Escape' &&
    dialog &&
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
  )
    dialog.close();
  target.emit('keyup', { key: value, code: value, ...extra });
  return event;
}
function startCut(page) {
  page.$('start-button').click();
  page.frame(16);
  page.key('ArrowDown');
  for (let n = 0; n < 8; n++) page.frame(16);
  assert.equal(page.rendered.run.player.cutting, true);
}
function unchangedPaused(page, run, checkpoint) {
  for (let n = 0; n < 8; n++) page.frame(16);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  assert.equal(page.$('game-overlay').hidden, false);
}
async function embeddedPractice(t) {
  const parentDoc = new Document(),
    parent = new Events();
  parent.location = { origin: 'http://localhost' };
  parent.postMessage = () => {}; // Only preview status transport is outside this test.
  parent.getComputedStyle = parentDoc.defaultView.getComputedStyle;
  parentDoc.defaultView = parent;
  const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url))),
    { themes } = JSON.parse(await readFile(new URL('../content/themes.json', import.meta.url))),
    scenario = entryScenario({ campaign, themes, visualOverrides: {} }),
    session = '1234567890abcdef1234567890abcdef';
  const page = await soloPage(t, {
    search: `?practice=1&controller-preview=1&controller-session=${session}`,
    parentWindow: parent,
    previewStorage: memoryStorage({ 'revealline.playground.current': JSON.stringify(scenario) }),
  });
  const frame = parentDoc.createElement('iframe'),
    mission = parentDoc.createElement('select'),
    focusGame = parentDoc.createElement('button');
  frame.id = 'game-frame';
  mission.id = 'mission';
  focusGame.id = 'focus-game';
  parentDoc.body.append(focusGame, frame, mission);
  frame.contentWindow = page.win;
  Object.assign(page.win, {
    document: page.doc,
    frameElement: frame,
    name: 'revealline-controller-practice',
    CustomEvent: class extends Event {
      constructor(type, options) {
        super(type, options);
        this.detail = options.detail;
      }
    },
  });
  parentDoc.activeElement = frame;
  // Model the browser's cross-document focus bookkeeping and window blur.
  // The real app's suspension, pause overlay, navigation and Resume are untouched.
  const originalFocus = SoloElement.prototype.focus;
  const calls = [];
  SoloElement.prototype.focus = function (...args) {
    originalFocus.apply(this, args);
    if (this.ownerDocument === page.doc && !this.disabled) {
      calls.push(this.id);
      page.doc.focused = true;
      parentDoc.activeElement = frame;
    }
  };
  t.after(() => {
    SoloElement.prototype.focus = originalFocus;
  });
  for (const target of [mission, focusGame]) {
    const nativeFocus = target.focus.bind(target);
    target.focus = () => {
      nativeFocus();
      page.doc.focused = false;
      page.win.emit('blur', { bubbles: false });
    };
  }
  let releases = 0;
  const handoff = attachControllerPracticeExit({
    frame,
    document: parentDoc,
    getSession: () => session,
    isReady: () => true,
    getTarget: (backward) => (backward ? focusGame : mission),
    releaseInputs: () => {
      releases++;
    },
  });
  t.after(() => handoff.destroy());
  return {
    page,
    parentDoc,
    frame,
    mission,
    focusGame,
    calls,
    get releases() {
      return releases;
    },
  };
}

test('repeated forced Pause keeps the chosen menu action after Settings closes', async (t) => {
  const page = await soloPage(t);
  startCut(page);
  page.$('pause-button').click();
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  page.$('shell-settings').focus();
  page.$('shell-settings').click();
  assert.equal(page.$('settings-dialog').open, true);
  page.$('settings-dialog').querySelector('[data-close]').focus();
  key(page, 'Escape');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.$('settings-dialog').open, false);
  page.$('start-button').focus();
  key(page, 'Tab');
  assert.equal(page.doc.activeElement, page.$('overlay-field-details'));
  key(page, 'Tab');
  assert.equal(page.doc.activeElement, page.$('overlay-restart'));
  // A repeated platform suspension can arrive while focus is still reported
  // inside this document. It may neutralize input, but cannot restart menu focus.
  page.win.emit('blur', { bubbles: false });
  assert.equal(page.doc.activeElement, page.$('overlay-restart'));
  unchangedPaused(page, run, checkpoint);
  assert.deepEqual(page.errors, []);
});

test('paused Controller practice exits both boundaries through the real app blur handler', async (t) => {
  const f = await embeddedPractice(t),
    { page } = f;
  startCut(page);
  page.$('pause-button').click();
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    pausedTime = run.time,
    profile = new Map(page.storage.map);
  for (const [id, backward, target] of [
    ['overlay-menu', false, f.mission],
    ['shell-menu', true, f.focusGame],
  ]) {
    page.$(id).focus();
    const event = key(page, 'Tab', { shiftKey: backward });
    assert.equal(event.defaultPrevented, true);
    assert.equal(f.parentDoc.activeElement, target, 'Child blur must not reclaim parent focus.');
    assert.equal(page.doc.hasFocus(), false);
    const focusCalls = f.calls.length;
    page.win.emit('blur', { bubbles: false });
    unchangedPaused(page, run, checkpoint);
    assert.equal(f.calls.length, focusCalls, 'Background suspension must not invoke child focus.');
    assert.equal(f.parentDoc.activeElement, target);
    assert.deepEqual(page.storage.map, profile);
  }
  assert.equal(f.releases, 2);
  page.$('start-button').focus();
  unchangedPaused(page, run, checkpoint); // Focus return never resumes.
  key(page, 'Enter');
  assert.equal(page.$('game-overlay').hidden, true);
  page.frame(16);
  page.key('ArrowDown');
  page.frame(16);
  assert.ok(run.time > pausedTime, 'Only explicit Resume permits another real tick.');
  assert.deepEqual(page.errors, []);
});

test('first iframe blur pauses a moving cut without focusing its new Resume action', async (t) => {
  const f = await embeddedPractice(t),
    { page } = f;
  startCut(page);
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    focusCalls = f.calls.length,
    profile = new Map(page.storage.map);
  f.mission.focus(); // Actual app handler, with browser foreground already false.
  assert.equal(f.parentDoc.activeElement, f.mission);
  assert.equal(f.calls.length, focusCalls);
  unchangedPaused(page, run, checkpoint);
  page.doc.hidden = true;
  page.doc.emit('visibilitychange');
  assert.equal(f.parentDoc.activeElement, f.mission);
  assert.equal(f.calls.length, focusCalls);
  page.doc.hidden = false;
  page.$('start-button').focus();
  unchangedPaused(page, run, checkpoint);
  assert.deepEqual(page.storage.map, profile);
  assert.deepEqual(page.errors, []);
});
