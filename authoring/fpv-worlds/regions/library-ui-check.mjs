import { mountRegionalLibrary } from '../../../optional-practice/civilian-fpv/regional-library.mjs';
const hash = 'a'.repeat(64),
  descriptor = {
    id: 'fixture-region',
    revision: 'r1',
    title: { en: 'Fixture region', uk: 'Тестовий регіон' },
  };
const pin = { url: 'https://example.invalid/delivery.json', bytes: 100, sha256: hash };
const row = { id: descriptor.id, title: descriptor.title, pin };
const record = {
  id: descriptor.id,
  sha256: hash,
  active: true,
  generation: 1,
  descriptor,
  bytes: 1000,
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
async function settled() {
  for (let i = 0; i < 8; i++) await turn();
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
document.getElementById('run').onclick = async () => {
  const button = document.getElementById('run'),
    output = document.getElementById('result'),
    fixture = document.getElementById('fixture');
  button.disabled = true;
  fixture.replaceChildren();
  let stored = [],
    flights = 0,
    delayedLoad = null,
    delayedHost = null,
    delayedCommit = null,
    delayedTransfer = null,
    locale = 'en',
    removedGeneration = null;
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const parent = el('div');
  fixture.append(parent);
  let simulatedTime = 0,
    timerId = 0;
  const timers = new Map();
  const fixtureWindow = {
    indexedDB: window.indexedDB,
    location: window.location,
    setTimeout(fn, ms) {
      const id = ++timerId;
      timers.set(id, { at: simulatedTime + ms, fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const advance = (ms) => {
    const end = simulatedTime + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      simulatedTime = next[1].at;
      timers.delete(next[0]);
      next[1].fn();
    }
    simulatedTime = end;
  };
  const store = {
    list: async () => [...stored],
    inspect: async () => ({ descriptor, sha256: hash, pin }),
    async install(value, { signal, onProgress }) {
      signal.throwIfAborted();
      if (delayedTransfer) {
        delayedTransfer.progress = onProgress;
        let cancel;
        try {
          await Promise.race([
            delayedTransfer.promise,
            new Promise((resolve, reject) => {
              cancel = () => reject(signal.reason);
              signal.addEventListener('abort', cancel, { once: true });
              if (signal.aborted) cancel();
            }),
          ]);
        } finally {
          signal.removeEventListener('abort', cancel);
        }
      }
      signal.throwIfAborted();
      onProgress({ phase: 'commit', loadedBytes: 1000, totalBytes: 1000 });
      if (delayedCommit) await delayedCommit.promise;
      stored = [record];
      return record;
    },
    async load(id, { sha256 }) {
      assert(id === descriptor.id && sha256 === hash, 'Fly must request exact installed identity');
      if (delayedLoad) await delayedLoad.promise;
      return { verifiedFixture: true };
    },
    removalSnapshot: async () => ({
      id: descriptor.id,
      title: descriptor.title,
      generation: 7,
      revisions: [record],
      bytes: 1000,
    }),
    async remove(id, { expectedGeneration }) {
      removedGeneration = expectedGeneration;
      stored = [];
    },
    close() {},
  };
  const ui = mountRegionalLibrary({
    el,
    txt: (en, uk) => (locale === 'uk' ? uk : en),
    parent,
    pins: [row],
    window: fixtureWindow,
    openLibrary: async () => store,
    fly: async (configuration, record, { isCurrent }) => {
      assert(configuration.verifiedFixture, 'Verified configuration required');
      if (delayedHost) await delayedHost.promise;
      if (isCurrent()) flights++;
    },
  });
  const click = (action) => {
    const target = fixture.querySelector(`[data-region-action="${action}"]`);
    assert(target && !target.disabled, `Action ${action} reachable`);
    target.click();
  };
  const lines = [];
  try {
    ui.open();
    await settled();
    click('install');
    await settled();
    assert(stored.length === 1 && flights === 0, 'Download must not launch or arm');
    click('fly');
    await settled();
    assert(flights === 1, 'Explicit Fly launches exact revision');
    lines.push('PASS explicit download, then exact-revision Fly');
    delayedLoad = deferred();
    click('fly');
    await turn();
    ui.deactivate();
    delayedLoad.resolve();
    await settled();
    assert(flights === 1, 'Navigation must invalidate pending launch');
    delayedLoad = null;
    lines.push('PASS navigation cancels pending launch');
    ui.open();
    await settled();
    delayedHost = deferred();
    click('fly');
    await settled();
    ui.deactivate();
    delayedHost.resolve();
    await settled();
    assert(flights === 1, 'Host preparation must retain the Library launch lease');
    delayedHost = null;
    lines.push('PASS navigation invalidates an asynchronous host preparation lease');
    ui.open();
    await settled();
    click('remove');
    await settled();
    click('confirm-remove');
    await settled();
    assert(removedGeneration === 7 && stored.length === 0, 'Removal must use reviewed generation');
    lines.push('PASS reviewed, generation-guarded removal');
    delayedCommit = deferred();
    click('install');
    await settled();
    ui.deactivate();
    ui.open();
    delayedCommit.resolve();
    await settled();
    assert(
      stored.length === 1 && flights === 1,
      'Committed install retained without surprise launch',
    );
    delayedCommit = null;
    assert(
      fixture.querySelector('[data-region-action="fly"]'),
      'Reopened view refreshes committed installation',
    );
    lines.push('PASS completion after navigation preserves install and refreshes without launch');
    locale = 'uk';
    ui.refresh();
    assert(fixture.textContent.includes('Вільний політ у регіонах'), 'Ukrainian interface updates');
    lines.push('PASS locale refresh');
    locale = 'en';
    ui.refresh();
    click('remove');
    await settled();
    click('confirm-remove');
    await settled();
    delayedTransfer = deferred();
    click('install');
    await settled();
    for (let i = 1; i <= 4; i++) {
      advance(60000);
      delayedTransfer.progress({ phase: 'download', loadedBytes: i * 100, totalBytes: 1000 });
      await settled();
    }
    assert(
      fixture.textContent.includes('Preparing region:'),
      'Healthy download remains active past two minutes',
    );
    delayedTransfer.resolve();
    await settled();
    delayedTransfer = null;
    assert(stored.length === 1 && flights === 1, 'Long transfer saves without starting flight');
    assert(timers.size === 0, 'Completed transfer releases timers');
    lines.push('PASS progress-aware long download saves without surprise launch (virtual time)');
    click('remove');
    await settled();
    click('confirm-remove');
    await settled();
    for (const language of ['en', 'uk']) {
      locale = language;
      ui.refresh();
      delayedTransfer = deferred();
      click('install');
      await settled();
      advance(120000);
      await settled();
      assert(
        fixture.textContent.includes(language === 'en' ? 'stopped making progress' : 'зупинилася'),
        'Localized stall explanation remains visible',
      );
      assert(
        stored.length === 0 && flights === 1 && timers.size === 0,
        'Timed-out transfer neither commits nor launches and clears timers',
      );
      assert(
        !fixture.querySelector('[data-region-action="install"]').disabled,
        'Retry remains available',
      );
      delayedTransfer = null;
    }
    lines.push('PASS EN/UK timeout feedback, no stale commit/launch and reachable retry');

    output.textContent = `${lines.join('\n')}\nPASS ${lines.length}/${lines.length}`;
  } catch (error) {
    output.textContent = `${lines.join('\n')}\nFAIL ${error.message}`;
  } finally {
    ui.dispose();
    button.disabled = false;
  }
};
