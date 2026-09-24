import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { teamHud } from './helpers/coop-win.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const base = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const pad = () => ({
  index: 0,
  id: 'Composite menu controller',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});

async function teamResult(t) {
  const f = await teamPage(t, { nativeFocus: true, capturePaint: true }),
    pack = structuredClone(COOP_STARTER_PACK);
  // A navigation fixture owns its simple authored objective; ordinary host
  // inputs must still earn the result, with no writes to live simulation state.
  pack.id = 'menu-navigation';
  pack.levels = [pack.levels[0]];
  pack.levels[0].enemies = [];
  pack.levels[0].goal.coverage = 0.05;
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-experiment', 'independent');
  f.$('coop-start').focus();
  f.tap('Enter');
  f.tick(2);
  f.tap('KeyD');
  f.tick(160);
  f.tap('KeyW');
  for (let n = 0; n < 350 && f.$('coop-overlay').hidden; n++) f.tick();
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  return f;
}

function navigation(f, adapter, team = false) {
  const controller = team ? f.pads[0] : f.pads()[0];
  const pulse = (button) => {
    if (!team) return f.pulse(0, button);
    controller.buttons[button] = { pressed: true, value: 1 };
    f.tick();
    controller.buttons[button] = { pressed: false, value: 0 };
    f.tick();
  };
  const key = (code) => {
    if (team) return f.tap(code);
    const target = f.doc.activeElement;
    if (code === 'Tab') {
      const event = target.emit('keydown', { key: code, code });
      target.emit('keyup', { key: code, code });
      assert.equal(event.defaultPrevented, true, 'The nonmodal host owns sequential Tab.');
    } else {
      f.key(code, true, target);
      f.key(code, false, target);
    }
  };
  return {
    reach(id) {
      for (let n = 0; n < 40 && f.doc.activeElement.id !== id; n++) {
        if (adapter === 'controller') pulse(13);
        else key('Tab');
        assert.equal(f.doc.activeElement.closest('.race-pad'), null);
        assert.equal(
          ['coop-pause', 'coop-canvas', 'race-pause', 'race-canvas-0', 'race-canvas-1'].includes(
            f.doc.activeElement.id,
          ),
          false,
          'Menu traversal never includes live-play actions.',
        );
      }
      assert.equal(f.doc.activeElement.id, id, `${adapter} reaches visible ${id}.`);
    },
    confirm: () => (adapter === 'controller' ? pulse(0) : key('Enter')),
    back: () => (adapter === 'controller' ? pulse(1) : key('Escape')),
    adopt() {
      if (adapter !== 'controller') return;
      if (team) {
        f.tick(2);
        pulse(0);
      } else f.join(0);
    },
  };
}

for (const adapter of ['keyboard', 'controller']) {
  test(`Legacy Versus ${adapter} reaches Find missions and terminal Next outside the main panel`, async (t) => {
    const { level } = retryFixture('mission-timeout');
    const f = await couchPage(t, {
      campaign: { ...base, briefs: [], levels: [level] },
      pads: adapter === 'controller' ? [pad()] : [],
      nativeKeyboard: true,
    });
    const nav = navigation(f, adapter);
    nav.adopt();
    const initial = f.checkpoint();
    nav.reach('race-journey-find');
    const find = f.$('race-journey-find'),
      open = find.onclick;
    let opening;
    find.onclick = (...args) => (opening = open.apply(find, args));
    nav.confirm();
    find.onclick = open;
    assert.ok(opening instanceof Promise, 'Menu input activated the real catalogue operation.');
    await opening;
    assert.equal(f.$('journey-chooser').open, true);
    f.frame();
    nav.back();
    assert.equal(f.$('journey-chooser').open, false);
    assert.equal(f.doc.activeElement.id, 'race-journey-find');
    assert.deepEqual(f.checkpoint(), initial, 'Browsing does not replace either ready board.');
    f.frame();
    nav.reach('race-start');
    nav.confirm();
    f.frames(20);
    assert.equal(f.state(), 'finished');
    assert.equal(f.$('race-journey-next').hidden, false);
    const terminal = f.checkpoint();
    nav.reach('race-journey-next');
    const next = f.$('race-journey-next'),
      handler = next.onclick;
    let operation;
    next.onclick = (event) => (operation = handler(event));
    nav.confirm();
    assert.ok(operation instanceof Promise, 'The real continuation handler was activated.');
    assert.equal(f.$('race-picture-cancel').hidden, false, 'Preparation acknowledges activation.');
    nav.reach('race-picture-cancel');
    nav.confirm();
    await operation;
    assert.equal(f.state(), 'finished');
    assert.deepEqual(f.checkpoint(), terminal, 'Cancelling Next preserves both finished boards.');
  });

  for (const state of ['paused', 'won'])
    test(`Team ${adapter} reaches visible masthead from ${state} without entering flight controls`, async (t) => {
      const f =
        state === 'won'
          ? await teamResult(t)
          : await teamPage(t, { nativeFocus: true, capturePaint: true });
      if (state === 'paused') {
        f.$('coop-start').click();
        f.tick(3);
        f.$('coop-pause').click();
      }
      if (adapter === 'controller') f.pads.push(pad());
      if (adapter === 'controller')
        for (const id of ['coop-home', 'coop-race'])
          t.mock.method(f.$(id), 'click', function () {
            // Model the browser's anchor default after the real controller
            // activation and host departure listener have had their turn.
            const event = this.emit('click', { button: 0 });
            if (!event.defaultPrevented)
              f.visits.push(new URL(this.getAttribute('href'), globalThis.location.href).href);
          });
      const nav = navigation(f, adapter, true),
        held = { hud: teamHud(f), paint: f.lastPaint };
      nav.adopt();
      for (const id of ['coop-race', 'coop-home']) {
        nav.reach(id);
        if (state === 'paused') {
          nav.confirm();
          assert.equal(f.$('coop-discard-dialog').open, true);
          assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
          nav.back();
          assert.equal(f.$('coop-discard-dialog').open, false);
          assert.equal(f.doc.activeElement.id, id, 'Stay restores the actual header opener.');
          assert.deepEqual(f.visits, []);
        }
      }
      nav.confirm();
      if (state === 'paused') {
        nav.reach('coop-discard-confirm');
        nav.confirm();
      }
      assert.equal(f.$('coop-discard-dialog').open, false);
      assert.deepEqual(f.visits, ['http://localhost/game/?journey=legacy']);
      assert.deepEqual({ hud: teamHud(f), paint: f.lastPaint }, held);
    });
}
