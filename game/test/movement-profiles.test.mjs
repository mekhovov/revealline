import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ENEMY_CATALOG, ENEMY_THEMES, enemySkinId } from '../enemy-catalog.mjs';
import { JOURNEY_ACTOR_MATERIALS } from '../presentation/journey-actor-materials.mjs';
import { FPV_BODY_RECIPES } from '../ui/fpv-body-recipes.mjs';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import {
  PLAYER_MOVEMENT,
  ENEMY_MOVEMENT,
  recordedMovement,
  playerMovementBody,
} from '../ui/movement-profiles.mjs';
const recorded = new Set([
  'rotor',
  'motor',
  'wings',
  'grain',
  'wheels',
  'ceramic',
  'wood',
  'ratchet',
  'bell',
]);
const valid = (cue) => {
  assert.ok(recorded.has(cue), cue);
  assert.equal(EFFECT_BANK[cue].loop, true);
};
test('every shipped player body has an explicit recorded movement assignment', async () => {
  const presets = JSON.parse(
    await readFile(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
  );
  assert.deepEqual(Object.keys(PLAYER_MOVEMENT).sort(), Object.keys(presets.characters).sort());
  for (const body of Object.keys(presets.characters)) {
    valid(recordedMovement(body));
    assert.equal(
      recordedMovement(body, { family: 'fpv' }),
      PLAYER_MOVEMENT[body],
      `${body}: visible body wins over world`,
    );
  }
  assert.equal(recordedMovement('heavy-lift', { family: 'retro' }), 'rotor');
  assert.equal(recordedMovement('fixedwing-body', { family: 'atlas' }), 'motor');
});
test('all four worlds cover every enemy role and explicit skins override world defaults', () => {
  for (const family of ENEMY_THEMES)
    for (const { type } of ENEMY_CATALOG) {
      const expected = ENEMY_MOVEMENT[family][type];
      valid(expected);
      assert.equal(recordedMovement('', { family }, type), expected);
      assert.equal(
        recordedMovement('', { family: 'fpv' }, type, enemySkinId(type, family)),
        expected,
      );
    }
  assert.equal(recordedMovement('', { family: 'fpv' }, 'bouncer'), 'wheels');
  assert.equal(recordedMovement('', { family: 'atlas' }, 'contour-patrol'), 'grain');
  assert.equal(recordedMovement('', { family: 'navi' }, 'claimed-rover'), 'wheels');
});
test('all Journey palettes, Team threats, combat patrols and unknown appearances retain recorded fallbacks', () => {
  for (const material of JOURNEY_ACTOR_MATERIALS)
    for (const { type } of ENEMY_CATALOG) {
      valid(
        recordedMovement('', { id: `${material.sourceThemeId}-actors-v1`, family: 'fpv' }, type),
      );
    }
  for (const type of [
    'drifter',
    'hunter',
    'claimed-rover',
    'patrol',
    'interceptor',
    'sentry',
    'future-enemy',
  ])
    valid(recordedMovement('', { family: 'fpv' }, type));
  assert.equal(recordedMovement('', { family: 'fpv' }, 'drifter'), 'wheels');
  assert.equal(recordedMovement('', { family: 'fpv' }, 'hunter'), 'rotor');
  valid(recordedMovement('uploaded-custom-body', { family: 'unknown' }));
});
test('company recipes follow their visible rotor or paper bodies even on ground enemy roles', () => {
  for (const recipe of Object.keys(FPV_BODY_RECIPES))
    for (const { type } of ENEMY_CATALOG)
      assert.equal(
        recordedMovement('', { family: 'navi', actorRecipes: { [type]: recipe } }, type),
        'rotor',
      );
  for (const recipe of ['paper-tangle', 'missing-cloud', 'stale-fragments', 'backlog-knot'])
    assert.equal(
      recordedMovement('', { family: 'fpv', actorRecipes: { eroder: recipe } }, 'eroder'),
      'grain',
    );
  assert.equal(recordedMovement('droneaid-nl-propeller'), 'rotor');
});
test('player body selection follows equipped class, per-player body and appearance override', () => {
  const theme = {
    player: 'neutral-marker',
    classBodies: { carrier: 'heavy-lift', scout: 'navi-avatar' },
  };
  assert.equal(playerMovementBody({}, { activeClassId: 'carrier' }, theme), 'heavy-lift');
  assert.equal(
    playerMovementBody({ classId: 'scout' }, { activeClassId: 'carrier' }, theme),
    'navi-avatar',
  );
  assert.equal(playerMovementBody({ bodyId: 'ukrainian-bird' }, {}, theme), 'ukrainian-bird');
  assert.equal(
    recordedMovement(
      playerMovementBody({ bodyId: 'ukrainian-bird' }, {}, theme, { actorStyle: 'fpv' }),
      theme,
    ),
    'rotor',
  );
});

test('material bodies and eroders use their distinct recorded ingredients', () => {
  for (const [body, cue] of Object.entries({
    'atlas-pottery-courier-v1': 'ceramic',
    'atlas-carved-chest-v1': 'wood',
    'atlas-woven-basket-v1': 'wood',
    'atlas-bell-warden-v1': 'bell',
  }))
    assert.equal(recordedMovement(body), cue);
  assert.equal(recordedMovement('', { family: 'fpv' }, 'eroder'), 'ratchet');
  assert.equal(recordedMovement('', { family: 'retro' }, 'eroder'), 'ratchet');
});
