import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';

function pack(difficulty) {
  const source = createStarterProject('team-host-fixture');
  source.maps[0].spawns.push({ id: 'island', x: 32.5, y: 17.5 });
  source.missions[0].modes = ['team'];
  source.missions[0].team = { format: 'TeamMissionV1', spawnIds: ['home', 'island'] };
  source.missions[0].design.difficulty.coordination = 1;
  return createTeamTestPack(source, 'nearby-shore', difficulty);
}

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
    assert.match(f.$('coop-enemy-help').textContent, /Field keepers/);
    assert.doesNotMatch(f.$('coop-enemy-help').textContent, /Hunter/);
    assert.match(f.$('coop-picture-status').textContent, /Start remains a separate action/);
    f.$('coop-start').click();
    f.tick();
    assert.equal(f.$('coop-menu').hidden, true);
    assert.match(f.$('coop-message').textContent, /field keepers/);
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
