#!/usr/bin/env node
/** Re-execute authored routes with exact optional picture/context ownership. No state patches. */
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildOriginalChapters,
  ROOT,
  CHAPTER_ROOT,
  SOURCE_PINS,
  sha,
} from '../authoring/library/four-worlds-chapters/build.mjs';
import { decodeOriginalPNG } from '../authoring/library/four-worlds-chapters/verify-images.mjs';
import { boundedJSON, exactKeys } from '../game/data-json.mjs';
import { preparePack, scenarioFromPack } from '../game/packs.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { createRun, stepRun, FIXED_DT, getSummary } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { suspendSession, restoreSession } from '../game/sessions.mjs';
import { digest } from './verify-campaign.mjs';

export const PROOF_FILE = `${CHAPTER_ROOT}/routes.json`;
const policies = ['immediate', 'grid-center'],
  difficulties = ['standard', 'gentle'];
const routeKey = (r) => `${r.packId}/${r.difficulty}/${r.levelId}/${r.turnPolicy}`;
const physicalLevel = (level) =>
  Object.fromEntries(
    Object.entries(level).filter(([key]) => !['id', 'name', 'metadata', 'themeId'].includes(key)),
  );
// Gentle derives a new revision from the new authored identity; it is verified in the exact checkpoint, not equated to the old campaign.
const physicalSummary = (summary) =>
  Object.fromEntries(
    Object.entries(summary).filter(([key]) => !['levelId', 'revision', 'rosterHash'].includes(key)),
  );
const physicalRecipe = (r) =>
  Object.fromEntries(Object.entries(r).filter(([key]) => !['label', 'description'].includes(key)));

async function execute(pack, context, level, route) {
  const setup = {
    classId: 'scout',
    classRecipes: pack.classRecipes,
    turnPolicy: route.turnPolicy,
    seed: 1,
  };
  const run = createRun(level, setup),
    recorder = createRecorder(level, setup);
  let total = 0,
    releaseNeeded = false,
    saved = null,
    prefix = null;
  const eventCounts = {};
  for (const segment of route.segments) {
    exactKeys(segment, ['ticks', 'input'], 'Original route segment');
    exactKeys(segment.input, ['direction'], 'Direction-only input');
    assert.ok(Object.hasOwn(segment.input, 'direction'));
    assert.ok(
      Number.isInteger(segment.ticks) && segment.ticks > 0 && (total += segment.ticks) <= 21600,
    );
    if (releaseNeeded) {
      assert.deepEqual(segment, { ticks: 1, input: { direction: null } });
      releaseNeeded = false;
    } else assert.ok(['up', 'right', 'down', 'left'].includes(segment.input.direction));
    for (let i = 0; i < segment.ticks; i++) {
      assert.equal(run.status, 'running');
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      for (const event of run.events) eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
      if (run.events.some((e) => e.type === 'capture.stopped')) {
        assert.equal(i, segment.ticks - 1);
        releaseNeeded = run.status === 'running';
      }
      if (run.tick === route.savePrefix.tick) {
        assert.equal(run.player.cutting, true);
        assert.ok(run.enemies.some((e) => e.classic?.pressure?.phase === 'committed'));
        prefix = {
          tick: run.tick,
          direction: segment.input.direction,
          checkpoint: authoritativeCheckpoint(run),
        };
        saved = suspendSession({
          run,
          recorder,
          campaignKey: context.campaignKey,
          themeId: pack.themes[0].id,
          bodyId: pack.themes[0].player,
          runId: `original-${route.difficulty}-${route.turnPolicy}`,
          savedAt: '2026-09-13T00:00:00.000Z',
          continuation: { direction: segment.input.direction },
        });
        assert.deepEqual(
          authoritativeCheckpoint(run),
          prefix.checkpoint,
          'Suspending does not mutate the original run.',
        );
      }
    }
  }
  assert.equal(run.status, 'won');
  assert.equal(run.classic.livesLost, 0);
  assert.ok(eventCounts['pressure.warning'] > 0 && eventCounts['pressure.committed'] > 0);
  assert.equal(eventCounts['ability.used'] ?? 0, 0);
  assert.equal(eventCounts['pickup.collected'] ?? 0, 0);
  const expected = getSummary(run),
    checkpoint = authoritativeCheckpoint(run);
  assert.deepEqual(
    physicalSummary(expected),
    physicalSummary(route.expected),
    'Same legal commands produce the same gameplay outcome as the preserved R5 route.',
  );
  assert.deepEqual(eventCounts, route.metrics.eventCounts);
  const verified = verifyReplay(exportReplay(recorder, run));
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), checkpoint);
  assert.ok(saved);
  const restored = await restoreSession(saved, {
    campaign: context.campaign,
    campaignKey: context.campaignKey,
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), prefix.checkpoint);
  assert.deepEqual(restored.session.continuation, { direction: prefix.direction });
  assert.equal(restored.session.themeId, pack.themes[0].id);
  let skip = prefix.tick;
  for (const segment of route.segments) {
    const consumed = Math.min(skip, segment.ticks);
    skip -= consumed;
    for (let i = consumed; i < segment.ticks; i++) {
      recordInput(restored.recorder, segment.input);
      stepRun(restored.run, segment.input, FIXED_DT);
    }
  }
  assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
  assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
  return {
    expected,
    checkpoint,
    savePrefix: {
      ...prefix,
      sessionSha256: digest(saved),
      restoredCheckpoint: authoritativeCheckpoint(restored.run),
    },
    eventCounts,
  };
}

/** Candidate is owned before the first await; expected authority comes from pinned source files. */
export async function verifyFourWorlds({ candidate, write = false } = {}) {
  assert.ok(!(candidate && write));
  const owned =
    candidate === undefined
      ? null
      : boundedJSON(candidate, {
          maxBytes: 64 * 1024 * 1024,
          maxDepth: 32,
          maxNodes: 500000,
          maxArray: 24000,
          maxString: 6 * 1024 * 1024,
        });
  if (owned) exactKeys(owned, ['packs', 'proof'], 'Original proof request');
  const source = await buildOriginalChapters({ quiet: true });
  const actual = owned?.packs ?? source.packs;
  assert.deepEqual(
    actual.map(digest),
    source.packs.map(digest),
    'Optional packs match their exact source recipes, original art and registered themes.',
  );
  if (!owned && !write) {
    const info = await lstat(path.join(ROOT, PROOF_FILE));
    assert.ok(
      info.isFile() && !info.isSymbolicLink() && info.size <= 2 * 1024 * 1024,
      'Bounded ordinary proof file.',
    );
  }
  const proofBytes = !owned && !write ? await readFile(path.join(ROOT, PROOF_FILE)) : null;
  const proof = owned?.proof ?? (proofBytes ? JSON.parse(proofBytes) : null);
  const header = {
    format: 'revealline-four-worlds-proof.v1',
    sources: SOURCE_PINS,
    recipeSha256: sha(await readFile(path.join(ROOT, CHAPTER_ROOT, 'chapters.json'))),
    packs: actual.map((p) => ({
      id: p.id,
      version: p.version,
      sha256: digest(p),
      themeId: p.themes[0].id,
    })),
    classId: 'scout',
    seed: 1,
  };
  const expectedKeys = actual.flatMap((p) =>
    difficulties.flatMap((difficulty) =>
      p.campaigns[0].levels.flatMap((l) =>
        policies.map((turnPolicy) =>
          routeKey({ packId: p.id, difficulty, levelId: l.id, turnPolicy }),
        ),
      ),
    ),
  );
  if (!write) {
    exactKeys(proof, [...Object.keys(header), 'routes'], 'Original proof');
    for (const [key, value] of Object.entries(header)) assert.deepEqual(proof[key], value);
    assert.ok(Array.isArray(proof.routes));
    assert.deepEqual(proof.routes.map(routeKey).sort(), [...expectedKeys].sort());
    // Reject route/identity substitution before allocating an image decoder.
    for (const [packIndex, pack] of actual.entries())
      for (const difficulty of difficulties) {
        const context = createDifficultyContext(
          { ...pack.campaigns[0], classRecipes: pack.classRecipes },
          difficulty,
        );
        for (const [index, level] of context.campaign.levels.entries())
          for (const turnPolicy of policies) {
            const existing = proof.routes.find(
              (r) =>
                routeKey(r) ===
                routeKey({ packId: pack.id, difficulty, levelId: level.id, turnPolicy }),
            );
            const original = source.priorProof.routes.find(
              (r) =>
                r.packId === source.prior.id &&
                r.difficulty === difficulty &&
                r.levelId === source.recipe.geometryLevels[index] &&
                r.turnPolicy === turnPolicy,
            );
            assert.equal(existing.campaignKey, context.campaignKey);
            assert.equal(existing.levelSha256, digest(level));
            assert.equal(existing.sourceLevelId, source.recipe.geometryLevels[index]);
            assert.equal(
              source.recipe.chapters[packIndex].maps[index].id,
              pack.campaigns[0].levels[index].id,
            );
            assert.deepEqual(existing.segments, original.segments);
          }
      }
  }
  const routes = [],
    imageFacts = [];
  for (const [packIndex, pack] of actual.entries()) {
    const prepared = (
      await preparePack(pack, { decodeImage: async (dataUrl) => decodeOriginalPNG(dataUrl) })
    ).pack;
    assert.deepEqual(
      prepared.classRecipes.map(physicalRecipe),
      source.prior.classRecipes.map(physicalRecipe),
    );
    for (const [index, level] of prepared.campaigns[0].levels.entries()) {
      assert.deepEqual(
        physicalLevel(level),
        physicalLevel(source.prior.campaigns[0].levels[index]),
      );
      const scenario = scenarioFromPack(prepared, prepared.campaigns[0].id, level.id, {
        classId: 'scout',
      });
      const background = scenario.visualOverrides.background;
      const art = source.images.get(source.recipe.chapters[packIndex].maps[index].imageId);
      assert.equal(background.dataUrl, art.dataUrl);
      assert.equal(background.fit, 'contain');
      imageFacts.push({
        packId: pack.id,
        levelId: level.id,
        themeId: prepared.themes[0].id,
        sourceImageId: art.record.id,
        sha256: art.record.sha256,
        bytes: art.record.bytes,
        ...decodeOriginalPNG(background.dataUrl),
      });
    }
    const base = { ...prepared.campaigns[0], classRecipes: prepared.classRecipes };
    for (const difficulty of difficulties) {
      const context = createDifficultyContext(base, difficulty);
      for (const [index, level] of context.campaign.levels.entries())
        for (const turnPolicy of policies) {
          const prior = source.priorProof.routes.find(
            (r) =>
              r.packId === source.prior.id &&
              r.difficulty === difficulty &&
              r.levelId === source.recipe.geometryLevels[index] &&
              r.turnPolicy === turnPolicy,
          );
          assert.ok(prior);
          const identity = {
            packId: prepared.id,
            difficulty,
            levelId: level.id,
            turnPolicy,
            campaignKey: context.campaignKey,
            levelSha256: digest(level),
            sourceLevelId: prior.levelId,
            sourceSegmentsSha256: digest(prior.segments),
          };
          const existing = proof?.routes.find((r) => routeKey(r) === routeKey(identity));
          if (!write) {
            exactKeys(
              existing,
              [
                ...Object.keys(identity),
                'segments',
                'expected',
                'checkpoint',
                'savePrefix',
                'eventCounts',
              ],
              'Original route',
            );
            for (const [key, value] of Object.entries(identity))
              assert.deepEqual(existing[key], value);
            assert.deepEqual(
              existing.segments,
              prior.segments,
              'Only preserved legal direction/release segments are accepted.',
            );
          }
          const route = {
            ...identity,
            segments: structuredClone(prior.segments),
            ...(await execute(prepared, context, level, prior)),
          };
          if (!write) assert.deepEqual(existing, route);
          routes.push(route);
        }
    }
  }
  assert.equal(routes.length, 48);
  assert.equal(imageFacts.length, 12);
  const result = { ...header, routes };
  if (write)
    await writeFile(path.join(ROOT, PROOF_FILE), JSON.stringify(result, null, 2) + '\n', {
      flag: 'wx',
    });
  // Source and compiled outputs are reread after execution, not trusted from an earlier snapshot.
  const after = await buildOriginalChapters({ quiet: true });
  assert.deepEqual(after.packs, source.packs);
  assert.equal(
    sha(await readFile(path.join(ROOT, CHAPTER_ROOT, 'chapters.json'))),
    header.recipeSha256,
  );
  if (proofBytes) assert.equal(sha(await readFile(path.join(ROOT, PROOF_FILE))), sha(proofBytes));
  return {
    passed: true,
    routes: routes.map(({ segments, checkpoint, savePrefix, expected, ...r }) => ({
      ...r,
      ...expected,
      savedTick: savePrefix.tick,
      savedContinuationVerified: true,
    })),
    imageFacts,
    note: '48 actual wins and verified saved continuations for twelve distinct picture/map identities over three unchanged R5 geometries. Full owned RGB PNG scanlines decoded; browser/color/readability, physical controls and enjoyment remain separate.',
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--write'));
  console.log(JSON.stringify(await verifyFourWorlds({ write: args.length === 1 }), null, 2));
}
