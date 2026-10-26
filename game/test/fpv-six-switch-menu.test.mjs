import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createFlightMenuNavigation } from '../../optional-practice/civilian-fpv/input.mjs';

function fixture(t, { locale = 'en', stickMode = 2 } = {}) {
  const document = new Document(),
    root = document.createElement('section'),
    first = document.createElement('button'),
    second = document.createElement('button'),
    shortcuts = [],
    hints = [],
    frames = [];
  root.dataset.menuLayout = 'vertical';
  first.id = 'first';
  second.id = 'second';
  root.append(first, second);
  document.body.append(root);
  let context = { root, key: 'menu' },
    clicks = 0,
    backs = 0,
    escapes = 0,
    now = 0;
  first.addEventListener('click', () => clicks++);
  const radio = {
    key: 'calibrated-radio',
    index: 3,
    verified: true,
    layout: 'six-switch',
    stickMode,
    controls: { roll: 0, pitch: 0, yaw: 0, throttle: 0.8 },
    switches: {
      arm: false,
      fire: false,
      weapon: false,
      reload: false,
      payload: false,
      detonate: false,
    },
  };
  const nav = createFlightMenuNavigation({
    document,
    window: document.defaultView,
    getContext: () => context,
    locale: () => locale,
    onBack: () => backs++,
    onHint: (hint) => hints.push(hint),
    onRadioShortcut: (action, owner) => shortcuts.push({ action, owner }),
  });
  t.after(() => nav.dispose());
  const poll = (override = {}) => nav.poll({ now: (now += 20), radio, ...override });
  const cycle = (key) => {
    poll();
    radio.switches[key] = true;
    poll();
    radio.switches[key] = false;
    poll();
  };
  return {
    document,
    root,
    first,
    second,
    radio,
    nav,
    shortcuts,
    hints,
    frames,
    poll,
    cycle,
    join() {
      poll();
      cycle('fire');
      poll();
    },
    context(value) {
      context = value ? { ...context, ...value } : null;
    },
    capture() {
      context = {
        ...context,
        blockDevices: true,
        blockRadio: true,
        onCaptureBack: () => {
          escapes++;
          context = { root, key: 'returned' };
        },
      };
    },
    frame() {
      context = {
        ...context,
        frameFocused: true,
        handleFrameCommand: (value) => frames.push(value),
      };
    },
    get clicks() {
      return clicks;
    },
    get backs() {
      return backs;
    },
    get escapes() {
      return escapes;
    },
  };
}

test('six-switch menus require pickup, first Confirm joins, then fresh complete cycles act', (t) => {
  const f = fixture(t);
  f.radio.switches.fire = true;
  f.poll();
  f.radio.switches.fire = false;
  f.poll();
  assert.equal(f.nav.snapshot().device, null);
  assert.equal(f.clicks, 0);
  f.cycle('fire');
  assert.equal(f.nav.snapshot().device, 'radio');
  assert.equal(f.document.activeElement, f.first);
  assert.equal(f.clicks, 0);
  f.poll();
  f.radio.switches.fire = true;
  f.poll();
  f.poll();
  assert.equal(f.clicks, 0);
  f.radio.switches.fire = false;
  f.poll();
  assert.equal(f.clicks, 1);
  f.cycle('weapon');
  assert.equal(f.backs, 1);
});

test('all stick modes use the centering gimbal; six-switch yaw never confirms', (t) => {
  for (const stickMode of [1, 2, 3, 4]) {
    const f = fixture(t, { stickMode });
    f.join();
    const horizontal = [1, 4].includes(stickMode) ? 'yaw' : 'roll';
    f.root.dataset.menuLayout = 'horizontal';
    f.radio.controls[horizontal] = 1;
    f.poll();
    assert.equal(f.document.activeElement, f.second, `mode ${stickMode}`);
    for (let i = 0; i < 40; i++) f.poll();
    f.radio.controls[horizontal] = 0;
    f.poll();
    assert.equal(f.clicks, 0);
    assert.equal(f.backs, 0);
    assert.equal(f.radio.controls.throttle, 0.8, 'throttle does not navigate');
  }
});

test('adopted radio footer keeps its switch instructions across joined menu contexts', (t) => {
  for (const locale of ['en', 'uk']) {
    const f = fixture(t, { locale });
    f.join();
    for (const key of ['settings', 'setup', 'pause']) {
      f.context({ key });
      f.poll();
      assert.match(f.hints.at(-1), locale === 'uk' ? /Вогонь.*Зброя/ : /Fire.*Weapon/);
      assert.doesNotMatch(f.hints.at(-1), /yaw|рискання|0[.,]7/);
      assert.equal(f.nav.snapshot().device, 'radio');
    }
    f.cycle('fire');
    assert.equal(f.clicks, 1, 'changing the hint does not require another join');
  }
  const legacy = fixture(t);
  delete legacy.radio.layout;
  legacy.poll();
  assert.match(legacy.hints.at(-1), /hold yaw right/);
});

test('held switches, chords, arm transitions, disconnect and changed contexts never leak actions', (t) => {
  for (const transition of ['chord', 'arm', 'context', 'disconnect', 'stall', 'invalid']) {
    const f = fixture(t);
    f.join();
    f.radio.switches.fire = true;
    f.poll();
    if (transition === 'chord') {
      f.radio.switches.weapon = true;
      f.poll();
      f.radio.switches.weapon = false;
      f.poll();
    } else if (transition === 'arm') {
      f.radio.switches.arm = true;
      f.poll();
    } else if (transition === 'context') {
      f.context({ key: 'results' });
      f.poll();
    } else if (transition === 'disconnect') {
      f.poll({ radio: null });
      f.poll();
    } else if (transition === 'stall') {
      f.poll({ now: 5000 });
      f.poll();
    } else {
      f.radio.switches.reload = 1;
      f.poll();
      f.radio.switches.reload = false;
      f.poll();
    }
    f.radio.switches.fire = false;
    f.poll();
    assert.equal(f.clicks, 0, transition);
    assert.equal(f.backs, 0, transition);
  }
});

test('camera, retry and settings shortcuts execute on release without requiring Confirm join', (t) => {
  for (const [key, action] of [
    ['reload', 'camera'],
    ['payload', 'retry'],
    ['detonate', 'settings'],
  ]) {
    const f = fixture(t);
    f.poll();
    f.radio.switches[key] = true;
    f.poll();
    f.poll();
    assert.equal(f.shortcuts.length, 0);
    f.radio.switches[key] = false;
    f.poll();
    assert.equal(f.shortcuts[0].action, action);
    assert.equal(f.shortcuts[0].owner.root, f.root);
    assert.equal(f.nav.snapshot().device, null);
    assert.equal(f.clicks, 0);
    f.cycle('fire');
    assert.equal(f.clicks, 0, 'first Confirm still only joins the menu');
    f.cycle(key);
    assert.equal(f.shortcuts.length, 2);
    assert.equal(f.nav.snapshot().device, 'radio', 'shortcut preserves existing menu ownership');
    f.cycle('fire');
    assert.equal(f.clicks, 1, 'joined navigation continues after View without another join');
  }
});

test('capture cancel uses only a fresh known Weapon cycle despite blocked devices and deflected sticks', (t) => {
  const f = fixture(t);
  f.capture();
  f.radio.controls.pitch = 1;
  f.radio.switches.weapon = true;
  f.poll();
  f.radio.switches.weapon = false;
  f.poll();
  assert.equal(f.escapes, 0);
  f.cycle('fire');
  assert.equal(f.escapes, 0);
  f.cycle('weapon');
  assert.equal(f.escapes, 1);
  assert.equal(f.clicks, 0);
  assert.equal(f.backs, 0);
  f.poll();
  assert.equal(f.nav.snapshot().device, null);
  const blocked = fixture(t);
  blocked.capture();
  blocked.context({ captureRadioBack: false });
  blocked.cycle('weapon');
  assert.equal(blocked.escapes, 0, 'capturing Weapon itself can explicitly inhibit escape');
});

test('radio Back is available before join, and Confirm cannot follow a focus handoff while held', (t) => {
  const f = fixture(t);
  f.cycle('weapon');
  assert.equal(f.backs, 1);
  f.join();
  f.radio.switches.fire = true;
  f.poll();
  f.second.focus();
  f.radio.switches.fire = false;
  f.poll();
  assert.equal(f.clicks, 0);
  assert.equal(f.document.activeElement, f.second);
});

test('embedded frame Back is forwarded without invoking host shortcuts or flight actions', (t) => {
  const f = fixture(t);
  f.frame();
  f.cycle('weapon');
  assert.deepEqual(
    f.frames.filter((frame) => frame.source !== 'radio'),
    [{ back: true }],
  );
  assert.equal(f.frames.filter((frame) => frame.source === 'radio').length, 3);
  f.cycle('reload');
  assert.equal(f.shortcuts.length, 0);
  assert.equal(f.clicks, 0);
});

test('explicit provisional setup buttons work without axes and cannot borrow gamepad navigation', (t) => {
  const f = fixture(t);
  Object.assign(f.radio, { verified: false, provisional: true, controls: null });
  f.join();
  f.cycle('fire');
  assert.equal(f.clicks, 1);
  assert.match(
    f.hints.find((hint) => hint.startsWith('Setup buttons')),
    /Measure the sticks/,
  );
  const pad = {
    id: 'same radio',
    index: f.radio.index,
    mapping: 'standard',
    axes: [1, 1],
    buttons: Array.from({ length: 16 }, () => ({ value: 0 })),
  };
  f.poll({ gamepads: [pad] });
  assert.equal(f.document.activeElement, f.first);
  f.cycle('reload');
  assert.equal(f.shortcuts.length, 0);
  f.radio.switches.fire = true;
  f.poll();
  Object.assign(f.radio, {
    verified: true,
    provisional: false,
    controls: { roll: 0, pitch: 0, yaw: 0, throttle: 0 },
  });
  f.poll();
  f.radio.switches.fire = false;
  f.poll();
  assert.equal(f.clicks, 1, 'calibration handoff consumes the held button');
  assert.equal(f.nav.snapshot().device, null);
  const captured = fixture(t);
  Object.assign(captured.radio, { verified: false, provisional: true, controls: null });
  captured.capture();
  captured.cycle('weapon');
  assert.equal(captured.escapes, 1);
});

function fieldFixture(t, kind = 'text', options = {}) {
  const f = fixture(t, options),
    field = f.document.createElement(kind === 'textarea' || kind === 'select' ? kind : 'input');
  field.id = 'edited-value';
  field.type = kind;
  field.value = kind === 'number' ? '2' : '';
  f.root.replaceChildren(field, f.first, f.second);
  let changes = 0,
    inputs = 0;
  field.addEventListener('change', () => changes++);
  field.addEventListener('input', () => inputs++);
  f.join();
  f.cycle('fire');
  return {
    ...f,
    field,
    get changes() {
      return changes;
    },
    get inputs() {
      return inputs;
    },
  };
}

test('radio text keyboard edits only its draft, enforces bounds, commits once and cancels', (t) => {
  const f = fieldFixture(t);
  const panel = f.root.querySelector('[data-fpv-menu-editor]');
  assert.ok(panel);
  assert.equal(f.nav.snapshot().editing, f.field.id);
  f.cycle('fire'); // first highlighted letter
  assert.equal(panel.querySelector('output').textContent, 'a');
  assert.equal(f.field.value, '');
  panel.querySelector('[data-fpv-editor-key="b"]').click();
  panel.querySelector('[data-fpv-editor-action="apply"]').focus();
  f.cycle('fire');
  assert.equal(f.field.value, 'ab');
  assert.equal(f.changes, 1);
  assert.equal(f.inputs, 1);
  assert.equal(f.root.querySelector('[data-fpv-menu-editor]'), null);
  f.cycle('fire');
  f.root.querySelector('[data-fpv-editor-action="clear"]').click();
  f.cycle('weapon');
  assert.equal(f.field.value, 'ab');
  assert.equal(f.changes, 1);
  assert.equal(f.document.activeElement, f.field);
});

test('localized keyboard supports Ukrainian, Latin, multiline, maxlength and focus-loss cancellation', (t) => {
  const f = fixture(t, { locale: 'uk' }),
    field = f.document.createElement('textarea');
  Object.assign(field, { id: 'name', value: '', maxLength: 2 });
  f.root.replaceChildren(field);
  f.join();
  f.cycle('fire');
  const panel = f.root.querySelector('[data-fpv-menu-editor]');
  panel.querySelector('[data-fpv-editor-key="ї"]').click();
  panel.querySelector('[data-fpv-editor-action="newline"]').click();
  panel.querySelector('[data-fpv-editor-key="а"]').click();
  assert.equal(panel.querySelector('output').textContent, 'ї\n');
  assert.match(panel.querySelector('[role="status"]').textContent, /межі символів/);
  panel.querySelector('[data-fpv-editor-action="alphabet"]').click();
  assert.ok(panel.querySelector('[data-fpv-editor-key="a"]'));
  f.document.defaultView.emit('blur');
  assert.equal(field.value, '');
  assert.equal(f.root.querySelector('[data-fpv-menu-editor]'), null);
});

test('numeric editor provides coarse/fine steps, validates ranges and commits with one change', (t) => {
  const f = fieldFixture(t, 'number');
  Object.assign(f.field, { min: '-5', max: '5', step: '0.5' });
  const panel = f.root.querySelector('[data-fpv-menu-editor]');
  panel.querySelector('[data-fpv-editor-action="step-1"]').click();
  assert.equal(panel.querySelector('output').textContent, '2.5');
  panel.querySelector('[data-fpv-editor-action="clear"]').click();
  panel.querySelector('[data-fpv-editor-key="9"]').click();
  panel.querySelector('[data-fpv-editor-action="apply"]').click();
  assert.equal(f.field.value, '2');
  assert.equal(f.changes, 0);
  assert.match(panel.querySelector('[role="status"]').textContent, /allowed range/);
  panel.querySelector('[data-fpv-editor-action="clear"]').click();
  panel.querySelector('[data-fpv-editor-key="-"]').click();
  panel.querySelector('[data-fpv-editor-key="3"]').click();
  panel.querySelector('[data-fpv-editor-action="apply"]').click();
  assert.equal(f.field.value, '-3');
  assert.equal(f.changes, 1);
});

test('editor pointer keys preserve the draft and Tab stays inside; shortcuts cancel without changes', (t) => {
  const f = fieldFixture(t),
    panel = f.root.querySelector('[data-fpv-menu-editor]'),
    letter = panel.querySelector('[data-fpv-editor-key="b"]');
  letter.emit('pointerdown');
  letter.click();
  assert.equal(panel.querySelector('output').textContent, 'b');
  const apply = panel.querySelector('[data-fpv-editor-action="apply"]');
  apply.focus();
  apply.emit('keydown', { key: 'Tab' });
  assert.ok(panel.contains(f.document.activeElement));
  f.cycle('detonate');
  assert.equal(f.shortcuts.at(-1).action, 'settings');
  assert.equal(f.field.value, '');
  assert.equal(f.changes, 0);
  assert.equal(f.root.querySelector('[data-fpv-menu-editor]'), null);
});

test('capture Escape cannot complete across a gap, disconnect or device replacement', (t) => {
  for (const transition of ['gap', 'disconnect', 'device']) {
    const f = fixture(t);
    f.capture();
    f.poll();
    f.radio.switches.weapon = true;
    f.poll();
    if (transition === 'gap') f.poll({ now: 1000 });
    else if (transition === 'disconnect') f.poll({ radio: null });
    else {
      f.radio.key = 'another-device';
      f.poll();
    }
    f.radio.switches.weapon = false;
    f.poll();
    assert.equal(f.escapes, 0, transition);
    f.cycle('weapon');
    assert.equal(f.escapes, 1, transition);
  }
});

test('native files retain a host-gesture explanation without launching a picker', (t) => {
  const f = fieldFixture(t, 'file');
  assert.equal(f.root.querySelector('[data-fpv-menu-editor]'), null);
  assert.match(f.hints.at(-1), /external file.*click or touch/);
});

test('select and range values keep existing commit/cancel semantics through radio cycles', (t) => {
  for (const kind of ['select', 'range']) {
    const f = fixture(t),
      field = f.document.createElement(kind === 'select' ? 'select' : 'input');
    field.id = kind;
    if (kind === 'select') {
      field.options = ['a', 'b', 'c'].map((value) => ({ value }));
      Object.defineProperty(field, 'selectedOptions', {
        get: () => field.options.filter((option) => option.value === field.value),
      });
      field.value = 'a';
    } else Object.assign(field, { type: 'range', value: '2', min: '0', max: '5', step: '1' });
    f.root.replaceChildren(field);
    f.join();
    f.cycle('fire');
    f.radio.controls.roll = 1;
    f.poll();
    f.radio.controls.roll = 0;
    f.poll();
    f.cycle('weapon');
    assert.equal(field.value, kind === 'select' ? 'a' : '2');
    f.cycle('fire');
    f.radio.controls.roll = 1;
    f.poll();
    f.radio.controls.roll = 0;
    f.poll();
    f.cycle('fire');
    assert.equal(field.value, kind === 'select' ? 'b' : '3');
  }
});

test('legacy controller and calibrated yaw menus still join without activating and confirm normally', (t) => {
  const f = fixture(t);
  delete f.radio.layout;
  f.poll();
  f.radio.controls.yaw = 1;
  for (let i = 0; i < 36; i++) f.poll();
  f.radio.controls.yaw = 0;
  f.poll();
  assert.equal(f.nav.snapshot().device, 'radio');
  assert.equal(f.clicks, 0);
  f.poll();
  f.radio.controls.yaw = 1;
  for (let i = 0; i < 36; i++) f.poll();
  f.radio.controls.yaw = 0;
  f.poll();
  assert.equal(f.clicks, 1);
  const g = fixture(t),
    pad = {
      id: 'controller',
      index: 0,
      mapping: 'standard',
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, () => ({ value: 0 })),
    };
  const poll = () => g.poll({ radio: null, gamepads: [pad] });
  const confirm = () => {
    poll();
    pad.buttons[0].value = 1;
    poll();
    pad.buttons[0].value = 0;
    poll();
  };
  confirm();
  assert.equal(g.clicks, 0);
  confirm();
  assert.equal(g.clicks, 1);
});
