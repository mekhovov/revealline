import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachFirstFlightView } from '../ui/first-flight-view.mjs';
import { FIRST_FLIGHT_LESSONS } from '../first-flight.mjs';

class Element {
  constructor(document) {
    this.document = document;
    this.listeners = new Map();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
  }
  set innerHTML(_value) {
    throw new Error('Course copy must remain text.');
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  addEventListener(type, fn) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), fn]);
  }
  removeEventListener(type, fn) {
    this.listeners.set(
      type,
      (this.listeners.get(type) || []).filter((value) => value !== fn),
    );
  }
  emit(type) {
    for (const fn of this.listeners.get(type) || []) fn({ target: this });
  }
  focus() {
    if (!this.disabled && !this.hidden) this.document.activeElement = this;
  }
}
async function setup(t) {
  const document = { activeElement: null };
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const nodes = Object.fromEntries(
    [...html.matchAll(/id="(first-flight-[^"]+)"/g)].map((match) => [
      match[1],
      new Element(document),
    ]),
  );
  document.getElementById = (id) => nodes[id];
  document.createElement = () => new Element(document);
  const calls = [];
  const view = attachFirstFlightView({
    document,
    onEnter: () => calls.push('enter'),
    onCancelEnter: () => calls.push('cancel'),
    onNext: () => calls.push('next'),
    onSkip: () => calls.push('skip'),
    onExit: () => calls.push('exit'),
    onSelect: (id) => calls.push(['select', id]),
    getControlLabels: () => ({
      directions: 'Move: I J K L',
      stop: 'Stop: <X>',
      pause: 'Pause: Escape',
    }),
  });
  t.after(() => view.destroy());
  return { view, calls, document, nodes, $: (name) => nodes[`first-flight-${name}`] };
}
function state(lessonId = 'empty-side', outcome = 'pending', phase = 'playing') {
  const lesson = FIRST_FLIGHT_LESSONS.find((item) => item.id === lessonId);
  return {
    request: { course: 'first-flight', lessonId },
    phase,
    snapshot: {
      lessonId,
      runId: 'test-attempt',
      outcome,
      available: true,
      steps: lesson.steps.map((step, index) => ({
        id: step.id,
        status: outcome === 'complete' || index === 0 ? 'complete' : 'current',
      })),
    },
    visit: { 'close-line': 'complete', 'picture-home': 'skipped' },
  };
}

test('normal entry remains explicit and pending cancellation stays inside Help', async (t) => {
  const { view, $, calls } = await setup(t);
  view.render({ entry: { available: true, helpAvailable: true } });
  assert.equal($('panel').hidden, true);
  assert.equal($('markers').hidden, true);
  $('skip').emit('click');
  $('exit').emit('click');
  $('enter').emit('pointerdown');
  assert.deepEqual(calls, []);
  $('enter').emit('click');
  assert.deepEqual(calls, ['enter']);
  view.render({
    entry: {
      available: true,
      helpAvailable: true,
      pending: true,
      message: 'Verifying the retained flight…',
    },
  });
  $('enter').emit('click');
  $('help-enter').emit('click');
  assert.deepEqual(calls, ['enter']);
  assert.equal($('entry-status').hidden, false);
  assert.equal($('entry-cancel').hidden, false);
  $('entry-cancel').emit('click');
  assert.deepEqual(calls, ['enter', 'cancel']);
  view.render({
    entry: {
      available: true,
      helpAvailable: true,
      message: 'Storage failed; your current flight remains paused.',
    },
  });
  assert.equal($('entry-cancel').hidden, true);
  assert.match($('entry-status').textContent, /remains paused/);
  assert.equal($('help-enter').disabled, false);
});

test('repeated live updates preserve native selection drafts, focus and host task content', async (t) => {
  const { view, $, document, calls } = await setup(t);
  const model = state();
  const original = JSON.stringify(model);
  $('task').textContent = 'Host-owned current instruction';
  view.render(model);
  const stepNodes = [...$('step-list').children];
  const options = [...$('select').children];
  $('select').focus();
  $('select').value = 'picture-home';
  for (let i = 0; i < 30; i++) view.render(model);
  assert.equal($('select').value, 'picture-home');
  assert.equal(document.activeElement, $('select'));
  assert.deepEqual($('step-list').children, stepNodes);
  assert.deepEqual($('select').children, options);
  assert.equal($('task').textContent, 'Host-owned current instruction');
  assert.match($('controls').textContent, /Stop: <X>/);
  $('select').emit('change');
  assert.deepEqual(calls, [['select', 'picture-home']]);
  assert.equal(JSON.stringify(model), original);
});

test('a missed example and stale lesson snapshot cannot unlock Next or erase prior visit labels', async (t) => {
  const { view, $, calls } = await setup(t);
  view.render(state('empty-side', 'missed', 'review'));
  assert.equal($('next').hidden, true);
  assert.match($('outcome').textContent, /example was not completed/);
  assert.match($('select').children[0].textContent, /completed this visit/);
  assert.match($('select').children[2].textContent, /skipped/);
  $('next').emit('click');
  $('skip').emit('click');
  assert.deepEqual(calls, ['skip']);
  const stale = state('empty-side', 'complete', 'review');
  stale.snapshot.lessonId = 'close-line';
  view.render(stale);
  assert.equal($('next').hidden, true);
  view.render(state('empty-side', 'complete', 'review'));
  assert.equal($('next').hidden, false);
  $('next').emit('click');
  assert.deepEqual(calls, ['skip', 'next']);
});

test('lesson changes replace finite markers, keep geometry within the board and hide at results', async (t) => {
  const { view, $ } = await setup(t);
  for (const lesson of FIRST_FLIGHT_LESSONS) {
    view.render(state(lesson.id));
    assert.equal($('markers').hidden, false);
    assert.equal($('markers').children.length, lesson.markers.length);
    for (const node of $('markers').children) {
      assert.ok(Number.parseFloat(node.style.left) >= 0);
      assert.ok(Number.parseFloat(node.style.top) >= 0);
      assert.ok(
        Number.parseFloat(node.style.left) + Number.parseFloat(node.style.width) <= 100 + 1e-9,
      );
      assert.ok(
        Number.parseFloat(node.style.top) + Number.parseFloat(node.style.height) <= 100 + 1e-9,
      );
      assert.ok(node.children[0].textContent.length > 0);
    }
  }
  view.render(state('picture-home', 'complete', 'review'));
  assert.equal($('markers').hidden, true);
  assert.equal($('next').hidden, true);
  assert.equal($('exit').textContent, 'Return to the game');
  view.render({ ...state('picture-home'), embedded: true });
  assert.equal($('exit').textContent, 'End course');
});

test('switching, leaving, ended and destroyed views never invoke disabled course commands', async (t) => {
  const { view, $, calls } = await setup(t);
  for (const phase of ['switching', 'leaving', 'ended']) {
    view.render({ ...state(), phase, embedded: true });
    for (const name of ['next', 'skip', 'exit']) $(name).emit('click');
    $('select').emit('change');
  }
  assert.deepEqual(calls, []);
  assert.match($('outcome').textContent, /parent page/);
  view.render(state());
  $('select').value = '__proto__';
  $('select').emit('change');
  assert.equal($('select').value, 'empty-side');
  assert.deepEqual(calls, []);
  view.destroy();
  $('skip').emit('click');
  view.render(state('close-line'));
  assert.equal($('select').value, 'empty-side');
  assert.deepEqual(calls, []);
});
