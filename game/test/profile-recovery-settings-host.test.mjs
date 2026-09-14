// Real solo host, reader, view, simulation and input. Browser storage, dialogs,
// paint and pad events are modeled; this is not native layout/download evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'recovery-settings-host',
  revision: '1',
  title: 'Recovery entry preservation',
  classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
  levels: [retryFixture('self-contact').level],
};
function dialogs(t) {
  const open = SoloElement.prototype.showModal,
    close = SoloElement.prototype.close;
  const origins = new WeakMap();
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    open.call(this);
    this.querySelector('button:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    close.call(this);
    origins.get(this)?.focus();
  });
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
}
function cancel(dialog) {
  if (!dialog.emit('cancel').defaultPrevented) dialog.close();
}
async function enter(h) {
  h.$('profile-recovery-open').focus();
  assert.equal(h.$('profile-recovery-open').disabled, false);
  assert.equal(await h.$('profile-recovery-open').onclick(), true);
  assert.equal(h.$('profile-recovery-dialog').open, true);
  assert.equal(h.$('settings-dialog').open, true);
}

test('actual title Settings recovery Back and controller Back preserve the title opener and one input loop', async (t) => {
  dialogs(t);
  const h = await soloPage(t, { campaign, titleScreen: true });
  const pad = {
    index: 0,
    id: 'Recovery menu',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let reads = 0;
  navigator.getGamepads = () => {
    reads++;
    return [pad];
  };
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    h.frame(16);
    pad.buttons[index] = { pressed: false, value: 0 };
    h.frame(16);
  };
  h.frame(16);
  pulse(0);
  h.frame(16);
  for (const exit of ['back', 'controller']) {
    h.$('shell-options').focus();
    h.$('shell-options').click();
    h.frame(16);
    await enter(h);
    h.frame(16);
    h.frame(16);
    const beforeReads = reads;
    h.frame(16);
    assert.equal(reads - beforeReads, 1, 'The existing scene owns the single pad sample');
    assert.equal(h.$('shell-home').open, true);
    if (exit === 'back') await h.$('profile-recovery-back').onclick();
    else {
      pulse(1);
      await settle(() => !h.$('profile-recovery-dialog').open);
    }
    assert.equal(h.doc.activeElement.id, 'profile-recovery-open');
    assert.equal(h.$('settings-dialog').open, true);
    cancel(h.$('settings-dialog'));
    await Promise.resolve();
    assert.equal(h.$('shell-home').open, true);
    assert.equal(h.doc.activeElement.id, 'shell-options');
    assert.equal(h.rendered.run.tick, 0);
    h.frame(16);
  }
  assert.deepEqual(h.errors, []);
});

for (const mode of ['normal', 'quota-failure', 'occupied-writer'])
  test(`actual unfinished flight survives recovery Escape/blur and explicit Resume with ${mode}`, async (t) => {
    dialogs(t);
    const storage = memoryStorage();
    let refusedSaves = 0;
    const save = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (mode === 'quota-failure' && key.startsWith('revealline.suspended.')) {
        refusedSaves++;
        throw new Error('Storage quota fixture');
      }
      save(key, value);
    };
    const h = await soloPage(t, {
      campaign,
      storage,
      ...(mode === 'occupied-writer'
        ? {
            lockManager: {
              request(_name, options, callback) {
                return Promise.resolve((callback ?? options)(null));
              },
            },
          }
        : {}),
    });
    h.$('start-button').click();
    h.key('ArrowDown');
    for (let i = 0; i < 30; i++) h.frame();
    h.key('ArrowDown', false);
    h.$('settings-button').focus();
    h.$('settings-button').click();
    h.frame(0);
    assert.equal(h.rendered.paused, true);
    assert.equal(h.rendered.run.player.cutting, true);
    const run = h.rendered.run,
      checkpoint = structuredClone(run);
    const values = [...storage.map],
      writes = storage.writes.length;
    const selections = ['campaign-select', 'level-select', 'class-select', 'theme-select'].map(
      (id) => [id, h.$(id).value],
    );
    if (mode === 'quota-failure')
      assert.ok(refusedSaves > 0, 'Actual saveSession returned its storage failure');
    await enter(h);
    assert.deepEqual([...storage.map], values);
    assert.equal(storage.writes.length, writes, 'Recovery entry does not save the flight');
    assert.match(h.$('profile-recovery-catalog-status').textContent, /packaged release/);
    h.win.emit('blur');
    h.frame(0);
    // Existing host blur may make its own best-effort paused save. Recovery Back adds none.
    const afterBlurValues = [...storage.map],
      afterBlurWrites = storage.writes.length;
    const event = h.$('profile-recovery-dialog').emit('cancel');
    assert.equal(event.defaultPrevented, true);
    await settle(() => !h.$('profile-recovery-dialog').open);
    assert.equal(h.$('settings-dialog').open, true);
    assert.equal(h.doc.activeElement.id, 'profile-recovery-open');
    cancel(h.$('settings-dialog'));
    h.win.emit('focus');
    h.frame(0);
    assert.equal(h.$('shell-home').open, false);
    assert.equal(h.rendered.run, run);
    assert.deepEqual(structuredClone(h.rendered.run), checkpoint);
    assert.equal(h.rendered.paused, true);
    assert.deepEqual([...storage.map], afterBlurValues);
    assert.equal(storage.writes.length, afterBlurWrites, 'Recovery Back does not save the flight');
    assert.deepEqual(
      selections.map(([id]) => [id, h.$(id).value]),
      selections,
    );
    h.$('start-button').click();
    h.frame();
    assert.equal(h.rendered.paused, false);
    assert.ok(
      h.rendered.run.tick > checkpoint.tick,
      'Only explicit Resume advances the same flight',
    );
    assert.deepEqual(h.errors, []);
  });

test('actual packaged current-channel reader reports its busy writer without release or storage writes', async (t) => {
  dialogs(t);
  const profileKey = 'revealline.library.release-v0.42.0.v1';
  const storage = memoryStorage({ [profileKey]: '{}' }),
    locks = [];
  Object.defineProperty(storage, 'length', { get: () => storage.map.size });
  storage.key = (index) => [...storage.map.keys()][index] ?? null;
  const h = await soloPage(t, {
    campaign,
    storage,
    titleScreen: true,
    buildInfo: { version: 'v0.42.0' },
    lockManager: {
      request(name, options, callback) {
        locks.push(name);
        return Promise.resolve((callback ?? options)(null));
      },
    },
  });
  h.$('shell-options').click();
  await enter(h);
  const values = [...storage.map],
    writes = storage.writes.length;
  await h.$('profile-recovery-find').onclick();
  await h.$('profile-recovery-review').onclick();
  assert.match(h.$('profile-recovery-status').textContent, /profile is busy/);
  assert.equal(h.$('profile-recovery-export').disabled, true);
  assert.ok(locks.filter((name) => name === `${profileKey}.writer`).length >= 2);
  assert.deepEqual([...storage.map], values);
  assert.equal(storage.writes.length, writes);
  await h.$('profile-recovery-back').onclick();
  assert.equal(h.$('settings-dialog').open, true);
  assert.deepEqual(h.errors, []);
});
