import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createOwnedPhaserGame } from '../ui/owned-phaser-game.mjs';

function fixture({
  renderer = true,
  autoFocus = false,
  constructorStart = false,
  deferredDestroy = false,
} = {}) {
  const document = new EventTarget();
  document.hidden = false;
  const window = new EventTarget();
  document.defaultView = window;
  let focused = 0;
  window.focus = () => focused++;
  const calls = [];
  let latestGame;
  const events = {
    HIDDEN: 'hidden',
    VISIBLE: 'visible',
    BLUR: 'blur',
    FOCUS: 'focus',
    DESTROY: 'destroy',
  };
  class NativeGame {
    constructor(config) {
      latestGame = this;
      this.events = new EventEmitter();
      this.config = { autoFocus, postBoot: () => calls.push('postBoot'), ...config };
      this.renderer = renderer ? {} : null;
      this.loop = {
        start: (step) => {
          calls.push('loop');
          this.loop.active = true;
          this.callback = step;
        },
      };
      this.onHidden = () => calls.push('hidden');
      this.onVisible = () => calls.push('visible');
      this.onBlur = () => calls.push('blur');
      this.onFocus = () => calls.push('focus');
      this.step = () => {
        if (this.pendingDestroy) this.finishDestroy();
        else calls.push('step');
      };
      this.headlessStep = () => calls.push('headlessStep');
      if (constructorStart) this.start();
    }
    start() {
      throw new Error('The unowned native visibility setup must not run.');
    }
    destroy() {
      if (deferredDestroy) this.pendingDestroy = true;
      else this.finishDestroy();
    }
    finishDestroy() {
      this.pendingDestroy = false;
      this.destroyed = true;
      this.loop.active = false;
      this.events.emit(events.DESTROY);
      this.events.removeAllListeners();
    }
  }
  return {
    document,
    window,
    calls,
    focused: () => focused,
    latestGame: () => latestGame,
    Phaser: { VERSION: '4.2.1', Game: NativeGame, Core: { Events: events } },
  };
}

test('owned Phaser games remove only their lifecycle listeners and preserve the paused origin', () => {
  const f = fixture();
  const originalBlur = () => {},
    originalFocus = () => {};
  f.window.onblur = originalBlur;
  f.window.onfocus = originalFocus;
  let originalVisibilityCalls = 0;
  f.document.addEventListener('visibilitychange', () => originalVisibilityCalls++);
  for (let cycle = 0; cycle < 4; cycle++) {
    const game = createOwnedPhaserGame(f.Phaser, {}, f.document);
    game.start();
    assert.equal(game.isRunning, true);
    f.document.hidden = true;
    f.document.dispatchEvent(new Event('visibilitychange'));
    f.document.hidden = false;
    f.document.dispatchEvent(new Event('visibilitychange'));
    f.window.dispatchEvent(new Event('blur'));
    f.window.dispatchEvent(new Event('focus'));
    game.callback();
    assert.deepEqual(f.calls.slice(-7), [
      'postBoot',
      'loop',
      'hidden',
      'visible',
      'blur',
      'focus',
      'step',
    ]);
    game.destroy();
    game.destroy();
    const before = f.calls.length;
    f.document.dispatchEvent(new Event('visibilitychange'));
    f.window.dispatchEvent(new Event('blur'));
    f.window.dispatchEvent(new Event('focus'));
    assert.equal(
      f.calls.length,
      before,
      'Retired game handlers must no longer receive page events.',
    );
    assert.equal(f.window.onblur, originalBlur);
    assert.equal(f.window.onfocus, originalFocus);
  }
  assert.equal(originalVisibilityCalls, 12);
  assert.equal(f.focused(), 0);
});

test('owned Phaser setup preserves headless start, postBoot and requested focus semantics', () => {
  const f = fixture({ renderer: false, autoFocus: true });
  const game = createOwnedPhaserGame(f.Phaser, {}, f.document);
  game.start();
  game.callback();
  assert.deepEqual(f.calls, ['postBoot', 'loop', 'headlessStep']);
  assert.equal(f.focused(), 1);
  game.destroy();
});

test('partial owned Phaser startup releases page hooks and preserves the primary error', () => {
  const f = fixture({ autoFocus: true });
  const failure = new Error('focus startup failed');
  f.window.focus = () => {
    throw failure;
  };
  const game = createOwnedPhaserGame(f.Phaser, {}, f.document);
  assert.throws(
    () => game.start(),
    (error) => error === failure,
  );
  let emitted = 0;
  for (const name of ['hidden', 'visible', 'blur', 'focus']) game.events.on(name, () => emitted++);
  f.document.dispatchEvent(new Event('visibilitychange'));
  f.window.dispatchEvent(new Event('blur'));
  f.window.dispatchEvent(new Event('focus'));
  assert.equal(emitted, 0);
  assert.equal(game.events.listenerCount('destroy'), 0);
});

test('owned start semantics stay bound to the reviewed bundled Phaser 4.2.1 lifecycle', async () => {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(
    new URL('../../node_modules/phaser/src/core/Game.js', import.meta.url),
    'utf8',
  );
  const start = text.match(/^    start: function \(\)\r?\n    \{([\s\S]*?)^    \},/m)?.[1];
  assert.ok(start, 'The native start lifecycle must be explicitly reviewed if its shape changes.');
  const reviewed = `
    this.isRunning = true;
    this.config.postBoot(this);
    if (this.renderer) { this.loop.start(this.step.bind(this)); }
    else { this.loop.start(this.headlessStep.bind(this)); }
    VisibilityHandler(this);
    var eventEmitter = this.events;
    eventEmitter.on(Events.HIDDEN, this.onHidden, this);
    eventEmitter.on(Events.VISIBLE, this.onVisible, this);
    eventEmitter.on(Events.BLUR, this.onBlur, this);
    eventEmitter.on(Events.FOCUS, this.onFocus, this);
  `;
  assert.equal(start.replace(/\s+/g, ''), reviewed.replace(/\s+/g, ''));
});

test('synchronous failed construction retires its started engine before losing the Game handle', () => {
  const f = fixture({ autoFocus: true, constructorStart: true, deferredDestroy: true });
  const failure = new Error('startup interrupted');
  f.window.focus = () => {
    throw failure;
  };
  assert.throws(
    () => createOwnedPhaserGame(f.Phaser, {}, f.document),
    (error) => error === failure,
  );
  const game = f.latestGame();
  assert.equal(game.destroyed, true);
  assert.equal(game.pendingDestroy, false);
  assert.equal(game.loop.active, false);
  assert.equal(game.events.eventNames().length, 0);
});
