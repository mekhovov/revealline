import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';

// Real Team host, Settings, preferences and painter; finite DOM/Canvas commands
// and image decode are not native glyph/layout or physical-input qualification.
const cssFont = (call, width) => (Number(call.state.font.match(/([\d.]+)px/)[1]) * width) / 72;
const labels = (f) => f.lastDrawing.filter((call) => call.name === 'fillText');
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
const hud = (f) =>
  [
    'coop-stage',
    'coop-clock',
    'coop-coverage',
    'coop-reserves',
    'coop-objective',
    'coop-state-0',
    'coop-state-1',
  ].map((id) => f.$(id).textContent);
const artCounts = (f) =>
  Object.fromEntries(
    Object.entries(f.artwork.calls).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.length : value,
    ]),
  );
function badge(f, id, width) {
  const end = f.lastDrawing.findIndex((call) => call.name === 'fillText' && call.args[0] === id);
  assert.ok(end >= 0, `Missing pilot ${id}`);
  const start = f.lastDrawing.slice(0, end).findLastIndex((call) => call.name === 'beginPath');
  const path = f.lastDrawing.slice(start, end);
  const cell = width / 72;
  if (id === '1') {
    const circle = path.find((call) => call.name === 'arc');
    assert.ok(circle, 'Pilot 1 retains its circle marker.');
    return circle.args[2] * 2 * cell;
  }
  const vertices = path.filter((call) => ['moveTo', 'lineTo'].includes(call.name));
  assert.equal(vertices.length, 4, 'Pilot 2 retains its four-point diamond.');
  const xs = vertices.map((call) => call.args[0]);
  const ys = vertices.map((call) => call.args[1]);
  close(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 'Diamond aspect');
  return (Math.max(...xs) - Math.min(...xs)) * cell;
}

for (const [level, width, textFace, reduced] of [
  ['first-connection', 362, 'pixel', false],
  ['first-connection', 1152, 'plain', true],
  ['relay-yard', 362, 'plain', true],
  ['relay-yard', 1152, 'pixel', false],
]) {
  test(`${level} ${width}px ${textFace}: actual Settings scales Team cues and badges without replacing or resuming the paused attempt`, async (t) => {
    const storageReads = [],
      writes = [],
      values = new Map();
    const f = await page(t, {
      nativeFocus: true,
      nativeVisibility: true,
      capturePaint: true,
      captureDrawing: true,
      beforeImport: ({ $, install }) => {
        $('coop-canvas').clientWidth = width;
        install('localStorage', {
          value: {
            getItem: (key) => {
              storageReads.push(key);
              return values.get(key) ?? null;
            },
            setItem: (key, value) => {
              writes.push(key);
              values.set(key, value);
            },
          },
        });
      },
    });
    if (f.$('coop-level').value !== level) await f.choose('coop-level', level);
    f.$('coop-start').focus();
    f.tap('Enter');
    assert.equal(f.$('coop-menu').hidden, true);
    f.tick(180);
    assert.notEqual(
      f.$('coop-clock').textContent,
      '0:00',
      'The attempt has advanced before its display changes.',
    );
    f.$('coop-pause').click();
    f.$('coop-settings-open').focus();
    f.tap('Enter');
    assert.equal(f.$('coop-options').open, true);
    assert.equal(f.$('coop-overlay').hidden, false);
    f.$('coop-settings-tab-display').click();
    f.$('coop-text-face').focus();
    f.choose('coop-text-face', textFace);
    f.$('coop-reduced').checked = reduced;
    f.$('coop-reduced').onchange();
    f.tick(2);
    const before = hud(f),
      standardPaint = f.lastPaint,
      standard = labels(f),
      image = f.drawImages.at(-1);
    const counts = artCounts(f),
      snapshot = f.artwork.snapshot;
    assert.equal(
      image.sha256,
      COOP_PICTURE_BINDINGS.find((row) => row.levelId === level).picture.sha256,
    );
    assert.ok(standard.some((call) => call.args[0] === '1'));
    assert.ok(standard.some((call) => call.args[0] === '2'));
    if (level === 'relay-yard') {
      for (const text of ['A', 'B', 'SHIELD'])
        assert.ok(
          standard.some((call) => call.args[0] === text),
          text,
        );
    }
    for (const call of standard) {
      const minimum = ['1', '2'].includes(call.args[0]) ? 14 : 12;
      assert.ok(cssFont(call, width) >= minimum - 1e-8);
      assert.ok(cssFont(call, width) <= 18 + 1e-8);
      const numeric = ['1', '2', '+'].includes(call.args[0]);
      if (textFace === 'pixel')
        assert.ok(call.state.font.endsWith(snapshot.fonts[numeric ? 'numeric' : 'ui']));
      else
        assert.ok(
          call.state.font.includes(
            numeric ? 'ui-monospace, \"SFMono-Regular\"' : 'system-ui, -apple-system',
          ),
        );
    }
    close(badge(f, '1', width), 20, 'Standard circle');
    close(badge(f, '2', width), 24, 'Standard diamond');
    f.$('coop-text-size').focus();
    f.choose('coop-text-size', 'large');
    f.tick(2);
    assert.equal(f.doc.body.dataset.textSize, 'large');
    assert.equal(
      f.doc.activeElement.id,
      'coop-text-size',
      'Preference rendering does not steal the active control.',
    );
    const large = labels(f);
    assert.deepEqual(
      large.map((call) => call.args[0]),
      standard.map((call) => call.args[0]),
      'Large keeps every currently rendered role cue.',
    );
    for (const [index, call] of large.entries())
      close(
        cssFont(call, width),
        (cssFont(standard[index], width) * 4) / 3,
        `Large ${call.args[0]}`,
      );
    close(badge(f, '1', width), 27, 'Large circle');
    close(badge(f, '2', width), 32, 'Large diamond');
    assert.notEqual(
      f.lastPaint,
      standardPaint,
      'The Canvas drawing changes, not only a DOM preference.',
    );
    assert.deepEqual(hud(f), before);
    assert.equal(f.drawImages.at(-1), image);
    assert.equal(f.artwork.snapshot, snapshot);
    assert.deepEqual(
      artCounts(f),
      counts,
      'Display changes do not prepare, decode or release another picture.',
    );
    f.choose('coop-text-size', 'standard');
    f.tick(2);
    assert.equal(
      f.lastPaint,
      standardPaint,
      'Returning to Standard exactly restores the paused Canvas trace.',
    );
    assert.deepEqual(hud(f), before);
    f.choose('coop-text-size', 'large');
    f.tick(2);
    f.$('coop-settings-close').focus();
    f.tap('Enter');
    assert.equal(f.$('coop-options').open, false);
    assert.equal(
      f.doc.activeElement.id,
      'coop-settings-open',
      'Back restores the actual Settings opener.',
    );
    assert.equal(f.$('coop-overlay').hidden, false);
    f.tick(180);
    assert.deepEqual(hud(f), before, 'Closing Settings does not implicitly resume either player.');
    assert.deepEqual(artCounts(f), counts);
    assert.deepEqual([...new Set(storageReads)].sort(), [
      'revealline.audio-master.v1',
      'revealline.display.v1',
      'revealline.menu-style.v1',
    ]);
    assert.deepEqual(
      [...new Set(writes)],
      ['revealline.display.v1'],
      'Only global display preferences are written; no Solo save/progress writes.',
    );
    assert.equal(JSON.parse(values.get('revealline.display.v1')).textSize, 'large');
    f.$('coop-resume').focus();
    f.tap('Enter');
    assert.equal(f.$('coop-overlay').hidden, true);
    f.tick(180);
    assert.notDeepEqual(
      hud(f),
      before,
      'Only the deliberate Resume advances the retained attempt.',
    );
    assert.equal(f.drawImages.at(-1), image);
    assert.deepEqual(artCounts(f), counts);
  });
}
