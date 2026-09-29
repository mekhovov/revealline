import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';

// Real entry, core, input, Settings and message owner with the established finite
// DOM/Canvas fixture. No app-state injection, wall-clock timer or native-input claim.
const message = (f) => f.$('coop-message').textContent;
const labels = (f) =>
  f.lastDrawing.filter((call) => call.name === 'fillText').map((call) => call.args[0]);
// Observe the real painter's outlined target marks, not a symbol stub. Targets
// sit above/right of the owner in local cue space: P1 is a circle and P2 a
// closed four-point diamond. Other arena circles/diamonds remain owner-centred
// or use world coordinates, so they cannot stand in for these target marks.
const targetShapes = (f) => {
  let path = [];
  const shapes = [];
  for (const call of f.lastDrawing) {
    if (call.name === 'beginPath') path = [];
    else if (['arc', 'moveTo', 'lineTo', 'closePath'].includes(call.name)) path.push(call);
    else if (call.name === 'stroke' && call.state.lineWidth === 1.5) {
      if (path.length === 1 && path[0].name === 'arc') {
        const [x, y, radius] = path[0].args;
        if (x > 0 && y < 0 && radius > 0) shapes.push('circle');
      } else if (path.length === 5 && path[4].name === 'closePath') {
        const points = path.slice(0, 4).map((point) => point.args);
        const [[x, top], [right, y], [bottomX, bottom], [left, leftY]] = points;
        if (
          points.every(([px, py]) => px > 0 && py < 0) &&
          bottomX === x &&
          leftY === y &&
          left < x &&
          x < right &&
          top < y &&
          y < bottom
        )
          shapes.push('diamond');
      }
    }
  }
  return shapes.sort();
};
const hud = (f) =>
  [
    'coop-clock',
    'coop-coverage',
    'coop-reserves',
    'coop-state-0',
    'coop-state-1',
    'coop-objective',
  ].map((id) => f.$(id).textContent);
const activate = (f, id) => {
  f.$(id).focus();
  f.tap('Enter');
};
function until(f, predicate, maximum, label) {
  for (let tick = 0; tick < maximum; tick++) {
    if (predicate()) return tick;
    f.tick();
  }
  assert.ok(predicate(), `${label}: ${JSON.stringify({ hud: hud(f), message: message(f) })}`);
  return maximum;
}
async function start(t) {
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    captureDrawing: true,
  });
  await f.choose('coop-level', 'first-connection');
  activate(f, 'coop-start');
  f.tick(2);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  return f;
}
function settings(f) {
  activate(f, 'coop-pause');
  activate(f, 'coop-settings-open');
  activate(f, 'coop-settings-tab-display');
  assert.equal(f.$('coop-options').open, true);
  assert.equal(f.$('coop-overlay').hidden, false);
  f.$('coop-text-size').focus();
}
function size(f, value) {
  f.choose('coop-text-size', value);
  f.tick(2);
  assert.equal(f.doc.body.dataset.textSize, value);
  assert.equal(f.doc.activeElement.id, 'coop-text-size');
}

test('Large without an immediate threat preserves the ordinary advisory and paused focus', async (t) => {
  const f = await start(t);
  const ordinary = message(f);
  assert.equal(
    ordinary,
    'Watch the Hunter warnings. Cover a crossing or join after the charge passes.',
  );
  settings(f);
  const before = hud(f),
    standardPaint = f.lastPaint;
  size(f, 'large');
  assert.equal(message(f), ordinary);
  const focusCount = f.focusAttempts.length;
  f.tick(120);
  assert.deepEqual(hud(f), before);
  assert.equal(f.focusAttempts.length, focusCount, 'Advisory rendering does not request focus.');
  size(f, 'standard');
  assert.equal(message(f), ordinary);
  assert.equal(f.lastPaint, standardPaint);
  activate(f, 'coop-settings-close');
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  f.tick(120);
  assert.deepEqual(hud(f), before, 'Settings close never resumes flight.');
});

test('ordinary two-player cuts produce lock and charge summaries; Settings retains the attempt and message owner', async (t) => {
  const f = await start(t),
    ordinary = message(f);
  f.tap('KeyD');
  f.tap('ArrowLeft');
  const warningTicks = until(
    f,
    () => labels(f).includes('LOCK 1') && labels(f).includes('LOCK 2'),
    240,
    'Both real hunters warn against the two opened cuts',
  );
  assert.equal(message(f), ordinary, 'Standard retains its original advisory during warnings.');
  settings(f);
  const stopped = hud(f),
    standardPaint = f.lastPaint,
    image = f.drawImages.at(-1),
    summary = 'Hunter lock: Players 1 and 2';
  size(f, 'large');
  assert.equal(message(f), summary);
  assert.deepEqual(
    targetShapes(f),
    ['circle', 'diamond'],
    'Both live Hunter targets retain distinct nonverbal identities.',
  );
  assert.ok(
    !labels(f).includes('P1') && !labels(f).includes('P2'),
    'Large does not reintroduce displaced target captions.',
  );
  const focusCount = f.focusAttempts.length;
  f.tick(120);
  assert.equal(message(f), summary);
  assert.deepEqual(hud(f), stopped);
  assert.equal(f.focusAttempts.length, focusCount);
  size(f, 'standard');
  assert.equal(message(f), ordinary, 'Standard restores the last ordinary message verbatim.');
  assert.equal(f.lastPaint, standardPaint, 'The identical retained warning frame is restored.');
  size(f, 'large');
  assert.equal(message(f), summary);
  activate(f, 'coop-settings-close');
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  f.tick(120);
  assert.deepEqual(hud(f), stopped);
  assert.equal(message(f), summary);
  assert.equal(f.drawImages.at(-1), image);

  activate(f, 'coop-resume');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  const resumedFocusCount = f.focusAttempts.length;
  const chargeTicks = until(
    f,
    () => message(f).includes('Hunter charge: Player 1'),
    240,
    'Only explicit Resume advances the warning into a committed charge',
  );
  assert.match(message(f), /Hunter charge: Player 1/);
  assert.equal(f.focusAttempts.length, resumedFocusCount);
  assert.notDeepEqual(hud(f), stopped);
  settings(f);
  const chargeFrame = hud(f);
  size(f, 'standard');
  assert.equal(
    message(f),
    'Choose fresh directions when you are ready.',
    'Resume becomes the latest ordinary message; the initial briefing is not resurrected.',
  );
  size(f, 'large');
  assert.match(message(f), /Hunter charge: Player 1/);
  assert.deepEqual(hud(f), chargeFrame);
  t.diagnostic(
    JSON.stringify({ warningTicks, chargeTicks, boundary: 'ordinary input, finite host' }),
  );
});

test('a Hunter-caused knockdown keeps rescue guidance ahead of Large threat summaries', async (t) => {
  const f = await start(t);
  settings(f);
  size(f, 'large');
  activate(f, 'coop-settings-close');
  activate(f, 'coop-resume');
  f.tick(2);
  f.tap('KeyD');
  f.tap('ArrowLeft');
  until(f, () => message(f).includes('Hunter lock:'), 240, 'A cut creates an actual lock');
  const downTicks = until(
    f,
    () =>
      [f.$('coop-state-0').textContent, f.$('coop-state-1').textContent].some((text) =>
        /^(Rescue|Down)/.test(text),
      ),
    720,
    'An unprotected live cut receives a real knockdown',
  );
  const rescue = message(f);
  assert.match(rescue, /needs a rescue/);
  assert.doesNotMatch(rescue, /Hunter lock:|Hunter charge:/);
  settings(f);
  const stopped = hud(f);
  size(f, 'standard');
  assert.equal(message(f), rescue);
  size(f, 'large');
  assert.equal(message(f), rescue);
  f.tick(120);
  assert.equal(message(f), rescue);
  assert.deepEqual(hud(f), stopped);
  assert.equal(f.doc.activeElement.id, 'coop-text-size');
  t.diagnostic(
    JSON.stringify({ downTicks, boundary: 'ordinary input, finite host; not a playtest' }),
  );
});

for (const failure of ['confirmation', 'navigation'])
  test(`a ${failure} failure retains its explanation over a paused Large threat until explicit recovery`, async (t) => {
    const f = await start(t);
    f.tap('KeyD');
    f.tap('ArrowLeft');
    until(
      f,
      () => labels(f).includes('LOCK 1') && labels(f).includes('LOCK 2'),
      240,
      'Ordinary input creates both real Hunter warnings',
    );
    settings(f);
    size(f, 'large');
    assert.equal(message(f), 'Hunter lock: Players 1 and 2');
    activate(f, 'coop-settings-close');
    const paused = hud(f);
    if (failure === 'confirmation') {
      const unavailable = t.mock.method(f.$('coop-discard-dialog'), 'showModal', () => {
        throw new Error('Confirmation unavailable');
      });
      activate(f, 'coop-retry');
      unavailable.mock.restore();
    } else {
      const unavailable = t.mock.method(globalThis.location, 'assign', () => {
        throw new Error('Navigation unavailable');
      });
      activate(f, 'coop-versus');
      assert.equal(f.$('coop-discard-dialog').open, true);
      activate(f, 'coop-discard-confirm');
      unavailable.mock.restore();
    }
    const explanation = message(f),
      focus = f.doc.activeElement.id,
      focusCount = f.focusAttempts.length;
    assert.match(
      explanation,
      failure === 'confirmation'
        ? /Could not open the confirmation.*paused: Confirmation unavailable/
        : /could not be replaced: Navigation unavailable/,
    );
    assert.equal(f.$('coop-discard-dialog').open, false);
    f.tick(120);
    assert.equal(message(f), explanation, 'The next frame cannot erase the failed-action reason.');
    assert.deepEqual(hud(f), paused);
    assert.equal(f.doc.activeElement.id, focus);
    assert.equal(f.focusAttempts.length, focusCount);

    activate(f, 'coop-settings-open');
    activate(f, 'coop-settings-tab-display');
    f.$('coop-text-size').focus();
    size(f, 'standard');
    assert.equal(message(f), explanation);
    size(f, 'large');
    assert.equal(
      message(f),
      explanation,
      'Changing appearance does not resolve the failed action.',
    );
    activate(f, 'coop-settings-close');
    assert.deepEqual(hud(f), paused);

    if (failure === 'confirmation') {
      activate(f, 'coop-resume');
      f.tick(2);
      assert.equal(message(f), 'Hunter lock: Players 1 and 2');
    } else {
      activate(f, 'coop-retry');
      activate(f, 'coop-discard-confirm');
      f.tick(2);
      assert.equal(
        message(f),
        'Watch the Hunter warnings. Cover a crossing or join after the charge passes.',
        'A successfully started Retry owns new ordinary guidance.',
      );
      f.tap('KeyD');
      f.tap('ArrowLeft');
      until(
        f,
        () => message(f) === 'Hunter lock: Players 1 and 2',
        240,
        'The replacement attempt can again show current threat summaries',
      );
    }
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
  });
