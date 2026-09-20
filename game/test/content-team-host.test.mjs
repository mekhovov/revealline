import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';

function pack(difficulty) {
  const source = createStarterProject('team-host-fixture');
  source.maps[0].spawns.push({ id: 'island', x: 32.5, y: 17.5 });
  source.missions[0].modes = ['team'];
  source.missions[0].team = { format: 'TeamMissionV1', spawnIds: ['home', 'island'] };
  source.missions[0].design.difficulty.coordination = 1;
  return resolveContentJourney(source, { mode: 'team', difficulty }).campaigns[0].runtime;
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
    f.$('coop-start').click();
    f.tick();
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(
      f.$('coop-reserves').textContent,
      `${reserves} reserve${reserves === 1 ? '' : 's'}`,
    );
    assert.equal(f.$('coop-progress').value, 0);
    f.$('coop-pause').click();
    f.$('coop-lobby').click();
    f.$('coop-discard-confirm').click();
    await f.$('coop-pack-reset').onclick();
    await waitFor(() => !f.$('coop-start').disabled);
    assert.equal(f.$('coop-difficulty').disabled, false);
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.equal(JSON.stringify(pack(difficulty)), source);
  });
}
