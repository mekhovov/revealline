import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage, demoKey } from './helpers/demo-host-fixture.mjs';
import { settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const activationKeys = [
  ['Enter', 'Enter'],
  ['NumpadEnter', 'Enter'],
  ['Space', ' '],
];
const keyEvent = (target, type, code, key, extra = {}) =>
  target.emit(type, { code, key, repeat: false, isTrusted: true, ...extra });
function nativeActivate(target, code, key) {
  target.focus();
  const down = keyEvent(target, 'keydown', code, key);
  if (code !== 'Space' && !down.defaultPrevented)
    target.emit('click', { detail: 0, isTrusted: true });
  const up = keyEvent(target, 'keyup', code, key);
  if (code === 'Space' && !down.defaultPrevented && !up.defaultPrevented)
    target.emit('click', { detail: 0, isTrusted: true });
  return { down, up };
}

for (const [code, key] of activationKeys)
  for (const phase of ['loading', 'watching', 'practice', 'returned'])
    test(`actual ${phase} Demo Back owns ${code} through restored Home and releases fresh input`, async (t) => {
      const page = await demoPage(t);
      const ordinary = page.rendered.run,
        checkpoint = authoritativeCheckpoint(ordinary),
        saved = [...page.storage.map];
      page.$('shell-featured').focus();
      let release = () => {},
        response;
      const fetcher = globalThis.fetch;
      try {
        if (phase === 'loading') {
          const held = new Promise((resolve) => (release = resolve));
          globalThis.fetch = (url, options) => {
            if (url.pathname?.endsWith('/demo-data/catalog.json'))
              return (response = held.then(() => fetcher(url, options)));
            return fetcher(url, options);
          };
          page.$('shell-demo').click();
          await settle(() => !!response, 'Hold the real demo source request before Back.');
          assert.equal(page.$('demo-dialog').open, true);
          assert.equal(page.$('demo-fresh').disabled, true);
        } else {
          await page.open();
          if (phase === 'practice' || phase === 'returned') {
            page.$('demo-interrupt').click();
            page.$('demo-takeover').click();
            await settle(() => !page.$('demo-practice-controls').hidden);
            demoKey(page, 'ArrowDown');
            demoKey(page, 'ArrowDown', false);
            page.frame(16);
            assert.notEqual(page.demoFrame.run, ordinary);
            if (phase === 'returned') {
              page.$('demo-return').click();
              assert.equal(page.$('demo-practice-controls').hidden, true);
            }
          }
        }
        const back = page.$('demo-back');
        assert.ok(back.closest('[data-demo-ui]'), 'Exercise the actual nested UI wrapper.');
        back.focus();
        const down = keyEvent(back, 'keydown', code, key);
        assert.equal(down.defaultPrevented, true, 'Demo owns Back before native/menu activation.');
        assert.equal(page.$('demo-dialog').open, false);
        assert.equal(page.$('shell-home').open, true);
        const home = page.doc.activeElement;
        assert.equal(home, page.$('shell-featured'));
        assert.equal(keyEvent(home, 'keydown', code, key, { repeat: true }).defaultPrevented, true);
        assert.equal(keyEvent(home, 'keyup', code, key).defaultPrevented, true);
        assert.equal(home.emit('click', { detail: 0, isTrusted: true }).defaultPrevented, true);
        release();
        await response;
        await new Promise((resolve) => setImmediate(resolve));
        page.frame(16);
        assert.equal(page.$('demo-dialog').open, false, 'Late preparation cannot reopen Demo.');
        assert.equal(page.$('shell-home').open, true, 'Exit tail cannot launch the Home action.');
        assert.equal(page.rendered.paused, true);
        assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
        assert.deepEqual([...page.storage.map], saved);
        const fresh = nativeActivate(page.$('shell-options'), code, key);
        assert.equal(fresh.down.defaultPrevented, false);
        assert.equal(page.$('settings-dialog').open, true, 'A fresh deliberate key still works.');
        assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
        assert.deepEqual(page.errors, []);
      } finally {
        release();
        globalThis.fetch = fetcher;
      }
    });

test('actual Demo audio UI retains native keyboard activation and range editing', async (t) => {
  const page = await demoPage(t);
  await page.open();
  const ordinary = authoritativeCheckpoint(page.rendered.run),
    recorded = page.demoFrame.run,
    mute = page.$('demo-audio-mute');
  for (const [code, key] of activationKeys) {
    const before = mute.getAttribute('aria-pressed');
    const events = nativeActivate(mute, code, key);
    assert.equal(events.down.defaultPrevented, false);
    assert.equal(events.up.defaultPrevented, false);
    assert.notEqual(mute.getAttribute('aria-pressed'), before);
    assert.equal(page.$('demo-dialog').open, true);
    assert.equal(page.$('demo-practice-controls').hidden, true);
    assert.equal(page.demoFrame.run, recorded);
  }
  const volume = page.$('demo-audio-volume');
  volume.focus();
  assert.equal(keyEvent(volume, 'keydown', 'ArrowRight', 'ArrowRight').defaultPrevented, false);
  volume.value = '0.31';
  volume.emit('input');
  keyEvent(volume, 'keyup', 'ArrowRight', 'ArrowRight');
  assert.equal(volume.value, '0.31');
  assert.equal(page.$('demo-practice-controls').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ordinary);
  assert.deepEqual(page.errors, []);
});
