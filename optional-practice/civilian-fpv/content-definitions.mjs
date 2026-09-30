import { boundedJSON, dataIdentity, stableId } from '../../game/data-json.mjs';
import { validateWorldCourse } from './world-model.mjs';
import { resolveThemeExperience } from './world-themes.mjs';

export const CONTENT_FORMATS = Object.freeze({
  world: 'World.v1',
  layout: 'CourseLayout.v1',
  challenge: 'Challenge.v1',
  campaign: 'Campaign.v1',
  actor: 'ActorDefinition.v1',
  manifest: 'PackManifest.v1',
});
const clone = structuredClone;
const check = (ok, message) => {
  if (!ok) throw new TypeError(message);
};
const data = (value) =>
  boundedJSON(value, {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: 200000,
    maxArray: 60000,
    maxDepth: 16,
  });
function header(value, format) {
  check(
    value?.format === format && stableId(value.id) && stableId(value.revision),
    `Invalid ${format} identity.`,
  );
}
const modes = ['self-level', 'acro'];

/** Split an existing runtime course into independently reusable authored layers. */
export function splitCourseDefinition(input, { layoutId, challengeId } = {}) {
  const c = validateWorldCourse(input),
    world = {
      format: CONTENT_FORMATS.world,
      id: c.world.id,
      revision: c.revision,
      presentation: clone(c.world),
      environment: c.environment,
      spawn: clone(c.spawn),
      bounds: clone(c.bounds),
      obstacles: clone(c.obstacles),
    };
  const objectives = [],
    orders = {};
  for (const mode of modes) {
    orders[mode] = c.steps[mode].map((criterion, index) => {
      const id = `${mode === 'acro' ? 'acro' : 'level'}-${String(index + 1).padStart(3, '0')}`;
      objectives.push({ id, criterion: clone(criterion) });
      return id;
    });
  }
  const layout = {
    format: CONTENT_FORMATS.layout,
    id: layoutId ?? `${c.id}-layout`,
    revision: c.revision,
    worldId: world.id,
    objectives,
    orders,
    actors: clone(c.actors),
    bindings: {},
  };
  const challenge = {
    format: CONTENT_FORMATS.challenge,
    id: challengeId ?? c.id,
    revision: c.revision,
    worldId: world.id,
    layoutId: layout.id,
    locales: clone(c.locales),
    rules: clone(c.rules),
    conditions: clone(c.conditions),
  };
  return { world, layout, challenge };
}

/** The FPV adapter compiles data; component implementations are application code. */
export function compileChallengeDefinition({
  world: sourceWorld,
  layout: sourceLayout,
  challenge: sourceChallenge,
  campaign = null,
  profiles,
  rulesets,
} = {}) {
  const world = data(sourceWorld),
    layout = data(sourceLayout),
    challenge = data(sourceChallenge);
  header(world, CONTENT_FORMATS.world);
  header(layout, CONTENT_FORMATS.layout);
  header(challenge, CONTENT_FORMATS.challenge);
  check(
    layout.worldId === world.id &&
      challenge.worldId === world.id &&
      challenge.layoutId === layout.id,
    'Challenge dependencies do not match their world/layout identities.',
  );
  check(
    Array.isArray(layout.objectives) && layout.objectives.length <= 256,
    'Layout needs bounded objective definitions.',
  );
  const map = new Map();
  for (const objective of layout.objectives) {
    check(
      stableId(objective.id) && !map.has(objective.id),
      'Duplicate or invalid objective authoring ID.',
    );
    map.set(objective.id, objective.criterion);
  }
  const steps = {};
  for (const mode of modes) {
    const order = layout.orders?.[mode];
    check(
      Array.isArray(order) && order.length > 0 && order.length <= 128,
      'Layout requires ordered objectives for both flight modes.',
    );
    steps[mode] = order.map((id) => {
      check(map.has(id), `Missing objective ${id}.`);
      return clone(map.get(id));
    });
  }
  const course = {
    format: 'FlightCourse.v2',
    id: challenge.id,
    revision: challenge.revision,
    environment: world.environment,
    world: { id: world.id, theme: 'academy', style: 'hangar', ...world.presentation },
    locales: challenge.locales,
    spawn: layout.spawn ?? world.spawn,
    bounds: world.bounds,
    obstacles: world.obstacles,
    steps,
    actors: layout.actors ?? [],
    rules: challenge.rules ?? {},
    conditions: challenge.conditions ?? { profile: 'clear', revision: 'r1' },
    ...(challenge.rulesetId ? { rulesetId: challenge.rulesetId } : {}),
    ...(challenge.themeId ? { themeId: challenge.themeId } : {}),
  };
  const experience = resolveThemeExperience({ course, campaign, profiles, rulesets });
  return {
    course: validateWorldCourse(experience.course),
    theme: experience.theme,
    dependencies: {
      world: { id: world.id, revision: world.revision, identity: dataIdentity(world) },
      layout: { id: layout.id, revision: layout.revision, identity: dataIdentity(layout) },
      challenge: {
        id: challenge.id,
        revision: challenge.revision,
        identity: dataIdentity(challenge),
      },
    },
  };
}

/** Reimport moves only source-bound objectives without an explicit local override. */
export function mergeLayoutAnchors(input, { previous = [], next = [], overrides = {} } = {}) {
  const layout = data(input);
  header(layout, CONTENT_FORMATS.layout);
  const before = new Map(previous.map((a) => [a.id, a])),
    after = new Map(next.map((a) => [a.id, a])),
    diagnostics = [];
  const byId = new Map(layout.objectives.map((o) => [o.id, o]));
  for (const [objectiveId, anchorId] of Object.entries(layout.bindings ?? {})) {
    const target = byId.get(objectiveId);
    check(target, `Dangling objective binding: ${objectiveId}.`);
    const old = before.get(anchorId),
      current = after.get(anchorId);
    if (!current) {
      diagnostics.push({ severity: 'warning', code: 'missing-anchor', objectiveId, anchorId });
      continue;
    }
    if (overrides[objectiveId]) {
      diagnostics.push({ severity: 'info', code: 'override-preserved', objectiveId, anchorId });
      continue;
    }
    if (!old) continue;
    const delta = Object.fromEntries(
      ['x', 'y', 'z'].map((k) => [k, Math.round((current.position[k] - old.position[k]) * 1000)]),
    );
    const c = target.criterion;
    if (c.min && c.max)
      for (const k of ['x', 'y', 'z']) {
        c.min[k] += delta[k];
        c.max[k] += delta[k];
      }
    else if (c.type === 'gate') {
      c.at += delta[c.axis];
      const side = c.axis === 'x' ? 'z' : 'x';
      c.minSide += delta[side];
      c.maxSide += delta[side];
      c.minY += delta.y;
      c.maxY += delta.y;
    }
    diagnostics.push({ severity: 'info', code: 'anchor-updated', objectiveId, anchorId });
  }
  return { layout, diagnostics };
}

export function compileContentProject(input) {
  const p = data(input);
  check(
    Array.isArray(p.worlds) && Array.isArray(p.layouts) && Array.isArray(p.challenges),
    'A layered project needs worlds, layouts and challenges.',
  );
  const index = (rows) => {
    check(rows.length <= 256, 'Content count exceeds budget.');
    const map = new Map();
    for (const item of rows) {
      check(!map.has(item.id), 'Duplicate content ID.');
      map.set(item.id, item);
    }
    return map;
  };
  const worlds = index(p.worlds),
    layouts = index(p.layouts);
  index(p.challenges);
  return p.challenges.map((challenge) =>
    compileChallengeDefinition({
      world: worlds.get(challenge.worldId),
      layout: layouts.get(challenge.layoutId),
      challenge,
      campaign: p.campaigns?.find((c) => c.challengeIds?.includes(challenge.id)),
      profiles: p.themes,
      rulesets: p.rulesets,
    }),
  );
}
