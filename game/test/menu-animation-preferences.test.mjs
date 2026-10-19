import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MENU_ANIMATION_KEY,
  getMenuAnimation,
  setMenuAnimation,
  subscribeMenuAnimation,
  menuAnimationBinding,
} from '../ui/menu-animation-preferences.mjs';

function fixture(raw = 'on') {
  const win = new EventTarget(),
    data = new Map([[MENU_ANIMATION_KEY, raw]]),
    writes = [];
  win.CustomEvent = CustomEvent;
  win.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value]);
      data.set(key, value);
    },
  };
  const binding = menuAnimationBinding(win);
  return {
    win,
    data,
    writes,
    binding,
    event(type = 'storage', details = {}) {
      win.dispatchEvent(
        Object.assign(new Event(type), {
          key: MENU_ANIMATION_KEY,
          storageArea: win.localStorage,
          ...details,
        }),
      );
    },
  };
}

test('menu motion reads never write or claim a save', () => {
  const f = fixture('off'),
    seen = [],
    off = subscribeMenuAnimation((value) => seen.push(value), f.win);
  assert.equal(getMenuAnimation(f.win), false);
  assert.deepEqual(f.binding.persistence(), { status: 'idle', reason: '' });
  assert.equal(f.binding.feedback().text, '');
  assert.deepEqual(f.writes, []);
  off();
  setMenuAnimation(true, f.win);
  assert.deepEqual(seen, [false]);
});

for (const name of ['QuotaExceededError', 'SecurityError', 'silent'])
  test(`menu motion keeps the explicit choice through ${name}, remote events and restoration until Retry saves`, () => {
    const f = fixture(),
      seen = [],
      write = f.win.localStorage.setItem;
    const off = subscribeMenuAnimation((value) => seen.push(value), f.win);
    f.win.localStorage.setItem = () => {
      if (name !== 'silent') throw new DOMException('Modeled failure', name);
    };
    setMenuAnimation(false, f.win);
    assert.equal(getMenuAnimation(f.win), false);
    assert.equal(seen.at(-1), false);
    assert.deepEqual(f.binding.persistence(), {
      status: 'session',
      reason:
        name === 'QuotaExceededError'
          ? 'full'
          : name === 'SecurityError'
            ? 'blocked'
            : 'unconfirmed',
    });
    assert.equal(f.binding.feedback('uk').retry, true);
    assert.match(f.binding.feedback('uk').text, /Лише в цьому сеансі/);
    f.data.set(MENU_ANIMATION_KEY, 'on');
    f.event();
    f.event('pageshow', { persisted: true });
    assert.equal(getMenuAnimation(f.win), false);
    f.win.localStorage.setItem = write;
    f.binding.retry();
    assert.equal(f.data.get(MENU_ANIMATION_KEY), 'off');
    assert.deepEqual(f.binding.persistence(), { status: 'saved', reason: '' });
    assert.equal(f.binding.feedback('uk').text, 'Збережено');
    f.data.set(MENU_ANIMATION_KEY, 'on');
    f.event();
    assert.equal(getMenuAnimation(f.win), true);
    assert.deepEqual(f.binding.persistence(), { status: 'idle', reason: '' });
    off();
  });

test('an unreadable verification keeps session intent; a later explicit Retry clears the real reason', () => {
  const f = fixture(),
    read = f.win.localStorage.getItem;
  f.win.localStorage.getItem = () => {
    throw new Error('Read failed');
  };
  f.binding.set(false);
  assert.equal(f.binding.get(), false);
  assert.deepEqual(f.binding.persistence(), { status: 'session', reason: 'verify' });
  f.win.localStorage.getItem = read;
  f.binding.retry();
  assert.equal(f.binding.feedback().text, 'Saved');
});

for (const phase of ['write', 'verify'])
  test(`a newer menu choice during ${phase} cannot be acknowledged by the older save`, () => {
    const f = fixture(),
      storage = f.win.localStorage,
      write = storage.setItem,
      read = storage.getItem;
    const newer = () => {
      storage.setItem = write;
      storage.getItem = read;
      f.binding.set(true);
    };
    if (phase === 'write')
      storage.setItem = (key, value) => {
        write(key, value);
        newer();
      };
    else
      storage.getItem = (key) => {
        const value = read(key);
        newer();
        return value;
      };
    f.binding.set(false);
    assert.equal(f.binding.get(), true);
    assert.equal(f.binding.persistence().status, 'session');
    assert.equal(f.data.get(MENU_ANIMATION_KEY), 'off');
    f.binding.retry();
    assert.equal(f.data.get(MENU_ANIMATION_KEY), 'on');
    assert.equal(f.binding.persistence().status, 'saved');
  });

test('a newer explicit intent during a storage read cannot be replaced by the captured old value', () => {
  const f = fixture('off'),
    read = f.win.localStorage.getItem;
  f.win.localStorage.getItem = (key) => {
    const value = read(key);
    f.win.localStorage.getItem = read;
    f.binding.set(true);
    return value;
  };
  assert.equal(f.binding.get(), true);
  assert.equal(f.data.get(MENU_ANIMATION_KEY), 'on');
});

test('the projected SIM menu owner also keeps failed local intent and verifies Retry', async () => {
  const { simMenuAnimationBinding } = await import(
    '../../optional-practice/civilian-fpv/flight-fullscreen.mjs'
  );
  const f = fixture(),
    binding = simMenuAnimationBinding(f.win),
    write = f.win.localStorage.setItem;
  f.win.localStorage.setItem = () => {};
  binding.set(false);
  f.event();
  assert.equal(binding.get(), false);
  assert.equal(binding.feedback().retry, true);
  f.win.localStorage.setItem = write;
  binding.retry();
  assert.equal(f.data.get(MENU_ANIMATION_KEY), 'off');
  assert.equal(binding.feedback().text, 'Saved');
});
