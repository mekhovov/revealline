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
      queueMicrotask(() => script.onload?.());
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
    TextEncoder,
    Uint8Array,
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
