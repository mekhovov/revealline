import test from 'node:test';
import assert from 'node:assert/strict';
import * as leaf from '../presentation/team-runtime-slots.mjs';
import * as owner0 from '../couch/coop-outcome-presentation.mjs';
import * as owner1 from '../couch/coop-enemy-slots.mjs';
import * as owner2 from '../couch/coop-pilot-slots.mjs';
import * as owner3 from '../couch/coop-anchor-presentation.mjs';
import * as owner4 from '../couch/coop-core-presentation.mjs';
import * as owner5 from '../couch/coop-support-presentation.mjs';
import * as owner6 from '../couch/coop-emitter-presentation.mjs';
import * as owner7 from '../couch/coop-rescue-presentation.mjs';

const expected = {
  TEAM_ANCHOR_SLOTS: ['team.anchor.available', 'team.anchor.captured'],
  TEAM_CORE_SLOTS: ['team.core.shielded', 'team.core.exposed', 'team.core.secured'],
  TEAM_SUPPORT_SLOTS: ['team.support.pulse', 'team.enemy.slowed'],
  TEAM_EMITTER_SLOTS: ['team.emitter.warning', 'team.emitter.spark'],
  TEAM_RESCUE_SLOTS: ['team.rescue.progress', 'team.player.recovery'],
  TEAM_PILOT_SLOTS: [
    'team.pilot.p1.normal.compact',
    'team.pilot.p1.normal.detailed',
    'team.pilot.p1.cutting.compact',
    'team.pilot.p1.cutting.detailed',
    'team.pilot.p1.downed.compact',
    'team.pilot.p1.downed.detailed',
    'team.pilot.p1.crawling.compact',
    'team.pilot.p1.crawling.detailed',
    'team.pilot.p1.rescuing.compact',
    'team.pilot.p1.rescuing.detailed',
    'team.pilot.p1.recovery.compact',
    'team.pilot.p1.recovery.detailed',
    'team.pilot.p2.normal.compact',
    'team.pilot.p2.normal.detailed',
    'team.pilot.p2.cutting.compact',
    'team.pilot.p2.cutting.detailed',
    'team.pilot.p2.downed.compact',
    'team.pilot.p2.downed.detailed',
    'team.pilot.p2.crawling.compact',
    'team.pilot.p2.crawling.detailed',
    'team.pilot.p2.rescuing.compact',
    'team.pilot.p2.rescuing.detailed',
    'team.pilot.p2.recovery.compact',
    'team.pilot.p2.recovery.detailed',
  ],
  TEAM_ENEMY_SLOTS: [
    'team.enemy.drifter',
    'team.enemy.hunter.patrol',
    'team.enemy.hunter.warning',
    'team.enemy.hunter.charge',
    'team.enemy.hunter.recovery',
  ],
  TEAM_OUTCOME_SLOTS: ['team.capture.joint', 'team.recovery'],
};

test('shared slot leaf preserves all 42 identities and their historical order', () => {
  const all = Object.values(expected).flat();
  assert.equal(all.length, 42);
  assert.deepEqual(leaf.TEAM_RUNTIME_IMAGE_SLOTS, all);
  assert(Object.isFrozen(leaf.TEAM_RUNTIME_IMAGE_SLOTS));
  for (const [name, slots] of Object.entries(expected)) {
    assert.deepEqual(leaf[name], slots, name);
    assert(Object.isFrozen(leaf[name]), name);
    for (const id of slots) assert.equal(leaf.isTeamRuntimeImageSlot(id), true, id);
  }
  assert.deepEqual(leaf.TEAM_PILOT_STATES, [
    'normal',
    'cutting',
    'downed',
    'crawling',
    'rescuing',
    'recovery',
  ]);
  assert(Object.isFrozen(leaf.TEAM_PILOT_STATES));
  for (const id of [
    'team.fake',
    'team.core.secured.extra',
    'team.picture.any',
    'scene.reveal.wide',
    null,
  ])
    assert.equal(leaf.isTeamRuntimeImageSlot(id), false);
});

test('existing owner exports retain the same frozen contract objects', () => {
  assert.equal(owner0.TEAM_OUTCOME_SLOTS, leaf.TEAM_OUTCOME_SLOTS);
  assert.equal(owner1.TEAM_ENEMY_SLOTS, leaf.TEAM_ENEMY_SLOTS);
  assert.equal(owner2.TEAM_PILOT_STATES, leaf.TEAM_PILOT_STATES);
  assert.equal(owner2.TEAM_PILOT_SLOTS, leaf.TEAM_PILOT_SLOTS);
  assert.equal(owner3.TEAM_ANCHOR_SLOTS, leaf.TEAM_ANCHOR_SLOTS);
  assert.equal(owner4.TEAM_CORE_SLOTS, leaf.TEAM_CORE_SLOTS);
  assert.equal(owner5.TEAM_SUPPORT_SLOTS, leaf.TEAM_SUPPORT_SLOTS);
  assert.equal(owner6.TEAM_EMITTER_SLOTS, leaf.TEAM_EMITTER_SLOTS);
  assert.equal(owner7.TEAM_RESCUE_SLOTS, leaf.TEAM_RESCUE_SLOTS);
});
