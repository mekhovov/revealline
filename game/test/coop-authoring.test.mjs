import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  COOP_PACK_MAX_BYTES,
  COOP_PACK_RECIPE_VERSION,
  COOP_PACK_VERSION,
  COOP_TEMPLATES,
  createCoopLevelRecipe,
  buildCoopLevel,
  buildCoopPack,
  validateCoopRecipe,
  validateCoopPack,
} from '../coop/recipes.mjs';
import { FIRST_CONNECTION, FIRST_CONNECTION_RECIPE } from '../coop/first-connection.mjs';
import { RELAY_YARD, RELAY_YARD_RECIPE } from '../coop/relay-yard.mjs';
import { COOP_RULESET, createCoop, startCoop, stepCoop, FIELD, SAFE, WALL } from '../coop/core.mjs';
import { buildCoopCommand } from '../../scripts/build-coop-pack.mjs';

const packRecipe = (levels = [FIRST_CONNECTION_RECIPE, RELAY_YARD_RECIPE]) => ({
  version: COOP_PACK_RECIPE_VERSION,
  id: 'authoring-test',
  revision: 1,
  name: 'Authoring test',
  levels,
});
const neighbors = (cell) => {
  const x = cell % 72,
    y = Math.floor(cell / 72);
  return [
    x > 0 ? cell - 1 : -1,
    x < 71 ? cell + 1 : -1,
    y > 0 ? cell - 72 : -1,
    y < 35 ? cell + 72 : -1,
  ].filter((n) => n >= 0);
};
function connected(cells, kind) {
  const start = cells.indexOf(kind),
    seen = new Set([start]),
    queue = [start];
  for (let head = 0; head < queue.length; head++)
    for (const next of neighbors(queue[head]))
      if (cells[next] === kind && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  return seen.size === cells.filter((cell) => cell === kind).length;
}
const command = (direction) => ({ direction, boost: true, support: false });
const silent = { write() {} };

test('both explicit templates compile independent owned levels with distinct goals and layouts', () => {
  assert.deepEqual(
    COOP_TEMPLATES.map((entry) => entry.id),
    ['coverage', 'stronghold'],
  );
  assert.deepEqual(buildCoopLevel(FIRST_CONNECTION_RECIPE), FIRST_CONNECTION);
  assert.deepEqual(buildCoopLevel(RELAY_YARD_RECIPE), RELAY_YARD);
  assert.deepEqual(FIRST_CONNECTION.goal, { coverage: 0.65 });
  assert.deepEqual(RELAY_YARD.goal, { cores: ['yard-relay'] });
  assert.equal(FIRST_CONNECTION.walls.length, 0);
  assert.equal(RELAY_YARD.walls.length, 2);
  const clone = buildCoopLevel(RELAY_YARD_RECIPE);
  clone.enemies[0].x = 2.5;
  clone.strongholds[0].anchors[0].x = 2.5;
  assert.deepEqual(buildCoopLevel(RELAY_YARD_RECIPE), RELAY_YARD);
});

for (const level of [FIRST_CONNECTION, RELAY_YARD]) {
  test(`${level.name} revision 2 has one connected field, a rescue perimeter, and mirrored hazards`, () => {
    assert.equal(level.revision, 2);
    const run = createCoop(level);
    assert.equal(run.cells.filter((cell) => cell === SAFE).length, 212);
    assert.ok(connected(run.cells, SAFE));
    assert.ok(connected(run.cells, FIELD));
    for (let y = 1; y < 35; y++)
      assert.ok(run.cells.slice(y * 72 + 1, y * 72 + 71).some((cell) => cell === FIELD));
    assert.equal(level.enemies.filter((enemy) => enemy.type === 'hunter').length, 2);
    assert.equal(level.enemies.filter((enemy) => enemy.type === 'drifter').length, 2);
    for (const enemy of level.enemies)
      assert.ok(
        level.enemies.some(
          (other) =>
            other !== enemy &&
            other.type === enemy.type &&
            other.x === 72 - enemy.x &&
            other.y === enemy.y &&
            other.vx === -enemy.vx &&
            other.vy === enemy.vy &&
            other.radius === enemy.radius,
        ),
      );
    for (const wall of level.walls)
      assert.ok(
        level.walls.some(
          (other) =>
            other.x === 72 - wall.x - wall.w &&
            other.y === wall.y &&
            other.w === wall.w &&
            other.h === wall.h,
        ),
      );
    // A pair may approach above or below the pillars from either safe edge.
    for (const y of [11, 24])
      for (let x = 1; x < 71; x++) assert.notEqual(run.cells[y * 72 + x], WALL);
  });
}

test('the revised First Connection opening contests both halves instead of granting half the field', () => {
  const run = createCoop(FIRST_CONNECTION);
  startCoop(run);
  const events = [];
  for (let tick = 0; tick < 360 && !run.claimedCount; tick++) {
    stepCoop(run, [command('right'), command('left')]);
    events.push(...run.events);
  }
  assert.ok(events.some((event) => event.type === 'cut.joint'));
  assert.equal(run.claimedCount, 70);
  assert.ok(run.coverage < 0.03);
  assert.equal(run.status, 'running');
});

test('mixed source recipes reproduce the exact two shipped authored levels', async () => {
  const source = JSON.parse(
    await readFile(
      new URL('../../authoring/coop/starter-pack.recipe.json', import.meta.url),
      'utf8',
    ),
  );
  const pack = buildCoopPack(source);
  assert.deepEqual(pack.levels, [FIRST_CONNECTION, RELAY_YARD]);
  assert.deepEqual(validateCoopPack(pack), { valid: true, errors: [] });
  assert.equal(pack.version, COOP_PACK_VERSION);
  assert.equal(pack.ruleset, COOP_RULESET);
  assert.deepEqual(buildCoopPack(JSON.parse(JSON.stringify(source))), pack);
  assert.deepEqual(validateCoopPack(JSON.parse(JSON.stringify(pack))), { valid: true, errors: [] });
});

test('authored geometry replacements and encounter overrides are explicit and preserve their input', () => {
  const hold = {
    id: 'new-relay',
    core: { x: 35.5, y: 5.5 },
    anchors: [
      { x: 20.5, y: 11.5 },
      { x: 51.5, y: 11.5 },
    ],
  };
  const options = {
    id: 'new-yard',
    name: 'New Yard',
    layout: { strongholds: [hold], walls: [] },
    encounter: { hunterRecovery: 1.7 },
  };
  const before = structuredClone(options);
  const recipe = createCoopLevelRecipe('stronghold', options);
  const level = buildCoopLevel(recipe);
  assert.deepEqual(level.goal, { cores: ['new-relay'] });
  assert.equal(level.encounter.hunterRecovery, 1.7);
  assert.equal(level.encounter.hunterAttackSpeed, 11);
  assert.deepEqual(level.walls, []);
  assert.deepEqual(options, before);
  level.strongholds[0].core.x = 34.5;
  assert.deepEqual(options, before);
});

test('recipes reject implicit solo conversion, goal mismatches, unsupported controls, and unsafe geometry', () => {
  assert.throws(() => createCoopLevelRecipe('solo'), /coverage or stronghold/);
  assert.throws(
    () => createCoopLevelRecipe('coverage', { spawn: { x: 0.5, y: 0.5 } }),
    /Unsupported/,
  );
  for (const patch of [
    { goal: { cores: ['yard-relay'] } },
    { rules: { lives: 100 } },
    { encounter: { hunterAttackSpeed: 100 } },
    { layout: { walls: [{ x: 70, y: 5, w: 4, h: 2 }] } },
    {
      layout: {
        spawns: [
          { x: 10.5, y: 10.5 },
          { x: 71.5, y: 18.5 },
        ],
      },
    },
  ]) {
    const recipe = { ...FIRST_CONNECTION_RECIPE, ...patch };
    assert.equal(validateCoopRecipe(recipe).valid, false);
    assert.throws(() => buildCoopLevel(recipe), TypeError);
  }
});

test('anchor access is validated before shield removal, including compiled pack imports', () => {
  const recipe = createCoopLevelRecipe('stronghold');
  const inaccessible = {
    ...recipe,
    layout: {
      walls: [
        { x: 22, y: 10, w: 3, h: 1 },
        { x: 22, y: 12, w: 3, h: 1 },
        { x: 22, y: 11, w: 1, h: 1 },
        { x: 24, y: 11, w: 1, h: 1 },
      ],
    },
  };
  assert.match(validateCoopRecipe(inaccessible).errors.join(' '), /anchors need a route/);
  const pack = buildCoopPack(packRecipe());
  pack.levels[1].walls = inaccessible.layout.walls;
  assert.match(validateCoopPack(pack).errors.join(' '), /anchors need a route/);
});

test('pack boundaries reject duplicate levels, unsupported engines, solo formats and surplus fields', () => {
  const pack = buildCoopPack(packRecipe());
  for (const patch of [
    { version: 'xonix-pack.v1' },
    { ruleset: 'revealline-coop.future' },
    { levels: [] },
    { levels: [pack.levels[0], pack.levels[0]] },
    { levels: Array(25).fill(pack.levels[0]) },
    { awards: { solo: true } },
  ])
    assert.equal(validateCoopPack({ ...pack, ...patch }).valid, false);
  assert.equal(validateCoopPack({ ...pack, levels: [{ version: 'xonix-level.v1' }] }).valid, false);
  assert.throws(() => buildCoopPack({ ...packRecipe(), levels: [FIRST_CONNECTION] }), /recipe/);
});

test('validation does not invoke accessor properties in recipes or packs', () => {
  let invoked = false;
  const recipe = { ...FIRST_CONNECTION_RECIPE };
  Object.defineProperty(recipe, 'layout', {
    enumerable: true,
    get() {
      invoked = true;
      return {};
    },
  });
  assert.equal(validateCoopRecipe(recipe).valid, false);
  const pack = buildCoopPack(packRecipe());
  Object.defineProperty(pack.levels, '0', {
    enumerable: true,
    get() {
      invoked = true;
      return FIRST_CONNECTION;
    },
  });
  assert.equal(validateCoopPack(pack).valid, false);
  const nested = {
    ...RELAY_YARD_RECIPE,
    layout: {
      strongholds: [
        Object.defineProperty({}, 'id', {
          enumerable: true,
          get() {
            invoked = true;
            return 'bad';
          },
        }),
      ],
    },
  };
  assert.equal(validateCoopRecipe(nested).valid, false);
  assert.equal(invoked, false);
});

test('CLI creates playable level or pack JSON, validates it, and refuses overwriting an existing file', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'coop-authoring-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const destination = path.join(directory, 'new.pack.json');
  await buildCoopCommand(
    ['--template', 'stronghold', '--id', 'my-yard', '--name', 'My Yard', '--out', destination],
    { stdout: silent },
  );
  const original = await readFile(destination, 'utf8');
  const pack = JSON.parse(original);
  assert.equal(pack.levels[0].id, 'my-yard');
  assert.ok(validateCoopPack(pack).valid);
  await buildCoopCommand(['--validate', destination], { stdout: silent });
  await assert.rejects(
    buildCoopCommand(['--template', 'coverage', '--out', destination], { stdout: silent }),
    { code: 'EEXIST' },
  );
  assert.equal(await readFile(destination, 'utf8'), original);
  let stdout = '';
  const level = await buildCoopCommand(['--template', 'coverage', '--kind', 'level'], {
    stdout: {
      write(value) {
        stdout += value;
      },
    },
  });
  assert.deepEqual(JSON.parse(stdout), level);
  assert.equal(level.goal.coverage, 0.65);
  const longestID = 'a'.repeat(80);
  const longest = await buildCoopCommand(['--template', 'coverage', '--id', longestID], {
    stdout: silent,
  });
  assert.equal(longest.id, longestID);
  assert.equal(longest.levels[0].id, longestID);
});

test('CLI validates mixed recipes, rejects malformed flags and bounds file input before parsing', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'coop-authoring-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source.json');
  await writeFile(source, JSON.stringify(packRecipe()));
  const result = await buildCoopCommand(['--source', source], { stdout: silent });
  assert.deepEqual(result.levels, [FIRST_CONNECTION, RELAY_YARD]);
  await assert.rejects(
    buildCoopCommand(['--source', source, '--kind', 'level'], { stdout: silent }),
    /must produce a pack/,
  );
  for (const args of [
    [],
    ['--template', 'coverage', '--source', source],
    ['--source', source, '--id', 'ignored'],
    ['--template', 'coverage', '--kind', 'solo'],
    ['--template', 'coverage', '--template', 'stronghold'],
  ])
    await assert.rejects(buildCoopCommand(args, { stdout: silent }), TypeError);
  await writeFile(source, ' '.repeat(COOP_PACK_MAX_BYTES + 1));
  await assert.rejects(buildCoopCommand(['--source', source], { stdout: silent }), /1 MiB/);
});
