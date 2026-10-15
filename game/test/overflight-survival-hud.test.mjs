import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { updateOverflightSurvivalHUD } from '../overflight/survival-hud.mjs';
import { OVERFLIGHT_COPY } from '../overflight/copy.mjs';
import { overflightFinalTargetLayers } from '../overflight/tactical-view.mjs';

function fixture(locale = 'en') {
  const document = new Document();
  for (const id of ['hud-salvage', 'hud-salvage-meter', 'xp-fill', 'hud-final-objective']) {
    const node = document.createElement('div');
    node.id = id;
    document.body.append(node);
  }
  const run = {
    progression: { choices: 1, xp: 44 },
    goals: { finalSpawned: false, finalDefeated: false },
  };
  const compiled = { upgrades: { thresholds: [12, 45, 100] } };
  return {
    run,
    document,
    paint: () =>
      updateOverflightSurvivalHUD({
        run,
        compiled,
        document,
        text: (key) => OVERFLIGHT_COPY[locale][key],
      }),
  };
}

test('salvage readout counts collected value, resets at each draft and handles a complete build', () => {
  const { run, document, paint } = fixture();
  const label = document.getElementById('hud-salvage'),
    meter = document.getElementById('hud-salvage-meter');
  paint();
  assert.equal(label.textContent, '1 salvage to upgrade');
  assert.equal(meter.getAttribute('aria-valuenow'), '32');
  assert.equal(meter.getAttribute('aria-valuemax'), '33');
  run.pickups = [{ active: true, value: 500 }];
  paint();
  assert.equal(label.textContent, '1 salvage to upgrade', 'dropped salvage has not been collected');
  run.progression.xp = 50;
  paint();
  assert.equal(label.textContent, '0 salvage to upgrade');
  assert.equal(meter.getAttribute('aria-valuenow'), '33', 'pending draft cannot overfill');
  run.progression.choices = 2;
  paint();
  assert.equal(label.textContent, '50 salvage to upgrade');
  assert.equal(meter.getAttribute('aria-valuenow'), '5');
  run.progression = { choices: 3, xp: 100 };
  paint();
  assert.equal(label.textContent, 'Build complete');
  assert.equal(document.getElementById('xp-fill').style.width, '100%');
});

test('final objective appears at arrival and clears on defeat and retry; Ukrainian copy is native', () => {
  const { run, document, paint } = fixture('uk');
  const objective = document.getElementById('hud-final-objective');
  paint();
  assert.equal(objective.hidden, true);
  assert.equal(document.getElementById('hud-salvage').textContent, 'Деталей до покращення: 1');
  run.goals.finalSpawned = true;
  paint();
  assert.equal(objective.hidden, false);
  assert.match(objective.textContent, /Фінальна ціль/);
  run.goals.finalDefeated = true;
  paint();
  assert.equal(objective.hidden, true);
  assert.equal(objective.textContent, '');
  run.goals = { finalSpawned: false, finalDefeated: false };
  run.progression = { choices: 0, xp: 0 };
  paint();
  assert.equal(document.getElementById('hud-salvage-meter').getAttribute('aria-valuenow'), '0');
  assert.equal(objective.hidden, true);
});

test('final-tank marker keeps direction on every edge, uses a diamond and retires for dead targets', () => {
  const camera = { x: 1440, y: 540, width: 960, height: 540 };
  for (const [dx, dy] of [
    [500, 0],
    [0, -250],
    [1000, 0],
    [-1000, 0],
    [0, 500],
    [0, -500],
    [1000, 500],
    [-1000, -500],
  ]) {
    const cues = overflightFinalTargetLayers(
      { active: true, x: camera.x + dx, y: camera.y + dy },
      camera,
      'native-tank',
    );
    const tank = cues.find((cue) => cue.frame === 'native-tank');
    const arrow = cues.find((cue) => cue.frame === 'arrow');
    assert.ok(tank);
    assert.equal(arrow.rotation, Math.atan2(dy, dx));
    assert.equal(cues.filter((cue) => cue.frame === 'bar' && cue.height === 2).length, 4);
    assert.ok(cues.length <= 7);
    for (const cue of cues) {
      assert.ok(Math.abs(cue.x - camera.x) + cue.width / 2 < camera.width / 2);
      assert.ok(Math.abs(cue.y - camera.y) + cue.height / 2 < camera.height / 2 - 40);
    }
  }
  const visible = overflightFinalTargetLayers(
    { active: true, x: 1440, y: 540 },
    camera,
    'native-tank',
  );
  assert.equal(visible.length, 4, 'visible target has only a small diamond above its native body');
  assert.equal(
    visible.some((cue) => cue.frame === 'native-tank'),
    false,
  );
  assert.deepEqual(overflightFinalTargetLayers({ active: false }, camera, 'native-tank'), []);
});
