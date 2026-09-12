import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachControllerBoostSettings,
  renderControllerBoostCue,
} from '../ui/controller-boost-settings.mjs';

class Element extends EventTarget {
  value = '';
  hidden = true;
  writes = 0;
  text = '';
  get textContent() {
    return this.text;
  }
  set textContent(value) {
    this.text = value;
    this.writes++;
  }
  set innerHTML(_value) {
    throw new Error('Only plain text is allowed.');
  }
  choose(value) {
    this.value = value;
    this.dispatchEvent(new Event('change'));
  }
}
function setup(t, apply) {
  const select = new Element(),
    status = new Element();
  let mode = 'hold',
    calls = [];
  const ui = attachControllerBoostSettings({
    select,
    status,
    getMode: () => mode,
    applyMode(value) {
      calls.push(value);
      const outcome = apply?.(value) ?? { mode: value, ok: true };
      mode = outcome.mode;
      return outcome;
    },
  });
  t.after(() => ui.destroy());
  return {
    select,
    status,
    ui,
    calls,
    mode: () => mode,
    adopt: (value) => {
      mode = value;
    },
  };
}

test('mode selection reports the actual merged preference rather than an uncommitted request', (t) => {
  const h = setup(t, () => ({ mode: 'toggle', ok: true }));
  h.select.choose('hold');
  assert.equal(h.select.value, 'toggle');
  assert.equal(h.status.textContent, 'Controller Boost: Toggle. Saved on this device.');
  assert.deepEqual(h.calls, ['hold']);
});

test('session-only adoption remains usable and cannot inherit a previous successful save message', (t) => {
  let saved = true;
  const h = setup(t, (mode) => ({
    mode,
    ok: saved,
    warning: saved ? '' : 'Export before reloading.',
  }));
  h.select.choose('toggle');
  saved = false;
  h.select.choose('hold');
  assert.equal(h.mode(), 'hold');
  assert.match(h.status.textContent, /Hold\. Session only\. Export before reloading\./);
  assert.doesNotMatch(h.status.textContent, /Saved on this device/);
});

test('a malformed native candidate cannot call adoption or change the accepted mode', (t) => {
  const h = setup(t);
  for (const value of ['', 'Toggle', 'toggle ', null, undefined]) {
    h.select.choose(value);
    assert.equal(h.mode(), 'hold');
    assert.equal(h.select.value, 'hold');
    assert.match(h.status.textContent, /unchanged/);
  }
  assert.deepEqual(h.calls, []);
});

test('profile replacement refreshes the displayed mode without another persistence write', (t) => {
  const h = setup(t);
  h.adopt('toggle');
  h.ui.refresh();
  assert.equal(h.select.value, 'toggle');
  assert.equal(h.status.textContent, 'Controller Boost: Toggle.');
  h.adopt('hold');
  h.ui.refresh();
  assert.equal(h.select.value, 'hold');
  assert.deepEqual(h.calls, []);
});

test('a destroyed settings surface cannot adopt a late native change', (t) => {
  const h = setup(t);
  h.ui.destroy();
  h.select.choose('toggle');
  assert.equal(h.mode(), 'hold');
  assert.deepEqual(h.calls, []);
});

test('controller cue announces transitions and remaps once while repeated frames stay quiet', () => {
  const cue = new Element();
  renderControllerBoostCue(cue, { mode: 'hold', latched: false }, 'Right shoulder');
  assert.equal(cue.hidden, true);
  assert.equal(cue.writes, 0);
  for (let i = 0; i < 50; i++)
    renderControllerBoostCue(cue, { mode: 'toggle', latched: true }, 'Right shoulder', true);
  assert.equal(cue.hidden, false);
  assert.equal(cue.writes, 1);
  assert.equal(cue.textContent, 'Controller Boost on · Right shoulder to turn off');
  renderControllerBoostCue(cue, { mode: 'toggle', latched: true }, 'R1', true);
  assert.equal(cue.writes, 2);
  renderControllerBoostCue(cue, { mode: 'toggle', latched: false }, 'R1', true);
  assert.equal(cue.textContent, 'Controller Boost off · R1 to turn on');
  renderControllerBoostCue(cue, { mode: 'hold', latched: false }, 'R1');
  assert.equal(cue.hidden, true);
  assert.equal(cue.textContent, '');
});

test('unavailable Boost shows status without offering a button owned by another context', () => {
  const cue = new Element();
  renderControllerBoostCue(cue, { mode: 'toggle', latched: false }, 'South');
  assert.equal(cue.textContent, 'Controller Boost off');
  renderControllerBoostCue(cue, { mode: 'toggle', latched: false }, 'South', true);
  assert.equal(cue.textContent, 'Controller Boost off · South to turn on');
  for (let i = 0; i < 50; i++)
    renderControllerBoostCue(cue, { mode: 'toggle', latched: false }, 'South', false);
  assert.equal(cue.textContent, 'Controller Boost off');
  assert.equal(cue.writes, 3);
});
