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
  loadScript = (script) => script.onload?.(),
  scripts = [
    ['module.mjs', 'module', false],
    ['classic.js', '', false],
    ['deferred.js', '', true],
  ],
} = {}) {
  const all = [],
    started = [],
    saved = [],
    activated = [];
  let reloads = 0;
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
    }
    remove() {
      this.removed = true;
    }
    replaceWith(script) {
      started.push(script.src || script.textContent);
      activated.push(script);
      queueMicrotask(() => loadScript(script));
    }
  }
  for (const [src, type, defer] of scripts) {
    const e = new Element('script');
    e.dataset.accessType = type;
    if (src) e.setAttribute('src', src);
    e.setAttribute('nonce', 'fixture-nonce');
    e.setAttribute('integrity', 'sha256-fixture');
    e.setAttribute('crossorigin', 'anonymous');
    if (defer) e.setAttribute('defer', '');
    nodes.push(e);
  }
  const document = {
    baseURI: 'https://example.test/game/studio/snake.html',
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
    TextEncoder,
    Uint8Array,
    URL,
    location: { reload: () => reloads++ },
    CustomEvent: class {},
    atob,
    queueMicrotask,
    localStorage: {
      getItem() {
        if (storageBlocked) throw Error('blocked');
        return remembered;
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
    activated,
    reloads: () => reloads,
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

test('a community document replacement initializes its own gate in the same window', async () => {
  const f = await fixture({ remembered: verifier });
  const previous = f.host.RevealLineAccess;
  await previous.scriptsReady;
  const before = f.started.length;
  // document.open/write retain the Window and Document but replace the root.
  f.document.documentElement = { dataset: { accessState: 'locked' } };
  await runInNewContext(source, f.host);
  await f.flush();
  assert.equal(f.document.documentElement.dataset.accessState, 'unlocked');
  assert.notEqual(f.host.RevealLineAccess, previous);
  assert.equal(await f.host.RevealLineAccess.scriptsReady, true);
  assert.equal(f.started.length, before + 3);
});

test('loading the gate twice for the same document root starts application scripts once', async () => {
  const f = await fixture({ remembered: verifier });
  const previous = f.host.RevealLineAccess;
  await previous.scriptsReady;
  await runInNewContext(source, f.host);
  await f.flush();
  assert.equal(f.host.RevealLineAccess, previous);
  assert.equal(f.started.length, 3);
});

test('a replaced document rechecks access instead of trusting a previous unlocked page', async () => {
  const f = await fixture({ remembered: verifier });
  await f.host.RevealLineAccess.scriptsReady;
  const before = f.started.length;
  f.host.localStorage.getItem = () => 'invalid-token';
  f.document.documentElement = { dataset: { accessState: 'locked' } };
  await runInNewContext(source, f.host);
  await f.flush();
  assert.equal(f.document.documentElement.dataset.accessState, 'locked');
  assert.equal(f.started.length, before);
  assert.ok(f.all.some((e) => e.tagName === 'form'));
});

test('a failed script identifies its ordered path and reloads only on an explicit full-page action', async () => {
  const f = await fixture({
    remembered: verifier,
    scripts: [
      ['https://user:secret@example.test/game/snake.mjs?token=private#hidden', 'module', false],
      ['classic.js', '', false],
      ['deferred.js', '', true],
    ],
    loadScript: (script) => (script.type === 'module' ? script.onerror() : script.onload()),
  });
  assert.equal(await f.host.RevealLineAccess.ready, true);
  assert.equal(f.document.documentElement.dataset.accessState, 'failed');
  assert.equal(f.started.length, 2, 'later scripts stay inert after the failure');
  const copy = f.all
    .filter((e) => e.tagName === 'p')
    .map((e) => e.textContent)
    .join(' ');
  assert.match(copy, /script 2 of 3.*\/game\/snake\.mjs/);
  assert.doesNotMatch(copy, /secret|token|private|hidden/);
  assert.ok(copy.length < 500);
  const button = f.all.find((e) => e.tagName === 'button');
  assert.equal(button.textContent, 'Reload page');
  assert.equal(button.focused, true);
  assert.equal(f.reloads(), 0);
  await runInNewContext(source, f.host);
  assert.equal(f.started.length, 2, 'loading the gate again never replays executed scripts');
  button.listeners.click();
  button.listeners.click();
  assert.equal(f.reloads(), 1);
  assert.equal(f.started.length, 2, 'recovery does not reactivate scripts in the current document');
  for (const script of f.activated) {
    assert.equal(script.async, false);
    for (const [name, value] of [
      ['nonce', 'fixture-nonce'],
      ['integrity', 'sha256-fixture'],
      ['crossorigin', 'anonymous'],
    ])
      assert.ok(script.attributes.some((a) => a.name === name && a.value === value));
  }
});

test('inline module failures have a bounded diagnostic without exposing script contents', async () => {
  const f = await fixture({
    remembered: verifier,
    scripts: [['', 'module', false]],
    loadScript: (script) => script.onerror(),
  });
  const copy = f.all
    .filter((e) => e.tagName === 'p')
    .map((e) => e.textContent)
    .join(' ');
  assert.match(copy, /script 1 of 1.*inline module/);
});

test('script diagnostics bound long paths and omit inline data or malformed URL contents', async () => {
  for (const src of [
    'https://example.test/' + 'x'.repeat(10000),
    'data:text/javascript,privateCode',
    'https://[secret',
  ]) {
    const f = await fixture({
      remembered: verifier,
      scripts: [[src, 'module', false]],
      loadScript: (script) => script.onerror(),
    });
    const copy = f.all
      .filter((e) => e.tagName === 'p')
      .map((e) => e.textContent)
      .join(' ');
    assert.ok(copy.length < 400);
    assert.doesNotMatch(copy, /privateCode|secret/);
    assert.equal(f.started.length, 1);
  }
});

test('an old document cannot continue script activation or overlay a replacement page', async () => {
  for (const outcome of ['onload', 'onerror']) {
    const f = await fixture({ remembered: verifier, loadScript: () => {} });
    assert.equal(f.started.length, 1);
    const oldScript = f.activated[0];
    f.document.documentElement = { dataset: { accessState: 'locked' } };
    f.host.localStorage.getItem = () => 'invalid-token';
    await runInNewContext(source, f.host);
    const current = f.host.RevealLineAccess;
    oldScript[outcome]();
    await f.flush();
    assert.equal(f.host.RevealLineAccess, current);
    assert.equal(f.document.documentElement.dataset.accessState, 'locked');
    assert.equal(f.started.length, 1);
    assert.equal(
      f.all.filter((e) => e.attributes.some((a) => a.name === 'role' && a.value === 'alert'))
        .length,
      0,
    );
  }
});

test('a failure reload action is retired when its document is replaced', async () => {
  const f = await fixture({ remembered: verifier, loadScript: (script) => script.onerror() });
  const button = f.all.find((e) => e.tagName === 'button');
  assert.ok(button);
  f.document.documentElement = { dataset: { accessState: 'locked' } };
  button.listeners.click();
  assert.equal(f.reloads(), 0);
});

test('an unlock completed after document replacement cannot remember or start the old page', async () => {
  let finish;
  const f = await fixture({
    crypto: {
      subtle: {
        importKey: async () => ({}),
        deriveBits: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    },
  });
  const pending = f.submit('fixture-password');
  await f.flush();
  assert.equal(typeof finish, 'function');
  f.document.documentElement = { dataset: { accessState: 'locked' } };
  finish(Buffer.from(verifier, 'base64url'));
  await pending;
  assert.equal(f.document.documentElement.dataset.accessState, 'locked');
  assert.deepEqual(f.started, []);
  assert.deepEqual(f.saved, []);
});
