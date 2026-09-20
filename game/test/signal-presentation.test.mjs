import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTheme } from '../content.mjs';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { createTeamSignalCandidates } from '../content-design/team-signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { loadPreviewTheme } from '../content-design/preview-loader.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const theme = themes.find((entry) => entry.id === 'signal-gardens');

test('Signal palette distinguishes the campaign without changing functional colors or silhouettes', async () => {
  assert.deepEqual(validateTheme(theme).errors, []);
  for (const prior of themes.filter((entry) => entry !== theme)) {
    for (const key of ['accent', 'safe', 'danger'])
      assert.equal(theme.palette[key], prior.palette[key], key);
    for (const key of ['player', 'enemyShape', 'patrolShape', 'bossShape', 'classBodies', 'labels'])
      assert.deepEqual(theme[key], prior[key], key);
    assert.notEqual(theme.palette.field, prior.palette.field);
  }
  assert.equal(
    await loadPreviewTheme({
      themeId: theme.id,
      fetchTheme: async () => ({ ok: true, json: async () => ({ themes }) }),
    }),
    theme,
  );
});

test('explicit new presentation editions preserve historical greyboxes and all mode physics', () => {
  for (const [create, modes] of [
    [createSignalCandidates, ['solo', 'versus']],
    [createTeamSignalCandidates, ['team']],
  ]) {
    const oldSource = create(),
      newSource = create({ campaignTheme: true });
    const oldProject = compileContentProject(oldSource),
      newProject = compileContentProject(newSource);
    assert.equal(oldSource.revision, 'greybox-1');
    assert.equal(newSource.revision, 'greybox-2');
    assert.deepEqual(newSource.maps, oldSource.maps);
    for (const mission of newSource.missions) {
      assert.equal(mission.presentation.themeId, theme.id);
      assert.equal(mission.presentation.backgroundAssetId, null, 'No original artwork claim.');
      assert.equal(
        oldSource.missions.find((entry) => entry.id === mission.id).presentation.themeId,
        'horizon',
      );
      for (const mode of modes)
        for (const difficulty of ['gentle', 'standard', 'expert']) {
          const oldManifest = resolveMission(oldProject, mission.id, { mode, difficulty }),
            newManifest = resolveMission(newProject, mission.id, { mode, difficulty });
          assert.equal(newManifest.simulationIdentity, oldManifest.simulationIdentity);
          assert.deepEqual(
            { ...newManifest.level, revision: oldManifest.level.revision },
            oldManifest.level,
          );
          assert.equal(newManifest.officialProgressEligible, false);
          if (mode === 'team') {
            const pack = createTeamTestPack(newSource, mission.id, difficulty);
            assert.deepEqual(pack.levels[0], newManifest.level);
            assert.equal(
              Object.hasOwn(pack, 'theme'),
              false,
              'Geometry-only Team export stays honest.',
            );
          }
        }
      if (modes.includes('solo')) {
        const preview = prepareContentPreview(newSource, mission.id, { theme });
        assert.equal(preview.scenario.theme.id, theme.id);
        assert.deepEqual(preview.scenario.visualOverrides, {});
        assert.throws(
          () => prepareContentPreview(newSource, mission.id, { theme: themes[0] }),
          /must match/,
        );
      }
    }
    assert.deepEqual(create(), oldSource, 'New presentation cannot mutate the old edition.');
  }
});
