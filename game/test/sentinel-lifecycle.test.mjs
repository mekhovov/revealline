import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentinelCandidates } from '../content-design/sentinel-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { suspendSession, snapshotSession, restoreSession } from '../sessions.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { directionalView } from '../ui/directional-view.mjs';
import { relayView } from '../ui/relay-view.mjs';

const project = compileContentProject(createSentinelCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/sentinel-clear-routes.json', import.meta.url)),
);

for (const { difficulty, turnPolicy, rows } of fixture.sets.filter(
  (set) => set.difficulty === 'standard',
))
  test(`Sentinel candidate saves resume live trails, shield transitions and exposed warnings: ${turnPolicy}`, async () => {
    for (const [id, identity, finalCheckpoint, segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity);
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options);
      const inputs = segments.flatMap(([direction, ticks]) =>
        Array.from({ length: ticks }, () => ({ direction })),
      );
      const milestones = new Map();
      for (const [index, input] of inputs.entries()) {
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
        const stage =
          run.player.cutting && run.trail.length >= 3
            ? 'live-trail'
            : run.encounter.stage === 'transition'
              ? 'shield-transition'
              : run.encounter.stage === 'exposed' && run.encounter.phase === 'warning'
                ? 'exposed-warning'
                : null;
        if (!stage || milestones.has(stage)) continue;
        const saved = suspendSession({
          run,
          recorder,
          campaignKey: `sentinel-${id}@greybox-1`,
          themeId: 'fpv',
          bodyId: 'fpv-body',
          runId: `sentinel-${id}`,
          continuation: { direction: null },
        });
        milestones.set(stage, {
          index,
          saved,
          checkpoint: authoritativeCheckpoint(run),
          encounter: encounterView(run),
          relays: relayView(run),
          arrows: directionalView(run),
        });
      }
      assert.equal(run.status, 'won', id);
      assert.equal(authoritativeCheckpoint(run).hash, finalCheckpoint, id);
      assert.deepEqual([...milestones.keys()].sort(), [
        'exposed-warning',
        'live-trail',
        'shield-transition',
      ]);
      const campaign = {
        id: `sentinel-${id}`,
        levels: [manifest.level],
        classRecipes: run.classRecipes,
      };
      for (const [stage, snapshot] of milestones) {
        const label = `${id}/${stage}`;
        const restored = await restoreSession(snapshotSession(JSON.stringify(snapshot.saved)), {
          campaign,
          campaignKey: snapshot.saved.campaignKey,
        });
        assert.deepEqual(authoritativeCheckpoint(restored.run), snapshot.checkpoint, label);
        assert.deepEqual(encounterView(restored.run), snapshot.encounter, label);
        assert.deepEqual(relayView(restored.run), snapshot.relays, label);
        assert.deepEqual(directionalView(restored.run), snapshot.arrows, label);
        for (const input of inputs.slice(snapshot.index + 1)) {
          assert.equal(restored.run.status, 'running', label);
          recordInput(restored.recorder, input);
          stepRun(restored.run, input, FIXED_DT);
        }
        assert.equal(restored.run.status, 'won', label);
        assert.equal(restored.run.classic.livesLost, 0, label);
        assert.equal(authoritativeCheckpoint(restored.run).hash, finalCheckpoint, label);
        assert.equal(
          verifyReplay(exportReplay(restored.recorder, restored.run)).match,
          true,
          label,
        );
      }
      const saved = milestones.get('shield-transition').saved;
      const changed = structuredClone(campaign);
      changed.levels[0].encounter.exposed.openTicks++;
      await assert.rejects(
        restoreSession(saved, { campaign: changed, campaignKey: saved.campaignKey }),
        /Saved rules differ/,
      );
      const fresh = createRun(manifest.level, options);
      assert.equal(fresh.claimedCount, 0);
      assert(fresh.objectives.every((objective) => !objective.captured));
      assert(fresh.relay.gates.every((gate) => gate.openedTick === null));
      assert.equal(fresh.encounter.stage, 'shielded');
      assert.equal(fresh.encounter.phase, 'delay');
    }
  });
