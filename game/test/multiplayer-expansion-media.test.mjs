import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerExpansionCandidates } from '../content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import { createContentDraftBackend } from '../content-design/drafts.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';

test('required expedition objectives retain a compact HUD row and pause never clears them', async (t) => {
  const f = await teamPage(t);
  f.$('coop-start').click();
  f.tick(3);
  assert.equal(f.$('coop-objective').dataset.kind, 'coverage');
  const source = createMultiplayerExpansionCandidates({ chapterId: 'aurora' });
  const pack = createTeamTestPack(source, 'team-expedition-homecoming');
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  f.$('coop-discard-confirm').click();
  await f.selectFile(JSON.stringify(pack));
  f.$('coop-start').click();
  f.tick(3);
  assert.equal(f.$('coop-objective').dataset.kind, 'expedition');
  assert.match(f.$('coop-objective').textContent, /Relays 0\/1.*Targets 0\/3/);
  f.$('coop-pause').click();
  const goal = f.$('coop-objective').textContent;
  f.tick(120);
  assert.equal(f.$('coop-objective').textContent, goal);
});

for (const mode of ['team', 'versus'])
  test(`${mode} artwork replacement survives Studio recovery without changing advanced gameplay`, async () => {
    const source = createMultiplayerExpansionCandidates({ mode, chapterId: 'aurora' });
    const mission = source.missions.at(-1);
    const original = resolveMission(compileContentProject(source), mission.id, { mode });
    const replacement = source.assets.find(
      (asset) => asset.id !== mission.presentation.backgroundAssetId,
    );
    assert(replacement);
    const backend = createContentDraftBackend(managedIndexedDB());
    const session = createContentDraftSession(source, { backend });
    const edited = session.current();
    edited.revision = '2';
    edited.missions.at(-1).presentation.backgroundAssetId = replacement.id;
    session.replace(edited);
    const changed = resolveMission(compileContentProject(session.current()), mission.id, { mode });
    assert.deepEqual(changed.background, replacement);
    assert.notDeepEqual(changed.background, original.background);
    assert.deepEqual(changed.level, original.level);
    assert.equal(changed.simulationIdentity, original.simulationIdentity);
    assert.deepEqual(session.current().maps, source.maps);
    session.undo();
    assert.deepEqual(session.current(), source);
    session.redo();
    await session.save();
    const saved = await backend.read(source.id);
    assert.deepEqual(saved.project, session.current());
    const reloaded = createContentDraftSession(saved.project, {
      backend,
      revision: saved.revision,
    });
    const restored = createContentDraftSession(JSON.parse(reloaded.export()));
    const recovered = resolveMission(compileContentProject(restored.current()), mission.id, {
      mode,
    });
    assert.deepEqual(recovered, changed);
    assert.equal(source.missions.at(-1).presentation.backgroundAssetId, original.background.id);
  });
