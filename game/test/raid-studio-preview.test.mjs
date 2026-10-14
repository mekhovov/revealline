import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightHuntProject } from '../overflight/raid-project.mjs';
import { createExperimentalOverflightWorldProject } from '../overflight/worlds.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import {
  normalizeRaidPreviewOperation,
  raidStudioPreviewMode,
  raidStudioRuntimePath,
} from '../studio/raid-preview-mode.mjs';

test('Studio previews all three Raid operations through their native rules without changing draft identity', () => {
  for (const rulesVersion of [1, 2, 3, 4]) {
    const project = createOverflightHuntProject({ rulesVersion });
    const before = JSON.stringify(project);
    let identity;
    for (const operation of ['overflight-hunt', 'time-attack', 'marathon']) {
      const mode = raidStudioPreviewMode(operation);
      const compiled = mode.compileProject(project);
      identity ??= compiled.projectIdentity;
      assert.equal(compiled.projectIdentity, identity);
      assert.equal(compiled.rulesVersion, rulesVersion);
      assert.equal(mode.operationId ?? mode.id, operation);
      const url = new URL(
        raidStudioRuntimePath(operation, { studio: true }),
        'https://example.test/game/studio/raid.html',
      );
      assert.equal(url.pathname, '/game/overflight/raid.html');
      assert.equal(url.searchParams.get('studio'), 'overflight-hunt');
      assert.equal(
        url.searchParams.get('operation'),
        operation === 'overflight-hunt' ? null : operation,
      );
    }
    assert.equal(JSON.stringify(project), before);
  }
});

test('Studio experimental terrain is offered only to Single Raid; variant selection cannot discard it', () => {
  const project = createExperimentalOverflightWorldProject(OVERFLIGHT_HUNT_MODE.createProject);
  assert.equal(
    raidStudioPreviewMode('overflight-hunt').compileProject(project).terrain.obstacles.length,
    8,
  );
  for (const operation of ['time-attack', 'marathon'])
    assert.throws(
      () => raidStudioPreviewMode(operation).compileProject(project),
      /Experimental terrain/,
    );
  assert.equal(normalizeRaidPreviewOperation('invalid'), 'overflight-hunt');
  const installed = new URL(
    raidStudioRuntimePath('marathon', { community: 'abc123' }),
    'https://example.test/game/studio/raid.html',
  );
  assert.equal(installed.searchParams.get('community'), 'abc123');
  assert.equal(installed.searchParams.has('studio'), false);
});
