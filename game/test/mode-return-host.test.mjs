import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { teamReturnHref } from '../mode-return.mjs';
import { readVersusSoloReturnToken } from '../mode-return-v2.mjs';
import { couchPage } from './helpers/couch-host.mjs';

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

for (const [kind, version, label] of [
  ['team', 'v1', 'Team'],
  ['versus', 'v2', 'Versus'],
]) {
  const slot = 'revealline.suspended.dev.v1';
  const recordKey = `revealline.mode-return.${version}:/game/`;
  const entryId = kind === 'team' ? 'shell-team' : 'shell-versus';
  const destination = kind === 'team' ? 'couch/relay-rescue.html' : 'couch/';
  const query = kind === 'team' ? 'mode-return' : 'mode-return-v2';
  const outgoingQuery = kind === 'team' ? 'return-token' : 'return-token-v2';
  async function missions(h, flight = false) {
    if (flight) {
      h.$('start-button').click();
      await settle(() => h.doc.body.dataset.flightState === 'running');
      h.key('ArrowDown');
      for (let i = 0; i < 24; i++) h.frame();
      h.key('ArrowDown', false);
      h.$('overlay-menu').click();
      assert.equal(h.rendered.run.player.cutting, true);
    }
    h.$('shell-packs').click();
    await settle(() => h.$('journey-chooser')?.open && h.$('journey-collection'));
    h.$('mission-picker-setup').open = true;
    h.$('shell-mode-choice').open = true;
    h.$(entryId).focus();
  }
  async function request(h) {
    const work = h.$(entryId).onclick({ preventDefault() {} });
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
    test(`actual ${flight ? 'paused cut' : 'Title'} Missions → ${kind} → Back restores exact menu without adoption`, async (t) => {
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
        const originalSave = flight ? JSON.parse(storage.getItem(slot)) : null;
        await request(h);
        if (flight) {
          assert.equal(originalSave.format, 'xonix-session.v5');
          const retainedSave = JSON.parse(storage.getItem(slot));
          assert.equal(retainedSave.format, 'xonix-session.v5');
          assert.deepEqual(retainedSave.visualThemePin, originalSave.visualThemePin);
          assert.deepEqual(retainedSave.presentationPins, originalSave.presentationPins);
          assert.match(h.$('mode-leave-status').textContent, /saved and verified/);
          assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
          h.$('mode-leave-confirm').click();
        } else assert.equal(h.$('mode-leave-dialog').open, false);
        target = globalThis.location.href;
        assert.match(
          target,
          new RegExp(
            `^http://localhost/game/${destination.replace('.', '\\.')}\\?return=solo&${outgoingQuery}=[0-9a-f]{32}$`,
          ),
        );
        save = storage.getItem(slot);
        unchanged(h, checkpoint);
      });
      assert.equal(storage.getItem(slot), save, 'pagehide must not overwrite the checked handoff');
      let couchBack;
      if (kind === 'versus')
        await t.test('actual Versus host returns through the fixed own link', async (t) => {
          const f = await couchPage(t, { href: target, previewStorage });
          if (flight) {
            f.$('race-start').click();
            f.frame();
            f.frames(5);
            f.$('race-pause').click();
          }
          const checkpoint = f.checkpoint();
          const event = f.$('race-solo-return').emit('click');
          if (flight) {
            assert.equal(event.defaultPrevented, true);
            assert.equal(f.$('race-leave-panel').hidden, false);
            assert.equal(f.$('race-leave').emit('click').defaultPrevented, false);
            couchBack = f.$('race-leave').getAttribute('href');
          } else {
            assert.equal(event.defaultPrevented, false);
            couchBack = f.$('race-solo-return').getAttribute('href');
          }
          assert.deepEqual(f.checkpoint(), checkpoint);
          assert.ok(previewStorage.getItem(recordKey), 'Versus must not consume the Solo return.');
        });
      const back =
        kind === 'team' ? teamReturnHref({ href: target, storage: previewStorage }) : couchBack;
      if (kind === 'versus')
        assert.equal(
          back,
          `../?mode-return-v2=${readVersusSoloReturnToken({ href: target, storage: previewStorage })}`,
        );
      assert.match(back, new RegExp(`^\\.\\./\\?${query}=[0-9a-f]{32}$`));
      const search = new URL(back, target).search;
      await t.test(
        'receiving Solo opens exact Missions focus, with no flight resume',
        async (t) => {
          const before = [...storage.map];
          const h = await host(t, { storage, previewStorage, search, titleScreen: true });
          assert.equal(
            h.$('journey-chooser')?.open,
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
          assert.equal(
            h.$('shell-home').open,
            true,
            'Unified selector keeps its Back-to-menu parent.',
          );
          assert.equal(h.$('journey-mode').value, 'solo');
          assert.equal(h.doc.activeElement.classList.contains('journey-card'), true);
          const identity = JSON.parse(h.doc.activeElement.dataset.missionId);
          assert.deepEqual(JSON.parse(identity[0]), ['classic', 'base', null]);
          assert.equal(identity[3], selected.level);
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
        },
      );
      await t.test('the same return query is consumed, not replayed', async (t) => {
        const h = await host(t, { storage, previewStorage, search, titleScreen: true });
        assert.equal(h.$('shell-home').open, true);
        assert.equal(h.$('shell-missions').open, false);
        assert.equal(h.$('journey-chooser')?.open ?? false, false);
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
      assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
      assert.equal(storage.getItem(slot), newest);
      h.$('mode-leave-confirm').click();
      assert.ok(globalThis.location.href.includes(`${destination}?return=solo&${outgoingQuery}=`));
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
    assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
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
        const originalSave = flight ? JSON.parse(storage.getItem(slot)) : null;
        await request(h);
        if (flight) {
          assert.equal(originalSave.format, 'xonix-session.v5');
          const retainedSave = JSON.parse(storage.getItem(slot));
          assert.equal(retainedSave.format, 'xonix-session.v5');
          assert.deepEqual(retainedSave.visualThemePin, originalSave.visualThemePin);
          assert.deepEqual(retainedSave.presentationPins, originalSave.presentationPins);
          assert.match(h.$('mode-leave-status').textContent, /saved and verified/);
          h.$('mode-leave-confirm').click();
        }
        assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
        assert.ok(
          h
            .$('mode-leave-status')
            .textContent.includes(`Back from ${label} will open Solo’s title`),
        );
        h.$('mode-leave-confirm').click();
        assert.equal(
          globalThis.location.href,
          `http://localhost/game/${destination}?journey=legacy&return=solo`,
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
    const pending = h.$(entryId).onclick({ preventDefault() {} });
    await settle(() => !!finish);
    assert.equal(h.$('mode-leave-confirm').disabled, true);
    h.$('mode-leave-confirm').click();
    assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
    h.$('mode-leave-stay').click();
    assert.equal(h.$('mode-leave-dialog').open, false);
    assert.equal(h.doc.activeElement.id, entryId);
    finish();
    await pending;
    assert.equal(h.storage.getItem(slot), saved);
    assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
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
          search: `?${query}=${ticket}`,
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
      assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
      assert.match(h.$('mode-leave-status').textContent, /session-only.*Leaving may lose/);
      assert.doesNotMatch(
        h.$('mode-leave-status').textContent,
        /saved and verified|older saved flight.*unchanged/i,
      );
      if (failure === 'quota') assert.equal(get(slot), before);
      else assert.equal(written, true, 'This failure occurs after a real save write.');
      h.$('mode-leave-stay').click();
      assert.equal(h.doc.activeElement.id, entryId);
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
    assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
  });

  test('pending theme preparation cannot depart with a stale visible selection', async (t) => {
    const previewStorage = memoryStorage();
    const h = await host(t, { previewStorage, titleScreen: true });
    await missions(h);
    h.$('theme-select').value = 'retro';
    const preparing = h.$('theme-select').onchange();
    await h.$(entryId).onclick({ preventDefault() {} });
    assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
    assert.equal(h.$('mode-leave-dialog').open, false);
    assert.match(h.$('run-message').textContent, /Finish the current operation/);
    assert.equal(previewStorage.getItem(recordKey), null);
    await preparing;
    h.$(entryId).focus();
    await request(h);
    assert.equal(JSON.parse(previewStorage.getItem(recordKey)).selection.themeId, 'retro');
    assert.ok(globalThis.location.href.includes(destination));
  });

  for (const reason of ['blur', 'hidden', 'pagehide'])
    test(`${kind}: ${reason} retires a pending save decision before late locks can write or navigate`, async (t) => {
      const previewStorage = memoryStorage();
      const h = await host(t, { previewStorage });
      await missions(h, true);
      const checkpoint = authoritativeCheckpoint(h.rendered.run),
        before = h.storage.getItem(slot);
      let finish;
      navigator.locks.request = async (_name, _options, work) => {
        await new Promise((resolve) => {
          finish = resolve;
        });
        return work();
      };
      const pending = h.$(entryId).onclick({ preventDefault() {} });
      await settle(() => !!finish);
      if (reason === 'blur') {
        h.doc.focused = false;
        h.win.emit('blur');
      } else if (reason === 'hidden') {
        h.doc.hidden = true;
        h.doc.emit('visibilitychange');
      } else h.win.emit('pagehide', { persisted: true });
      assert.equal(h.$('mode-leave-dialog').open, false);
      h.$('mode-leave-confirm').click();
      finish();
      await pending;
      assert.equal(h.storage.getItem(slot), before);
      assert.equal(previewStorage.getItem(recordKey), null);
      assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
      h.doc.focused = true;
      h.doc.hidden = false;
      h.win.emit('focus');
      h.$('mode-leave-confirm').click();
      assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
      unchanged(h, checkpoint);
    });

  test(`${kind}: foreground lost during hint write cannot navigate or leave a reusable owned hint`, async (t) => {
    const previewStorage = memoryStorage();
    const h = await host(t, { previewStorage, titleScreen: true });
    await missions(h);
    const set = previewStorage.setItem;
    previewStorage.setItem = (key, raw) => {
      set(key, raw);
      h.doc.focused = false;
      h.win.emit('blur');
    };
    await h.$(entryId).onclick({ preventDefault() {} });
    assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
    assert.equal(previewStorage.getItem(recordKey), null);
    assert.equal(h.$('mode-leave-dialog').open, false);
  });

  test(`${kind}: Stay returns to the actual initiating link and other mode cannot steal its pending decision`, async (t) => {
    const h = await host(t);
    await missions(h, true);
    const checkpoint = authoritativeCheckpoint(h.rendered.run);
    await request(h);
    const other = kind === 'team' ? 'shell-versus' : 'shell-team';
    await h.$(other).onclick({ preventDefault() {} });
    assert.equal(h.$('mode-leave-title').textContent, `Open ${label}?`);
    h.$('mode-leave-stay').click();
    assert.equal(h.doc.activeElement.id, entryId);
    unchanged(h, checkpoint);
  });

  test(`${kind}: modified gestures remain native and do not write or pause the existing flight`, async (t) => {
    const previewStorage = memoryStorage(),
      h = await host(t, { previewStorage });
    await missions(h, true);
    const checkpoint = authoritativeCheckpoint(h.rendered.run),
      before = h.storage.getItem(slot);
    for (const modifiers of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { button: 1 },
    ]) {
      let prevented = false;
      await h.$(entryId).onclick({
        ...modifiers,
        preventDefault() {
          prevented = true;
        },
      });
      assert.equal(prevented, false);
      assert.equal(h.$('mode-leave-dialog').open, false);
    }
    assert.equal(previewStorage.getItem(recordKey), null);
    assert.equal(h.storage.getItem(slot), before);
    unchanged(h, checkpoint);
  });

  test(`${kind}: rejected native dialog opening releases its owner and keeps the flight paused`, async (t) => {
    const h = await host(t);
    await missions(h, true);
    const checkpoint = authoritativeCheckpoint(h.rendered.run);
    const dialog = h.$('mode-leave-dialog'),
      original = dialog.showModal;
    dialog.showModal = () => {
      throw new Error('dialog unavailable');
    };
    await h.$(entryId).onclick({ preventDefault() {} });
    assert.equal(dialog.open, false);
    assert.match(h.$('run-message').textContent, /departure could not open/);
    assert.equal(h.doc.activeElement.id, entryId);
    unchanged(h, checkpoint);
    dialog.showModal = original;
    await request(h);
    assert.equal(dialog.open, true);
    assert.equal(h.$('mode-leave-confirm').disabled, false);
    h.$('mode-leave-stay').click();
  });
}
