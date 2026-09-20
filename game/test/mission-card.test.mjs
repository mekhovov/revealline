import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createMissionCard, paintMissionThumbnail } from '../content-design/mission-card.mjs';
import { createRun } from '../core/index.mjs';
import { dataIdentity } from '../data-json.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const source = createOpeningCandidates({ artwork: true });
const solo = createCandidateSoloHost(source, { themes, buildVersion: '0.69.0' });
const versus = createCandidateVersusHost(source, { themes });

test('all opening mission diagrams use exact engine initial cells, terrain, spawn and actors', () => {
  const signatures = new Set();
  for (const entry of solo.entries)
    for (const manifest of entry.manifests) {
      const before = dataIdentity(manifest),
        card = createMissionCard(manifest);
      const run = createRun(manifest.level, { seed: 1, classId: 'scout' });
      assert.deepEqual(card.cells, [...run.cells]);
      assert.deepEqual(card.terrain, [...run.classic.terrain]);
      assert.deepEqual(card.spawn, { x: run.player.x, y: run.player.y });
      assert.deepEqual(
        card.actors,
        run.enemies.map(({ type, x, y }) => ({ type, x, y })),
      );
      assert.equal(card.band, manifest.design.difficulty.band);
      assert.equal(card.preset, entry.difficulty);
      assert.equal(card.mastery, manifest.design.mastery);
      assert.equal(
        createMissionCard(manifest),
        card,
        'unchanged immutable manifests reuse their diagram',
      );
      assert.equal(dataIdentity(manifest), before);
      assert(Object.isFrozen(card.cells));
      signatures.add(dataIdentity({ cells: card.cells, spawn: card.spawn, actors: card.actors }));
    }
  assert.equal(signatures.size, 10, 'all ten maps have distinct starting problems');
});

test('Solo and Versus expose identical cards only for exact catalog missions', () => {
  for (const mission of solo.catalog.missions) {
    const other = versus.catalog.missions.find((item) => item.id === mission.id);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      assert.deepEqual(solo.card(mission, difficulty), versus.card(other, difficulty));
    assert.equal(solo.card({ ...mission }), null);
    assert.equal(versus.card({ ...other }), null);
  }
});

test('thumbnail rendering is bounded to initial state and produces no asset or simulation mutations', () => {
  for (const mission of solo.catalog.missions) {
    const card = solo.card(mission),
      before = dataIdentity(card),
      calls = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_, method) =>
          (...args) =>
            calls.push([method, ...args]),
      },
    );
    paintMissionThumbnail(ctx, card, 288);
    assert.deepEqual(calls[0], ['save']);
    assert.deepEqual(calls[1], ['fillRect', 0, 0, 288, 144]);
    assert.deepEqual(calls.at(-1), ['restore']);
    assert(calls.length < 3000);
    assert.equal(dataIdentity(card), before);
  }
});
