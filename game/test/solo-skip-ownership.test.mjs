import test from 'node:test';
import assert from 'node:assert/strict';
import { context, deferred, turnsUntil, owner, createMissionLibrary } from './solo-skip-host.mjs';

function setup(boundary = 'library lookup') {
  const f = context(),
    { ctx, $ } = f,
    gates = [deferred(), deferred(), deferred()];
  const library = createMissionLibrary([
    owner('classic-fixture', [{ id: 'current' }, { id: 'next' }]),
  ]);
  let entries = 0,
    lookups = 0,
    focusCalls = 0;
  const originalFocus = $('journey-skip').focus;
  $('journey-skip').focus = (...args) => {
    focusCalls++;
    originalFocus.call($('journey-skip'), ...args);
  };
  ctx.getUnifiedMissionLibrary = async () => {
    const index = lookups++;
    if (boundary === 'library lookup') {
      entries++;
      await gates[index].promise;
    }
    return {
      library,
      refreshInstalled: async () => {
        if (boundary === 'installed refresh') {
          entries++;
          await gates[index].promise;
        }
      },
    };
  };
  ctx.currentSoloLibraryMission = () => library.forMode('solo')[0];
  const retained = {
    run: ctx.run,
    recorder: ctx.recorder,
    profile: ctx.library,
    runJSON: JSON.stringify(ctx.run),
    profileJSON: JSON.stringify(ctx.library),
  };
  return {
    ...f,
    gates,
    entered: (n) => turnsUntil(() => entries === n),
    focusCalls: () => focusCalls,
    preserved() {
      assert.equal(ctx.run, retained.run);
      assert.equal(ctx.recorder, retained.recorder);
      assert.equal(ctx.library, retained.profile);
      assert.equal(JSON.stringify(ctx.run), retained.runJSON);
      assert.equal(JSON.stringify(ctx.library), retained.profileJSON);
    },
  };
}
function pending(f, operation) {
  assert.equal(f.ctx.librarySkipResolution, operation, 'replacement owns lookup');
  assert.equal(operation.controller.signal.aborted, false, 'replacement is not aborted');
  assert.equal(f.$('journey-skip').disabled, false, 'replacement stays focusable');
  assert.equal(
    f.$('journey-skip').getAttribute('aria-busy'),
    'true',
    'replacement keeps busy button',
  );
  assert.equal(f.ctx.journeySkipArmed, null, 'stale operation cannot arm confirmation');
  assert.equal(f.statuses.at(-1).finished, false, 'replacement retains feedback');
  f.preserved();
}

for (const boundary of ['library lookup', 'installed refresh'])
  test('retired successful completion preserves the replacement at ' + boundary, async () => {
    const f = setup(boundary),
      { ctx, gates } = f;
    const first = ctx.resolveLibrarySkip();
    await f.entered(1);
    ctx.cancelSkipResolution({ announce: false });
    const second = ctx.resolveLibrarySkip();
    await f.entered(2);
    const replacement = ctx.librarySkipResolution;
    gates[0].resolve();
    await first;
    pending(f, replacement);
    gates[1].resolve();
    await second;
    assert.equal(ctx.journeySkipArmed, ctx.runId);
    f.preserved();
  });

for (const boundary of ['library lookup', 'installed refresh'])
  test('R1 stale rejection preserves replacement at ' + boundary, async () => {
    const f = setup(boundary),
      { ctx, gates } = f;
    const first = ctx.resolveLibrarySkip();
    await f.entered(1);
    ctx.cancelSkipResolution({ announce: false });
    const second = ctx.resolveLibrarySkip();
    await f.entered(2);
    const replacement = ctx.librarySkipResolution,
      focus = f.document.activeElement;
    gates[0].reject(new Error('retired request failed'));
    await first;
    pending(f, replacement);
    assert.equal(f.document.activeElement, focus);
    gates[1].resolve();
    await second;
    assert.equal(ctx.journeySkipArmed, ctx.runId);
    f.preserved();
  });

for (const visibility of ['hidden', 'blurred'])
  test('R1 owned rejection releases lookup while ' + visibility, async () => {
    const f = setup(),
      { ctx, gates, $, document } = f;
    const first = ctx.resolveLibrarySkip();
    await f.entered(1);
    const focus = f.focusCalls();
    if (visibility === 'hidden') document.hidden = true;
    else document.hasFocus = () => false;
    gates[0].reject(new Error('owned request failed'));
    await first;
    assert.equal(ctx.librarySkipResolution, null, 'settled hidden request must release ownership');
    assert.equal($('journey-skip').disabled, false, 'settled hidden request must release button');
    assert.equal(f.statuses[0].finished, true);
    assert.equal(f.statuses[0].message, '', 'no foreground error announcement');
    assert.equal(f.focusCalls(), focus, 'no foreground focus restoration');
    assert.equal(ctx.journeySkipArmed, null);
    f.preserved();
    document.hidden = false;
    document.hasFocus = () => true;
    const retry = ctx.resolveLibrarySkip();
    await f.entered(2);
    gates[1].resolve();
    await retry;
    assert.equal(ctx.journeySkipArmed, ctx.runId);
    f.preserved();
  });

test('R1 retired feedback cancel callback cannot cancel replacement', async () => {
  const f = setup(),
    { ctx, gates } = f;
  const first = ctx.resolveLibrarySkip();
  await f.entered(1);
  const oldCancel = f.statuses[0].cancel;
  ctx.cancelSkipResolution({ announce: false });
  const second = ctx.resolveLibrarySkip();
  await f.entered(2);
  const replacement = ctx.librarySkipResolution;
  oldCancel({ restoreFocus: true });
  pending(f, replacement);
  gates[0].resolve();
  gates[1].resolve();
  await Promise.all([first, second]);
  assert.equal(ctx.journeySkipArmed, ctx.runId);
  f.preserved();
});

test('R1 abort callback reentry keeps replacement UI ownership', async () => {
  const f = setup(),
    { ctx, gates } = f;
  const first = ctx.resolveLibrarySkip();
  await f.entered(1);
  const retired = ctx.librarySkipResolution;
  let second;
  retired.controller.signal.addEventListener(
    'abort',
    () => {
      assert.equal(ctx.librarySkipResolution, null, 'retire before abort callbacks');
      second = ctx.resolveLibrarySkip();
    },
    { once: true },
  );
  ctx.cancelSkipResolution({ announce: false });
  await f.entered(2);
  const replacement = ctx.librarySkipResolution;
  pending(f, replacement);
  gates[0].resolve();
  await first;
  pending(f, replacement);
  gates[1].resolve();
  await second;
  assert.equal(ctx.journeySkipArmed, ctx.runId);
  f.preserved();
});

for (const completion of ['cancel', 'success', 'error'])
  test('R1 ' + completion + ' feedback reentry keeps replacement UI ownership', async () => {
    const f = setup(),
      { ctx, gates } = f;
    const first = ctx.resolveLibrarySkip();
    await f.entered(1);
    const retired = ctx.librarySkipResolution,
      finish = retired.feedback.finish;
    let second;
    retired.feedback.finish = (...args) => {
      finish(...args);
      assert.equal(ctx.librarySkipResolution, null, 'retire before feedback callbacks');
      second = ctx.resolveLibrarySkip();
    };
    if (completion === 'cancel') ctx.cancelSkipResolution({ announce: false });
    else if (completion === 'success') gates[0].resolve();
    else gates[0].reject(new Error('owned lookup failed'));
    await f.entered(2);
    const replacement = ctx.librarySkipResolution;
    if (completion === 'cancel') gates[0].resolve();
    await first;
    pending(f, replacement);
    gates[1].resolve();
    await second;
    assert.equal(ctx.journeySkipArmed, ctx.runId);
    f.preserved();
  });

test('R1 completed feedback cannot resurrect confirmation after reentrant start and cancellation', async () => {
  const f = setup(),
    { ctx, gates, $ } = f;
  const first = ctx.resolveLibrarySkip();
  await f.entered(1);
  const retired = ctx.librarySkipResolution,
    finish = retired.feedback.finish;
  let second;
  retired.feedback.finish = (...args) => {
    finish(...args);
    second = ctx.resolveLibrarySkip();
    ctx.cancelSkipResolution({ announce: false });
  };
  gates[0].resolve();
  await first;
  assert.equal(ctx.librarySkipResolution, null);
  assert.equal(ctx.journeySkipArmed, null, 'newer cancelled intent prevents stale confirmation');
  assert.equal($('journey-skip').disabled, false);
  gates[1].resolve();
  await second;
  f.preserved();
});
