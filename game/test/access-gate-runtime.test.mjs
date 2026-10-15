import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { webcrypto, pbkdf2Sync } from 'node:crypto';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../access-gate.mjs', import.meta.url), 'utf8');
// Test credential only; the production password is neither read nor changed.
const salt = Buffer.from('password-gate-test');
const verifier = pbkdf2Sync('fixture-password', salt, 150000, 32, 'sha256').toString('base64url');
async function fixture({
  remembered = '',
  storageBlocked = false,
  crypto = webcrypto,
  missingConfig = false,
  locale = '',
  languages = ['en'],
  scriptFailure = false,
} = {}) {
  const all = [],
    started = [],
    saved = [];
  let nodes = [];
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.dataset = {};
      this.attributes = [];
      this.children = [];
      this.listeners = {};
      all.push(this);
    }
    setAttribute(name, value) {
      this.attributes = this.attributes.filter((a) => a.name !== name);
      this.attributes.push({ name, value });
      if (name === 'src') this.src = value;
    }
    hasAttribute(name) {
      return this.attributes.some((a) => a.name === name);
    }
    append(...children) {
      this.children.push(...children);
    }
    prepend(...children) {
      this.children.unshift(...children);
    }
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    }
    focus() {
      this.focused = true;
      document.activeElement = this;
    }
    remove() {
      this.removed = true;
    }
    replaceWith(script) {
      started.push(script.src || script.textContent);
      queueMicrotask(() => (scriptFailure ? script.onerror?.() : script.onload?.()));
    }
  }
  for (const [src, type, defer] of [
    ['module.mjs', 'module', false],
    ['classic.js', '', false],
    ['deferred.js', '', true],
  ]) {
    const e = new Element('script');
    e.dataset.accessType = type;
    e.setAttribute('src', src);
    if (defer) e.setAttribute('defer', '');
    nodes.push(e);
  }
  const document = {
    readyState: 'complete',
    documentElement: { dataset: { accessState: 'locked' } },
    body: new Element('body'),
    createElement: (tag) => new Element(tag),
    dispatchEvent() {},
    querySelector(selector) {
      const key = selector.match(/name="([^"]+)"/)[1];
      return {
        content: missingConfig
          ? ''
          : {
              'revealline-access-id': 'test',
              'revealline-access-title': 'Test',
              'revealline-access-salt': salt.toString('base64url'),
              'revealline-access-verifier': verifier,
            }[key],
      };
    },
    querySelectorAll() {
      return nodes;
    },
  };
  const host = {
    document,
    crypto,
    navigator: { languages },
    TextEncoder,
    Uint8Array,
    CustomEvent: class {},
    atob,
    queueMicrotask,
    localStorage: {
      getItem(key) {
        if (storageBlocked) throw Error('blocked');
        return key === 'revealline.locale.v1' ? locale : remembered;
      },
      setItem(k, v) {
        if (storageBlocked) throw Error('blocked');
        saved.push([k, v]);
      },
    },
  };
  await runInNewContext(source, host);
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  await flush();
  return {
    host,
    document,
    all,
    started,
    saved,
    flush,
    async submit(value) {
      const input = all.find((e) => e.tagName === 'input');
      input.value = value;
      await all.find((e) => e.tagName === 'form').listeners.submit({ preventDefault() {} });
      await flush();
    },
  };
}

test('fresh or invalid remembered tokens leave every application script inert', async () => {
  for (const remembered of ['', 'wrong-token']) {
    const f = await fixture({ remembered });
    assert.equal(f.document.documentElement.dataset.accessState, 'locked');
    assert.deepEqual(f.started, []);
    assert.ok(f.all.find((e) => e.tagName === 'input').focused);
  }
});
test('wrong password stays locked; successful password starts scripts once in parser order', async () => {
  const f = await fixture();
  await f.submit('wrong');
  assert.equal(f.document.documentElement.dataset.accessState, 'locked');
  assert.deepEqual(f.started, []);
  assert.equal(f.saved.length, 0);
  await f.submit('fixture-password');
  assert.equal(await f.host.RevealLineAccess.ready, true);
  assert.deepEqual(f.started, ['classic.js', 'module.mjs', 'deferred.js']);
  assert.equal(f.saved[0][1], verifier);
});
test('remembered unlock starts a direct-linked page without another prompt', async () => {
  const f = await fixture({ remembered: verifier });
  assert.equal(f.document.documentElement.dataset.accessState, 'unlocked');
  assert.ok(!f.all.some((e) => e.tagName === 'form'));
  assert.equal(f.started.length, 3);
});
test('blocked storage allows this visit only; missing crypto/config fails closed', async () => {
  const blocked = await fixture({ storageBlocked: true });
  await blocked.submit('fixture-password');
  assert.equal(blocked.document.documentElement.dataset.accessState, 'unlocked');
  assert.equal(blocked.saved.length, 0);
  for (const options of [{ crypto: {} }, { missingConfig: true }]) {
    const f = await fixture(options);
    await f.submit('fixture-password');
    assert.equal(f.document.documentElement.dataset.accessState, 'locked');
    assert.deepEqual(f.started, []);
  }
});

test('entry uses the saved language, browser fallback and English for unsupported locales', async () => {
  for (const [options, expected] of [
    [{ locale: 'uk', languages: ['en'] }, 'Потрібен пароль'],
    [{ locale: 'en', languages: ['uk-UA'] }, 'Password required'],
    [{ languages: ['fr', 'uk-UA'] }, 'Потрібен пароль'],
    [{ locale: 'invalid', languages: ['bad_locale', 'fr'] }, 'Password required'],
    [{ storageBlocked: true, languages: ['uk'] }, 'Потрібен пароль'],
  ]) {
    const f = await fixture(options);
    assert.equal(f.all.find((e) => e.id === 'access-gate-title').textContent, expected);
    assert.deepEqual(f.started, []);
    assert.deepEqual(f.saved, []);
  }
});

test('language changes translate existing errors and write only the ordinary locale preference', async () => {
  const f = await fixture();
  await f.submit('wrong');
  const language = f.all.find((e) => e.tagName === 'select');
  const input = f.all.find((e) => e.tagName === 'input');
  input.value = 'not-yet-submitted';
  language.focus();
  language.value = 'uk';
  language.listeners.change();
  assert.equal(
    f.all.find((e) => e.className === 'access-gate-status').textContent,
    'Неправильний пароль.',
  );
  assert.equal(f.all.find((e) => e.tagName === 'button').textContent, 'Розблокувати');
  assert.equal(input.value, 'not-yet-submitted');
  assert.equal(f.document.activeElement, language);
  assert.deepEqual(f.saved, [['revealline.locale.v1', 'uk']]);
  assert.deepEqual(f.started, []);
  const blocked = await fixture({ storageBlocked: true });
  const blockedLanguage = blocked.all.find((e) => e.tagName === 'select');
  blockedLanguage.value = 'uk';
  blockedLanguage.listeners.change();
  assert.equal(
    blocked.all.find((e) => e.id === 'access-gate-title').textContent,
    'Потрібен пароль',
  );
  assert.deepEqual(blocked.saved, []);
});

test('Tab and Shift-Tab reach every entry control and stay in the locked dialog', async () => {
  const f = await fixture();
  const gate = f.all.find((e) => e.id === 'access-gate');
  const language = f.all.find((e) => e.tagName === 'select');
  const input = f.all.find((e) => e.tagName === 'input');
  const button = f.all.find((e) => e.tagName === 'button');
  let prevented = 0;
  const tab = (shiftKey = false) =>
    gate.listeners.keydown({
      key: 'Tab',
      shiftKey,
      preventDefault() {
        prevented++;
      },
    });
  tab();
  assert.equal(f.document.activeElement, button);
  tab();
  assert.equal(f.document.activeElement, language);
  tab();
  assert.equal(f.document.activeElement, input);
  tab(true);
  assert.equal(f.document.activeElement, language);
  tab(true);
  assert.equal(f.document.activeElement, button);
  assert.equal(prevented, 5);
  assert.deepEqual(f.started, []);
});

test('pending verification retains focus and ignores duplicate and post-unlock submissions', async () => {
  let settle;
  let checks = 0;
  const f = await fixture({
    crypto: {
      subtle: {
        async importKey() {
          return {};
        },
        deriveBits() {
          checks++;
          return new Promise((resolve) => {
            settle = resolve;
          });
        },
      },
    },
  });
  const input = f.all.find((e) => e.tagName === 'input');
  const button = f.all.find((e) => e.tagName === 'button');
  button.focus();
  const first = f.submit('fixture-password');
  await f.flush();
  assert.equal(input.readOnly, true);
  assert.equal(f.document.activeElement, button);
  assert.equal(button.disabled, undefined);
  assert.equal(button.attributes.find((a) => a.name === 'aria-disabled').value, 'true');
  await f.submit('fixture-password');
  assert.equal(checks, 1);
  assert.deepEqual(f.started, []);
  settle(Buffer.from(verifier, 'base64url'));
  await first;
  await f.submit('fixture-password');
  assert.equal(checks, 1);
  assert.equal(f.started.length, 3);
  assert.equal(f.saved.length, 1);
});

test('late failure translates to the current language without stealing newer focus', async () => {
  let settle;
  const f = await fixture({
    crypto: {
      subtle: {
        async importKey() {
          return {};
        },
        deriveBits() {
          return new Promise((resolve) => {
            settle = resolve;
          });
        },
      },
    },
  });
  const pending = f.submit('wrong');
  await f.flush();
  const language = f.all.find((e) => e.tagName === 'select');
  language.focus();
  language.value = 'uk';
  language.listeners.change();
  assert.equal(f.all.find((e) => e.className === 'access-gate-status').textContent, 'Перевіряємо…');
  settle(new Uint8Array(32));
  await pending;
  assert.equal(f.document.activeElement, language);
  assert.equal(
    f.all.find((e) => e.className === 'access-gate-status').textContent,
    'Неправильний пароль.',
  );
  assert.deepEqual(f.started, []);
});

test('unavailable verification and post-unlock load failures have Ukrainian explanations', async () => {
  const unavailable = await fixture({ locale: 'uk', crypto: {} });
  await unavailable.submit('fixture-password');
  assert.equal(
    unavailable.all.find((e) => e.className === 'access-gate-status').textContent,
    'Захист паролем недоступний у цьому браузері.',
  );
  assert.deepEqual(unavailable.started, []);
  const failed = await fixture({ locale: 'uk', remembered: verifier, scriptFailure: true });
  assert.equal(failed.document.documentElement.dataset.accessState, 'failed');
  assert.equal(failed.started.length, 1);
  assert.match(
    failed.all.find((e) => e.id === 'access-gate').textContent,
    /Не вдалося завантажити сторінку/,
  );
});

test('a rejected crypto operation stays locked and restores an editable field for retry', async () => {
  const f = await fixture({
    locale: 'uk',
    crypto: {
      subtle: {
        async importKey() {
          throw Error('private implementation detail');
        },
      },
    },
  });
  const button = f.all.find((e) => e.tagName === 'button');
  const input = f.all.find((e) => e.tagName === 'input');
  button.focus();
  await f.submit('fixture-password');
  assert.equal(f.document.documentElement.dataset.accessState, 'locked');
  assert.deepEqual(f.started, []);
  assert.deepEqual(f.saved, []);
  assert.equal(input.readOnly, false);
  assert.equal(f.document.activeElement, input);
  assert.equal(
    f.all.find((e) => e.className === 'access-gate-status').textContent,
    'Не вдалося розблокувати застосунок. Спробуйте ще раз.',
  );
});
