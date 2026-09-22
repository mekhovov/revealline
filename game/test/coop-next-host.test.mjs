import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { winTeam, earnTeamVictory, teamHud, teamImage } from './helpers/coop-win.mjs';

const yard = COOP_PICTURE_BINDINGS.find((row) => row.levelId === 'relay-yard');
assert.ok(yard);

test('earned First Connection focuses Next and one explicit action prepares and starts Relay Yard with the accepted settings', async (t) => {
  const { f, first } = await winTeam(t);
  const statuses = recordText(t, f.$('coop-next-status'));
  assert.ok(f.$('coop-next'), 'Results must offer its actual ordered successor.');
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.equal(f.$('coop-next-status').getAttribute('role'), 'status');
  // A hidden setup draft cannot replace the accepted attempt's recipe.
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-experiment').value = 'independent';
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(
    f.$('coop-reserves').textContent,
    first.hud[3],
    'Standard reserves survive hidden Expert draft changes.',
  );
  assert.equal(teamImage(f).sha256, yard.picture.sha256);
  assert.equal(teamImage(f) === first.image, false, 'Next adopts the successor original.');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  assert.match(teamHud(f)[0], /Relay Yard/i);
  assertYardBriefing(f);
  assert.ok(statuses.some((text) => /Preparing Relay Yard/.test(text)));
  assert.ok(statuses.some((text) => /Relay Yard ready\. Starting together/.test(text)));
  assert.equal(
    statuses.some((text) => /Start remains a separate action/i.test(text)),
    false,
    'Next automatically starts after preparation; its status must not demand another Start.',
  );
  assert.deepEqual(f.visits, []);
  earnTeamVictory(t, f, 'relay-yard');
  assert.equal(f.$('coop-next').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  assert.match(f.$('coop-overlay-copy').textContent, /Pack complete.*Browse Team arenas/i);
  f.tap('Enter');
  assert.equal(f.$('coop-discovery-dialog').open, true);
  f.$('coop-discovery-back').focus();
  f.tap('Enter');
  f.$('coop-lobby').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-play').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assertYardBriefing(f, { visible: true });
});

function assertYardBriefing(f, { visible = false } = {}) {
  const help = f.$('coop-stronghold-help');
  assert.equal(help.hidden, false, 'The successor exposes its stronghold instructions.');
  assert.match(help.textContent, /Capture both anchors of a stronghold to expose its core/i);
  assert.match(help.textContent, /shielded core blocks entry/i);
  assert.equal(f.$('coop-briefing-title').textContent, 'TAKE THE STRONGHOLD TOGETHER');
  assert.match(f.$('coop-menu-goal').textContent, /both anchors, then the exposed core/i);
  if (visible) {
    for (const node of [help, f.$('coop-briefing-title'), f.$('coop-menu-goal')])
      assert.equal(Boolean(node.closest('[hidden],[inert]')), false);
  }
}

function recordText(t, node, onWrite = () => {}) {
  const own = Object.getOwnPropertyDescriptor(node, 'textContent');
  let prototype = node;
  while (!Object.getOwnPropertyDescriptor(prototype, 'textContent'))
    prototype = Object.getPrototypeOf(prototype);
  const original = Object.getOwnPropertyDescriptor(prototype, 'textContent');
  assert.equal(typeof original.set, 'function');
  const writes = [];
  Object.defineProperty(node, 'textContent', {
    configurable: true,
    get() {
      return original.get.call(this);
    },
    set(value) {
      original.set.call(this, value);
      writes.push(String(value));
      onWrite(String(value));
    },
  });
  t.after(() => {
    if (own) Object.defineProperty(node, 'textContent', own);
    else delete node.textContent;
  });
  return writes;
}

function resultSnapshot(f) {
  return {
    hud: teamHud(f),
    paint: f.lastPaint,
    title: f.$('coop-overlay-title').textContent,
    copy: f.$('coop-overlay-copy').textContent,
    image: teamImage(f),
    imageSource: teamImage(f).src,
  };
}
function assertResult(f, result) {
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.deepEqual(teamHud(f), result.hud);
  assert.equal(f.lastPaint, result.paint);
  assert.equal(f.$('coop-overlay-title').textContent, result.title);
  assert.equal(f.$('coop-overlay-copy').textContent, result.copy);
  assert.equal(teamImage(f) === result.image, true, 'The earned original remains accepted.');
  assert.equal(f.artwork.calls.releases.includes(result.imageSource), false);
}
function controls(t) {
  const state = { read: null, decode: null };
  const gates = [];
  t.after(() => gates.forEach((gate) => gate.resolve()));
  return {
    presentation: {
      async read(event) {
        if (event.slot === yard.picture.slot) await state.read?.(event);
      },
      async decode(event) {
        if (event.image.sha256 === yard.picture.sha256) await state.decode?.(event);
      },
    },
    hold(kind = 'read') {
      const gate = deferred();
      gates.push(gate);
      let entered = false,
        finished = false;
      state[kind] = async () => {
        entered = true;
        try {
          await gate.promise;
        } finally {
          finished = true;
        }
      };
      return {
        gate,
        entered: () => entered,
        finished: () => finished,
        clear: () => {
          state[kind] = null;
        },
      };
    },
  };
}
async function beginHeld(f, held) {
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(held.entered, () => f.$('coop-next-status').textContent);
  assert.equal(f.$('coop-next-cancel').hidden, false);
  assert.equal(f.$('coop-next-status').hidden, false);
  assert.equal(f.$('coop-next-status').getAttribute('role'), 'status');
}
async function releaseHeld(f, held) {
  held.clear();
  held.gate.resolve();
  await waitFor(held.finished);
  // Let both the fulfilled decoder and its enclosing selection continuation
  // unwind before observing ordinary controlled animation frames.
  await new Promise((resolve) => setImmediate(resolve));
  f.tick(3);
}

test('pending Next retains the earned picture and ignores duplicate activation before a deliberate cancel', async (t) => {
  const control = controls(t);
  const { f } = await winTeam(t, { presentation: control.presentation });
  const result = resultSnapshot(f),
    held = control.hold();
  await beginHeld(f, held);
  assertResult(f, result);
  const reads = f.artwork.calls.reads.length;
  f.$('coop-next').click();
  f.tick(15);
  assert.equal(
    f.artwork.calls.reads.length,
    reads,
    'Duplicate Next cannot create a second candidate.',
  );
  assertResult(f, result);
  f.$('coop-next-cancel').focus();
  f.tap('Enter');
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.equal(f.$('coop-next-cancel').hidden, true);
  await releaseHeld(f, held);
  assertResult(f, result);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.deepEqual(f.visits, []);
});

test('menu, lifecycle, mode departure and newer focus retire a pending Next without taking over Results', async (t) => {
  const control = controls(t);
  const { f } = await winTeam(t, { presentation: control.presentation });
  const result = resultSnapshot(f);
  for (const action of [
    'Back',
    'blur',
    'hidden',
    'persisted pagehide',
    'controller Menu',
    'direct mode link click',
    'Settings',
    'earned picture',
    'newer focus',
  ]) {
    await t.test(action, async () => {
      let menuPad;
      if (action === 'controller Menu') {
        menuPad = {
          index: 0,
          id: 'Standard Next test controller',
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        };
        f.pads.push(menuPad);
        f.tick(2);
        menuPad.buttons[0] = { pressed: true, value: 1 };
        f.tick(2);
        menuPad.buttons[0] = { pressed: false, value: 0 };
        f.tick(2);
        assertResult(f, result);
      }
      const held = control.hold();
      await beginHeld(f, held);
      if (action === 'Back') f.tap('Escape');
      else if (action === 'blur') f.win.emit('blur');
      else if (action === 'hidden') {
        f.doc.hidden = true;
        f.doc.emit('visibilitychange');
      } else if (action === 'persisted pagehide') f.win.emit('pagehide', { persisted: true });
      else if (action === 'controller Menu') {
        menuPad.buttons[9] = { pressed: true, value: 1 };
        f.tick(2);
        menuPad.buttons[9] = { pressed: false, value: 0 };
        f.tick(2);
      } else if (action === 'direct mode link click') {
        const link = f.$('coop-solo');
        assert.notEqual(f.doc.activeElement.id, link.id);
        // The finite host dispatches the real click handler; only its keyboard
        // helper models navigation. This checks the allowed native default,
        // not a browser navigation or a focus-triggered cancellation.
        const click = link.emit('click', { button: 0 });
        assert.equal(click.defaultPrevented, false);
        assert.equal(link.getAttribute('href'), '../?journey=legacy');
        assert.notEqual(f.doc.activeElement.id, link.id);
      } else if (action === 'Settings') f.$('coop-settings-open').click();
      else if (action === 'earned picture') f.$('coop-view-picture').click();
      else f.$('coop-retry').focus();
      const focus = f.doc.activeElement.id;
      if (action === 'Settings') assert.equal(f.$('coop-options').open, true);
      if (action === 'earned picture') assert.equal(f.$('coop-earned-picture').open, true);
      assert.equal(f.$('coop-next-cancel').hidden, true);
      await releaseHeld(f, held);
      assertResult(f, result);
      assert.equal(f.doc.activeElement.id, focus, 'Late completion cannot steal newer focus.');
      if (action === 'Settings') {
        assert.equal(f.$('coop-options').open, true);
        f.$('coop-settings-close').click();
      } else if (action === 'earned picture') {
        assert.equal(f.$('coop-earned-picture').open, true);
        assert.equal(f.earnedDrawImages.at(-1)[0] === result.image, true);
        f.$('coop-picture-return').click();
      } else if (action === 'blur' || action === 'hidden' || action === 'persisted pagehide') {
        if (action === 'hidden') {
          f.doc.hidden = false;
          f.doc.emit('visibilitychange');
        } else if (action === 'persisted pagehide') f.win.emit('pageshow', { persisted: true });
        f.win.emit('focus');
        f.tick(2);
      } else if (menuPad) {
        f.pads.splice(f.pads.indexOf(menuPad), 1);
        f.tick(2);
      }
      assertResult(f, result);
    });
  }
});

test('read, decode and first-paint failures retain Results and permit a fresh explicit Next', async (t) => {
  const control = controls(t);
  const { f } = await winTeam(t, { presentation: control.presentation });
  const result = resultSnapshot(f);
  for (const boundary of ['read', 'decode', 'first paint']) {
    await t.test(boundary, async () => {
      const held = control.hold(boundary === 'decode' ? 'decode' : 'read');
      await beginHeld(f, held);
      assertResult(f, result);
      held.clear();
      if (boundary === 'first paint') {
        f.failNextPaint();
        held.gate.resolve();
      } else held.gate.reject(new Error(`Controlled Next ${boundary} failure.`));
      await waitFor(
        () => /could not start/i.test(f.$('coop-next-status').textContent),
        () => f.$('coop-next-status').textContent,
      );
      f.tick(3);
      assertResult(f, result);
      assert.equal(f.$('coop-next-cancel').hidden, true);
      assert.equal(f.doc.activeElement.id, 'coop-next');
    });
  }
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(teamImage(f).sha256, yard.picture.sha256);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
});

test('explicit Retry during pending Next restarts the accepted arena and ignores the late successor', async (t) => {
  const control = controls(t);
  const { f, first } = await winTeam(t, { presentation: control.presentation });
  const firstSource = first.image.src;
  const held = control.hold();
  await beginHeld(f, held);
  f.$('coop-retry').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(teamImage(f) === first.image, true);
  assert.deepEqual(teamHud(f), first.hud);
  await releaseHeld(f, held);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(teamImage(f) === first.image, true);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.artwork.calls.releases.includes(firstSource), false);
});

test('Choose arena during pending successor decode retains the original for a later explicit Start', async (t) => {
  const control = controls(t);
  const { f, first } = await winTeam(t, { presentation: control.presentation });
  const firstSource = first.image.src,
    held = control.hold('decode');
  await beginHeld(f, held);
  const reads = f.artwork.calls.reads.length;
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-play').hidden, true);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-stronghold-help').hidden, true);
  await releaseHeld(f, held);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.artwork.calls.reads.length, reads, 'Lobby reuses the retained picture lease.');
  assert.equal(f.artwork.calls.releases.includes(firstSource), false);
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-play').hidden, false);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(
    teamImage(f) === first.image,
    true,
    'Start reuses the exact original decoded image.',
  );
  assert.deepEqual(teamHud(f), first.hud);
  assert.equal(
    f.artwork.calls.reads.length,
    reads,
    'Start does not reacquire the retained original.',
  );
  assert.equal(f.artwork.calls.releases.includes(firstSource), false);
  assert.deepEqual(f.visits, []);
});

test('an older cancelled Next completion cannot replace a newer Next candidate or steal its focus', async (t) => {
  const control = controls(t);
  const { f } = await winTeam(t, { presentation: control.presentation });
  const result = resultSnapshot(f),
    older = control.hold();
  await beginHeld(f, older);
  f.$('coop-next-cancel').click();
  const newer = control.hold();
  await beginHeld(f, newer);
  const focus = f.doc.activeElement.id;
  older.gate.resolve();
  await waitFor(older.finished);
  await new Promise((resolve) => setImmediate(resolve));
  f.tick(3);
  assertResult(f, result);
  assert.equal(f.doc.activeElement.id, focus);
  assert.equal(
    f.$('coop-next-cancel').hidden,
    false,
    'Newer preparation still owns its cancel action.',
  );
  await releaseHeld(f, newer);
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(teamImage(f).sha256, yard.picture.sha256);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
});

test('a completed Team pack focuses Browse Team arenas and keeps the earned result available', async (t) => {
  const { f } = await winTeam(t, { level: 'relay-yard' });
  const result = resultSnapshot(f);
  assert.equal(f.$('coop-next').hidden, true);
  assert.equal(f.$('coop-next-cancel').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  assert.match(f.$('coop-overlay-copy').textContent, /Pack complete.*Browse Team arenas/i);
  f.$('coop-next').click();
  f.tick(5);
  assertResult(f, result);
  f.tap('Enter');
  assert.equal(f.$('coop-discovery-dialog').open, true);
  assertResult(f, result);
  f.$('coop-discovery-back').focus();
  f.tap('Enter');
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  assertResult(f, result);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.deepEqual(f.visits, []);
});

test('synchronous blur during the initial Preparing status retires Next before focus or picture acquisition', async (t) => {
  const { f } = await winTeam(t);
  const result = resultSnapshot(f),
    reads = f.artwork.calls.reads.length,
    focusAttempts = f.focusAttempts.length;
  let interrupted = false;
  const statuses = recordText(t, f.$('coop-next-status'), (text) => {
    if (!interrupted && /^Preparing Relay Yard/.test(text)) {
      interrupted = true;
      f.win.emit('blur');
    }
  });
  f.tap('Enter');
  await new Promise((resolve) => setImmediate(resolve));
  f.tick(3);
  assert.equal(interrupted, true);
  assertResult(f, result);
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.$('coop-next-cancel').hidden, true);
  assert.equal(
    f.focusAttempts.slice(focusAttempts).some(({ id }) => id === 'coop-next-cancel'),
    false,
    'A retired initialization cannot acquire the Cancel focus lease.',
  );
  assert.ok(statuses.some((text) => /cancelled/i.test(text)));
  assert.equal(
    statuses.some((text) => /ready\. Starting together/.test(text)),
    false,
  );
  f.win.emit('focus');
  f.tick(2);
  assertResult(f, result);
  assert.deepEqual(f.visits, []);
});
