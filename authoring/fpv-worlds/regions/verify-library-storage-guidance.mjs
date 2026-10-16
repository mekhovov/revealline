import assert from 'node:assert/strict';
import { Document } from '../../../game/test/helpers/couch-dom.mjs';
import { mountRegionalLibrary } from '../../../optional-practice/civilian-fpv/regional-library.mjs';

// Production UI, isolated in-memory store: never opens or evicts player storage.
const hash = 'a'.repeat(64),
  oldHash = 'b'.repeat(64);
const descriptor = {
  id: 'storage-fixture',
  revision: 'r2',
  title: { en: 'Storage fixture', uk: 'Тест сховища' },
};
const saved = (sha256, revision) => ({
  id: descriptor.id,
  sha256,
  descriptor: { ...descriptor, revision },
  bytes: 100,
  generation: 1,
});
const pin = { url: 'https://example.invalid/delivery.json', bytes: 100, sha256: hash };
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const checks = [];
async function scenario({
  failure = new DOMException('Unexposed browser detail', 'QuotaExceededError'),
  postCommit = false,
} = {}) {
  const doc = new Document();
  const parent = doc.createElement('div');
  doc.body.append(parent);
  let locale = 'en',
    records = [saved(oldHash, 'r1')],
    installFailure = failure,
    failList = false,
    flights = 0,
    removals = 0;
  const store = {
    list: async () => {
      if (failList) throw failure;
      return [...records];
    },
    inspect: async () => ({ descriptor }),
    install: async (_pin, { onProgress }) => {
      if (installFailure && !postCommit) throw installFailure;
      onProgress({ phase: 'commit', loadedBytes: 100, totalBytes: 100 });
      records.push(saved(hash, 'r2'));
      failList = postCommit;
    },
    load: async () => ({ fixture: true }),
    remove: async () => {
      removals++;
    },
    removeRevision: async () => {
      removals++;
    },
    close() {},
  };
  const ui = mountRegionalLibrary({
    parent,
    pins: [{ id: descriptor.id, title: descriptor.title, pin }],
    el(tag, text, className) {
      const e = doc.createElement(tag);
      if (text !== undefined) e.textContent = text;
      if (className) e.className = className;
      return e;
    },
    txt: (en, uk) => (locale === 'uk' ? uk : en),
    window: { location: { href: 'https://example.invalid/sim' }, setTimeout, clearTimeout },
    openLibrary: async () => store,
    fly: async () => {
      flights++;
    },
  });
  const click = () => {
    const button = doc.querySelector('[data-region-action="install"]');
    assert(button && !button.disabled);
    button.click();
  };
  try {
    ui.open();
    await settle();
    click();
    await settle();
    assert.equal(removals, 0);
    assert.equal(flights, 0);
    assert.equal(records[0].sha256, oldHash);
    const notice = () => doc.querySelector('[role="status"]').textContent;
    assert(!notice().includes('Unexposed browser detail'));
    if (postCommit) {
      assert.equal(records.length, 2);
      assert(notice().includes('Saved changes are retained'));
      assert(!notice().includes('Not enough device storage'));
      checks.push('Post-commit refresh failure preserves truthful committed outcome');
    } else if (failure.name === 'QuotaExceededError') {
      assert.equal(records.length, 1);
      assert(notice().includes('Not enough device storage'));
      assert(notice().includes('Remove this version'));
      assert(!doc.querySelector('[data-region-action="install"]').disabled);
      locale = 'uk';
      ui.refresh();
      assert(notice().includes('Недостатньо місця'));
      assert(notice().includes('Вилучити цю версію'));
      assert(!notice().includes('Not enough device storage'));
      installFailure = null;
      click();
      await settle();
      assert.equal(records.length, 2);
      assert.equal(flights, 0);
      assert.equal(removals, 0);
      assert(notice().includes('Регіон збережено'));
      checks.push(
        'EN/UK quota guidance, retained prior revision, explicit retry without automatic removal or flight',
      );
    } else {
      assert(notice().includes('Could not complete this action'));
      assert(!notice().includes('Not enough device storage'));
      checks.push('Unknown failure retains generic guidance rather than inventing a quota cause');
    }
  } finally {
    ui.dispose();
  }
}
await scenario();
await scenario({ failure: new Error('Unexposed browser detail') });
await scenario({ postCommit: true });
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope: 'Production Library UI with isolated mock store; no real quota or native-device claim',
    },
    null,
    2,
  ),
);
