import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyFpvR5, verifyFpvR5Proof } from '../../scripts/verify-fpv-r5.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';

const load = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const source = {
  packs: await Promise.all(
    ['fpv-arcade-r5', 'fpv-pressure-frontier'].map((id) => load(`../content/packs/${id}.json`)),
  ),
  prior: await load('../content/packs/fpv-arcade-r4.json'),
  homeward: await load('../content/packs/homeward-skies.json'),
  proof: await load('../replays/fpv-arcade-r5-routes.json'),
};
const protectedFiles = [
  [
    '../content/packs/fpv-arcade-r4.json',
    'a7ab557d69f2bdd5473ee85d62ee0e7a03e6e75f01e79cc0dc7654b1c5ae6703',
  ],
  [
    '../content/packs/homeward-skies.json',
    '4793e07a45484238bae483e2a2e9354c6d29e0ad2ba2d8d708169bd9e0250b8b',
  ],
];
async function originals() {
  for (const [file, sha256] of protectedFiles)
    assert.equal(
      createHash('sha256')
        .update(await readFile(new URL(file, import.meta.url)))
        .digest('hex'),
      sha256,
    );
}
const key = (r) => `${r.packId}/${r.difficulty}/${r.levelId}/${r.turnPolicy}`;

test('R5 proves 24 real direction-only pressure wins and keeps ordinary departures separate from balance claims', async () => {
  await originals();
  const result = await verifyFpvR5();
  assert.equal(result.routes.length, 24);
  assert.equal(new Set(result.routes.map(key)).size, 24);
  assert.equal(result.ordinaryProbes.length, 24);
  for (const route of result.routes) {
    assert.equal(route.won, true);
    assert.equal(route.livesLost, 0);
    assert.ok(route.metrics.eventCounts['capture.stopped'] > 0);
    assert.ok(route.metrics.eventCounts['pressure.warning'] > 0);
    assert.ok(route.metrics.eventCounts['pressure.committed'] > 0);
    assert.equal(route.metrics.eventCounts['ability.used'], undefined);
    assert.equal(route.metrics.eventCounts['pickup.collected'], undefined);
  }
  assert.deepEqual(
    new Set(result.ordinaryProbes.map((p) => p.outcome)),
    new Set(['capture', 'failure', 'blocked']),
  );
  for (const probe of result.ordinaryProbes) {
    if (probe.outcome === 'capture') {
      assert.equal(probe.stationary.ticks, 120);
      assert.equal(probe.stationary.positionUnchanged, true);
      assert.equal(probe.stationary.stopped, true);
    }
  }
  // This particular ordinary departure does not establish a pressure-caused loss.
  const orchard = result.ordinaryProbes.find(
    (p) => p.levelId === 'orchard-crossing' && p.difficulty === 'standard',
  );
  assert.equal(orchard.outcome, 'capture');
  assert.equal(orchard.expected.coverage, orchard.passiveControl.expected.coverage);
  assert.equal(orchard.expected.livesLost, orchard.passiveControl.expected.livesLost);
  await originals();
});

test('R5 rejects missing identities, manual commands, missing releases and foreign source authority', () => {
  for (const mutate of [
    (p) => p.routes.pop(),
    (p) => p.routes.splice(1, 1, structuredClone(p.routes[0])),
    (p) => p.ordinaryProbes.pop(),
    (p) => {
      p.packs[0].sha256 = 'foreign';
    },
    (p) => {
      p.routes[0].campaignKey = 'foreign';
    },
    (p) => {
      p.routes[0].segments[0].input.boost = true;
    },
    (p) => {
      p.routes[0].segments[0].input.action = true;
    },
    (p) => {
      p.routes[0].segments[0].input.pickup = true;
    },
    (p) => {
      p.routes[0].segments[0].ticks = 21601;
    },
    (p) => {
      const index = p.routes[0].segments.findIndex((s) => s.input.direction === null);
      assert.ok(index > 0);
      p.routes[0].segments.splice(index, 1);
    },
  ]) {
    const proof = structuredClone(source.proof);
    mutate(proof);
    assert.throws(() => verifyFpvR5Proof({ ...source, proof }));
  }
  const packs = structuredClone(source.packs);
  packs[0].campaigns[0].levels[0].classic.enemyPressure.actors[0].warningTicks++;
  assert.throws(() => verifyFpvR5Proof({ ...source, packs }), /exact authored layouts/);
  let reads = 0;
  const hostile = { ...source };
  Object.defineProperty(hostile, 'proof', {
    enumerable: true,
    get() {
      reads++;
      return source.proof;
    },
  });
  assert.throws(() => verifyFpvR5Proof(hostile));
  assert.equal(reads, 0);
});

test('R5 recomputes pressure events, saved checkpoints and ordinary-control observations', () => {
  for (const mutate of [
    (p) => {
      p.routes[0].expected.score++;
    },
    (p) => {
      p.routes[0].checkpoint.hash = 'fabricated';
    },
    (p) => {
      p.routes[0].savePrefix.checkpoint.hash = 'fabricated';
    },
    (p) => {
      p.routes[0].metrics.eventCounts['pressure.committed']++;
    },
    (p) => {
      p.ordinaryProbes[0].passiveControl.expected.coverage = 1;
    },
  ]) {
    const proof = structuredClone(source.proof);
    mutate(proof);
    assert.throws(() => verifyFpvR5Proof({ ...source, proof }));
  }
});

test('all 24 actual pressure commitments survive public save, restore and complete winning continuation', async (t) => {
  for (const route of source.proof.routes)
    await t.test(key(route), async () => {
      const pack = source.packs.find((p) => p.id === route.packId);
      const base = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
      const context = createDifficultyContext(base, route.difficulty),
        { campaign } = context;
      const level = campaign.levels.find((l) => l.id === route.levelId);
      const setup = {
        classId: 'scout',
        classRecipes: pack.classRecipes,
        turnPolicy: route.turnPolicy,
        seed: 1,
      };
      const run = createRun(level, setup),
        recorder = createRecorder(level, setup);
      const advance = (state, record, input, count) => {
        for (let i = 0; i < count; i++) {
          recordInput(record, input);
          stepRun(state, input, FIXED_DT);
        }
      };
      let left = route.savePrefix.tick;
      for (const segment of route.segments) {
        const count = Math.min(left, segment.ticks);
        advance(run, recorder, segment.input, count);
        left -= count;
        if (!left) break;
      }
      assert.equal(left, 0);
      assert.equal(run.player.cutting, true);
      assert.ok(run.enemies.some((e) => e.classic?.pressure?.phase === 'committed'));
      assert.deepEqual(authoritativeCheckpoint(run), route.savePrefix.checkpoint);
      const saved = suspendSession({
        run,
        recorder,
        campaignKey: context.campaignKey,
        themeId: pack.themes[0].id,
        bodyId: pack.themes[0].player,
        runId: `r5-${route.levelId}-${route.difficulty}-${route.turnPolicy}`,
        continuation: { direction: route.savePrefix.direction },
      });
      const restored = await restoreSession(saved, { campaign, campaignKey: context.campaignKey });
      assert.deepEqual(authoritativeCheckpoint(restored.run), route.savePrefix.checkpoint);
      assert.equal(restored.session.continuation.direction, route.savePrefix.direction);
      const other = createDifficultyContext(
        base,
        route.difficulty === 'standard' ? 'gentle' : 'standard',
      );
      await assert.rejects(() =>
        restoreSession(saved, { campaign: other.campaign, campaignKey: other.campaignKey }),
      );
      let skip = route.savePrefix.tick;
      for (const segment of route.segments) {
        const consumed = Math.min(skip, segment.ticks);
        skip -= consumed;
        advance(restored.run, restored.recorder, segment.input, segment.ticks - consumed);
      }
      assert.deepEqual(authoritativeCheckpoint(restored.run), route.checkpoint);
      assert.equal(restored.run.status, 'won');
      assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
    });
});
