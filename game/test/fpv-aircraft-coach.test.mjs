import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountBeginnerCoach } from '../../optional-practice/civilian-fpv/beginner-coach.mjs';
import { BEGINNER_LESSONS } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';

function fixture(
  t,
  {
    aircraft = null,
    locale = 'en',
    lesson = BEGINNER_LESSONS[0],
    mode = 'self-level',
    modePractice = false,
    onLessonMode = null,
  } = {},
) {
  const doc = new Document();
  doc.createElementNS = (_namespace, name) => doc.createElement(name);
  const root = doc.createElement('section');
  doc.body.append(root);
  const win = new Events();
  const frames = new Map();
  const pads = [];
  const modes = [];
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
    onLessonMode: (value) => {
      modes.push(value);
      return onLessonMode?.(value);
    },
    readRadioPreview: () => radio,
  });
  t.after(() => coach.dispose());
  coach.open(lesson, { mode, modePractice, practiceAircraftName: aircraft });
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
    doc,
    modes,
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

for (const locale of ['en', 'uk'])
  test(`lesson mode choice explains unscored continuation and switches only by explicit action (${locale})`, (t) => {
    const lesson = BEGINNER_LESSONS.find((entry) => entry.id === 'beginner-43');
    const original = structuredClone(lesson);
    const h = fixture(t, { lesson, modePractice: true, locale });
    const choice = h.root.querySelector('[data-coach-action="lesson-mode"]');
    assert.match(choice.textContent, locale === 'uk' ? /заново в Acro/ : /Restart lesson in Acro/);
    assert.match(
      h.root.querySelector('[data-coach-action="start"]').textContent,
      locale === 'uk' ? /без заліку/ : /unscored/,
    );
    assert.equal(h.coach.blocksArm(), true);
    assert.deepEqual(h.modes, []);
    h.action('lesson-mode');
    assert.deepEqual(h.modes, ['acro']);
    assert.equal(h.starts(), 0, 'choosing the lesson mode never arms the old attempt');
    assert.equal(h.coach.blocksArm(), true);
    assert.deepEqual(lesson, original, 'the guide cannot change course objectives');
  });

test('lesson mode choice allows deliberate current-mode flight and preserves focus across language changes', (t) => {
  let locale = 'en';
  const h = fixture(t, { mode: 'acro', locale: () => locale });
  h.root.querySelector('[data-coach-action="lesson-mode"]').focus();
  locale = 'uk';
  h.coach.update({ mode: 'acro' });
  assert.match(h.doc.activeElement.textContent, /заново із самовирівнюванням/);
  const start = h.root.querySelector('[data-coach-action="start"]');
  assert.equal(start.textContent, 'Продовжити в Acro →');
  assert.doesNotMatch(start.textContent, /без заліку/);
  h.action('start');
  assert.equal(h.starts(), 1);
  assert.deepEqual(h.modes, []);
  assert.equal(h.coach.blocksArm(), false);
});

test('selected aircraft practice still labels an incompatible mode as unscored', (t) => {
  const h = fixture(t, {
    aircraft: 'Meteor75 custom',
    lesson: BEGINNER_LESSONS.find((entry) => entry.id === 'beginner-43'),
    modePractice: true,
  });
  assert.match(h.root.querySelector('[data-coach-action="start"]').textContent, /unscored/);
  h.action('start');
  assert.equal(h.starts(), 1);
  assert.deepEqual(h.modes, []);
  h.coach.open(BEGINNER_LESSONS[0], {
    mode: 'acro',
    modePractice: true,
    practiceAircraftName: 'Meteor75 custom',
  });
  assert.match(
    h.root.querySelector('[data-coach-action="start"]').textContent,
    /Practice with Meteor75 custom in Acro · unscored/,
  );
  assert.doesNotMatch(h.root.textContent, /Self-level practice · no score/);
});

test('lesson mode choice is absent for a matching mode and recorded playback', (t) => {
  const h = fixture(t);
  assert.equal(h.root.querySelector('[data-coach-action="lesson-mode"]'), null);
  h.coach.open(BEGINNER_LESSONS[0], { mode: 'acro', replay: true });
  h.coach.showGuide();
  assert.equal(h.root.querySelector('[data-coach-action="lesson-mode"]'), null);
  assert.equal(
    h.root.querySelector('[data-coach-action="start"]').textContent,
    'Continue playback',
  );
});

test('pending lesson mode change keeps focus and blocks duplicate changes or starting the old mode', async (t) => {
  let rejectChange;
  const pending = new Promise((_resolve, reject) => {
    rejectChange = reject;
  });
  const h = fixture(t, { mode: 'acro', onLessonMode: () => pending });
  h.root.querySelector('[data-coach-action="lesson-mode"]').focus();
  h.action('lesson-mode');
  assert.equal(h.doc.activeElement.dataset.coachAction, 'lesson-mode');
  assert.equal(h.doc.activeElement.getAttribute('aria-disabled'), 'true');
  assert.match(h.doc.activeElement.textContent, /Changing flight mode/);
  h.action('lesson-mode');
  h.action('start');
  assert.deepEqual(h.modes, ['self-level']);
  assert.equal(h.starts(), 0);
  assert.equal(h.coach.blocksArm(), true);
  rejectChange(new Error('Preparation failed'));
  await pending.catch(() => {});
  assert.equal(h.doc.activeElement.dataset.coachAction, 'lesson-mode');
  assert.equal(h.doc.activeElement.getAttribute('aria-disabled'), null);
  assert.match(h.root.textContent, /The mode could not be changed/);
  h.action('start');
  assert.equal(h.starts(), 1, 'failed preparation still permits explicit current-mode practice');
});

test('a late mode-change failure cannot replace the newly opened lesson', async (t) => {
  let rejectChange;
  const pending = new Promise((_resolve, reject) => {
    rejectChange = reject;
  });
  const h = fixture(t, { mode: 'acro', onLessonMode: () => pending });
  h.action('lesson-mode');
  h.coach.open(BEGINNER_LESSONS[0], { mode: 'self-level' });
  const start = h.root.querySelector('[data-coach-action="start"]');
  start.focus();
  rejectChange(new Error('Old preparation failed'));
  await pending.catch(() => {});
  assert.equal(h.doc.activeElement, start);
  assert.doesNotMatch(h.root.textContent, /The mode could not be changed/);
  assert.equal(h.root.querySelector('[data-coach-action="lesson-mode"]'), null);
  assert.equal(start.getAttribute('aria-disabled'), null);
  assert.equal(h.coach.blocksArm(), true);
  assert.equal(h.starts(), 0);
});

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
