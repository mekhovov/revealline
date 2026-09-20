import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';

function pack(difficulty) {
  const source = createStarterProject('team-host-fixture');
  source.maps[0].spawns.push({ id: 'island', x: 32.5, y: 17.5 });
  source.missions[0].modes = ['team'];
  source.missions[0].team = { format: 'TeamMissionV1', spawnIds: ['home', 'island'] };
  source.missions[0].design.difficulty.coordination = 1;
  return createTeamTestPack(source, 'nearby-shore', difficulty);
}

test('real Team terrain import explains materials, applies lethal contact and retains exact rules on retry', async (t) => {
  const project = createTeamOpeningCandidates();
  project.missions[0].team.format = 'TeamMissionV2';
  project.maps[0].foundations = [];
  project.maps[0].spawns = [
    { id: 'west', x: 0.5, y: 18.5 },
    { id: 'east', x: 71.5, y: 18.5 },
  ];
  project.maps[0].terrain = [
    { id: 'west', kind: 'lethal', x: 2, y: 18, w: 1, h: 1 },
    { id: 'east', kind: 'slow', x: 68, y: 18, w: 2, h: 1 },
  ];
  const f = await page(t, { nativeFocus: true, nativeVisibility: true }),
    source = JSON.stringify(createTeamTestPack(project, 'twin-landings', 'expert'));
  await f.selectFile(source);
  assert.equal(f.$('coop-pack-status').dataset.state, 'ready', f.$('coop-pack-status').textContent);
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.$('coop-difficulty').disabled, true);
  assert.match(f.$('coop-threat-help').textContent, /Paired dashes/);
  assert.match(f.$('coop-threat-help').textContent, /Framed crosses/);
  f.$('coop-start').click();
  f.tick(3);
  f.tap('KeyD');
  f.tick(18);
  assert.match(f.$('coop-state-0').textContent, /Rescue/);
  assert.equal(f.$('coop-state-1').textContent, 'On safe ground');
  assert.match(f.$('coop-message').textContent, /Unclaimed lethal field caught a craft/);
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  assert.equal(f.$('coop-discard-confirm').closest('dialog').open, true);
  f.$('coop-discard-confirm').click();
  f.tick(3);
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(f.$('coop-state-0').textContent, 'On safe ground');
  f.tap('KeyD');
  f.tick(18);
  assert.match(f.$('coop-state-0').textContent, /Rescue/);
  assert.match(f.$('coop-message').textContent, /Unclaimed lethal field caught a craft/);
  assert.equal(JSON.stringify(createTeamTestPack(project, 'twin-landings', 'expert')), source);
});

for (const [difficulty, reserves] of [
  ['gentle', 4],
  ['standard', 2],
  ['expert', 1],
]) {
  test(`real Team import honors immutable ${difficulty} foundation edition`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    const source = JSON.stringify(pack(difficulty));
    f.$('coop-difficulty').value = difficulty === 'expert' ? 'gentle' : 'expert';
    await f.selectFile(source);
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    assert.equal(f.$('coop-level').value, 'nearby-shore');
    assert.equal(f.$('coop-difficulty').value, difficulty);
    assert.equal(f.$('coop-difficulty').disabled, true);
    assert.match(
      f.$('coop-preview-caption').textContent,
      /Preview scenery is not authored mission artwork/,
    );
    assert.match(f.$('coop-threat-help').textContent, /Drifters patrol continuously/);
    assert.doesNotMatch(f.$('coop-threat-help').textContent, /Hunter/);
    assert.match(f.$('coop-picture-status').textContent, /Start remains a separate action/);
    f.$('coop-start').click();
    f.tick();
    assert.equal(f.$('coop-menu').hidden, true);
    assert.match(f.$('coop-message').textContent, /patrolling Drifters/);
    assert.equal(
      f.$('coop-reserves').textContent,
      `${reserves} reserve${reserves === 1 ? '' : 's'}`,
    );
    assert.equal(f.$('coop-progress').value, 0);
    f.$('coop-pause').click();
    assert.match(f.$('coop-picture-status').textContent, /ready for this attempt/);
    assert.doesNotMatch(f.$('coop-picture-status').textContent, /Start remains a separate action/);
    f.$('coop-lobby').click();
    f.$('coop-discard-confirm').click();
    await f.$('coop-pack-reset').onclick();
    await waitFor(() => !f.$('coop-start').disabled);
    assert.equal(f.$('coop-difficulty').disabled, false);
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.equal(JSON.stringify(pack(difficulty)), source);
  });
}
