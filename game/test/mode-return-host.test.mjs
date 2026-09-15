import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { teamReturnHref } from '../mode-return.mjs';

// Native boot CSS prevents focus before ready; exercise the actual app handoff.
async function host(t, options) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'RevealLineBoot');
  const focus = SoloElement.prototype.focus;
  let ready = false;
  t.mock.method(SoloElement.prototype, 'focus', function (...args) {
    if (
      ready &&
      !this.disabled &&
      !this.closest('[hidden],[inert]') &&
      this.getClientRects().length
    )
      focus.apply(this, args);
  });
  globalThis.RevealLineBoot = {
    progress() {},
    fail(error) {
      throw error;
    },
    ready() {
      ready = true;
      globalThis.document.documentElement.dataset.bootState = 'ready';
      for (const element of globalThis.document.querySelectorAll('[data-boot-inert]'))
        element.inert = false;
      globalThis.document.getElementById('boot-screen').hidden = true;
    },
  };
  t.after(() =>
    original
      ? Object.defineProperty(globalThis, 'RevealLineBoot', original)
      : delete globalThis.RevealLineBoot,
  );
  return soloPage(t, options);
}

const slot = 'revealline.suspended.dev.v1';
const recordKey = 'revealline.mode-return.v1:/game/';
async function missions(h, flight = false) {
  if (flight) {
    h.$('start-button').click();
    h.key('ArrowDown');
    for (let i = 0; i < 24; i++) h.frame();
    h.key('ArrowDown', false);
    h.$('overlay-menu').click();
    assert.equal(h.rendered.run.player.cutting, true);
  }
  h.$('shell-packs').click();
  h.$('shell-mode-choice').open = true;
  h.$('shell-team').focus();
}
async function request(h) {
  const work = h.$('shell-team').onclick({ preventDefault() {} });
  if (!h.$('mode-leave-dialog').open) return work;
  assert.equal(h.doc.activeElement.id, 'mode-leave-stay');
  await work;
  assert.equal(h.$('mode-leave-confirm').disabled, false);
}
function unchanged(h, checkpoint) {
  for (let i = 0; i < 30; i++) h.frame();
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
  assert.deepEqual(h.errors, []);
}

for (const flight of [false, true])
  test(`actual ${flight ? 'paused cut' : 'Title'} Missions → Team → Back restores exact menu without adoption`, async (t) => {
    const storage = memoryStorage(),
      previewStorage = memoryStorage();
    let target, selected, save;
    await t.test('depart through the real explicit controls', async (t) => {
      const h = await host(t, { storage, previewStorage, titleScreen: !flight });
      await missions(h, flight);
      if (!flight) {
        h.$('theme-select').focus();
        h.$('theme-select').value = 'retro';
        await h.$('theme-select').onchange();
      }
      selected = {
        pack: h.$('pack-select').value,
        level: h.$('level-select').value,
        theme: h.$('theme-select').value,
      };
      const checkpoint = authoritativeCheckpoint(h.rendered.run);
      await request(h);
      if (flight) {
        assert.match(h.$('mode-leave-status').textContent, /saved and verified/);
        assert.equal(globalThis.location.href, 'http://localhost/game/');
        h.$('mode-leave-confirm').click();
      } else assert.equal(h.$('mode-leave-dialog').open, false);
      target = globalThis.location.href;
      assert.match(
        target,
        /^http:\/\/localhost\/game\/couch\/relay-rescue.html\?return=solo&return-token=[0-9a-f]{32}$/,
      );
      save = storage.getItem(slot);
      unchanged(h, checkpoint);
    });
    assert.equal(storage.getItem(slot), save, 'pagehide must not overwrite the checked handoff');
    const back = teamReturnHref({ href: target, storage: previewStorage });
    assert.match(back, /^\.\.\/\?mode-return=[0-9a-f]{32}$/);
    const search = new URL(back, target).search;
    await t.test('receiving Solo opens exact Missions focus, with no flight resume', async (t) => {
      const before = [...storage.map];
      const h = await host(t, { storage, previewStorage, search, titleScreen: true });
      assert.equal(
        h.$('shell-missions').open,
        true,
        JSON.stringify({
          active: h.doc.activeElement.id,
          errors: h.errors.map((e) => e.message),
          record: previewStorage.getItem(recordKey),
          pack: h.$('pack-select').value,
          level: h.$('level-select').value,
          theme: h.$('theme-select').value,
        }),
      );
      assert.equal(h.$('shell-home').open, false);
      assert.equal(h.$('shell-mode-choice').open, true);
      assert.equal(h.doc.activeElement.id, 'shell-team');
      assert.deepEqual(
        {
          pack: h.$('pack-select').value,
          level: h.$('level-select').value,
          theme: h.$('theme-select').value,
        },
        selected,
      );
      assert.equal(h.rendered.run.tick, 0);
      assert.deepEqual([...storage.map], before);
      assert.equal(previewStorage.getItem(recordKey), null);
      unchanged(h, authoritativeCheckpoint(h.rendered.run));
    });
    await t.test('the same return query is consumed, not replayed', async (t) => {
      const h = await host(t, { storage, previewStorage, search, titleScreen: true });
      assert.equal(h.$('shell-home').open, true);
      assert.equal(h.$('shell-missions').open, false);
      assert.equal(h.rendered.run.tick, 0);
    });
  });

test('failed checked save stays paused; explicit Leave warns of loss and never overwrites a newer save', async (t) => {
  const storage = memoryStorage(),
    previewStorage = memoryStorage();
  let newest;
  await t.test('preserve an externally changed slot through Leave and pagehide', async (t) => {
    const h = await host(t, { storage, previewStorage });
    await missions(h, true);
    const before = storage.getItem(slot);
    assert.ok(before);
    const other = JSON.parse(before);
    other.savedAt = '2026-09-15T20:00:00.000Z';
    newest = JSON.stringify(other);
    storage.setItem(slot, newest);
    const checkpoint = authoritativeCheckpoint(h.rendered.run);
    await request(h);
    assert.match(h.$('mode-leave-status').textContent, /session-only.*Leaving may lose/);
    assert.match(h.$('mode-leave-status').textContent, /last verified save/);
    assert.equal(globalThis.location.href, 'http://localhost/game/');
    assert.equal(storage.getItem(slot), newest);
    h.$('mode-leave-confirm').click();
    assert.match(globalThis.location.href, /relay-rescue.html\?return=solo&return-token=/);
    unchanged(h, checkpoint);
  });
  assert.equal(storage.getItem(slot), newest);
});

test('storage failure after a successful check requires another deliberate Leave with truthful warning', async (t) => {
  const h = await host(t);
  await missions(h, true);
  await request(h);
  assert.match(h.$('mode-leave-status').textContent, /saved and verified/);
  const raw = h.storage.getItem(slot);
  h.storage.setItem(slot, `${raw} `);
  h.$('mode-leave-confirm').click();
  assert.equal(globalThis.location.href, 'http://localhost/game/');
  assert.match(h.$('mode-leave-status').textContent, /changed.*Leave again/);
  assert.match(h.$('mode-leave-status').textContent, /session-only/);
});

for (const flight of [false, true])
  test(`unavailable return storage preserves ${flight ? 'verified flight' : 'ready title'} with an explicit fixed fallback`, async (t) => {
    const storage = memoryStorage();
    const previewStorage = {
      getItem: () => null,
      setItem() {
        throw new Error('denied');
      },
      removeItem() {},
    };
    let saved;
    await t.test('choose the warned fallback deliberately', async (t) => {
      const h = await host(t, { storage, previewStorage, titleScreen: !flight });
      await missions(h, flight);
      const checkpoint = authoritativeCheckpoint(h.rendered.run);
      await request(h);
      if (flight) {
        assert.match(h.$('mode-leave-status').textContent, /saved and verified/);
        h.$('mode-leave-confirm').click();
      }
      assert.equal(globalThis.location.href, 'http://localhost/game/');
      assert.match(h.$('mode-leave-status').textContent, /Back from Team will open Solo’s title/);
      h.$('mode-leave-confirm').click();
      assert.equal(
        globalThis.location.href,
        'http://localhost/game/couch/relay-rescue.html?return=solo',
      );
      saved = storage.getItem(slot);
      unchanged(h, checkpoint);
    });
    assert.equal(
      storage.getItem(slot),
      saved,
      'Fallback departure keeps the checked bytes through pagehide.',
    );
  });

test('Stay cancels a pending verified-save wait and late completion cannot navigate or write', async (t) => {
  const h = await host(t);
  await missions(h, true);
  const saved = h.storage.getItem(slot),
    checkpoint = authoritativeCheckpoint(h.rendered.run);
  let finish;
  navigator.locks.request = async (_name, _options, work) => {
    await new Promise((resolve) => {
      finish = resolve;
    });
    return work();
  };
  const pending = h.$('shell-team').onclick({ preventDefault() {} });
  await settle(() => !!finish);
  assert.equal(h.$('mode-leave-confirm').disabled, true);
  h.$('mode-leave-confirm').click();
  assert.equal(globalThis.location.href, 'http://localhost/game/');
  h.$('mode-leave-stay').click();
  assert.equal(h.$('mode-leave-dialog').open, false);
  assert.equal(h.doc.activeElement.id, 'shell-team');
  finish();
  await pending;
  assert.equal(h.storage.getItem(slot), saved);
  assert.equal(globalThis.location.href, 'http://localhost/game/');
  unchanged(h, checkpoint);
});

for (const change of ['source', 'selection'])
  test(`return with incompatible ${change} falls back to visible Title without changing stored authority`, async (t) => {
    const previewStorage = memoryStorage(),
      storage = memoryStorage();
    let ticket;
    await t.test('capture the installed menu identity', async (t) => {
      const h = await host(t, { storage, previewStorage, titleScreen: true });
      await missions(h);
      await request(h);
      h.$('mode-leave-confirm').click();
      const record = JSON.parse(previewStorage.getItem(recordKey));
      if (change === 'source') record.authority.sourceRevision = 'a'.repeat(40);
      else record.selection.levelId = 'not-installed';
      previewStorage.setItem(recordKey, JSON.stringify(record));
      ticket = record.token;
    });
    const before = [...storage.map];
    await t.test('reject stale context at the real receiving host', async (t) => {
      const h = await host(t, {
        storage,
        previewStorage,
        titleScreen: true,
        search: `?mode-return=${ticket}`,
      });
      assert.equal(h.$('shell-home').open, true);
      assert.equal(h.$('shell-missions').open, false);
      assert.equal(h.rendered.run.tick, 0);
      assert.deepEqual([...storage.map], before);
      assert.equal(previewStorage.getItem(recordKey), null);
    });
  });

for (const failure of ['quota', 'readback'])
  test(`checked save ${failure} failure never claims durable storage or navigates silently`, async (t) => {
    const h = await host(t);
    await missions(h, true);
    const checkpoint = authoritativeCheckpoint(h.rendered.run),
      before = h.storage.getItem(slot);
    const set = h.storage.setItem.bind(h.storage),
      get = h.storage.getItem.bind(h.storage);
    let written = false;
    h.storage.setItem = (key, value) => {
      if (key === slot && failure === 'quota') throw new Error('quota');
      set(key, value);
      if (key === slot) written = true;
    };
    h.storage.getItem = (key) =>
      key === slot && written && failure === 'readback' ? '{}' : get(key);
    await request(h);
    assert.equal(globalThis.location.href, 'http://localhost/game/');
    assert.match(h.$('mode-leave-status').textContent, /session-only.*Leaving may lose/);
    assert.doesNotMatch(
      h.$('mode-leave-status').textContent,
      /saved and verified|older saved flight.*unchanged/i,
    );
    if (failure === 'quota') assert.equal(get(slot), before);
    else assert.equal(written, true, 'This failure occurs after a real save write.');
    h.$('mode-leave-stay').click();
    assert.equal(h.doc.activeElement.id, 'shell-team');
    unchanged(h, checkpoint);
  });

test('a newer slot after helper readback cannot become this departure’s saved authority', async (t) => {
  const h = await host(t);
  await missions(h, true);
  const original = navigator.locks.request;
  let checks = 0,
    newer;
  navigator.locks.request = async (...args) => {
    const result = await original(...args);
    if (++checks === 2) {
      const value = JSON.parse(h.storage.getItem(slot));
      value.savedAt = '2026-09-15T23:00:00.000Z';
      newer = JSON.stringify(value);
      h.storage.setItem(slot, newer);
    }
    return result;
  };
  await request(h);
  assert.equal(checks, 2);
  assert.equal(h.storage.getItem(slot), newer);
  assert.match(h.$('mode-leave-status').textContent, /session-only/);
  assert.match(h.$('mode-leave-status').textContent, /changed before departure/);
  assert.equal(globalThis.location.href, 'http://localhost/game/');
});

test('pending theme preparation cannot depart with a stale visible selection', async (t) => {
  const previewStorage = memoryStorage();
  const h = await host(t, { previewStorage, titleScreen: true });
  await missions(h);
  h.$('theme-select').value = 'retro';
  const preparing = h.$('theme-select').onchange();
  await h.$('shell-team').onclick({ preventDefault() {} });
  assert.equal(globalThis.location.href, 'http://localhost/game/');
  assert.equal(h.$('mode-leave-dialog').open, false);
  assert.match(h.$('run-message').textContent, /Finish the current operation/);
  assert.equal(previewStorage.getItem(recordKey), null);
  await preparing;
  h.$('shell-team').focus();
  await request(h);
  assert.equal(JSON.parse(previewStorage.getItem(recordKey)).selection.themeId, 'retro');
  assert.match(globalThis.location.href, /relay-rescue.html/);
});
