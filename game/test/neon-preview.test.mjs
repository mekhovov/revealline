import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createNeonCandidates } from '../content-design/neon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';

const source = createNeonCandidates(),
  project = compileContentProject(source);
const theme = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes.find((t) => t.id === 'horizon');

test('every Neon Studio preview resolves the exact shared mission and preset without changing the draft', () => {
  const original = JSON.stringify(source);
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const preview = prepareContentPreview(source, mission.id, { difficulty, theme });
      const direct = resolveMission(project, mission.id, { difficulty });
      assert.deepEqual(preview.manifest, direct);
      assert.deepEqual(preview.scenario.level, direct.level);
      assert.equal(preview.scenario.theme.id, 'horizon');
      assert.equal(preview.capture.filledCells.length, 0);
      assert.match(preview.capture.assumption, /moving enemies/);
      assert.equal(preview.manifest.officialProgressEligible, false);
    }
  assert.equal(JSON.stringify(source), original);
  assert.throws(() => prepareContentPreview(source, 'inside-out', { mode: 'team' }), /mode/);
});

test('Neon CLI shares the revised mission and advisory campaign projection used by Studio', () => {
  const cli = (...args) =>
    spawnSync(
      process.execPath,
      [
        new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
        '-',
        ...args,
      ],
      { input: JSON.stringify(source), encoding: 'utf8' },
    );
  const mission = cli('--mission', 'inside-out', '--difficulty', 'expert');
  assert.equal(mission.status, 0, mission.stderr);
  assert.deepEqual(
    JSON.parse(mission.stdout),
    resolveMission(project, 'inside-out', { difficulty: 'expert' }),
  );
  const pacing = cli('--pacing', '--exclude-campaigns', 'neon-remixes');
  assert.equal(pacing.status, 0, pacing.stderr);
  assert.deepEqual(
    JSON.parse(pacing.stdout),
    inspectContentPacing(source, { excludedCampaignIds: ['neon-remixes'] }),
  );
});
