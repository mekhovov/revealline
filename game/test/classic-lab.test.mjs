import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildClassicLab, studyMaterials } from '../../scripts/build-classic-lab.mjs';
import { createRun, CELL } from '../core/index.mjs';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const inside = (rect, x, y) =>
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
function expectedMaterial(study, x, y) {
  let kind = 0;
  for (const [index, name] of ['slow', 'lethal', 'wall'].entries())
    for (const item of study.materials[name]) {
      const rect = item.ring || item;
      if (
        inside(rect, x, y) &&
        (!item.ring ||
          !inside({ x: rect.x + 1, y: rect.y + 1, w: rect.w - 2, h: rect.h - 2 }, x, y))
      )
        kind = index + 1;
    }
  return kind;
}
function assertProjection(study) {
  const materials = studyMaterials(study),
    observed = new Uint8Array(72 * 36);
  for (const rect of [
    ...materials.terrain,
    ...materials.walls.map((r) => ({ ...r, kind: 'wall' })),
  ])
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const index = y * 72 + x;
        assert.equal(observed[index], 0, 'generated material rectangles must be disjoint');
        observed[index] = ['slow', 'lethal', 'wall'].indexOf(rect.kind) + 1;
      }
  for (let y = 0; y < 36; y++)
    for (let x = 0; x < 72; x++)
      assert.equal(
        observed[y * 72 + x],
        expectedMaterial(study, x, y),
        `${study.id}: cell ${x},${y}`,
      );
}

test('reference conversion preserves half-open geometry, hollow rings and declared material precedence', () => {
  assertProjection({
    format: 'revealline-reference-study.v1',
    id: 'overlap-fixture',
    projection: { width: 72, height: 36 },
    materials: {
      slow: [{ x: 5, y: 5, w: 20, h: 20 }],
      lethal: [{ ring: { x: 8, y: 8, w: 10, h: 10 } }],
      wall: [{ x: 8, y: 7, w: 2, h: 4 }],
    },
  });
});

test('all three checked-in routing hypotheses compile to the same material cells', async () => {
  for (const id of ['opening-space', 'wall-slow-channels', 'bars-hollow-chambers']) {
    const study = await readJSON(`../../authoring/reference-studies/${id}.json`);
    assert.equal(study.sourceAssetsCopied, false);
    assert.equal(study.studyOnly, true);
    assertProjection(study);
  }
});

test('Classic Lab regenerates exactly, remains separate from campaign milestones, and creates nine valid wide simulations', async () => {
  const { pack } = await buildClassicLab(),
    published = await readJSON('../content/packs/classic-lab.json');
  assert.deepEqual(pack, published);
  assert.equal(pack.themes.length, 4);
  assert.equal(pack.campaigns[0].levels.length, 9);
  assert.equal(
    (await readJSON('../content/packs/index.json')).packs.some((entry) => entry.id === pack.id),
    false,
  );
  assert.deepEqual(
    pack.campaigns[0].levels[0].classic.powerups.map((item) => item.kind),
    ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze'],
  );
  for (const level of pack.campaigns[0].levels) {
    const run = createRun(level, { classRecipes: pack.classRecipes, classId: 'scout' });
    assert.equal(run.ruleset, 'xonix-core.v5');
    assert.equal(run.cells.length, 72 * 36);
    assert.equal(run.cells[Math.floor(level.spawn.y) * 72 + Math.floor(level.spawn.x)], CELL.SAFE);
    assert.equal(run.status, 'running');
    assert.ok(level.metadata.description.length > 50);
  }
});
