import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { mountModePlayShell } from '../ui/mode-play-shell.mjs';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';

function fixture(options = {}) {
  const document = new Document();
  document.documentElement.lang = 'en';
  const source = document.createElement('main');
  document.body.append(source);
  const slots = {};
  for (const name of [
    'missions',
    'briefing',
    'play',
    'settings',
    'expert',
    'help',
    'workshop',
    'results',
  ]) {
    const slot = document.createElement('section');
    slot.id = `${options.idPrefix ?? 'original'}-${name}`;
    source.append(slot);
    slots[name] = slot;
  }
  const calls = [];
  const actions = Object.fromEntries(
    ['pause', 'start', 'resume', 'retry', 'continue', 'toggleSound'].map((name) => [
      name,
      () => calls.push(name),
    ]),
  );
  const shell = mountModePlayShell({
    ...options,
    document,
    slots,
    actions: { ...actions, ...options.actions },
    services: { attachModalNavigation, ...options.services },
  });
  return { document, source, slots, calls, shell };
}

test('menus move the existing live controls and disposal restores their original identity and order', () => {
  const h = fixture();
  const before = Object.values(h.slots);
  const control = h.document.createElement('input');
  control.id = 'actual-pace';
  control.value = 'slow';
  let changes = 0;
  control.addEventListener('change', () => changes++);
  h.slots.expert.append(control);
  assert.equal(h.document.getElementById('actual-pace'), control);
  h.shell.open('expert');
  control.value = 'fast';
  control.emit('change');
  h.shell.dispose();
  assert.deepEqual(h.source.children, before);
  assert.equal(control.value, 'fast');
  assert.equal(changes, 1);
  assert.equal(h.document.querySelector('[data-mode-play-shell]'), null);
});

test('Settings, help, Back and native Escape never resume a paused attempt', async () => {
  const h = fixture({ initial: 'play', actions: { canResume: () => true } });
  h.shell.update({ phase: 'playing' });
  h.shell.openHome();
  assert.deepEqual(h.calls, ['pause']);
  assert.equal(h.shell.blocksPlay(), true);
  h.shell.elements.buttons.settings.focus();
  h.shell.elements.buttons.settings.click();
  h.shell.elements.buttons.help.focus();
  h.shell.elements.buttons.help.click();
  assert.equal(h.shell.topDialog(), h.shell.elements.dialogs.help);
  const cancel = h.shell.elements.dialogs.help.emit('cancel');
  assert.equal(cancel.defaultPrevented, true);
  await Promise.resolve();
  assert.equal(h.shell.topDialog(), h.shell.elements.dialogs.settings);
  assert.equal(h.document.activeElement, h.shell.elements.buttons.help);
  h.shell.back();
  h.shell.back();
  assert.equal(h.shell.blocksPlay(), false);
  assert.deepEqual(h.calls, ['pause']);
  h.shell.elements.buttons.pause.click();
  assert.deepEqual(h.calls, ['pause', 'resume']);
  h.shell.dispose();
});

test('explicit Start closes all preparation surfaces before the host starts its simulation', () => {
  let active;
  const calls = [];
  const h = fixture({ actions: { start: () => calls.push(active.blocksPlay()) } });
  active = h.shell;
  active.elements.buttons.missions.click();
  active.elements.buttons.review.click();
  assert.equal(active.topDialog(), active.elements.dialogs.briefing);
  active.elements.buttons.start.click();
  assert.deepEqual(calls, [false]);
  assert.equal(
    active.elements.root.dataset.phase,
    'ready',
    'Only the host accepts a running phase.',
  );
  active.dispose();
});

test('a host pause callback can reopen the shared pause surface without recursion or duplicate pause', () => {
  let shell,
    pauses = 0;
  const h = fixture({
    initial: 'play',
    actions: {
      pause: () => {
        pauses++;
        shell.open('pause');
      },
      canResume: () => true,
    },
  });
  shell = h.shell;
  shell.update({ phase: 'playing' });
  shell.openHome();
  assert.equal(pauses, 1);
  assert.equal(shell.topDialog(), shell.elements.home);
  shell.back();
  assert.equal(shell.blocksPlay(), false);
  assert.equal(pauses, 1);
  shell.dispose();
});

test('host-owned external dialogs remain the top modal and Back never closes them', () => {
  let external;
  const h = fixture({
    actions: {
      open: (surface) => {
        if (surface === 'help') {
          external.showModal();
          return false;
        }
      },
    },
  });
  external = h.document.createElement('dialog');
  external.append(h.document.createElement('button'));
  h.document.body.append(external);
  h.shell.open('help');
  assert.equal(h.shell.elements.dialogs.help.open, false);
  assert.equal(h.shell.topDialog(), external);
  assert.equal(h.shell.back(), false);
  assert.equal(external.open, true);
  h.shell.dispose();
  assert.equal(external.open, true, 'Disposal owns only the shell dialogs.');
});

test('direct-level briefing can return to Select Mission without starting and localizes in place', () => {
  const h = fixture({
    initial: 'briefing',
    modeName: (locale) => (locale === 'uk' ? 'Змійка' : 'Snake'),
  });
  h.shell.update({ missionName: { en: 'Cable Cutoff', uk: 'Перехоплення кабелем' }, muted: true });
  h.shell.setLocale('uk');
  assert.equal(h.shell.elements.header.querySelector('span').textContent, 'Змійка');
  assert.equal(h.shell.elements.buttons.missions.textContent, 'Вибрати місію');
  assert.equal(h.shell.elements.buttons.sound.textContent, 'Звук: вимкнено');
  assert.equal(
    h.shell.elements.content.briefing.querySelector('p').textContent,
    'Перехоплення кабелем',
  );
  h.shell.back();
  assert.equal(h.shell.topDialog(), h.shell.elements.dialogs.missions);
  assert.deepEqual(h.calls, []);
  h.shell.dispose();
});

test('state refresh does not reopen menus or replace full-screen service labels', () => {
  let disposed = false;
  const h = fixture({
    initial: 'play',
    services: {
      attachFullscreen: (button) => {
        button.textContent = 'Exit full screen';
        return () => {
          disposed = true;
        };
      },
    },
  });
  h.shell.update({ phase: 'playing', missionName: 'A route' });
  h.shell.update({ phase: 'results' });
  assert.equal(h.shell.blocksPlay(), false);
  assert.equal(h.shell.elements.buttons.fullscreen.textContent, 'Exit full screen');
  h.shell.dispose();
  assert.equal(disposed, true);
});

test('saved progress belongs to title Continue; ready header Pause cannot start it accidentally', () => {
  const h = fixture({ actions: { canResume: () => true } });
  assert.equal(h.shell.elements.buttons.primary.textContent, 'Continue');
  assert.equal(h.shell.elements.buttons.pause.textContent, 'Pause');
  assert.equal(h.shell.elements.buttons.pause.disabled, true);
  h.shell.elements.buttons.primary.click();
  assert.deepEqual(h.calls, ['continue']);
  h.shell.update({ phase: 'paused', missionName: 'Current mission' });
  h.shell.open('briefing');
  assert.equal(
    h.shell.elements.dialogs.briefing.querySelector('h1').textContent,
    'Current mission',
  );
  assert.equal(h.shell.elements.buttons.start.textContent, 'Resume');
  h.shell.elements.buttons.start.click();
  assert.deepEqual(h.calls, ['continue', 'resume']);
  h.shell.dispose();
});

test('a result title offers a fresh retry even if old saved progress remains available', () => {
  const h = fixture({ actions: { canResume: () => true } });
  h.shell.update({ phase: 'results' });
  assert.equal(h.shell.elements.buttons.primary.textContent, 'Retry');
  assert.equal(
    h.shell.elements.buttons['home-retry'].hidden,
    true,
    'Results has one Retry action.',
  );
  h.shell.elements.buttons.primary.click();
  assert.deepEqual(h.calls, ['retry']);
  assert.equal(h.shell.blocksPlay(), false);
  h.shell.update({ phase: 'paused' });
  h.shell.openHome();
  assert.equal(h.shell.elements.buttons.primary.textContent, 'Continue');
  assert.equal(
    h.shell.elements.buttons['home-retry'].hidden,
    false,
    'Paused attempts retain Retry.',
  );
  h.shell.dispose();
});

test('a Pause pointer press stays paused when focus loss updates host phase before click', () => {
  const h = fixture({ initial: 'play', actions: { canResume: () => true } });
  h.shell.update({ phase: 'playing' });
  const pauseButton = h.shell.elements.buttons.pause;
  pauseButton.emit('pointerdown', { pointerId: 1, button: 0, isPrimary: true });
  // Native flight-input blur owns this pause, before the browser dispatches click.
  h.shell.update({ phase: 'paused' });
  assert.equal(pauseButton.textContent, 'Resume');
  pauseButton.emit('click', { detail: 1, pointerId: 1 });
  assert.equal(h.shell.topDialog(), h.shell.elements.home);
  assert.deepEqual(h.calls, [], 'The same Pause activation must never resume.');
  h.shell.back();
  pauseButton.emit('pointerdown', { pointerId: 2, button: 0, isPrimary: true });
  pauseButton.emit('click', { detail: 1, pointerId: 2 });
  assert.deepEqual(h.calls, ['resume'], 'A fresh deliberate Resume press still resumes.');
  h.shell.dispose();
});

for (const activation of ['cancelled-pointer', 'keyboard'])
  test(`${activation} never reuses a previous pointer Pause intent`, () => {
    const h = fixture({ initial: 'play', actions: { canResume: () => true } });
    const button = h.shell.elements.buttons.pause;
    h.shell.update({ phase: 'playing' });
    button.emit('pointerdown', { pointerId: 1, button: 0, isPrimary: true });
    h.shell.update({ phase: 'paused' });
    if (activation === 'cancelled-pointer') button.emit('pointercancel', { pointerId: 1 });
    button.emit('click', { detail: activation === 'keyboard' ? 0 : 1, pointerId: 1 });
    assert.deepEqual(h.calls, ['resume']);
    assert.equal(h.shell.blocksPlay(), false);
    h.shell.dispose();
  });

test('shell action IDs never collide with same-prefix host slot IDs or their CSS selectors', () => {
  const h = fixture({ idPrefix: 'snake' });
  const ids = h.document
    .querySelectorAll('[id]')
    .map((node) => node.id)
    .filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'Every connected ID must remain unique.');
  for (const [name, slot] of Object.entries(h.slots))
    assert.equal(
      h.document.getElementById(`snake-${name}`),
      slot,
      'Host lookup still owns its slot.',
    );
  for (const [name, button] of Object.entries(h.shell.elements.buttons)) {
    assert.equal(button.id, `snake-action-${name}`);
    assert.equal(h.document.getElementById(button.id), button);
  }
  h.shell.elements.buttons.settings.click();
  assert.equal(h.shell.topDialog(), h.shell.elements.dialogs.settings);
  assert.equal(h.slots.settings.parentNode, h.shell.elements.content.settings);
  h.shell.dispose();
});

// Model the native textContent setter's Text-node replacement at the DOM
// boundary; the lightweight fixture otherwise stores text as a string.
function observeTextNode(node) {
  const native = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'textContent');
  let textNode = { nodeType: 3, data: native.get.call(node) },
    writes = 0;
  Object.defineProperty(node, 'textContent', {
    configurable: true,
    get: () => native.get.call(node),
    set(value) {
      native.set.call(node, value);
      textNode = { nodeType: 3, data: String(value) };
      writes++;
    },
  });
  return {
    get current() {
      return textNode;
    },
    get writes() {
      return writes;
    },
  };
}

test('frequent HUD refreshes preserve pressed menu Text nodes and pointer activation', () => {
  const h = fixture({ initial: 'play', actions: { canResume: () => true } });
  h.shell.update({
    phase: 'paused',
    missionName: 'Current flight',
    summary: 'Intercept the patrol.',
  });
  h.shell.openHome();
  const settings = h.shell.elements.buttons.settings;
  const watched = [
    settings,
    h.shell.elements.buttons.primary,
    h.shell.elements.buttons.pause,
    h.shell.elements.buttons.start,
    h.shell.elements.buttons.sound,
    h.shell.elements.dialogs.briefing.querySelector('h1'),
  ].map(observeTextNode);
  const originalNodes = watched.map((text) => text.current);
  settings.emit('pointerdown', { pointerId: 1, button: 0, isPrimary: true });
  for (let frame = 0; frame < 120; frame++) {
    h.shell.update({
      phase: 'paused',
      missionName: 'Current flight',
      summary: 'Intercept the patrol.',
    });
    h.shell.setLocale('en');
  }
  watched.forEach((text, index) => {
    assert.equal(text.current, originalNodes[index], 'Unchanged labels retain their Text node.');
    assert.equal(text.writes, 0);
  });
  settings.emit('pointerup', { pointerId: 1, button: 0, isPrimary: true });
  settings.emit('click', { pointerId: 1, detail: 1 });
  assert.equal(h.shell.topDialog(), h.shell.elements.dialogs.settings);
  assert.deepEqual(h.calls, []);
  h.shell.setLocale('uk');
  assert.notEqual(
    watched[0].current,
    originalNodes[0],
    'A real locale change still updates labels.',
  );
  const translated = watched[0].current;
  h.shell.setLocale('uk');
  assert.equal(watched[0].current, translated);
  h.shell.dispose();
});
