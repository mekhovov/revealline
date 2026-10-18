import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountBeginnerCoach } from '../../optional-practice/civilian-fpv/beginner-coach.mjs';
import { BEGINNER_LESSONS } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';

function fixture(t, { aircraft = null, locale = 'en' } = {}) {
  const doc = new Document();
  doc.createElementNS = (_namespace, name) => doc.createElement(name);
  const root = doc.createElement('section');
  doc.body.append(root);
  const win = new Events();
  const frames = new Map();
  const pads = [];
  let nextFrame = 0,
    now = 0,
    starts = 0;
  let radio = { verified: true, index: 1, controls: { roll: 0, pitch: 0, yaw: 0, throttle: 0 } };
  Object.assign(win, {
    performance: { now: () => now },
    navigator: { getGamepads: () => pads },
    requestAnimationFrame(callback) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  const coach = mountBeginnerCoach({
    root,
    window: win,
    locale,
    onStart() {
      starts++;
    },
    readRadioPreview: () => radio,
  });
  t.after(() => coach.dispose());
  coach.open(BEGINNER_LESSONS[0], { mode: 'self-level', practiceAircraftName: aircraft });
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      now += 20;
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback(now);
      }
    }
  };
  return {
    root,
    win,
    coach,
    pads,
    tick,
    starts: () => starts,
    setRadio(value) {
      radio = { ...radio, controls: value };
    },
    action(name) {
      root.querySelector(`[data-coach-action="${name}"]`).click();
    },
  };
}

for (const source of ['keyboard', 'touch', 'controller', 'radio']) {
  test(`selected aircraft lesson keeps ${source} out of the reference example until explicit practice`, (t) => {
    const h = fixture(t, { aircraft: 'Meteor75 custom' });
    assert.match(h.root.textContent, /REFERENCE AIRCRAFT · WATCH ONLY/);
    assert.match(h.root.textContent, /Practice with Meteor75 custom/);
    assert.equal(h.root.querySelector('[data-coach-action="lab-immersive"]'), null);
    assert.equal(h.root.querySelector('.coach-lab-touch-controls'), null);
    h.action('lab-play');
    if (source === 'keyboard') {
      const drawing = h.root.querySelector('.coach-lab-drawing');
      drawing.focus();
      h.win.emit('keydown', { target: drawing, code: 'KeyW', key: 'w' });
      h.win.emit('keydown', { target: drawing, code: 'ArrowRight', key: 'ArrowRight' });
    } else if (source === 'touch') {
      const gimbal = h.root.querySelector('.coach-stick-pad');
      gimbal.emit('pointerdown', { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
      gimbal.emit('pointermove', { pointerId: 1, clientX: 90, clientY: 10 });
    } else if (source === 'controller') {
      h.pads.push({
        id: 'Standard pad',
        index: 0,
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      });
      h.tick(20);
      h.pads[0].axes = [0.5, -0.8, 0.8, 0.5];
    } else {
      h.coach.update({ radioAvailable: true, radioIndex: 1 });
      h.setRadio({ roll: 0.8, pitch: 0.5, yaw: 0.4, throttle: 0.7 });
      h.coach.update({ radioAvailable: true, radioIndex: 1 });
    }
    h.tick(30);
    assert.equal(h.coach.previewSnapshot().mode, 'example');
    assert.equal(h.coach.previewSource(), null);
    assert.equal(h.starts(), 0, 'moving input must never arm the prepared aircraft');
    assert.equal(h.coach.blocksArm(), true);
    h.action('lab-reset');
    assert.equal(h.coach.previewSnapshot().mode, 'example');
    h.action('start');
    assert.equal(h.starts(), 1);
    assert.equal(h.coach.blocksArm(), false);
    assert.equal(h.coach.previewRunning(), false);
  });
}

test('legacy learning keeps its existing interactive control lab', (t) => {
  const h = fixture(t);
  assert.ok(h.root.querySelector('[data-coach-action="lab-immersive"]'));
  assert.ok(h.root.querySelector('.coach-lab-touch-controls'));
  h.action('lab-play');
  const drawing = h.root.querySelector('.coach-lab-drawing');
  drawing.focus();
  h.win.emit('keydown', { target: drawing, code: 'KeyW', key: 'w' });
  assert.equal(h.coach.previewSnapshot().mode, 'try');
  assert.equal(h.coach.previewSource(), 'keyboard');
  assert.equal(h.starts(), 0);
});

test('selected-aircraft lesson explains the reference preview in Ukrainian', (t) => {
  const h = fixture(t, { aircraft: 'Meteor75 custom', locale: 'uk' });
  assert.match(h.root.textContent, /НАВЧАЛЬНИЙ ДРОН · ЛИШЕ ПЕРЕГЛЯД/);
  assert.match(h.root.textContent, /Практика з Meteor75 custom/);
  assert.match(h.root.textContent, /Рухи керування тут не запускають політ/);
});
