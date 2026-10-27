import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';
import { createOverflightRun } from './core.mjs';
import { compileOverflightProject, validateOverflightProject } from './project.mjs';
import { validateOverflightMovement } from './battlefields.mjs';
import {
  createOverflightBuild,
  legalOverflightUpgrades,
  utilityOffers,
  applyOverflightUpgrade,
} from './upgrades.mjs';
import { checkpointSchema as schemas } from './checkpoint-schema.mjs';

export const OVERFLIGHT_CHECKPOINT_FORMAT = 'OverflightCheckpointV1';
export const OVERFLIGHT_CHECKPOINT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_NODES = 40000;
const finite = (value) => Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
const fail = (condition, message = 'Invalid Survival checkpoint.') => required(condition, message);
const plain = (value) =>
  value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function validateSurvivalPackageIdentity(value) {
  exactKeys(value, ['manifestSha256', 'runtimeSha256', 'sourceRevision'], 'Survival package');
  fail(sha256(value.manifestSha256) && sha256(value.runtimeSha256));
  fail(typeof value.sourceRevision === 'string' && /^[a-f0-9]{40,64}$/.test(value.sourceRevision));
  return value;
}
export function validateSurvivalAttemptId(value) {
  fail(
    typeof value === 'string' &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value),
    'Invalid Survival attempt identity.',
  );
  return value;
}

function constantsFor(run) {
  const byPath = new Map(),
    byObject = new WeakMap();
  const visit = (value, path) => {
    if (!value || typeof value !== 'object' || byObject.has(value)) return;
    byObject.set(value, path);
    byPath.set(path, value);
    for (const [key, child] of Object.entries(value)) visit(child, `${path}/${key}`);
  };
  visit(run.compiled, 'compiled');
  visit(run.flight, 'flight');
  byObject.set(run._permittedFamilies, 'families');
  byPath.set('families', run._permittedFamilies);
  return { byPath, byObject };
}
function constantFits(path, type, constants) {
  if (['compiled', 'flight', 'families'].includes(type)) return path === type;
  const value = constants.byPath.get(path);
  if (!path.startsWith('compiled/') || !value) return false;
  if (type === 'movementProfile')
    return /\/movement$/.test(path) && typeof value.preset === 'string';
  if (type === 'point')
    return Object.keys(value).length === 2 && finite(value.x) && finite(value.y);
  if (type === 'points')
    return (
      Array.isArray(value) &&
      value.length <= 48 &&
      value.every((p) => plain(p) && Object.keys(p).length === 2 && finite(p.x) && finite(p.y))
    );
  return false;
}
function scalar(value, type) {
  if (type === 'number') return finite(value);
  if (type === 'integer') return Number.isSafeInteger(value);
  if (type === 'distance') return value === Infinity || (finite(value) && value >= 0);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'null') return value === null;
  if (type === 'text' || type === 'copy')
    return typeof value === 'string' && value.length <= (type === 'copy' ? 1024 : 160);
  if (type === 'machine') return value === false || ['tracked', 'wheeled'].includes(value);
  return null;
}

function encodeGraph(root, constants) {
  const nodes = [],
    seen = new WeakMap(),
    active = new WeakSet();
  const encode = (value, type, depth = 0) => {
    fail(depth <= 32, 'Survival checkpoint nesting is too deep.');
    if (type.startsWith('?')) return value === null ? null : encode(value, type.slice(1), depth);
    if (type.startsWith('~'))
      return value === undefined ? ['u'] : encode(value, type.slice(1), depth);
    const primitive = scalar(value, type);
    if (primitive !== null) {
      fail(primitive, `Invalid checkpoint ${type}.`);
      return value === Infinity ? ['infinity'] : Object.is(value, -0) ? ['negative-zero'] : value;
    }
    fail(value && typeof value === 'object', `Missing checkpoint ${type}.`);
    const constant = constants.byObject.get(value);
    if (constant !== undefined) {
      fail(constantFits(constant, type, constants), `Unexpected immutable ${type} reference.`);
      return ['c', constant];
    }
    fail(!active.has(value), 'Cyclic Survival checkpoint.');
    if (seen.has(value)) {
      const index = seen.get(value);
      fail(nodes[index][0] === type, 'Checkpoint alias changes type.');
      return ['r', index];
    }
    const schema = schemas[type];
    fail(schema, `Unsupported checkpoint type ${type}.`);
    fail(nodes.length < MAX_NODES, 'Survival checkpoint has too many objects.');
    const index = nodes.length,
      node = [type, null];
    nodes.push(node);
    seen.set(value, index);
    active.add(value);
    const child = (v, t) => encode(v, t, depth + 1);
    if (schema.kind === 'record' || schema.kind === 'dictionary') {
      fail(schema.kind === 'dictionary' ? Object.getPrototypeOf(value) === null : plain(value));
      const allowed = { ...schema.required, ...schema.optional };
      if (schema.kind === 'record')
        for (const key of Object.keys(schema.required))
          fail(Object.hasOwn(value, key), `Missing checkpoint ${type}.${key}.`);
      const entries = Object.entries(value);
      fail(entries.length <= (schema.max ?? Object.keys(allowed).length));
      node[1] = entries.map(([key, v]) => {
        const fieldType = schema.kind === 'dictionary' ? schema.of : allowed[key];
        fail(
          Object.hasOwn(allowed, key) || schema.kind === 'dictionary',
          `Unknown checkpoint ${type}.${key}.`,
        );
        fail(!['__proto__', 'constructor', 'prototype'].includes(key));
        return [key, child(v, fieldType)];
      });
    } else if (schema.kind === 'list' || schema.kind === 'typed' || schema.kind === 'set') {
      fail(
        schema.kind === 'list'
          ? Array.isArray(value)
          : schema.kind === 'set'
            ? value instanceof Set
            : value instanceof schema.constructor,
      );
      fail((value.size ?? value.length) <= schema.max);
      node[1] = Array.from(value, (v) =>
        child(v, schema.of ?? (schema.constructor === Float64Array ? 'number' : 'integer')),
      );
    } else if (schema.kind === 'map') {
      fail(value instanceof Map && value.size <= schema.max);
      node[1] = [...value].map(([key, v]) => [child(key, schema.key), child(v, schema.of)]);
    }
    active.delete(value);
    return ['r', index];
  };
  const rootRef = encode(root, 'run');
  return { root: rootRef, nodes };
}

function decodeGraph(graph, constants) {
  exactKeys(graph, ['root', 'nodes'], 'Survival graph');
  fail(Array.isArray(graph.nodes) && graph.nodes.length > 0 && graph.nodes.length <= MAX_NODES);
  const values = new Map(),
    active = new Set(),
    used = new Set();
  const decode = (wire, type, depth = 0) => {
    fail(depth <= 32, 'Survival checkpoint nesting is too deep.');
    if (type.startsWith('?')) return wire === null ? null : decode(wire, type.slice(1), depth);
    if (type.startsWith('~'))
      return Array.isArray(wire) && wire.length === 1 && wire[0] === 'u'
        ? undefined
        : decode(wire, type.slice(1), depth);
    if (
      ['number', 'integer', 'distance'].includes(type) &&
      Array.isArray(wire) &&
      wire.length === 1 &&
      wire[0] === 'negative-zero'
    )
      return -0;
    const value =
      type === 'distance' && Array.isArray(wire) && wire.length === 1 && wire[0] === 'infinity'
        ? Infinity
        : wire;
    const primitive = scalar(value, type);
    if (primitive !== null) {
      fail(primitive, `Invalid checkpoint ${type}.`);
      return value;
    }
    fail(Array.isArray(wire) && wire.length === 2);
    if (wire[0] === 'c') {
      fail(
        typeof wire[1] === 'string' &&
          constants.byPath.has(wire[1]) &&
          constantFits(wire[1], type, constants),
        'Checkpoint references an incompatible immutable object.',
      );
      return constants.byPath.get(wire[1]);
    }
    const index = wire[1];
    fail(
      wire[0] === 'r' && Number.isSafeInteger(index) && index >= 0 && index < graph.nodes.length,
    );
    const node = graph.nodes[index],
      schema = schemas[type];
    fail(
      schema &&
        Array.isArray(node) &&
        node.length === 2 &&
        node[0] === type &&
        Array.isArray(node[1]),
      'Invalid checkpoint node type.',
    );
    fail(!active.has(index), 'Cyclic Survival checkpoint.');
    if (values.has(index)) return values.get(index);
    used.add(index);
    active.add(index);
    const data = node[1],
      child = (v, t) => decode(v, t, depth + 1);
    let result;
    if (schema.kind === 'record' || schema.kind === 'dictionary') {
      result = schema.kind === 'dictionary' ? Object.create(null) : {};
      const allowed = { ...schema.required, ...schema.optional };
      fail(data.length <= (schema.max ?? Object.keys(allowed).length));
      for (const entry of data) {
        fail(Array.isArray(entry) && entry.length === 2);
        const [key, v] = entry;
        fail(
          typeof key === 'string' &&
            key.length <= 160 &&
            !['__proto__', 'constructor', 'prototype'].includes(key) &&
            !Object.hasOwn(result, key),
        );
        fail(
          schema.kind === 'dictionary' || Object.hasOwn(allowed, key),
          `Unknown checkpoint ${type}.${key}.`,
        );
        result[key] = child(v, schema.kind === 'dictionary' ? schema.of : allowed[key]);
      }
      if (schema.kind === 'record')
        for (const key of Object.keys(schema.required))
          fail(Object.hasOwn(result, key), `Missing checkpoint ${type}.${key}.`);
    } else if (schema.kind === 'list' || schema.kind === 'typed' || schema.kind === 'set') {
      fail(data.length <= schema.max);
      const entries = data.map((v) =>
        child(v, schema.of ?? (schema.constructor === Float64Array ? 'number' : 'integer')),
      );
      if (schema.kind === 'typed') {
        if (schema.constructor === Int32Array)
          fail(entries.every((n) => n >= -0x80000000 && n <= 0x7fffffff));
        if (schema.constructor === Uint32Array)
          fail(entries.every((n) => n >= 0 && n <= 0xffffffff));
        result = new schema.constructor(entries);
      } else if (schema.kind === 'set') {
        result = new Set(entries);
        fail(result.size === entries.length);
      } else result = entries;
    } else if (schema.kind === 'map') {
      fail(data.length <= schema.max);
      result = new Map();
      for (const entry of data) {
        fail(Array.isArray(entry) && entry.length === 2);
        const key = child(entry[0], schema.key);
        fail(!result.has(key));
        result.set(key, child(entry[1], schema.of));
      }
    }
    active.delete(index);
    values.set(index, result);
    return result;
  };
  const root = decode(graph.root, 'run');
  fail(used.size === graph.nodes.length, 'Checkpoint contains unowned state.');
  return root;
}

function validateLinks(grid, capacity) {
  fail(grid.heads.length === grid.columns * grid.rows && grid.next.length === capacity);
  fail(
    [...grid.heads, ...grid.next].every((n) => n >= -1 && n < capacity),
    'Invalid checkpoint grid index.',
  );
  const seen = new Set();
  for (const head of grid.heads)
    for (let index = head; index !== -1; index = grid.next[index]) {
      fail(!seen.has(index), 'Cyclic or duplicate checkpoint grid membership.');
      seen.add(index);
    }
}
function validateState(run, fresh) {
  const compiled = fresh.compiled;
  fail(
    run.compiled === compiled &&
      run.flight === fresh.flight &&
      run._permittedFamilies === fresh._permittedFamilies,
  );
  fail(
    run.rulesVersion === fresh.rulesVersion &&
      run.difficulty === fresh.difficulty &&
      run.seed === fresh.seed &&
      run.airframes === fresh.airframes &&
      run.slowResume === fresh.slowResume,
  );
  fail(
    ['paused', 'won', 'lost'].includes(run.phase) &&
      ['playing', 'upgrade'].includes(run._resumePhase),
  );
  fail(run.review !== true && run.fixture === null);
  fail(run.tick >= 0 && run.time === run.tick / 60, 'Checkpoint simulation time differs.');
  for (const key of ['_randomState', '_draftRandomState'])
    fail(run[key] > 0 && run[key] <= 0xffffffff);
  fail(
    Number.isSafeInteger(run.airframesRemaining) &&
      run.airframesRemaining >= 0 &&
      run.airframesRemaining <= run.airframes,
  );
  fail(run.stats.airframesLost === run.airframes - run.airframesRemaining);
  fail(
    run.player.hull >= 0 &&
      run.player.hull <= run.player.maxHull &&
      run.player.radius === fresh.player.radius,
  );
  for (const key of ['width', 'height']) fail(run.camera[key] === fresh.camera[key]);
  for (const [key, freeKey] of [
    ['enemies', '_enemyFree'],
    ['pickups', '_pickupFree'],
    ['effects', '_effectFree'],
    ['projectiles', '_projectileFree'],
    ['fields'],
    ['priorityAttacks'],
    ['_echoes'],
    ['_pulses'],
  ]) {
    fail(
      run[key].length === fresh[key].length && new Set(run[key]).size === run[key].length,
      `Checkpoint ${key} capacity differs.`,
    );
    if (freeKey) {
      const free = run[freeKey];
      fail(
        new Set(free).size === free.length &&
          free.every((i) => i >= 0 && i < run[key].length && !run[key][i].active),
      );
      fail(
        free.length === run[key].filter((v) => !v.active).length,
        `Checkpoint ${freeKey} ownership differs.`,
      );
    }
  }
  for (const [index, enemy] of run.enemies.entries()) {
    fail(
      enemy._slot === index &&
        run._permittedFamilies.has(enemy.family) &&
        ['common', 'elite', 'final'].includes(enemy.role),
    );
    fail(enemy.radius > 0 && enemy.radius <= 128 && enemy.hp >= 0 && enemy.hp <= enemy.maxHp);
    if (enemy._coordinated) validateOverflightMovement(enemy._coordinated.profile, compiled.arena);
  }
  fail(
    run._supportSources.length === 8 &&
      run._supportSources.every((enemy) => enemy === null || run.enemies[enemy._slot] === enemy),
  );
  fail(run._grid.records === run.enemies);
  for (const key of ['width', 'height', 'columns', 'rows', 'cellSize'])
    fail(run._grid[key] === fresh._grid[key]);
  validateLinks(run._grid, run.enemies.length);
  for (const key of ['counts', 'sumX', 'sumY', 'x', 'y'])
    fail(run._grid[key].length === fresh._grid[key].length);
  if (run._grid.local) {
    const local = run._grid.local;
    fail(
      local.cellSize === 16 &&
        local.columns === Math.ceil(compiled.arena.width / 16) &&
        local.rows === Math.ceil(compiled.arena.height / 16),
    );
    validateLinks(local, run.enemies.length);
  }
  fail(
    run._encounterIndex >= 0 &&
      Number.isSafeInteger(run._encounterIndex) &&
      run._encounterIndex <= compiled.encounters.length,
  );
  for (const [key, count] of Object.entries(run._movementSpawnCounts ?? {}))
    fail(compiled.encounters.some((e) => e.id === key) && count >= 0);
  fail(run.defeats.capacity === 512 && run.defeats.records.length === 512);
  const build = createOverflightBuild();
  let lastTick = 0;
  for (const choice of run.progression.history) {
    fail(choice.tick >= lastTick && choice.tick <= run.tick && choice.time === choice.tick / 60);
    lastTick = choice.tick;
    const offer = [
      ...legalOverflightUpgrades(build, compiled.upgrades.modules, run.rulesVersion),
      ...utilityOffers(build),
    ].find((o) => o.id === choice.id);
    fail(
      offer && applyOverflightUpgrade(build, offer, compiled.upgrades.modules, run.rulesVersion),
      'Checkpoint upgrade history is invalid.',
    );
  }
  fail(
    canonicalJSON(run.build) === canonicalJSON(build),
    'Checkpoint build differs from its choices.',
  );
  fail(run.player.maxHull === fresh.player.maxHull + run.build.reinforcement * 12);
  fail(
    run.progression.choices === run.progression.history.length &&
      run.stats.upgradesChosen === run.progression.choices &&
      run.progression.maxChoices === compiled.upgrades.choices,
  );
  fail(
    run.progression.choices <= run.progression.maxChoices &&
      run.progression.nextThreshold ===
        (compiled.upgrades.thresholds[run.progression.choices] ?? null),
  );
  const pending = run.phase === 'paused' && run._resumePhase === 'upgrade';
  fail(run.offers.length === (pending ? 3 : 0));
  const legal = [
    ...legalOverflightUpgrades(run.build, compiled.upgrades.modules, run.rulesVersion),
    ...utilityOffers(run.build),
  ];
  fail(new Set(run.offers.map((o) => o.id)).size === run.offers.length);
  for (const offer of run.offers)
    fail(
      legal.some((o) => canonicalJSON(o) === canonicalJSON(offer)),
      'Checkpoint upgrade offer differs.',
    );
  fail((run.terrain === null) === (fresh.terrain === null));
  if (run.terrain) {
    const terrain = run.terrain;
    for (const key of ['format', 'id', 'experimental']) fail(terrain[key] === fresh.terrain[key]);
    fail(terrain.obstacles.length === fresh.terrain.obstacles.length);
    for (const [i, obstacle] of terrain.obstacles.entries()) {
      for (const key of ['id', 'x', 'y', 'width', 'height', 'breakable'])
        fail(obstacle[key] === fresh.terrain.obstacles[i][key]);
      fail(
        obstacle.hp === Infinity
          ? !obstacle.breakable
          : obstacle.breakable && obstacle.hp >= 0 && obstacle.hp <= 2,
      );
      fail(obstacle.active === obstacle.hp > 0);
    }
    for (const [radius, graph] of terrain.graphs) {
      fail(radius >= 4 && radius <= 132 && radius % 4 === 0);
      fail(
        graph.edges.length === graph.points.length &&
          graph.edges.every((row) => row.length === graph.points.length),
      );
    }
    for (const [key, distances] of terrain.fields) {
      fail(/^\d+:\d+:\d+$/.test(key));
      const [radius, x, y] = key.split(':').map(Number);
      fail(
        terrain.graphs.has(radius) &&
          distances.length === terrain.graphs.get(radius).points.length &&
          x <= Math.ceil(compiled.arena.width / 32) &&
          y <= Math.ceil(compiled.arena.height / 32),
      );
    }
  }
  return run;
}

function validateSettings(value) {
  exactKeys(
    value,
    ['seed', 'airframes', 'slowResume', 'characterId', 'flightTraits', 'authored'],
    'Survival settings',
  );
  fail(Number.isSafeInteger(value.seed) && value.seed > 0 && value.seed <= 0xffffffff);
  fail(
    [1, 3].includes(value.airframes) &&
      typeof value.slowResume === 'boolean' &&
      typeof value.flightTraits === 'boolean',
  );
  fail(typeof value.characterId === 'string' && /^[a-z0-9-]{1,80}$/.test(value.characterId));
  fail(typeof value.authored === 'boolean');
  return value;
}
export function encodeOverflightCheckpoint({
  run,
  project,
  packageIdentity,
  attemptId,
  settings = null,
}) {
  validateSurvivalAttemptId(attemptId);
  validateSurvivalPackageIdentity(packageIdentity);
  const source = validateOverflightProject(project),
    compiled = compileOverflightProject(source);
  fail(
    canonicalJSON(compiled) === canonicalJSON(run.compiled),
    'The checkpoint project differs from the active flight.',
  );
  const options = validateSettings(
    settings ?? {
      seed: run.seed,
      airframes: run.airframes,
      slowResume: run.slowResume,
      characterId: run.flight.id,
      flightTraits: true,
      authored: false,
    },
  );
  const fresh = createOverflightRun(compiled, options);
  fail(
    canonicalJSON(run.flight) === canonicalJSON(fresh.flight),
    'The saved handling settings differ from this flight.',
  );
  fail(
    canonicalJSON([...run._permittedFamilies]) === canonicalJSON([...fresh._permittedFamilies]),
    'The saved enemy families differ from this flight.',
  );
  const { appearance = null, ...state } = run;
  const graph = encodeGraph(state, constantsFor(run));
  // The writer uses the same admission path as a later reopen. It cannot store
  // an incomplete runtime field or a checkpoint that its reader cannot accept.
  const value = {
    format: OVERFLIGHT_CHECKPOINT_FORMAT,
    packageIdentity: { ...packageIdentity },
    attemptId,
    project: source,
    projectIdentity: compiled.projectIdentity,
    settings: options,
    appearance,
    graph,
  };
  const text = JSON.stringify(value);
  fail(
    new TextEncoder().encode(text).byteLength <= OVERFLIGHT_CHECKPOINT_MAX_BYTES,
    'Survival checkpoint exceeds its storage bound.',
  );
  validateState(decodeGraph(graph, constantsFor(fresh)), fresh);
  return text;
}
export function decodeOverflightCheckpoint(source, { packageIdentity, terminal = false } = {}) {
  validateSurvivalPackageIdentity(packageIdentity);
  const value = boundedJSON(source, {
    maxBytes: OVERFLIGHT_CHECKPOINT_MAX_BYTES,
    maxNodes: 1500000,
    maxArray: MAX_NODES,
    maxDepth: 20,
  });
  exactKeys(
    value,
    [
      'format',
      'packageIdentity',
      'attemptId',
      'project',
      'projectIdentity',
      'settings',
      'appearance',
      'graph',
    ],
    'Survival checkpoint',
  );
  fail(value.format === OVERFLIGHT_CHECKPOINT_FORMAT, 'Unsupported Survival checkpoint version.');
  validateSurvivalPackageIdentity(value.packageIdentity);
  fail(
    canonicalJSON(value.packageIdentity) === canonicalJSON(packageIdentity),
    'This saved flight requires its exact game package.',
  );
  validateSurvivalAttemptId(value.attemptId);
  const project = validateOverflightProject(value.project),
    compiled = compileOverflightProject(project);
  fail(
    value.projectIdentity === compiled.projectIdentity,
    'Checkpoint authored source identity differs.',
  );
  const settings = validateSettings(value.settings),
    fresh = createOverflightRun(compiled, settings);
  const run = validateState(decodeGraph(value.graph, constantsFor(fresh)), fresh);
  fail(
    terminal ? ['won', 'lost'].includes(run.phase) : run.phase === 'paused',
    'This checkpoint cannot resume a flight.',
  );
  // Appearance is a retained admission request, never permission to load a URL.
  // The host must match it against its independently prepared exact appearance.
  const appearance = boundedJSON(value.appearance, {
    maxBytes: 128 * 1024,
    maxNodes: 10000,
    maxArray: 512,
    maxDepth: 12,
  });
  if (appearance !== null) {
    fail(plain(appearance));
    run.appearance = appearance;
  }
  return { run, project, settings, attemptId: value.attemptId, appearance };
}
