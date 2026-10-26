import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountRadioSetup } from '../../optional-practice/civilian-fpv/radio-setup.mjs';
import { createRadioRuntime } from '../../optional-practice/civilian-fpv/radio-runtime.mjs';
import { defaultRadioProfile } from '../../optional-practice/civilian-fpv/radio-profile.mjs';

function fixture(t, { known = false, denyStorage = false } = {}) {
  const doc = new Document(),
    create = doc.createElement.bind(doc);
  doc.createElement = (...args) => {
    const node = create(...args);
    Object.defineProperty(node, 'firstChild', {
      get: () =>
        node._text
          ? {
              get textContent() {
                return node._text;
              },
              set textContent(value) {
                node._text = value;
              },
            }
          : (node.children[0] ?? null),
    });
    return node;
  };
  const pad = known
    ? {
        id: defaultRadioProfile().device.id,
        index: 0,
        mapping: '',
        connected: true,
        axes: [0.004, 0.004, -1, 0.004, -1, 0, 0, 0],
        buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
      }
    : {
        id: 'Oxbot RC USB JoyStick',
        index: 0,
        mapping: '',
        connected: true,
        axes: [0, 0, 0, -0.5],
        buttons: [],
      };
  const data = new Map(),
    frames = new Map();
  let time = 0,
    next = 0,
    done = 0;
  const win = Object.assign(new Events(), {
    Event,
    performance: { now: () => time },
    localStorage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        if (denyStorage) throw new Error('Storage denied');
        data.set(key, value);
      },
    },
    requestAnimationFrame: (fn) => {
      frames.set(++next, fn);
      return next;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const runtime = createRadioRuntime({ getGamepads: () => [pad] });
  const container = doc.createElement('section');
  doc.body.append(container);
  const setup = mountRadioSetup({
    container,
    window: win,
    runtime,
    onDone: () => {
      done++;
      runtime.endSetup();
    },
  });
  // The minimal DOM does not implement the browser's first-option default.
  if (!known) container.querySelector('select[aria-label="Throttle stick"]').value = 'full-travel';
  const tick = (count = 10) => {
    for (let i = 0; i < count; i++) {
      time += 100;
      const pending = [...frames.values()];
      frames.clear();
      for (const frame of pending) frame(time);
    }
  };
  const click = (text) => {
    const button = container.querySelectorAll('button').find((node) => node.textContent === text);
    assert.ok(button, text);
    assert.equal(button.disabled, false, text + ' is enabled');
    button.click();
    tick(1);
  };
  t.after(() => setup.dispose());
  return {
    pad,
    runtime,
    container,
    setup,
    tick,
    click,
    done: () => done,
    phase: () => container.querySelector('.radio-guide').dataset.radioGuidePhase,
  };
}

test('automatic calibration accepts all four sticks with a valid reduced USB range', (t) => {
  const f = fixture(t);
  f.click('Set up my sticks');
  f.tick();
  for (const [axis, positive, negative, rest] of [
    [3, 0.5, -0.5, -0.5],
    [2, 0.5, -0.5, 0],
    [1, 0.5, -0.5, 0],
    [0, 0.5, -0.5, 0],
  ]) {
    assert.equal(f.phase(), 'positive');
    f.pad.axes[axis] = positive;
    f.tick();
    assert.equal(f.phase(), 'return', 'detect positive movement on axis ' + axis);
    f.pad.axes[axis] = rest;
    f.tick();
    assert.equal(f.phase(), 'negative');
    f.pad.axes[axis] = negative;
    f.tick();
    assert.equal(f.phase(), 'return', 'detect negative movement on axis ' + axis);
    f.pad.axes[axis] = rest;
    f.tick();
  }
  f.tick();
  assert.equal(f.phase(), 'arm', f.container.querySelector('.radio-feedback').textContent);
  f.click('Keep current binding / skip');
  f.click('Keep current binding / skip');
  assert.equal(f.phase(), 'check');
});

test('known radio exposes confirmation and Save & return immediately', (t) => {
  const f = fixture(t, { known: true });
  f.container.querySelector('select').emit('change');
  f.tick();
  assert.equal(f.phase(), 'check');
  assert.equal(f.container.querySelector('.radio-confirm').hidden, false);
  const confirm = f.container.querySelector('.radio-confirm input');
  confirm.checked = true;
  confirm.emit('change');
  f.click('Save & return');
  assert.equal(f.runtime.status().verified, true);
  assert.equal(f.runtime.status().active, false);
  assert.equal(f.done(), 1);
  assert.equal(f.setup.store.snapshot().radio.verified, true);
});

test('manual Save verified profile also selects the radio in its simulator host', (t) => {
  const f = fixture(t, { known: true });
  f.click('I checked the animated sticks and their direction');
  f.click('Save verified profile');
  assert.equal(f.done(), 1, 'the host must switch input to radio after every explicit save');
});

test('optional Fire binding saves v4 without changing stick calibration and removal restores the older format', (t) => {
  const f = fixture(t, { known: true });
  const fire = f.container.querySelector('[data-radio-switch="fire"]');
  assert.ok(fire);
  const channel = fire.querySelector('input');
  channel.value = '2';
  channel.emit('change');
  f.click('I checked the animated sticks and their direction');
  f.click('Save verified profile');
  const saved = f.setup.store.snapshot().radio;
  assert.equal(saved.format, 'RadioProfile.v4');
  assert.deepEqual(saved.channels, defaultRadioProfile().channels);
  assert.deepEqual(saved.switches.fire, { button: 2, threshold: 0.5, invert: false });
  f.click('Remove Fire switch');
  f.click('I checked the animated sticks and their direction');
  f.click('Save verified profile');
  assert.equal(f.setup.store.snapshot().radio.format, 'RadioProfile.v2');
  assert.equal(Object.hasOwn(f.setup.store.snapshot().radio.switches, 'fire'), false);
});

test('manual setup is available during calibration and can save without automatic capture', (t) => {
  const f = fixture(t);
  f.click('Set up my sticks');
  f.tick();
  f.click('Set sticks manually');
  assert.equal(f.phase(), 'manual');
  assert.equal(f.setup.captureActive(), false);
  assert.equal(f.container.querySelector('.radio-extra-manual').open, true);
  const fields = f.container.querySelector('.radio-channels').children;
  for (const field of fields) {
    const inputs = field.querySelectorAll('input');
    inputs[1].value = '-0.5';
    inputs[2].value = '0';
    inputs[3].value = '0.5';
    inputs[1].emit('change');
  }
  f.click('Check my sticks');
  const confirm = f.container.querySelector('.radio-confirm input');
  confirm.checked = true;
  confirm.emit('change');
  f.click('Save & return');
  assert.equal(f.done(), 1);
  assert.equal(f.runtime.status().verified, true);
  assert.equal(f.runtime.requestArm(), true);
  f.pad.axes = [0.5, -0.5, -0.5, 0.5];
  assert.deepEqual(f.runtime.poll(), { roll: 1, pitch: -1, yaw: -1, throttle: 1 });
});

for (const [low, high, reversed] of [
  [-0.25, 0.25, false],
  [0, 1, true],
  [-1, 1, true],
]) {
  test(`wizard calibrates all axes over ${low}…${high}, reversed=${reversed}, and saves flight input`, (t) => {
    const f = fixture(t);
    const centre = (low + high) / 2,
      up = reversed ? low : high,
      down = reversed ? high : low;
    f.pad.axes = [centre, centre, centre, down];
    f.click('Set up my sticks');
    f.tick();
    for (const axis of [3, 2, 1, 0]) {
      f.pad.axes[axis] = up;
      f.tick();
      assert.equal(f.phase(), 'return');
      f.pad.axes[axis] = axis === 3 ? down : centre;
      f.tick();
      assert.equal(f.phase(), 'negative');
      f.pad.axes[axis] = down;
      f.tick();
      assert.equal(f.phase(), 'return');
      f.pad.axes[axis] = axis === 3 ? down : centre;
      f.tick();
    }
    f.tick();
    f.click('Keep current binding / skip');
    f.click('Keep current binding / skip');
    const confirm = f.container.querySelector('.radio-confirm input');
    confirm.checked = true;
    confirm.emit('change');
    f.click('Save & return');
    assert.equal(f.runtime.requestArm(), true);
    f.pad.axes = [up, down, up, up];
    assert.deepEqual(f.runtime.poll(), { roll: 1, pitch: -1, yaw: 1, throttle: 1 });
  });
}

test('calibration never guesses two moving axes and manual mode recovers after focus interruption', (t) => {
  const f = fixture(t);
  f.click('Set up my sticks');
  f.tick();
  f.pad.axes[0] = 1;
  f.pad.axes[1] = 1;
  f.tick();
  assert.equal(f.phase(), 'positive');
  f.container.ownerDocument.hidden = true;
  f.tick();
  f.container.ownerDocument.hidden = false;
  f.click('Set sticks manually');
  assert.equal(f.phase(), 'manual');
  assert.equal(f.setup.captureActive(), false);
});

test('denied storage permits an explicitly verified session and reports it before returning', (t) => {
  const f = fixture(t, { known: true, denyStorage: true });
  const confirm = f.container.querySelector('.radio-confirm input');
  confirm.checked = true;
  confirm.emit('change');
  f.click('Save & return');
  assert.equal(f.phase(), 'saved');
  assert.equal(f.done(), 0);
  assert.match(f.container.querySelector('.radio-feedback').textContent, /Session only/);
  f.click('Return to flight');
  assert.equal(f.done(), 1);
  assert.equal(f.runtime.status().verified, true);
});

test('a known radio cannot arm while its setup dialog owns the controls', (t) => {
  const f = fixture(t, { known: true });
  f.runtime.poll();
  f.pad.axes[4] = 1;
  f.runtime.poll();
  assert.equal(f.runtime.status().active, false);
  assert.equal(f.runtime.requestArm(), false);
});

test('optional Fire conflicts cannot overwrite the verified radio profile or its sticks', (t) => {
  const f = fixture(t, { known: true });
  f.click('I checked the animated sticks and their direction');
  f.click('Save verified profile');
  const saved = structuredClone(f.setup.store.snapshot().radio);
  const row = f.container.querySelector('[data-radio-switch="fire"]'),
    channel = row.querySelector('input'),
    source = row.querySelector('select');
  channel.value = '1';
  channel.emit('change');
  f.click('I checked the animated sticks and their direction');
  assert.deepEqual(f.setup.store.snapshot().radio, saved);
  assert.match(f.container.querySelector('.radio-feedback').textContent, /duplicate switch/);
  source.value = 'axis';
  source.emit('change');
  channel.value = String(saved.channels.yaw.axis);
  channel.emit('change');
  f.click('I checked the animated sticks and their direction');
  assert.deepEqual(f.setup.store.snapshot().radio, saved);
  assert.match(f.container.querySelector('.radio-feedback').textContent, /overlap/);
  channel.value = '5';
  channel.emit('change');
  f.click('I checked the animated sticks and their direction');
  f.click('Save verified profile');
  const updated = f.setup.store.snapshot().radio;
  assert.deepEqual(updated.channels, saved.channels);
  assert.deepEqual(updated.switches.arm, saved.switches.arm);
  assert.deepEqual(updated.switches.reset, saved.switches.reset);
  assert.deepEqual(updated.switches.fire, { axis: 5, off: -1, on: 1 });
});

test('action UX labels calibration separately from physical switch correctness', (t) => {
  const f = fixture(t, { known: true });
  f.container.querySelector('select').emit('change');
  f.tick();
  const saved = f.container
    .querySelectorAll('option')
    .map((node) => node.textContent)
    .join(' ');
  assert.match(saved, /sticks configured/);
  assert.doesNotMatch(saved, / · verified/);
  assert.match(f.container.textContent, /STICKS READY/);
  assert.match(
    f.container.textContent,
    /Stick calibration does not identify your intended Fire or Deploy switch/,
  );
  assert.ok(
    f.container.querySelectorAll('button').some((node) => node.textContent === 'Assign Fire gun'),
  );
  assert.equal(f.container.querySelector('.radio-confirm'), null);
});

function useActionSuggestion(f) {
  const model = f.container.querySelector('[data-radio-model]');
  const transport = f.container.querySelector('[data-radio-transport]');
  model.value = 'oxbot-r1';
  transport.value = 'oxbot-aetr';
  model.emit('change');
  f.tick();
  f.click('Apply suggested switch assignments');
}

test('action UX shows the actual payload action when the intended Fire input is misassigned', (t) => {
  const f = fixture(t, { known: true });
  useActionSuggestion(f);
  assert.match(
    f.container.querySelector('[data-six-status]').textContent,
    /Check physical switch choices/,
  );
  f.pad.buttons[0].value = 1;
  f.tick(1);
  assert.equal(
    f.container.querySelector('[data-radio-action-preview]').textContent,
    'ON now: Deploy payload',
  );
  assert.equal(f.container.querySelector('[data-six-role="fire"]').dataset.switchActive, 'false');
  assert.equal(f.container.querySelector('[data-six-role="payload"]').dataset.switchActive, 'true');
  assert.equal(f.runtime.status().active, false);
  const before = structuredClone(f.setup.store.snapshot().radio.channels);
  f.click('Swap Fire gun ↔ Deploy payload');
  assert.equal(
    f.container.querySelector('[data-radio-action-preview]').textContent,
    'ON now: Fire gun',
  );
  assert.deepEqual(f.setup.store.snapshot().radio.channels, before);
  assert.deepEqual(f.runtime.controlLayout().switches.fire, {
    button: 0,
    threshold: 0.5,
    invert: false,
  });
  assert.deepEqual(f.runtime.controlLayout().switches.payload, { axis: 5, off: -1, on: 1 });
});

test('action UX explains Fire and Deploy conflicts without overwriting assignments', (t) => {
  const f = fixture(t, { known: true });
  useActionSuggestion(f);
  const before = structuredClone(f.runtime.controlLayout());
  f.click('Assign Fire gun');
  f.tick(4);
  f.pad.buttons[0].value = 1;
  f.tick(4);
  f.pad.buttons[0].value = 0;
  f.tick(4);
  const feedback = f.container.querySelector('[data-six-status]').textContent;
  assert.match(feedback, /Fire gun: not changed/);
  assert.match(feedback, /currently activates Deploy payload/);
  assert.match(feedback, /Swap Fire gun ↔ Deploy payload/);
  assert.deepEqual(f.runtime.controlLayout(), before);
});

test('action UX preserves the session-only warning when storage is unavailable', (t) => {
  const f = fixture(t, { known: true, denyStorage: true });
  useActionSuggestion(f);
  const feedback = f.container.querySelector('[data-six-status]').textContent;
  assert.match(feedback, /Switches work for this session/);
  assert.doesNotMatch(feedback, /Assignments saved automatically/);
  assert.equal(f.runtime.status().active, false);
});

test('action UX gives a new controller a next step instead of JSON errors or false OFF status', (t) => {
  const f = fixture(t);
  f.tick();
  assert.doesNotMatch(f.container.querySelector('.radio-feedback').textContent, /JSON|finite/);
  assert.match(
    f.container.querySelector('[data-radio-action-preview]').textContent,
    /No switch actions assigned yet/,
  );
  assert.match(
    f.container.querySelector('[data-six-role="fire"]').querySelector('.radio-switch-live')
      .textContent,
    /Not assigned/,
  );
  assert.equal(f.runtime.status().active, false);
});
