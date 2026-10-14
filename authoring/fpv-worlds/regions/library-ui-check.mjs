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
  const store = {
    list: async () => [...stored],
    inspect: async () => ({ descriptor, sha256: hash, pin }),
    async install(value, { signal, onProgress }) {
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
    output.textContent = `${lines.join('\n')}\nPASS ${lines.length}/${lines.length}`;
  } catch (error) {
    output.textContent = `${lines.join('\n')}\nFAIL ${error.message}`;
  } finally {
    ui.dispose();
    button.disabled = false;
  }
};
