import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { attachStorageRetention } from '../ui/storage-retention.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise(setImmediate);
class Element extends EventTarget {
  textContent = '';
  attributes = new Map();
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  set innerHTML(_) {
    throw new Error('Use plain text.');
  }
}
function setup(t, storage) {
  const button = new Element(),
    status = new Element();
  let open = false;
  const ui = attachStorageRetention({ button, status, navigator: { storage }, isOpen: () => open });
  t.after(() => ui.destroy());
  return {
    button,
    status,
    ui,
    open() {
      open = true;
      return ui.refresh();
    },
    close() {
      open = false;
      ui.close();
    },
    click() {
      button.dispatchEvent(new Event('click'));
    },
  };
}

test('opening checks persisted only; explicit action invokes persist synchronously with its receiver', async (t) => {
  let checks = 0,
    requests = 0,
    clicking = false;
  const storage = {
    persisted() {
      assert.equal(this, storage);
      checks++;
      return Promise.resolve(false);
    },
    persist() {
      assert.equal(this, storage);
      assert.equal(clicking, true);
      requests++;
      return Promise.resolve(true);
    },
    get estimate() {
      throw new Error('Quota is not retention authority.');
    },
  };
  const h = setup(t, storage);
  assert.equal(checks + requests, 0);
  await h.open();
  assert.equal(checks, 1);
  assert.equal(requests, 0);
  assert.match(h.status.textContent, /not enabled/);
  clicking = true;
  h.click();
  clicking = false;
  assert.equal(requests, 1);
  await flush();
  assert.match(h.status.textContent, /Retention granted/);
  assert.match(h.status.textContent, /backups/);
  assert.equal(h.button.attributes.get('aria-busy'), 'false');
});

test('existing persistent mode is reported from persisted without requesting it', async (t) => {
  let requests = 0;
  const h = setup(t, {
    persisted: async () => true,
    persist() {
      requests++;
    },
  });
  await h.open();
  assert.match(h.status.textContent, /Retention granted/);
  assert.equal(requests, 0);
});

test('denial is visible, does not retry automatically, and permits another deliberate action', async (t) => {
  let requests = 0;
  const h = setup(t, { persisted: async () => false, persist: async () => ++requests > 1 });
  await h.open();
  h.click();
  await flush();
  assert.match(h.status.textContent, /Not granted/);
  h.close();
  await h.open();
  assert.equal(requests, 1);
  h.click();
  await flush();
  assert.equal(requests, 2);
  assert.match(h.status.textContent, /Retention granted/);
});

test('unsupported methods and unavailable status stay distinct from denial or grant', async (t) => {
  for (const storage of [undefined, {}, { persisted: async () => false }]) {
    const h = setup(t, storage);
    await h.open();
    h.click();
    await flush();
    assert.match(h.status.textContent, /cannot request/);
  }
  const h = setup(t, { persist: async () => true });
  await h.open();
  assert.match(h.status.textContent, /status is unavailable/);
  h.click();
  await flush();
  assert.match(h.status.textContent, /Retention granted/);
});

test('rejected and synchronous API failures are caught without claiming denial or grant', async (t) => {
  for (const fail of [
    () => Promise.reject(new Error('blocked')),
    () => {
      throw new TypeError('disabled');
    },
  ]) {
    const h = setup(t, { persisted: fail, persist: fail });
    await h.open();
    assert.match(h.status.textContent, /Could not check/);
    h.click();
    await flush();
    assert.match(h.status.textContent, /Could not request/);
    assert.equal(h.button.attributes.get('aria-busy'), 'false');
    const partial = setup(t, { persisted: fail });
    await partial.open();
    assert.equal(partial.status.textContent, 'Could not check retention. Keep backups.');
    partial.click();
    await flush();
    assert.match(partial.status.textContent, /cannot request/);
  }
});

test('a slow status check cannot overwrite a newer granted request', async (t) => {
  const read = deferred();
  const h = setup(t, { persisted: () => read.promise, persist: async () => true });
  const checking = h.open();
  h.click();
  await flush();
  assert.match(h.status.textContent, /Retention granted/);
  read.resolve(false);
  await checking;
  assert.match(h.status.textContent, /Retention granted/);
});

test('pending browser request coalesces clicks and a reopened Settings checks its settled state', async (t) => {
  const answer = deferred();
  let requests = 0,
    retained = false,
    reads = 0;
  const h = setup(t, {
    persisted: async () => {
      reads++;
      return retained;
    },
    persist: () => {
      requests++;
      return answer.promise;
    },
  });
  await h.open();
  h.click();
  h.click();
  assert.equal(requests, 1);
  assert.match(h.status.textContent, /can close Settings/);
  assert.notEqual(h.button.disabled, true, 'Pending status keeps the actual focus target enabled.');
  h.close();
  const opening = h.open();
  h.click();
  assert.equal(requests, 1);
  assert.equal(reads, 1, 'Reopened view waits for the existing browser decision before checking.');
  retained = true;
  answer.resolve(true);
  await opening;
  assert.equal(reads, 2);
  assert.match(h.status.textContent, /Retention granted/);
});

test('late rejection after close and late grant after destroy cannot publish or request again', async (t) => {
  const answer = deferred();
  let requests = 0;
  const h = setup(t, {
    persisted: async () => false,
    persist: () => {
      requests++;
      return answer.promise;
    },
  });
  await h.open();
  h.click();
  h.close();
  const before = h.status.textContent;
  answer.reject(new Error('denied access'));
  await flush();
  assert.equal(h.status.textContent, before);
  const next = deferred();
  const g = setup(t, {
    persisted: async () => false,
    persist: () => {
      requests++;
      return next.promise;
    },
  });
  await g.open();
  g.click();
  g.ui.destroy();
  const stopped = g.status.textContent;
  next.resolve(true);
  await flush();
  g.click();
  assert.equal(g.status.textContent, stopped);
  assert.equal(requests, 2);
});

test('retention notices translate live without requesting or rechecking browser permission', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  let checks = 0,
    requests = 0;
  const gate = deferred();
  const page = setup(context, {
    persisted: async () => {
      checks++;
      return false;
    },
    persist: () => {
      requests++;
      return gate.promise;
    },
  });
  await page.open();
  setLocale('uk', { persist: false });
  assert.match(page.status.textContent, /Захист не ввімкнено/);
  assert.equal(checks, 1);
  assert.equal(requests, 0);
  page.click();
  assert.equal(requests, 1);
  setLocale('en', { persist: false });
  assert.match(page.status.textContent, /Asking the browser/);
  assert.equal(page.button.attributes.get('aria-busy'), 'true');
  assert.equal(checks, 1);
  assert.equal(requests, 1);
  gate.resolve(true);
  await flush();
  setLocale('uk', { persist: false });
  assert.match(page.status.textContent, /Захист збереження надано/);
  assert.equal(page.button.attributes.get('aria-busy'), 'false');
});
