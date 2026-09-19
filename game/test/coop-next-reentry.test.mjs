import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { winTeam, teamHud, teamImage } from './helpers/coop-win.mjs';

// Legal command-earned wins through the actual Team host. Reentrant callbacks
// model hostile DOM/URL boundaries, not a browser rendering or layout result.
const yard = COOP_PICTURE_BINDINGS.find((row) => row.levelId === 'relay-yard');
assert.ok(yard);
const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};
const releases = (f, url) => f.artwork.calls.releases.filter((entry) => entry === url).length;
const nextUI = (f) => ({
  status: f.$('coop-next-status').textContent,
  statusHidden: f.$('coop-next-status').hidden,
  cancelHidden: f.$('coop-next-cancel').hidden,
  busy: f.$('coop-next').getAttribute('aria-busy'),
  focus: f.doc.activeElement.id,
});
const resultSnapshot = (f) => ({
  hud: teamHud(f),
  paint: f.lastPaint,
  image: teamImage(f),
  imageURL: teamImage(f).src,
  title: f.$('coop-overlay-title').textContent,
  copy: f.$('coop-overlay-copy').textContent,
});
function assertResult(f, result) {
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.equal(f.$('coop-overlay-title').textContent, result.title);
  assert.equal(f.$('coop-overlay-copy').textContent, result.copy);
  assert.deepEqual(teamHud(f), result.hud);
  assert.equal(f.lastPaint, result.paint);
  assert.equal(teamImage(f), result.image);
  assert.equal(releases(f, result.imageURL), 0);
}

test('a one-shot stage publication exception after Next first paint restores earned Results and allows a fresh Next', async (t) => {
  const { f } = await winTeam(t);
  const result = resultSnapshot(f),
    stage = f.$('coop-stage'),
    priorDescriptor = Object.getOwnPropertyDescriptor(stage, 'textContent'),
    nativeDescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(stage), 'textContent');
  assert.equal(typeof nativeDescriptor?.set, 'function');
  let failures = 0,
    sawFirstPaint = false;
  Object.defineProperty(stage, 'textContent', {
    configurable: true,
    get() {
      return nativeDescriptor.get.call(this);
    },
    set(value) {
      if (value === 'RELAY YARD' && failures === 0) {
        failures++;
        sawFirstPaint = f.drawImages.some((image) => image.sha256 === yard.picture.sha256);
        throw new Error('Controlled stage publication refusal');
      }
      nativeDescriptor.set.call(this, value);
    },
  });
  t.after(() => {
    if (priorDescriptor) Object.defineProperty(stage, 'textContent', priorDescriptor);
    else delete stage.textContent;
  });
  f.$('coop-next').click();
  await waitFor(
    () => /could not start/i.test(f.$('coop-next-status').textContent),
    () => f.$('coop-next-status').textContent,
  );
  await flush();
  assert.equal(failures, 1);
  assert.equal(sawFirstPaint, true, 'The failure occurs after the actual candidate picture paint.');
  assertResult(f, result);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.equal(f.$('coop-next-cancel').hidden, true);
  assert.equal(f.artwork.calls.urls.length, 2);
  assert.equal(releases(f, f.artwork.calls.urls[1]), 1, 'Only the rejected candidate is retired.');
  f.tick(10);
  assertResult(f, result);
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(teamImage(f).sha256, yard.picture.sha256);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.artwork.calls.urls.length, 3);
  assert.equal(releases(f, result.imageURL), 1);
  assert.equal(releases(f, f.artwork.calls.urls[1]), 1);
  assert.equal(releases(f, f.artwork.calls.urls[2]), 0);
});

for (const action of ['Next', 'Retry'])
  test(`candidate URL cleanup reenters ${action}; the old cancellation cannot overwrite its status or focus`, async (t) => {
    const olderDecode = deferred(),
      newerRead = deferred();
    t.after(() => {
      olderDecode.resolve();
      newerRead.resolve();
    });
    let yardReads = 0,
      yardDecodes = 0,
      oldDecodeEntered = false,
      newReadEntered = false;
    const { f, first } = await winTeam(t, {
      presentation: {
        async read({ slot }) {
          if (slot !== yard.picture.slot) return;
          if (++yardReads === 2) {
            newReadEntered = true;
            await newerRead.promise;
          }
        },
        async decode({ image }) {
          if (image.sha256 !== yard.picture.sha256) return;
          if (++yardDecodes === 1) {
            oldDecodeEntered = true;
            await olderDecode.promise;
          }
        },
      },
    });
    const result = resultSnapshot(f);
    f.$('coop-next').click();
    await waitFor(
      () => oldDecodeEntered,
      () => f.$('coop-next-status').textContent,
    );
    assertResult(f, result);
    assert.equal(f.artwork.calls.urls.length, 2);
    const rejectedURL = f.artwork.calls.urls[1],
      urlClass = globalThis.URL,
      revoke = urlClass.revokeObjectURL;
    let reentered = 0,
      afterReentry;
    t.mock.method(urlClass, 'revokeObjectURL', function (url) {
      revoke.call(this, url);
      if (url !== rejectedURL || reentered) return;
      reentered++;
      if (action === 'Next') f.$('coop-next').click();
      else {
        f.$('coop-retry').focus();
        f.tap('Enter');
      }
      afterReentry = nextUI(f);
    });
    f.$('coop-next-cancel').click();
    assert.equal(reentered, 1, 'Actual candidate URL retirement must cross the reentry boundary.');
    assert.deepEqual(nextUI(f), afterReentry, 'The returning old cancel preserves the newer UI.');
    assert.equal(releases(f, rejectedURL), 1);
    assert.equal(releases(f, result.imageURL), 0);
    if (action === 'Next') {
      await waitFor(
        () => newReadEntered,
        () => f.$('coop-next-status').textContent,
      );
      assertResult(f, result);
      assert.equal(f.doc.activeElement.id, 'coop-next-cancel');
      assert.equal(f.$('coop-next-cancel').hidden, false);
      assert.equal(f.$('coop-next').getAttribute('aria-busy'), 'true');
      const newerUI = nextUI(f);
      olderDecode.resolve();
      await flush();
      assert.deepEqual(
        nextUI(f),
        newerUI,
        'The older decode completion cannot repaint new status.',
      );
      assertResult(f, result);
      newerRead.resolve();
      await waitFor(
        () => f.$('coop-overlay').hidden,
        () => f.$('coop-next-status').textContent,
      );
      assert.equal(teamImage(f).sha256, yard.picture.sha256);
      assert.equal(f.doc.activeElement.id, 'coop-canvas');
      assert.equal(f.artwork.calls.urls.length, 3);
      assert.equal(releases(f, rejectedURL), 1);
      assert.equal(releases(f, result.imageURL), 1);
      assert.equal(releases(f, f.artwork.calls.urls[2]), 0);
    } else {
      assert.equal(f.$('coop-overlay').hidden, true);
      assert.equal(f.doc.activeElement.id, 'coop-canvas');
      assert.deepEqual(teamHud(f), first.hud);
      assert.equal(f.lastPaint, first.paint);
      assert.equal(teamImage(f), first.image);
      olderDecode.resolve();
      await flush();
      assert.deepEqual(nextUI(f), afterReentry);
      assert.deepEqual(teamHud(f), first.hud);
      assert.equal(f.lastPaint, first.paint);
      assert.equal(teamImage(f), first.image);
      assert.equal(yardReads, 1, 'Retry does not secretly prepare another successor.');
      assert.equal(f.artwork.calls.urls.length, 2);
      assert.equal(releases(f, result.imageURL), 0);
    }
  });

test('retiring the old image after successful Next may open Settings without a later canvas focus or automatic resume', async (t) => {
  const { f } = await winTeam(t);
  const oldURL = teamImage(f).src,
    urlClass = globalThis.URL,
    revoke = urlClass.revokeObjectURL;
  let opened = 0,
    focused,
    focusCount,
    paused;
  t.mock.method(urlClass, 'revokeObjectURL', function (url) {
    revoke.call(this, url);
    if (url !== oldURL || opened) return;
    opened++;
    // Settings is reached through the visible Pause tools during a live arena.
    f.$('coop-pause').click();
    f.$('coop-settings-open').click();
    focused = f.doc.activeElement;
    focusCount = f.focusAttempts.length;
    paused = { hud: teamHud(f), paint: f.lastPaint };
  });
  f.$('coop-next').click();
  await waitFor(
    () => opened === 1,
    () => f.$('coop-next-status').textContent,
  );
  await flush();
  assert.equal(f.$('coop-options').open, true);
  assert.equal(f.$('coop-options').contains(focused), true);
  assert.equal(f.doc.activeElement, focused);
  assert.equal(f.focusAttempts.length, focusCount, 'The old continuation performs no later focus.');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  assert.equal(teamImage(f).sha256, yard.picture.sha256);
  const acceptedYard = teamImage(f),
    acceptedYardURL = acceptedYard.src,
    preparedReads = f.artwork.calls.reads.length;
  assert.equal(releases(f, oldURL), 1);
  assert.equal(f.artwork.calls.urls.length, 2);
  assert.equal(releases(f, f.artwork.calls.urls[1]), 0);
  f.tick(90);
  assert.deepEqual({ hud: teamHud(f), paint: f.lastPaint }, paused);
  f.$('coop-settings-close').click();
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-difficulty').value, 'standard');
  assert.equal(f.$('coop-experiment').value, 'full');
  f.tick(90);
  assert.deepEqual({ hud: teamHud(f), paint: f.lastPaint }, paused);
  assert.equal(f.$('coop-overlay').hidden, false, 'Closing Settings leaves Resume explicit.');
  f.$('coop-resume').click();
  // The displayed timer is whole seconds; 90 ticks is only 0.75 seconds.
  f.tick(180);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.notDeepEqual(teamHud(f), paused.hud);
  assert.equal(teamImage(f), acceptedYard);
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-difficulty').value, 'standard');
  assert.equal(f.$('coop-experiment').value, 'full');
  assert.equal(f.$('coop-picture-status').dataset.state, 'ready');
  assert.equal(f.previewDrawImages.at(-1), acceptedYard);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.artwork.calls.reads.length, preparedReads);
  assert.equal(f.artwork.calls.urls.length, 2);
  assert.equal(releases(f, acceptedYardURL), 0);
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.match(f.$('coop-stage').textContent, /Relay Yard/i);
  assert.equal(teamImage(f), acceptedYard);
  assert.equal(f.artwork.calls.reads.length, preparedReads);
  assert.equal(f.artwork.calls.urls.length, 2);
  assert.equal(releases(f, oldURL), 1);
  assert.equal(releases(f, acceptedYardURL), 0);
});

for (const [phase, paintNumber] of [
  ['first candidate paint', 1],
  ['committed repaint', 2],
])
  test(`terminal disposal during the ${phase} retires both originals once and prevents later focus`, async (t) => {
    const { f } = await winTeam(t);
    const oldURL = teamImage(f).src,
      context = f.$('coop-canvas').getContext('2d'),
      draw = context.drawImage;
    let yardPaints = 0,
      terminated = false,
      focusAfterDeparture;
    context.drawImage = function (image, ...args) {
      draw.call(this, image, ...args);
      if (image.sha256 !== yard.picture.sha256 || ++yardPaints !== paintNumber) return;
      terminated = true;
      f.win.emit('pagehide', { persisted: false });
      focusAfterDeparture = f.focusAttempts.length;
    };
    t.after(() => {
      context.drawImage = draw;
    });
    f.$('coop-next').click();
    await waitFor(
      () => terminated,
      () => f.$('coop-next-status').textContent,
    );
    await flush();
    assert.equal(yardPaints, paintNumber, 'The requested actual repaint boundary was reached.');
    assert.equal(f.artwork.calls.urls.length, 2);
    assert.equal(releases(f, oldURL), 1);
    assert.equal(releases(f, f.artwork.calls.urls[1]), 1);
    assert.equal(f.artwork.calls.releases.length, 2, 'No lease is leaked or retired twice.');
    assert.equal(f.artwork.calls.closes, 1);
    assert.equal(f.focusAttempts.length, focusAfterDeparture);
    assert.equal(f.$('coop-next').onclick, null);
    assert.equal(f.$('coop-next-cancel').onclick, null);
    const images = f.drawImages.length;
    f.win.emit('pagehide', { persisted: false });
    f.win.emit('pageshow', { persisted: true });
    await flush();
    assert.equal(f.drawImages.length, images, 'Late lifecycle events do not paint another arena.');
    assert.equal(f.artwork.calls.releases.length, 2);
    assert.equal(f.artwork.calls.closes, 1);
    assert.equal(f.focusAttempts.length, focusAfterDeparture);
  });
