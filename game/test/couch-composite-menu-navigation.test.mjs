import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { teamHud, winTeam } from './helpers/coop-win.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';

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
  const { f } = await winTeam(t);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  return f;
}

async function teamLoss(t) {
  const f = await teamPage(t, {
      nativeFocus: true,
      nativeVisibility: true,
      capturePaint: true,
    }),
    pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'native-menu-terminal-loss';
  pack.levels[0].enemies = [];
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-difficulty', 'expert');
  f.$('coop-start').focus();
  f.tap('Enter');
  f.tick(3);
  for (let attempt = 0; attempt < 2; attempt++)
    for (const [first, second, ticks] of [
      ['KeyD', 'ArrowLeft', 30],
      ['KeyW', 'ArrowUp', 15],
      ['KeyD', 'ArrowLeft', 15],
      ['KeyS', 'ArrowDown', 15],
      ['KeyA', 'ArrowRight', 15],
    ]) {
      f.tap(first);
      f.tap(second);
      f.tick(ticks);
    }
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.match(f.$('coop-overlay-copy').textContent, /unfinished line crossed itself/);
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
      const trace = [];
      for (let n = 0; n < 40 && f.doc.activeElement.id !== id; n++) {
        trace.push(f.doc.activeElement.id);
        if (adapter === 'controller') {
          const current = f.doc.activeElement,
            target = f.$(id),
            group = current.closest('[data-menu-layout]'),
            controls = f.doc.querySelectorAll('button,a[href],select,input,textarea,summary'),
            forward = controls.indexOf(target) > controls.indexOf(current),
            withinGroup = group?.contains(target),
            explicitScope = current.getAttribute('data-menu-navigation-scope'),
            explicitOwner = explicitScope ? f.$(explicitScope) : null,
            explicitActive =
              (!explicitScope ||
                (explicitOwner &&
                  !explicitOwner.hidden &&
                  !explicitOwner.closest('[hidden],[inert],[aria-hidden="true"]') &&
                  (explicitOwner.tagName !== 'DIALOG' || explicitOwner.open))) &&
              !current.closest('.shared-pause-menu'),
            explicit =
              explicitActive &&
              ['left', 'right', 'up', 'down'].find((direction) =>
                (current.getAttribute(`data-menu-${direction}`) || '').split(/\s+/).includes(id),
              ),
            horizontal = withinGroup
              ? group.getAttribute('data-menu-layout') === 'horizontal'
              : group?.getAttribute('data-menu-layout') === 'vertical' &&
                group.getAttribute('data-menu-edge-exit') !== 'true';
          pulse(
            explicit
              ? { left: 14, right: 15, up: 12, down: 13 }[explicit]
              : horizontal
                ? forward
                  ? 15
                  : 14
                : forward
                  ? 13
                  : 12,
          );
        } else if (
          f.doc.activeElement.getAttribute('role') === 'tab' &&
          f.$(id).getAttribute('role') === 'tab'
        ) {
          const tabs = f.doc.activeElement.parentNode.querySelectorAll('[role="tab"]');
          key(tabs.indexOf(f.$(id)) < tabs.indexOf(f.doc.activeElement) ? 'ArrowUp' : 'ArrowDown');
        } else key('Tab');
        assert.equal(f.doc.activeElement.closest('.race-pad'), null);
        assert.equal(
          ['coop-pause', 'coop-canvas', 'race-pause', 'race-canvas-0', 'race-canvas-1'].includes(
            f.doc.activeElement.id,
          ),
          false,
          'Menu traversal never includes live-play actions.',
        );
      }
      assert.equal(
        f.doc.activeElement.id,
        id,
        `${adapter} reaches visible ${id}: ${trace.join(' → ')}.`,
      );
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
      campaign: { ...base, id: 'navigation-fixture', briefs: [], levels: [level] },
      pads: adapter === 'controller' ? [pad()] : [],
      nativeKeyboard: true,
    });
    const nav = navigation(f, adapter);
    nav.adopt();
    const initial = f.checkpoint();
    nav.reach('race-quick-sound');
    assert.equal(f.$('race-quick-sound').parentNode.className, 'native-menu-utilities');
    nav.reach('race-start');
    assert.deepEqual(
      f.checkpoint(),
      initial,
      'Crossing the utility row does not start either board.',
    );
    const catalogueAction = adapter === 'controller' ? 'race-chapters' : 'race-journey-find';
    nav.reach(catalogueAction);
    const find = f.$(catalogueAction),
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
    assert.equal(f.doc.activeElement.id, catalogueAction);
    assert.deepEqual(f.checkpoint(), initial, 'Browsing does not replace either ready board.');
    f.frame();
    nav.reach('race-start');
    nav.confirm();
    f.frames(20);
    assert.equal(f.state(), 'finished');
    assert.equal(f.$('race-journey-next').hidden, false);
    const terminal = f.checkpoint();
    assert.equal(f.$('race-recording-help').hidden, false);
    nav.reach('race-verify-recording');
    assert.equal(f.$('race-verify-recording').getAttribute('target'), '_blank');
    assert.equal(f.$('race-verify-recording').getAttribute('rel'), 'noopener');
    assert.match(f.$('race-verify-recording').getAttribute('href'), /#recording-verification$/);
    assert.deepEqual(f.checkpoint(), terminal, 'Finding verification keeps the terminal boards.');
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

  test(`Team landing ${adapter} reaches the separate sound row and returns to Start`, async (t) => {
    const f = await teamPage(t, { nativeFocus: true, capturePaint: true });
    if (adapter === 'controller') f.pads.push(pad());
    const nav = navigation(f, adapter, true);
    const held = { hud: teamHud(f), paint: f.lastPaint };
    nav.adopt();
    nav.reach('coop-quick-sound');
    assert.equal(f.$('coop-quick-sound').parentNode.className, 'native-menu-utilities');
    nav.reach('coop-start');
    assert.equal(f.$('coop-menu').hidden, false);
    assert.deepEqual({ hud: teamHud(f), paint: f.lastPaint }, held);
  });

  for (const state of ['paused', 'won', 'lost'])
    test(`Team ${adapter} reaches the shared Home action or terminal masthead from ${state} without entering flight controls`, async (t) => {
      const f =
        state === 'won'
          ? await teamResult(t)
          : state === 'lost'
            ? await teamLoss(t)
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
      assert.equal(f.$('coop-recording-help').hidden, state === 'paused');
      if (state !== 'paused') {
        nav.reach('coop-verify-recording');
        assert.equal(f.$('coop-verify-recording').getAttribute('target'), '_blank');
        assert.equal(f.$('coop-verify-recording').getAttribute('rel'), 'noopener');
        assert.match(f.$('coop-verify-recording').getAttribute('href'), /#recording-verification$/);
        assert.deepEqual({ hud: teamHud(f), paint: f.lastPaint }, held);
      }
      nav.reach('coop-settings-open');
      nav.confirm();
      assert.equal(f.$('coop-options').open, true);
      nav.reach('coop-settings-tab-data');
      nav.confirm();
      assert.equal(f.$('coop-settings-panel-data').hidden, false);
      nav.back();
      assert.equal(f.$('coop-options').open, false);
      assert.equal(f.doc.activeElement.id, 'coop-settings-open');
      assert.deepEqual({ hud: teamHud(f), paint: f.lastPaint }, held);
      for (const id of state === 'paused' ? ['coop-home-paused'] : ['coop-race', 'coop-home']) {
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
