import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { winTeam, teamHud, teamImage } from './helpers/coop-win.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';

// Queued Team Next composition: actual host/readers/core and a legal keyboard
// win, with finite DOM/Canvas and controlled picture IO. No native or public claim.
const yard = COOP_PICTURE_BINDINGS.find((row) => row.levelId === 'relay-yard');
assert.ok(yard);
const options = { nativeFocus: true, nativeVisibility: true, capturePaint: true };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const pictureState = (f) => f.$('coop-picture-status').dataset.state;
const pictureSettled = (f, state = 'ready') =>
  waitFor(
    () => pictureState(f) === state,
    () => f.$('coop-picture-status').textContent,
  );

function recordText(t, node) {
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
      // Capture even a synchronously replaced error. A settled-value assertion
      // alone cannot protect the role=status/aria-live DOM from diagnostics.
      writes.push(String(value));
      original.set.call(this, value);
    },
  });
  t.after(() => {
    if (own) Object.defineProperty(node, 'textContent', own);
    else delete node.textContent;
  });
  return writes;
}
function recordStatuses(t, $) {
  return [recordText(t, $('coop-picture-status')), recordText(t, $('coop-next-status'))];
}
function assertNoDiagnostic(writes, marker) {
  assert.ok(
    writes.some((stream) => stream.length > 0),
    'The real host wrote a status.',
  );
  assert.equal(
    writes.flat().some((value) => value.includes(marker)),
    false,
    'No intermediate or settled player status may expose the diagnostic marker.',
  );
}
function assertLogged(faults, refusal) {
  assert.equal(
    faults.filter((args) => args.some((value) => value === refusal)).length,
    1,
    'Console diagnostics retain the original exception object exactly once.',
  );
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
function holdYard(t, kind = 'read', forwardedMarker = null) {
  const gate = deferred();
  let entered = false,
    held = true,
    forwarded = false;
  t.after(() => gate.resolve());
  return {
    gate,
    entered: () => entered,
    forwarded: () => forwarded,
    release: () => {
      held = false;
    },
    presentation: {
      async read({ slot, options: readOptions }) {
        if (kind === 'read' && held && slot === yard.picture.slot) {
          if (forwardedMarker) {
            assert.equal(typeof readOptions.onStatus, 'function');
            // This is the actual reader status callback, before bytes are
            // returned, authenticated or decoded. Its stage cannot start play.
            readOptions.onStatus({ stage: 'ready', message: forwardedMarker });
            forwarded = true;
          }
          entered = true;
          await gate.promise;
        }
      },
      async decode({ image }) {
        if (kind === 'decode' && held && image.sha256 === yard.picture.sha256) {
          entered = true;
          await gate.promise;
        }
      },
    },
  };
}
async function beginNext(f, held) {
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(held.entered, () => f.$('coop-next-status').textContent);
  assert.equal(f.$('coop-next-cancel').hidden, false);
  assert.equal(f.$('coop-next-status').hidden, false);
  assert.equal(f.$('coop-next-status').getAttribute('role'), 'status');
}
async function recoverNext(f) {
  assert.equal(f.$('coop-next').hidden, false);
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(teamImage(f).sha256, yard.picture.sha256);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.$('coop-clock').textContent, '0:00');
}

for (const boundary of ['read', 'decode']) {
  test(`lobby ${boundary} failure keeps every status player-facing and logs the original exception`, async (t) => {
    const marker = `PRIVATE_TEAM_LOBBY_${boundary.toUpperCase()}_DIAGNOSTIC`;
    const refusal = new Error(marker),
      faults = [],
      gate = deferred();
    let fail = true,
      entered = false,
      statuses;
    t.after(() => gate.resolve());
    t.mock.method(console, 'error', (...args) => faults.push(args));
    const f = await page(t, {
      ...options,
      waitPicture: false,
      beforeImport({ $ }) {
        statuses = recordStatuses(t, $);
      },
      presentation: {
        [boundary]: async () => {
          if (fail) {
            entered = true;
            await gate.promise;
          }
        },
      },
    });
    await waitFor(
      () => entered,
      () => f.$('coop-picture-status').textContent,
    );
    assert.equal(f.$('coop-start').disabled, true);
    fail = false;
    gate.reject(refusal);
    await pictureSettled(f, 'error');
    await flush();
    assertNoDiagnostic(statuses, marker);
    assertLogged(faults, refusal);
    assert.equal(
      f.$('coop-picture-status').textContent,
      'Team picture unavailable. Retry picture or choose another arena.',
    );
    assert.equal(f.$('coop-picture-retry').hidden, false);
    assert.equal(f.$('coop-start').disabled, true);
    assert.equal(f.doc.activeElement.id, 'coop-picture-retry');
    assert.equal(f.drawImages.length, 0, 'Failure cannot start a procedural substitute.');
    f.tap('Enter');
    await pictureSettled(f);
    assert.equal(f.$('coop-menu').hidden, false, 'Retry prepares but does not auto-start.');
    f.$('coop-start').focus();
    f.tap('Enter');
    await waitFor(() => f.$('coop-menu').hidden);
    f.tick(2);
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.ok(teamImage(f)?.sha256, 'A deliberate Start paints the prepared original.');
    assertNoDiagnostic(statuses, marker);
    assertLogged(faults, refusal);
  });
}

for (const boundary of ['read', 'decode', 'paint']) {
  test(`Next ${boundary} failure hides all diagnostics, keeps the earned result and allows explicit recovery`, async (t) => {
    const marker = `PRIVATE_TEAM_NEXT_${boundary.toUpperCase()}_DIAGNOSTIC`;
    const refusal = new Error(marker),
      faults = [],
      held = holdYard(
        t,
        boundary === 'decode' ? 'decode' : 'read',
        boundary === 'read' ? marker : null,
      );
    t.mock.method(console, 'error', (...args) => faults.push(args));
    const { f } = await winTeam(t, { presentation: held.presentation });
    const result = resultSnapshot(f),
      statuses = recordStatuses(t, f.$);
    await beginNext(f, held);
    const pendingStatuses = [...statuses[1]];
    assertResult(f, result);
    held.release();
    if (boundary === 'paint') {
      // Inject the precise original exception at the existing finite Canvas
      // boundary. The production painter and its rollback remain real.
      const context = f.$('coop-canvas').getContext('2d');
      const own = Object.getOwnPropertyDescriptor(context, 'save');
      const restore = () => {
        if (own) Object.defineProperty(context, 'save', own);
        else delete context.save;
      };
      t.after(restore);
      context.save = () => {
        restore();
        throw refusal;
      };
      held.gate.resolve();
    } else held.gate.reject(refusal);
    await waitFor(
      () => /could not start/i.test(f.$('coop-next-status').textContent),
      () => f.$('coop-next-status').textContent,
    );
    await flush();
    f.tick(3);
    if (boundary === 'read') {
      assert.equal(held.forwarded(), true, 'The real lower-level reader status was exercised.');
      assert.equal(
        pendingStatuses.some((text) => /ready|starting together/i.test(text)),
        false,
        'A forwarded ready stage cannot announce final readiness while the read is held.',
      );
    }
    assertNoDiagnostic(statuses, marker);
    assertLogged(faults, refusal);
    assert.equal(
      f.$('coop-next-status').textContent,
      'Could not start Relay Yard. Your result is unchanged. Try Next again.',
    );
    assertResult(f, result);
    assert.equal(f.$('coop-next-cancel').hidden, true);
    assert.equal(f.doc.activeElement.id, 'coop-next');
    await recoverNext(f);
    assert.equal(teamImage(f) === result.image, false);
    assert.equal(
      f.artwork.calls.releases.filter((source) => source === result.imageSource).length,
      1,
    );
    assertNoDiagnostic(statuses, marker);
    assertLogged(faults, refusal);
  });
}

test('Next logger reentry can cancel the pending action without a returning catch replacing cancellation', async (t) => {
  const marker = 'PRIVATE_TEAM_NEXT_LOGGER_REENTRY_DIAGNOSTIC';
  const refusal = new Error(marker),
    faults = [],
    held = holdYard(t);
  const { f } = await winTeam(t, { presentation: held.presentation });
  const result = resultSnapshot(f),
    statuses = recordStatuses(t, f.$);
  let cancelled = false,
    cancellationText;
  t.mock.method(console, 'error', (...args) => {
    faults.push(args);
    if (!cancelled && args.some((value) => value === refusal)) {
      cancelled = true;
      // Console adapters are an external callback boundary. Cancel uses the
      // offered control, not a private operation/state mutation.
      f.$('coop-next-cancel').click();
      cancellationText = f.$('coop-next-status').textContent;
    }
  });
  await beginNext(f, held);
  held.release();
  held.gate.reject(refusal);
  await waitFor(
    () => cancelled || /could not start/i.test(f.$('coop-next-status').textContent),
    () => f.$('coop-next-status').textContent,
  );
  await flush();
  f.tick(3);
  assert.equal(cancelled, true, 'The original exception reaches the logger.');
  assert.match(cancellationText, /cancelled/i);
  assert.equal(f.$('coop-next-status').textContent, cancellationText);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.equal(f.$('coop-next-cancel').hidden, true);
  assertNoDiagnostic(statuses, marker);
  assertLogged(faults, refusal);
  assertResult(f, result);
  await recoverNext(f);
  assertNoDiagnostic(statuses, marker);
});
