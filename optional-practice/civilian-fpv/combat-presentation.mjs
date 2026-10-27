import { ACTOR_FAMILIES, actorVisual } from '../../game/hunt/actor-catalog.mjs';
import { INDUSTRIAL_SOLDIER_KITS } from '../../game/hunt/industrial-soldier-kit.mjs';
import { HUNT_PRESENTATION_CATALOG } from '../../game/hunt/presentation-catalog.mjs';
import {
  createDestructionPreferences,
  sharedActorAppearance,
} from '../../game/hunt/preferences.mjs';
import { createEncounterDisplayPreferences } from '../../game/encounter-display-preferences.mjs';

/** Cosmetic limits never cap accepted hits, rewards, or the living population. */
export const COMBAT_EFFECT_LIMITS = Object.freeze({
  capacity: 1024,
  low: Object.freeze({ bursts: 4, moving: 128, settled: 256, marks: 32, calls: 16, triangles: 0 }),
  high: Object.freeze({
    bursts: 6,
    moving: 256,
    settled: 768,
    marks: 96,
    calls: 24,
    triangles: 600000,
  }),
  ultra: Object.freeze({
    bursts: 8,
    moving: 512,
    settled: 1536,
    marks: 192,
    calls: 40,
    triangles: 1200000,
  }),
});
export const COMBAT_PRESENTATION_KEY = 'revealline.sim.combat-presentation.v1';
const FORMAT = 'FpvCombatPresentationV2';
const LEGACY_FORMAT = 'FpvCombatPresentationV1';
const families = new Set(ACTOR_FAMILIES.map(({ id }) => id));
const materials = new Set([
  'organic',
  'metal',
  'wood',
  'electronic',
  'glass',
  'stone',
  'earth',
  'concrete',
]);
const bodyRegions = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const axes = ['x', 'y', 'z'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const vector = (value, limit = 100000000) =>
  value && axes.every((key) => Number.isFinite(value[key]) && Math.abs(value[key]) <= limit);
const copyVector = (value) => Object.fromEntries(axes.map((key) => [key, value[key]]));
const normalOf = (value) => {
  if (!vector(value)) return { x: 0, y: 1, z: 0 };
  const length = Math.hypot(value.x, value.y, value.z);
  return length > 0
    ? Object.fromEntries(axes.map((key) => [key, value[key] / length]))
    : { x: 0, y: 1, z: 0 };
};
const hash = (text) => {
  let n = 2166136261;
  for (const char of String(text)) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return n >>> 0;
};
const random = (seed, salt) => {
  let n = (seed ^ Math.imul(salt + 1, 2246822519)) >>> 0;
  n ^= n >>> 16;
  n = Math.imul(n, 3266489917);
  n ^= n >>> 13;
  return (n >>> 0) / 4294967296;
};
// Accepted damage stays unchanged. These are presentation-only force/readability choices.
const breakupOutcome = (record, brutal) =>
  brutal && !record.protected && record.outcome === 'localized' ? 'breakup' : record.outcome;
const impactStrength = (record) =>
  clamp(
    Math.max(
      0.65 + Math.sqrt(record.severity ?? 0.25) * 0.65,
      Math.hypot(record.velocity.x, record.velocity.y, record.velocity.z) / 18000,
      record.outcome === 'explosive' ? 1.9 : 0,
    ),
    0.65,
    2.6,
  );
const identifier = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256;
const surfaceOf = (value) =>
  value && vector(value.position) && vector(value.normal)
    ? {
        position: copyVector(value.position),
        normal: normalOf(value.normal),
        ...(identifier(value.surfaceId) ? { surfaceId: value.surfaceId } : {}),
        ...(vector(value.localPosition) ? { localPosition: copyVector(value.localPosition) } : {}),
      }
    : null;
// Physics collider/chunk IDs and renderer mesh IDs use different namespaces.
// Preserve accepted contacts, and bind presentation only to their actual surface.
const sameContact = (accepted, rendered) =>
  rendered &&
  Math.hypot(...axes.map((axis) => rendered.position[axis] - accepted.position[axis])) < 50 &&
  axes.reduce((sum, axis) => sum + rendered.normal[axis] * accepted.normal[axis], 0) > 0.98;

/** Separate storage keeps older strict shared destruction records compatible. */
export function createCombatPresentationPreferences({ window: win = globalThis, storage } = {}) {
  let store = storage;
  try {
    store ??= win.localStorage;
  } catch {
    /* Session choice remains available. */
  }
  let value = { detail: 'auto', artStyle: 'current', durable: true };
  const listeners = new Set();
  const valid = (next) =>
    next && ['auto', 'high', 'ultra'].includes(next.detail) && next.artStyle === 'current';
  const read = () => {
    try {
      const raw = store?.getItem(COMBAT_PRESENTATION_KEY);
      if (!raw) return;
      if (raw.length > 512) throw new Error('Oversized combat preferences');
      const next = JSON.parse(raw);
      if (next.format !== 'FpvCombatPreferencesV1' || !valid(next))
        throw new Error('Unsupported combat preferences');
      value = { detail: next.detail, artStyle: next.artStyle, durable: true };
    } catch {
      value = { ...value, durable: false };
    }
  };
  read();
  const notify = () => listeners.forEach((listener) => listener({ ...value }));
  const changed = (event) => {
    if (event.key !== COMBAT_PRESENTATION_KEY) return;
    read();
    notify();
  };
  win.addEventListener?.('storage', changed);
  return {
    snapshot: () => ({ ...value }),
    set(patch) {
      const next = { ...value, ...patch };
      if (!valid(next) || Object.keys(patch).some((key) => !['detail', 'artStyle'].includes(key)))
        throw new TypeError('Unsupported combat presentation choice');
      value = { detail: next.detail, artStyle: next.artStyle, durable: false };
      try {
        const raw = JSON.stringify({
          format: 'FpvCombatPreferencesV1',
          detail: value.detail,
          artStyle: value.artStyle,
        });
        if (!store) throw new Error('Storage unavailable');
        store.setItem(COMBAT_PRESENTATION_KEY, raw);
        value.durable = store.getItem(COMBAT_PRESENTATION_KEY) === raw;
      } catch {
        /* Keep the requested setting for this session. */
      }
      notify();
      return { ...value };
    },
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...value });
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
      win.removeEventListener?.('storage', changed);
    },
  };
}

export function normalizeCombatDefeat(fact, query = null) {
  if (
    !fact ||
    fact.type !== 'defeat' ||
    !identifier(fact.eventId) ||
    !identifier(fact.sourceId) ||
    !vector(fact.position) ||
    !Number.isSafeInteger(fact.tick) ||
    fact.tick < 0
  )
    throw new TypeError('Invalid accepted combat defeat');
  const family = families.has(fact.appearance?.family) ? fact.appearance.family : 'patroller';
  const preferredCast = sharedActorAppearance().snapshot().cast;
  const cast = ['rivals', 'tactical', 'arcade'].includes(fact.appearance?.cast)
    ? fact.appearance.cast
    : ['rivals', 'tactical', 'arcade'].includes(preferredCast)
      ? preferredCast
      : 'rivals';
  let surface = surfaceOf(fact.surface);
  if (!surface && query) {
    try {
      surface = surfaceOf(query(copyVector(fact.position), normalOf(fact.normal)));
    } catch {
      /* Unknown resident geometry cannot receive a mark. */
    }
  }
  let renderSurface = surfaceOf(fact.renderSurface);
  if (!renderSurface && surface && query) {
    try {
      const candidate = surfaceOf(query(surface.position, surface.normal));
      if (sameContact(surface, candidate)) renderSurface = candidate;
    } catch {
      /* Resolve the exact contact when its streamed geometry becomes available. */
    }
  }
  return {
    eventId: fact.eventId,
    sourceId: fact.sourceId,
    spawnId: typeof fact.spawnId === 'string' ? fact.spawnId.slice(0, 256) : fact.eventId,
    tick: fact.tick,
    position: copyVector(fact.position),
    ...(vector(fact.impactPosition) ? { impactPosition: copyVector(fact.impactPosition) } : {}),
    normal: normalOf(fact.normal),
    ...(vector(fact.impactDirection) ? { impactDirection: normalOf(fact.impactDirection) } : {}),
    velocity: vector(fact.velocity, 1000000) ? copyVector(fact.velocity) : { x: 0, y: 0, z: 0 },
    material: materials.has(fact.material) ? fact.material : 'metal',
    appearance: {
      family,
      cast,
      type: String(fact.appearance?.type ?? '').slice(0, 64),
      model: String(fact.appearance?.model ?? fact.vehicleModel ?? '').slice(0, 64),
      archetype: String(fact.appearance?.archetype ?? '').slice(0, 64),
    },
    radius: clamp(
      Number.isFinite(fact.radius) ? fact.radius : fact.material === 'organic' ? 350 : 700,
      100,
      3000,
    ),
    height: clamp(
      Number.isFinite(fact.height) ? fact.height : fact.material === 'organic' ? 1800 : 900,
      100,
      6000,
    ),
    seed: Number.isSafeInteger(fact.seed) ? fact.seed >>> 0 : hash(fact.eventId),
    weapon: String(fact.weapon ?? fact.cause ?? 'pulse').slice(0, 64),
    cause: String(fact.cause ?? 'pulse').slice(0, 64),
    severity: clamp(
      Number.isFinite(fact.severity)
        ? fact.severity
        : ({ explosive: 1.6, high: 0.8, localized: 0.25 }[fact.severity] ??
            (fact.damage ?? 25) / 100),
      0,
      4,
    ),
    damage: clamp(Number.isFinite(fact.damage) ? fact.damage : 25, 0, 10000),
    componentMask: Number.isSafeInteger(fact.componentMask) ? fact.componentMask : 0,
    protected: fact.protected === true,
    outcome: ['intact', 'localized', 'breakup', 'explosive'].includes(fact.outcome)
      ? fact.outcome
      : fact.severity === 'explosive' ||
          /rocket|bomb|charge|explosion/.test(fact.weapon ?? fact.cause ?? '')
        ? 'explosive'
        : fact.severity === 'high' || fact.severity > 0.6 || fact.cause === 'impact'
          ? 'breakup'
          : 'localized',
    presentation: normalizeFragmentArchive(fact.presentation),
    surface,
    renderSurface,
  };
}

const canonicalRegion = (name) =>
  ({
    torso: 'chest',
    leftArm: 'leftUpperArm',
    rightArm: 'rightUpperArm',
    leftLeg: 'leftThigh',
    rightLeg: 'rightThigh',
  })[name] ?? name;
const roundCosmetic = (value, precision = 3) => Number(value.toFixed(precision));
function compactFragmentArchive(value) {
  if (!value) return value;
  const compactSurface = (surface) =>
    surface && {
      ...surface,
      position: Object.fromEntries(
        axes.map((axis) => [axis, roundCosmetic(surface.position[axis], 1)]),
      ),
      normal: Object.fromEntries(
        axes.map((axis) => [axis, roundCosmetic(surface.normal[axis], 5)]),
      ),
      ...(surface.localPosition
        ? {
            localPosition: Object.fromEntries(
              axes.map((axis) => [axis, roundCosmetic(surface.localPosition[axis], 4)]),
            ),
          }
        : {}),
    };
  return {
    born: roundCosmetic(value.born, 4),
    pieces: Object.fromEntries(
      Object.entries(value.pieces).map(([key, piece]) => [
        canonicalRegion(key),
        {
          ...piece,
          at: piece.at.map((value) => roundCosmetic(value)),
          rotation: piece.rotation.map((value) => roundCosmetic(value, 5)),
          velocity: piece.velocity.map((value) => roundCosmetic(value, 4)),
          time: roundCosmetic(piece.time, 4),
          surface: compactSurface(piece.surface),
        },
      ]),
    ),
  };
}

/** Cosmetic failure must never invalidate accepted combat state. Coordinates are metres. */
function normalizeFragmentArchive(value) {
  if (
    !value ||
    !Number.isFinite(value.born) ||
    value.born < 0 ||
    !value.pieces ||
    typeof value.pieces !== 'object' ||
    Array.isArray(value.pieces) ||
    Object.keys(value.pieces).length > 128
  )
    return null;
  const pieces = {};
  for (const [key, piece] of Object.entries(value.pieces)) {
    if (
      !identifier(key) ||
      !piece ||
      !Array.isArray(piece.at) ||
      !Array.isArray(piece.rotation) ||
      !Array.isArray(piece.velocity) ||
      [piece.at, piece.rotation, piece.velocity].some(
        (a) => a.length !== 3 || a.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e8),
      ) ||
      !Number.isFinite(piece.time) ||
      piece.time < 0
    )
      return null;
    pieces[canonicalRegion(key)] = {
      at: [...piece.at],
      rotation: [...piece.rotation],
      velocity: [...piece.velocity],
      time: piece.time,
      settled: piece.settled === true,
      pending: piece.pending === true,
      surface: surfaceOf(piece.surface),
    };
  }
  return { born: value.born, pieces };
}

/** Bounded, exportable world-space records. No physics state or engine object is retained. */
export function createCombatRemainsLedger() {
  let runId = '',
    revision = 0,
    tick = 0,
    records = [],
    impactRecords = [],
    seen = new Set(),
    evicted = 0;
  const reset = (id = '') => {
    revision++;
    runId = id;
    tick = 0;
    records = [];
    impactRecords = [];
    seen.clear();
    evicted = 0;
  };
  return {
    reset,
    add(facts, options = {}) {
      if (options.runId !== undefined && options.runId !== runId) reset(String(options.runId));
      tick = Math.max(tick, options.tick ?? 0);
      const fresh = [];
      for (const fact of (facts ?? []).slice(-1024)) {
        if (!['defeat', 'surface-impact'].includes(fact?.type) || seen.has(fact.eventId)) continue;
        const isImpact = fact.type === 'surface-impact';
        const next = normalizeCombatDefeat(
          {
            ...fact,
            type: 'defeat',
            sourceId: isImpact
              ? String(fact.sourceId ?? 'surface').slice(0, 256) || 'surface'
              : fact.sourceId,
          },
          options.groundQuery,
        );
        next.kind = isImpact ? 'surface-impact' : 'defeat';
        const collection = isImpact ? impactRecords : records;
        tick = Math.max(tick, next.tick);
        collection.push(next);
        revision++;
        seen.add(next.eventId);
        fresh.push(next);
        if (collection.length > COMBAT_EFFECT_LIMITS.capacity) {
          const old = collection.shift();
          seen.delete(old.eventId);
          evicted++;
        }
      }
      return fresh;
    },
    records: () => records,
    impacts: () => impactRecords,
    revision: () => revision,
    export: () => structuredClone({ format: FORMAT, runId, tick, records, impactRecords }),
    restore(input, options = {}) {
      const source = Array.isArray(input)
        ? { format: FORMAT, runId: options.runId ?? '', tick: options.tick ?? 0, records: input }
        : input;
      if (
        !source ||
        ![FORMAT, LEGACY_FORMAT].includes(source.format) ||
        typeof source.runId !== 'string' ||
        source.runId.length > 256 ||
        !Number.isSafeInteger(source.tick) ||
        source.tick < 0 ||
        !Array.isArray(source.records) ||
        source.records.length > 1024 ||
        (source.impactRecords !== undefined &&
          (!Array.isArray(source.impactRecords) || source.impactRecords.length > 1024)) ||
        (options.runId !== undefined && source.runId !== options.runId)
      )
        throw new TypeError('Invalid combat presentation archive');
      const next = source.records.map((record) => ({
        // Reconstruction resolves support lazily within the shared frame budget.
        ...normalizeCombatDefeat({ ...record, type: 'defeat' }),
        kind: 'defeat',
      }));
      const nextImpacts = (source.impactRecords ?? []).map((record) => ({
        ...normalizeCombatDefeat({ ...record, type: 'defeat' }),
        kind: 'surface-impact',
      }));
      const all = [...next, ...nextImpacts];
      if (new Set(all.map((record) => record.eventId)).size !== all.length)
        throw new TypeError('Duplicate combat presentation records');
      if (all.some((record) => record.tick > source.tick))
        throw new TypeError('Combat remains exceed the restored tick');
      reset(source.runId);
      tick = source.tick;
      records = next;
      impactRecords = nextImpacts;
      seen = new Set(all.map((record) => record.eventId));
    },
    snapshot: () => ({
      runId,
      tick,
      stored: records.length,
      storedImpacts: impactRecords.length,
      capacity: 1024,
      impactCapacity: 1024,
      evicted,
    }),
  };
}

// Convert a child's local support box into its parent's axes using the same
// XYZ Euler convention as the renderer. The resulting box is conservative for
// layered tissue, diagonal straps and fingers as their connected root settles.
function rotatedSupportSize(part) {
  const [x, y, z] = part.rotation ?? [0, 0, 0];
  const [sx, sy, sz] = part.supportSize ?? part.size;
  const a = Math.cos(x),
    b = Math.sin(x),
    c = Math.cos(y),
    d = Math.sin(y),
    e = Math.cos(z),
    f = Math.sin(z);
  return [
    Math.abs(c * e) * sx + Math.abs(c * f) * sy + Math.abs(d) * sz,
    Math.abs(a * f + b * e * d) * sx + Math.abs(a * e - b * f * d) * sy + Math.abs(b * c) * sz,
    Math.abs(b * f - a * e * d) * sx + Math.abs(b * e + a * f * d) * sy + Math.abs(a * c) * sz,
  ];
}

/** A recipe uses common primitives so every family/cast fits a small set of GPU batches. */
export function combatFragmentRecipe(
  record,
  { brutal = false, blood = true, detail = 'high' } = {},
) {
  const parts = [],
    organic = record.material === 'organic',
    bloody = organic && blood && !record.protected,
    outcome = breakupOutcome(record, brutal),
    dismember = organic && brutal && !record.protected && outcome !== 'intact';
  const palette = actorVisual(record.appearance.family, record.appearance.cast).palette;
  const add = (shape, size, tint, at = [0, 0, 0], rotation = [0, 0, 0], attachment = -1) => {
    parts.push({ shape, size, tint, at, rotation, attachment });
    return parts.length - 1;
  };
  if (organic) {
    const roots = new Map();
    const severe = ['breakup', 'explosive'].includes(outcome);
    const hitSide = random(record.seed, 102) < 0.5 ? 'left' : 'right';
    const fine = detail !== 'low';
    const ornament = (root, shape, size, tint, at, rotation = [0, 0, 0], optional = true) => {
      const index = add(shape, size, tint, at, rotation, root);
      parts[index].region = parts[root].region;
      parts[index].optionalDetail = optional;
      return index;
    };
    const region = (name, shape, size, tint, at, parent = 'chest') => {
      const detached =
        dismember &&
        (outcome === 'explosive' ||
          (severe && !['chest', 'abdomen', 'pelvis'].includes(name)) ||
          name === `${hitSide}Forearm`);
      const anchor = roots.get(parent);
      const local =
        anchor !== undefined && !detached
          ? at.map((n, axis) => n - parts[anchor].bodyAt[axis])
          : at;
      const index = add(
        shape,
        size,
        tint,
        local,
        [0, 0, 0],
        anchor !== undefined && !detached ? anchor : -1,
      );
      parts[index].region = name;
      parts[index].bodyAt = at;
      parts[index].authored = true;
      roots.set(name, index);
      if (detached && bloody) {
        // The neck opens below the head; limb cuts open at their proximal joint.
        // Every layer follows that persistent body region, including after restore.
        const sign = name === 'head' ? -1 : 1;
        const end = sign * (size[1] / 2 + 0.003);
        ornament(
          index,
          'wound',
          [size[0] * 0.94, 0.038, size[2] * 0.94],
          '#421019',
          [0, end, 0],
          [0, 0, 0],
          false,
        );
        ornament(index, 'wound', [size[0] * 0.74, 0.047, size[2] * 0.72], '#a82436', [
          0,
          end + sign * 0.012,
          0,
        ]);
        const paired = /Forearm|Shin/.test(name),
          core = /chest|abdomen|pelvis/.test(name);
        const width = core ? 0.045 : name === 'head' ? 0.035 : 0.026;
        for (const side of paired ? [-1, 1] : [0])
          ornament(
            index,
            'bone',
            [width, core ? 0.075 : 0.055, width],
            '#dfd0ab',
            [side * size[0] * 0.18, end + sign * 0.034, 0],
            [0.08 * side, 0, -0.1 * side],
            false,
          );
        if (fine)
          for (let fold = 0; fold < (detail === 'ultra' ? 4 : 2); fold++) {
            const angle = random(record.seed, 120 + index * 3 + fold) * Math.PI * 2;
            ornament(
              index,
              'wound',
              [size[0] * 0.22, 0.07, size[2] * 0.2],
              fold % 2 ? '#741b30' : '#c24b4d',
              [
                Math.cos(angle) * size[0] * 0.26,
                end + sign * 0.016,
                Math.sin(angle) * size[2] * 0.25,
              ],
              [0.12, angle, 0.14],
            );
          }
        if (fine && core)
          for (const side of [-1, 1])
            for (let rib = 0; rib < 3; rib++)
              ornament(
                index,
                'bone',
                [0.024, size[0] * 0.4, 0.023],
                '#bfa98e',
                [side * size[0] * 0.22, end + sign * 0.025, (rib - 1) * size[2] * 0.19],
                [0.2, 0.1 * rib, side * 1.05],
              );
      }
      return index;
    };
    const torso = region('chest', 'round', [0.4, 0.37, 0.27], palette.coat, [0, 0.16, 0], null);
    const abdomen = region('abdomen', 'round', [0.32, 0.22, 0.24], palette.coat, [0, -0.1, 0]);
    const pelvis = region(
      'pelvis',
      'round',
      [0.35, 0.19, 0.26],
      palette.pants,
      [0, -0.28, 0],
      'abdomen',
    );
    ornament(
      torso,
      'cloth',
      [0.31, 0.31, 0.065],
      palette.dark,
      [0, 0.005, -0.115],
      [0, 0, 0],
      false,
    );
    ornament(torso, 'cloth', [0.27, 0.25, 0.025], palette.coat, [0, 0.015, -0.16]);
    ornament(abdomen, 'cloth', [0.33, 0.035, 0.25], palette.dark, [0, -0.045, 0], [0, 0, 0], false);
    ornament(pelvis, 'metal', [0.045, 0.035, 0.02], '#939b87', [0, 0.072, -0.137]);
    for (const side of [-1, 1]) {
      ornament(
        torso,
        'cloth',
        [0.045, 0.36, 0.04],
        palette.dark,
        [side * 0.135, 0.015, -0.14],
        [0, 0, side * 0.1],
      );
      ornament(
        torso,
        'cloth',
        [0.105, 0.12, 0.06],
        palette.coat,
        [side * 0.077, -0.055, -0.183],
        [0, 0, 0],
        false,
      );
      ornament(torso, 'cloth', [0.086, 0.018, 0.065], palette.dark, [side * 0.077, 0.002, -0.184]);
    }
    const head = region('head', 'round', [0.23, 0.285, 0.24], palette.skin, [0, 0.48, 0]);
    ornament(head, 'round', [0.27, 0.18, 0.285], palette.coat, [0, 0.09, 0.012], [0, 0, 0], false);
    ornament(
      head,
      'cloth',
      [0.18, 0.047, 0.03],
      palette.dark,
      [0, 0.012, -0.117],
      [0, 0, 0],
      false,
    );
    ornament(head, 'round', [0.04, 0.065, 0.065], palette.skin, [0, -0.025, -0.119]);
    for (const side of [-1, 1]) {
      ornament(head, 'round', [0.04, 0.075, 0.06], palette.skin, [side * 0.108, -0.005, 0]);
      if (fine)
        ornament(
          head,
          'cloth',
          [0.016, 0.135, 0.025],
          palette.dark,
          [side * 0.09, -0.047, -0.073],
          [0.1, 0, side * 0.2],
        );
      const prefix = side < 0 ? 'left' : 'right';
      const upper = region(`${prefix}UpperArm`, 'limb', [0.155, 0.28, 0.17], palette.coat, [
        side * 0.27,
        0.105,
        0,
      ]);
      ornament(upper, 'cloth', [0.11, 0.095, 0.035], palette.dark, [0, -0.09, -0.072]);
      const arm = region(
        `${prefix}Forearm`,
        'limb',
        [0.13, 0.24, 0.15],
        palette.coat,
        [side * 0.29, -0.16, -0.035],
        `${prefix}UpperArm`,
      );
      ornament(arm, 'limb', [0.14, 0.045, 0.155], palette.dark, [0, -0.105, 0]);
      const glove = palette.glove ?? palette.dark;
      ornament(arm, 'round', [0.1, 0.115, 0.065], glove, [0, -0.175, -0.008], [0, 0, 0], false);
      ornament(
        arm,
        'limb',
        [0.034, 0.067, 0.038],
        glove,
        [side * 0.052, -0.18, -0.015],
        [0, 0, side * 0.55],
      );
      if (fine)
        for (let finger = 0; finger < 4; finger++)
          ornament(
            arm,
            'limb',
            [0.021, 0.065 - Math.abs(finger - 1.5) * 0.009, 0.024],
            glove,
            [(finger - 1.5) * 0.024, -0.238, -0.008],
            [0.12, 0, (finger - 1.5) * 0.035],
          );
      const thigh = region(
        `${prefix}Thigh`,
        'limb',
        [0.19, 0.32, 0.205],
        palette.pants,
        [side * 0.12, -0.51, 0],
        'pelvis',
      );
      ornament(thigh, 'cloth', [0.065, 0.15, 0.11], palette.coat, [side * 0.085, -0.005, 0.005]);
      const leg = region(
        `${prefix}Shin`,
        'limb',
        [0.155, 0.3, 0.175],
        palette.pants,
        [side * 0.13, -0.83, 0],
        `${prefix}Thigh`,
      );
      ornament(
        leg,
        'round',
        [0.145, 0.12, 0.065],
        palette.dark,
        [0, 0.12, -0.078],
        [0, 0, 0],
        false,
      );
      ornament(
        leg,
        'limb',
        [0.16, 0.15, 0.18],
        palette.dark,
        [0, -0.135, -0.005],
        [0, 0, 0],
        false,
      );
      ornament(leg, 'round', [0.17, 0.12, 0.3], palette.dark, [0, -0.19, -0.075], [0, 0, 0], false);
      ornament(leg, 'cloth', [0.175, 0.035, 0.3], '#252b26', [0, -0.24, -0.075]);
      if (fine)
        for (const lace of [-1, 1])
          ornament(
            leg,
            'cloth',
            [0.105, 0.012, 0.018],
            palette.coat,
            [0, -0.14 + lace * 0.023, -0.143],
            [0, lace * 0.14, 0],
          );
    }
    const kit = INDUSTRIAL_SOLDIER_KITS[record.appearance.family];
    const kitRoot = add(
      'cloth',
      [kit.size[0] * 0.026, 0.045, kit.size[1] * 0.026],
      palette.dark,
      [0, 0.01, 0.14],
      [0, 0, 0],
      torso,
    );
    for (const [role, x, y, width, height] of kit.rectangles)
      add(
        'cloth',
        [width * 0.026, 0.02, height * 0.026],
        palette[role] ?? role,
        [
          (x + width / 2 - kit.size[0] / 2) * 0.026,
          0.035,
          (y + height / 2 - kit.size[1] / 2) * 0.026,
        ],
        [0, 0, 0],
        kitRoot,
      );
    // Keep a complete body/kit first, then a bounded selection of finer layers.
    // Optional ornaments attach directly to non-optional roots, so trimming does
    // not orphan a finger, fabric seam or tissue layer during admission.
    const optionalLimit = Math.max(0, 140 - parts.filter((part) => !part.optionalDetail).length);
    let keptOptional = 0;
    const retained = parts
      .map((part, index) => ({ ...part, oldIndex: index }))
      .filter((part) => !part.optionalDetail || keptOptional++ < optionalLimit);
    const remap = new Map(retained.map((part, index) => [part.oldIndex, index]));
    for (const part of retained) part.attachment = remap.get(part.attachment) ?? -1;
    parts.splice(0, parts.length, ...retained);
    for (const part of parts) part.ownSupportSize = [...(part.supportSize ?? part.size)];
    // Include clothing and equipment before deriving each connected root's support bounds.
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      part.supportSize ??= [...part.size];
      if (part.attachment >= 0) {
        const parent = parts[part.attachment];
        parent.supportSize ??= [...parent.size];
        const childSupport = rotatedSupportSize(part);
        for (let axis = 0; axis < 3; axis++)
          parent.supportSize[axis] = Math.max(
            parent.supportSize[axis],
            Math.abs(part.at[axis]) * 2 + childSupport[axis],
          );
      }
    }
  } else {
    const colors =
      record.material === 'wood'
        ? ['#785438', '#ba9164', '#473629']
        : record.material === 'glass'
          ? ['#8fbcc6', '#c4e2de', '#dcebea']
          : ['#5e7063', '#a5b3ae', '#263431'];
    const size = record.radius / 700;
    const machine = !['wood', 'glass'].includes(record.material);
    const vehicle = record.appearance.type === 'vehicle',
      drone =
        record.appearance.type === 'drone' ||
        record.appearance.type === 'hazard' ||
        /uav|drone/.test(record.appearance.archetype);
    const hull = add(
      machine ? 'metal' : 'cloth',
      [0.68 * size, 0.16 * size, 0.42 * size],
      colors[0],
    );
    add(
      'metal',
      [0.43 * size, 0.045 * size, 0.2 * size],
      colors[1],
      [0, 0.1 * size, 0],
      [0, 0, 0],
      hull,
    );
    for (let i = 0; i < (brutal ? 8 : 4); i++) {
      const angle = i * 2.39996;
      add(
        record.material === 'glass'
          ? 'glass'
          : record.material === 'wood'
            ? 'cloth'
            : vehicle && i % 3 === 0
              ? 'rubber'
              : 'metal',
        [
          0.18 * size,
          (record.material === 'wood' ? 0.05 : 0.12) * size,
          (record.material === 'wood' ? 0.52 : 0.22) * size,
        ],
        colors[i % 3],
        [Math.cos(angle) * 0.5 * size, 0, Math.sin(angle) * 0.5 * size],
      );
    }
    if (vehicle) {
      add('glass', [0.28 * size, 0.03, 0.2 * size], '#a2cbd1', [-0.2 * size, 0, -0.34 * size]);
      if (record.appearance.model === 'field-tank') {
        add('metal', [0.1 * size, 0.1 * size, 0.8 * size], '#394f43', [
          0.25 * size,
          0,
          -0.35 * size,
        ]);
        for (const side of [-1, 1])
          add('cloth', [0.18 * size, 0.1 * size, 0.72 * size], '#27342e', [
            side * 0.5 * size,
            0,
            0.2 * size,
          ]);
      } else if (record.appearance.model === 'cargo-truck')
        add('cloth', [0.56 * size, 0.04, 0.45 * size], '#998367', [-0.4 * size, 0, 0.5 * size]);
    }
    if (drone)
      for (const side of [-1, 1]) {
        const arm = add('metal', [0.55 * size, 0.035, 0.04], '#3d514b', [
          side * 0.38 * size,
          0,
          side * 0.23 * size,
        ]);
        add('metal', [0.08, 0.075, 0.08], '#a0b5ae', [0.22 * size, 0.03, 0], [0, 0, 0], arm);
        add('cloth', [0.35 * size, 0.018, 0.04], '#273a37', [0.22 * size, 0.08, 0], [0, 0, 0], arm);
      }
    if (
      /robot|tracked|explosive/.test(record.appearance.archetype) ||
      record.appearance.type === 'prop'
    )
      for (const side of [-1, 1])
        add('rubber', [0.24 * size, 0.08 * size, 0.55 * size], '#283330', [
          side * 0.37 * size,
          0.02,
          0.05,
        ]);
    if (record.material === 'electronic')
      add('metal', [0.18, 0.025, 0.3], '#315d47', [0.3, 0, 0.25]);
  }
  return parts;
}

/** Renderer-only motion and marks: accepted facts are immutable; the native clock owns age. */
export function createCombatPresentation({
  THREE,
  scene,
  preferences,
  groundQuery,
  detail = 'auto',
}) {
  const shared = preferences ? null : createDestructionPreferences();
  const display = preferences ? null : createEncounterDisplayPreferences();
  let getPreferences =
    preferences ?? (() => ({ ...shared.snapshot(), showRemains: display.snapshot().showRemains }));
  let query = groundQuery,
    choice = detail,
    currentTick = 0,
    presentationClock = 0,
    runId = '',
    disposed = false;
  let previousTreatment = null,
    appearance = null,
    autoTier = 'high',
    slow = 0,
    fast = 0;
  const ledger = createCombatRemainsLedger(),
    bursts = new Map(),
    impacts = new Map(),
    recipes = new Map(),
    markSupports = new Map(),
    surfaceSupports = new Map(),
    restingBounds = new WeakMap(),
    pendingChecks = new Map();
  let orderRevision = -1,
    orderCamera = null;
  const orderedRings = new Map();
  const nearestRecords = (collection, cameraPosition, originMm) => {
    const camera = cameraPosition
      ? axes.map((axis) => cameraPosition[axis] + originMm[axis] / 1000)
      : null;
    if (
      orderRevision !== ledger.revision() ||
      Boolean(camera) !== Boolean(orderCamera) ||
      camera?.some((value, i) => value !== orderCamera?.[i])
    ) {
      orderedRings.clear();
      orderRevision = ledger.revision();
      orderCamera = camera;
    }
    if (!orderedRings.has(collection)) {
      // Record positions are immutable accepted facts. Measure each once when
      // the ring or world-space camera moves, rather than once per comparator.
      const measured = collection.map((record) => ({
        record,
        distance: camera
          ? axes.reduce((sum, axis, i) => sum + (record.position[axis] / 1000 - camera[i]) ** 2, 0)
          : 0,
      }));
      measured.sort((a, b) => a.distance - b.distance || b.record.tick - a.record.tick);
      orderedRings.set(
        collection,
        measured.map(({ record }) => record),
      );
    }
    return orderedRings.get(collection);
  };
  const root = new THREE.Group();
  root.name = 'combat-presentation';
  scene.add(root);
  const pools = new Map(),
    pos = new THREE.Vector3(),
    scale = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
    decalTurn = new THREE.Quaternion(),
    euler = new THREE.Euler(),
    matrix = new THREE.Matrix4(),
    color = new THREE.Color(),
    pieceOffset = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    decalAxis = new THREE.Vector3(0, 0, 1);
  const capacity = 2048;
  // One shared soft, irregular density texture; no downloaded/per-victim assets.
  const mistPixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const u = (x - 15.5) / 15.5,
        v = (y - 15.5) / 15.5;
      const noise =
        0.7 + Math.sin(u * 13 + Math.sin(v * 9)) * 0.15 + Math.cos(v * 19 - u * 7) * 0.15;
      const density = Math.max(0, 1 - Math.hypot(u, v)) ** 1.25 * noise;
      mistPixels.set([255, 255, 255, Math.round(density * 255)], (y * 32 + x) * 4);
    }
  const mistTexture = new THREE.DataTexture(mistPixels, 32, 32);
  mistTexture.magFilter = mistTexture.minFilter = THREE.LinearFilter;
  mistTexture.needsUpdate = true;
  const shapes = {
    cloth: new THREE.BoxGeometry(1, 1, 1),
    round: new THREE.SphereGeometry(0.5, 16, 12),
    limb: new THREE.CylinderGeometry(0.39, 0.46, 1, 12, 4),
    wound: new THREE.IcosahedronGeometry(0.5, 2),
    bone: new THREE.CylinderGeometry(0.4, 0.32, 1, 10, 3),
    metal: new THREE.BoxGeometry(1, 1, 1),
    rubber: new THREE.TorusGeometry(0.35, 0.15, 6, 10),
    glass: new THREE.IcosahedronGeometry(0.5, 0),
    spark: new THREE.SphereGeometry(0.5, 5, 4),
    mark: new THREE.CircleGeometry(0.5, 48),
    smoke: new THREE.PlaneGeometry(1, 1),
  };
  // Sculpt shared primitives rather than allocating geometry for every victim.
  for (const name of ['limb', 'wound', 'bone']) {
    const geometry = shapes[name],
      vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        y = vertices.getY(i),
        z = vertices.getZ(i);
      const ring =
        name === 'wound'
          ? 0.88 + Math.sin(x * 29 + z * 19) * 0.08 + Math.cos(y * 23 - z * 11) * 0.04
          : name === 'limb'
            ? 0.86 + 0.14 * Math.cos(y * Math.PI)
            : 0.76 + 0.24 * Math.abs(y * 2);
      vertices.setXYZ(i, x * ring, y, z * ring);
    }
    geometry.computeVertexNormals();
    if (name === 'wound') {
      const shades = new Float32Array(vertices.count * 3);
      for (let i = 0; i < vertices.count; i++) {
        const crease =
          0.52 +
          0.48 *
            Math.abs(
              Math.sin(
                vertices.getY(i) * 37 + Math.sin(vertices.getX(i) * 21) * 2 + vertices.getZ(i) * 14,
              ),
            );
        shades.set([crease, crease * 0.89, crease * 0.86], i * 3);
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3));
    }
  }
  const markVertices = shapes.mark.attributes.position;
  const markColors = new Float32Array(markVertices.count * 3);
  for (let i = 0; i < markVertices.count; i++) {
    const x = markVertices.getX(i),
      y = markVertices.getY(i),
      angle = Math.atan2(y, x);
    const radius = 0.82 + Math.sin(angle * 7) * 0.09 + Math.cos(angle * 13) * 0.05;
    markVertices.setXY(i, x * radius, y * radius);
    const shade = i === 0 ? 0.34 : 0.66 + Math.sin(angle * 9) * 0.14;
    markColors.set([shade, shade, shade], i * 3);
  }
  shapes.mark.setAttribute('color', new THREE.BufferAttribute(markColors, 3));
  for (const [name, geometry] of Object.entries(shapes)) {
    const paint =
      name === 'spark'
        ? new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
        : new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness:
              name === 'glass' ? 0.18 : name === 'wound' ? 0.3 : name === 'mark' ? 0.46 : 0.86,
            vertexColors: name === 'mark' || name === 'wound',
            metalness: name === 'metal' ? 0.55 : 0,
            ...(name === 'mark'
              ? {
                  side: THREE.DoubleSide,
                  polygonOffset: true,
                  polygonOffsetFactor: -1,
                  polygonOffsetUnits: -1,
                  depthWrite: false,
                }
              : {}),
            ...(name === 'smoke'
              ? { map: mistTexture, transparent: true, opacity: 0.65, depthWrite: false }
              : {}),
          });
    const mesh = new THREE.InstancedMesh(geometry, paint, capacity);
    mesh.name = `combat-${name}`;
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate the color attribute before shader preparation; the first hit must
    // not introduce a new USE_INSTANCING_COLOR program variant during flight.
    mesh.setColorAt(0, color.set(0xffffff));
    root.add(mesh);
    pools.set(name, mesh);
  }
  const releaseAppearance = (value, releaseLeases = true) => {
    if (!value) return;
    const geometries = new Set();
    for (const [name, mesh] of value.pools) {
      if (pools.get(name) === mesh) pools.delete(name);
      mesh.removeFromParent();
      geometries.add(mesh.geometry);
      mesh.dispose();
    }
    for (const probe of value.probes ?? []) {
      probe.removeFromParent();
      probe.dispose();
    }
    for (const texture of value.textures ?? []) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of value.materials ?? []) material.dispose();
    if (releaseLeases)
      for (const input of value.inputs ?? []) {
        try {
          input.release?.();
        } catch {
          /* Keep current-art fallback available. */
        }
      }
  };
  /** A batch transfer is atomic: false leaves every incoming lease with its caller.
   * Shared source primitives are baked once; each family/cast keeps its own gear. */
  function setAppearancePartsTemplates(inputs) {
    if (disposed) return false;
    inputs ??= [];
    const staged = {
      pools: new Map(),
      materials: new Set(),
      textures: new Set(),
      probes: [],
      inputs: [],
      byIdentity: new Map(),
      calls: 0,
      blood: { value: Boolean(getPreferences().blood) },
      derivedBytes: 0,
    };
    const cache = new Map(),
      regionMaterials = new Map();
    let valid = false;
    try {
      if (!Array.isArray(inputs) || inputs.length > 36 || new Set(inputs).size !== inputs.length)
        throw new TypeError('Invalid remains collection');
      function batch(node, transform, center, size, role, region, identity) {
        const paints = Array.isArray(node.material) ? node.material : [node.material];
        const calls = Array.isArray(node.material) ? node.geometry?.groups.length : 1;
        if (
          !node.geometry?.attributes.position ||
          !calls ||
          paints.some((p) => !p?.isMaterial || p.transparent)
        )
          throw new TypeError('Invalid rigid region material');
        const key = [
          role,
          identity ?? node.geometry.uuid,
          ...paints.map((p) => p.uuid),
          ...transform.elements,
          ...center.toArray(),
          ...size.toArray(),
        ].join('/');
        let pair = cache.get(key);
        if (!pair) {
          const geometry = node.geometry.clone().applyMatrix4(transform);
          geometry.translate(-center.x, -center.y, -center.z);
          geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          if (!vector(geometry.boundingBox?.min) || !vector(geometry.boundingBox?.max)) {
            geometry.dispose();
            throw new TypeError('Invalid authored bounds');
          }
          const make = (material, suffix, drawCount) => {
            const shape = `appearance:${cache.size}:${region}:${suffix}`;
            const mesh = new THREE.InstancedMesh(geometry, material, 512);
            mesh.name = `combat-${shape}`;
            mesh.count = 0;
            mesh.visible = false;
            mesh.frustumCulled = false;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.userData.combatCalls = drawCount;
            mesh.userData.combatTriangles =
              (geometry.index?.count ?? geometry.attributes.position.count) / 3;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.setColorAt(0, color.set(0xffffff));
            staged.pools.set(shape, mesh);
            return shape;
          };
          pair = {
            shape: make(node.material, role, calls),
            ...(role === 'body-cap' ? { mergedCap: true } : {}),
          };
          if (role === 'body-cap')
            geometry.setAttribute(
              'combatCapEnabled',
              new THREE.InstancedBufferAttribute(new Float32Array(512), 1).setUsage(
                THREE.DynamicDrawUsage,
              ),
            );
          if (role === 'cap') {
            pair.interior = true;
            const mesh = staged.pools.get(pair.shape);
            const white = (staged.white ??= (() => {
              const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
              map.needsUpdate = true;
              staged.textures.add(map);
              return map;
            })());
            const neutral = (paint) => {
              const material = paint.clone();
              material.color.set('#797764');
              material.emissive?.set(0);
              if (material.map) material.map = white;
              material.roughness = 0.96;
              material.metalness = 0;
              staged.materials.add(material);
              return material;
            };
            mesh.userData.combatOriginalMaterial = mesh.material;
            mesh.userData.combatCleanMaterial = Array.isArray(mesh.material)
              ? mesh.material.map(neutral)
              : neutral(mesh.material);
            const probe = new THREE.InstancedMesh(geometry, mesh.userData.combatCleanMaterial, 1);
            probe.name = 'combat-clean-cap-material-probe';
            probe.setColorAt(0, color.set(0xffffff));
            probe.count = 0;
            probe.visible = false;
            probe.frustumCulled = false;
            staged.probes.push(probe);
          }
          cache.set(key, pair);
        }
        return pair;
      }
      // The r2 cap and opaque exterior share one draw. Their authored UVs and
      // normals remain distinct; the masked hair keeps its own alpha-tested draw.
      function mergeRegionCaps(rows) {
        const exterior = rows.filter(
            (row) =>
              row.role === 'mesh' &&
              row.node.material?.isMeshStandardMaterial &&
              !row.node.material.transparent &&
              row.node.material.alphaTest === 0,
          ),
          caps = rows.filter((row) => row.role === 'cap');
        if (exterior.length !== 1 || caps.length !== 1) return rows;
        const body = exterior[0],
          cap = caps[0],
          outerPaint = body.node.material,
          capPaint = cap.node.material;
        if (
          !capPaint?.isMeshStandardMaterial ||
          capPaint.transparent ||
          capPaint.alphaTest > 0 ||
          capPaint.normalMap ||
          capPaint.bumpMap ||
          capPaint.emissiveMap ||
          capPaint.emissive?.getHex() !== 0 ||
          ['map', 'roughnessMap', 'metalnessMap'].some(
            (key) => capPaint[key] && capPaint[key].channel !== 0,
          )
        )
          return rows;
        const sources = [body, cap].map((row) =>
          row.node.geometry.clone().applyMatrix4(row.transform),
        );
        let geometry;
        try {
          const names = new Set(sources.flatMap((source) => Object.keys(source.attributes)));
          if (
            !['position', 'normal', 'uv'].every((name) =>
              sources.every((source) => source.attributes[name]),
            ) ||
            [...names].some((name) => {
              const attributes = sources.map((source) => source.attributes[name]),
                reference = attributes.find(Boolean);
              return attributes.some(
                (attribute) =>
                  (!attribute && name !== 'color') ||
                  (attribute &&
                    (attribute.isInterleavedBufferAttribute ||
                      attribute.itemSize !== reference.itemSize ||
                      attribute.normalized !== reference.normalized ||
                      attribute.array.constructor !== reference.array.constructor)),
              );
            })
          )
            return rows;
          geometry = new THREE.BufferGeometry();
          const total = sources.reduce((n, source) => n + source.attributes.position.count, 0),
            indices = [];
          let offset = 0;
          for (const source of sources) {
            for (let i = 0; i < (source.index?.count ?? source.attributes.position.count); i++)
              indices.push(offset + (source.index ? source.index.getX(i) : i));
            offset += source.attributes.position.count;
          }
          geometry.setIndex(indices);
          for (const name of names) {
            const reference = sources.map((source) => source.attributes[name]).find(Boolean),
              values = new reference.array.constructor(total * reference.itemSize);
            let at = 0;
            for (const source of sources) {
              const attribute = source.attributes[name],
                length = source.attributes.position.count * reference.itemSize;
              if (attribute) values.set(attribute.array, at);
              else {
                // An unpainted interior must not inherit the exterior's clothing tint.
                const white = reference.normalized
                  ? reference.array instanceof Uint8Array
                    ? 255
                    : 65535
                  : 1;
                values.fill(white, at, at + length);
              }
              at += length;
            }
            geometry.setAttribute(
              name,
              new THREE.BufferAttribute(values, reference.itemSize, reference.normalized),
            );
          }
          const role = new Float32Array(total);
          role.fill(1, sources[0].attributes.position.count);
          geometry.setAttribute('combatCapRole', new THREE.BufferAttribute(role, 1));
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          const materialKey = `${outerPaint.uuid}/${capPaint.uuid}`;
          let material = regionMaterials.get(materialKey);
          if (!material) {
            material = outerPaint.clone();
            material.name = `${outerPaint.name}:combat-region-cap`;
            material.side = THREE.DoubleSide;
            const uniforms = {
              combatBlood: staged.blood,
              combatCapColor: { value: capPaint.color.clone() },
              combatCleanCapColor: { value: new THREE.Color('#797764') },
              combatCapRoughness: { value: capPaint.roughness },
              combatCapMetalness: { value: capPaint.metalness },
            };
            for (const [property, label] of [
              ['map', 'Map'],
              ['roughnessMap', 'RoughnessMap'],
              ['metalnessMap', 'MetalnessMap'],
            ]) {
              const texture = capPaint[property];
              if (!texture) continue;
              if (texture.matrixAutoUpdate) texture.updateMatrix();
              uniforms[`combatCap${label}`] = { value: texture };
              uniforms[`combatCap${label}Transform`] = { value: texture.matrix.clone() };
            }
            const maps = ['Map', 'RoughnessMap', 'MetalnessMap'].filter(
              (label) => uniforms[`combatCap${label}`],
            );
            material.userData.combatCapTextures = maps.map(
              (label) => uniforms[`combatCap${label}`].value,
            );
            material.userData.combatCapUniforms = uniforms;
            material.customProgramCacheKey = () => `combat-region-cap-v1/${maps.join('/')}`;
            material.onBeforeCompile = (shader) => {
              Object.assign(shader.uniforms, uniforms);
              shader.vertexShader = shader.vertexShader
                .replace(
                  '#include <common>',
                  `#include <common>
attribute float combatCapRole;
attribute float combatCapEnabled;
varying float vCombatCapRole;
varying float vCombatCapEnabled;
${maps.map((label) => `uniform mat3 combatCap${label}Transform;\nvarying vec2 vCombatCap${label}Uv;`).join('\n')}`,
                )
                .replace(
                  '#include <begin_vertex>',
                  `#include <begin_vertex>
vCombatCapRole = combatCapRole;
vCombatCapEnabled = combatCapEnabled;
${maps.map((label) => `vCombatCap${label}Uv = (combatCap${label}Transform * vec3(uv, 1.0)).xy;`).join('\n')}`,
                );
              shader.fragmentShader = shader.fragmentShader
                .replace(
                  '#include <common>',
                  `#include <common>
varying float vCombatCapRole;
varying float vCombatCapEnabled;
uniform bool combatBlood;
uniform vec3 combatCapColor;
uniform vec3 combatCleanCapColor;
uniform float combatCapRoughness;
uniform float combatCapMetalness;
${maps.map((label) => `uniform sampler2D combatCap${label};\nvarying vec2 vCombatCap${label}Uv;`).join('\n')}`,
                )
                .replace(
                  '#include <map_fragment>',
                  `if (vCombatCapRole > 0.5) {
  if (vCombatCapEnabled < 0.5) discard;
  diffuseColor = vec4(combatBlood ? combatCapColor : combatCleanCapColor, 1.0);
  ${maps.includes('Map') ? 'if (combatBlood) diffuseColor *= texture2D(combatCapMap, vCombatCapMapUv);' : ''}
} else {
  #include <map_fragment>
}`,
                )
                .replace(
                  '#include <roughnessmap_fragment>',
                  `#include <roughnessmap_fragment>
if (vCombatCapRole > 0.5) {
  roughnessFactor = combatBlood ? combatCapRoughness : 0.96;
  ${maps.includes('RoughnessMap') ? 'if (combatBlood) roughnessFactor *= texture2D(combatCapRoughnessMap, vCombatCapRoughnessMapUv).g;' : ''}
}`,
                )
                .replace(
                  '#include <metalnessmap_fragment>',
                  `#include <metalnessmap_fragment>
if (vCombatCapRole > 0.5) {
  metalnessFactor = combatBlood ? combatCapMetalness : 0.0;
  ${maps.includes('MetalnessMap') ? 'if (combatBlood) metalnessFactor *= texture2D(combatCapMetalnessMap, vCombatCapMetalnessMapUv).b;' : ''}
}`,
                )
                .replace(
                  '#include <normal_fragment_maps>',
                  `if (vCombatCapRole < 0.5) {
  #include <normal_fragment_maps>
}`,
                );
            };
            staged.materials.add(material);
            regionMaterials.set(materialKey, material);
          }
          const merged = {
            ...body,
            node: { geometry, material },
            transform: new THREE.Matrix4(),
            role: 'body-cap',
            bounds: body.bounds.clone().union(cap.bounds),
            identity: [body, cap]
              .map((row) => [row.node.geometry.uuid, ...row.transform.elements].join('/'))
              .join('|'),
            temporary: true,
          };
          return rows.flatMap((row) => (row === cap ? [] : row === body ? [merged] : [row]));
        } catch (error) {
          geometry?.dispose();
          throw error;
        } finally {
          for (const source of sources) source.dispose();
        }
      }
      function mergeEquipment(rows) {
        const groups = new Map(),
          result = rows.filter((row) => row.role !== 'gear');
        for (const row of rows.filter((row) => row.role === 'gear')) {
          if (Array.isArray(row.node.material)) {
            result.push(row);
            continue;
          }
          const key = `${row.node.material.uuid}/${row.tint.getHexString()}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(row);
        }
        for (const group of groups.values()) {
          if (group.length === 1) {
            result.push(group[0]);
            continue;
          }
          const names = Object.keys(group[0].node.geometry.attributes);
          const compatible = group.every(
            (row) =>
              names.length === Object.keys(row.node.geometry.attributes).length &&
              names.every((name) => {
                const attribute = row.node.geometry.attributes[name],
                  reference = group[0].node.geometry.attributes[name];
                return (
                  attribute &&
                  !attribute.isInterleavedBufferAttribute &&
                  attribute.itemSize === reference.itemSize &&
                  attribute.normalized === reference.normalized &&
                  attribute.array.constructor === reference.array.constructor
                );
              }),
          );
          if (!compatible) {
            result.push(...group);
            continue;
          }
          const sources = group.map((row) => row.node.geometry.clone().applyMatrix4(row.transform));
          const geometry = new THREE.BufferGeometry(),
            indices = [],
            bounds = new THREE.Box3();
          let offset = 0;
          for (const source of sources) {
            for (let i = 0; i < (source.index?.count ?? source.attributes.position.count); i++)
              indices.push(offset + (source.index ? source.index.getX(i) : i));
            offset += source.attributes.position.count;
          }
          for (const name of names) {
            const reference = sources[0].attributes[name];
            const values = new reference.array.constructor(
              sources.reduce((n, g) => n + g.attributes[name].array.length, 0),
            );
            let at = 0;
            for (const source of sources) {
              values.set(source.attributes[name].array, at);
              at += source.attributes[name].array.length;
            }
            geometry.setAttribute(
              name,
              new THREE.BufferAttribute(values, reference.itemSize, reference.normalized),
            );
          }
          geometry.setIndex(indices);
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          for (const source of sources) source.dispose();
          for (const row of group) bounds.union(row.bounds);
          result.push({
            ...group[0],
            node: { geometry, material: group[0].node.material },
            transform: new THREE.Matrix4(),
            bounds,
            identity: group
              .map((row) => [row.node.geometry.uuid, ...row.transform.elements].join('/'))
              .join('|'),
            temporary: true,
          });
        }
        return result;
      }
      for (const input of inputs) {
        if (
          !input ||
          input.ready !== true ||
          !/^[a-f0-9]{64}$/.test(input.sha256) ||
          !families.has(input.family) ||
          !input.scene?.isObject3D ||
          !Number.isFinite(input.height) ||
          input.height < 0.5 ||
          input.height > 3 ||
          !Number.isFinite(input.radius) ||
          input.radius <= 0 ||
          input.radius > 1 ||
          (input.cast !== undefined && !['tactical', 'rivals', 'arcade'].includes(input.cast)) ||
          (input.release !== undefined && typeof input.release !== 'function')
        )
          throw new TypeError('Invalid admitted remains palette');
        const identity = `${input.family}/${input.cast ?? '*'}`;
        if (staged.byIdentity.has(identity) || (staged.hash && staged.hash !== input.sha256))
          throw new TypeError('Repeated or mixed remains identity');
        staged.hash = input.sha256;
        staged.inputs.push(input);
        input.scene.updateWorldMatrix(true, true);
        const members = new Set(),
          roots = new Set();
        input.scene.traverse((node) => members.add(node));
        const inverse = input.scene.matrixWorld.clone().invert();
        const palette = {
          regions: [],
          height: input.height,
          radius: input.radius,
          identity,
          calls: 0,
        };
        let vertices = 0;
        const regionEntries = input.regions
          ? Object.entries(input.regions)
          : bodyRegions.map((name) => [name, input.parts?.[name]]);
        if (![6, 12].includes(regionEntries.length)) throw new TypeError('Incomplete body regions');
        for (const [region, definition] of regionEntries) {
          const box = new THREE.Box3(),
            rows = [];
          const visit = (branch, role, tint = '#ffffff') => {
            if (!branch?.isObject3D || !members.has(branch) || roots.has(branch))
              throw new TypeError('Missing or repeated authored region');
            roots.add(branch);
            let draws = 0;
            branch.traverse((node) => {
              if (
                node.isSkinnedMesh ||
                node.isLight ||
                node.isCamera ||
                node.isLine ||
                node.isPoints
              )
                throw new TypeError('Remains must be rigid');
              if (!node.isMesh) return;
              const calls = Array.isArray(node.material) ? node.geometry?.groups.length : 1;
              if (!node.geometry?.attributes.position || !calls)
                throw new TypeError('Empty region');
              draws += calls;
              vertices += node.geometry.attributes.position.count;
              if (draws > 2 || vertices > 65536) throw new TypeError('Region exceeds budget');
              node.geometry.computeBoundingBox();
              const transform = new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld);
              const bounds = node.geometry.boundingBox.clone().applyMatrix4(transform);
              if (role !== 'gear') box.union(bounds);
              rows.push({ node, transform, role, tint, bounds });
            });
            if (!draws) throw new TypeError('Empty authored region');
          };
          visit(definition?.mesh, 'mesh');
          visit(definition?.cap, 'cap');
          const center = box.getCenter(new THREE.Vector3()),
            size = box.getSize(new THREE.Vector3()).clampScalar(0.001, 10);
          for (const gear of input.equipment ?? [])
            if ((input.regions ? gear.damageRegion : gear.region) === region)
              visit(gear.mesh, 'gear', new THREE.Color().fromArray(gear.color ?? [1, 1, 1]));
          const support = size.clone();
          for (const row of rows)
            for (let axis = 0; axis < 3; axis++)
              support.setComponent(
                axis,
                Math.max(
                  support.getComponent(axis),
                  2 * Math.abs(row.bounds.min.getComponent(axis) - center.getComponent(axis)),
                  2 * Math.abs(row.bounds.max.getComponent(axis) - center.getComponent(axis)),
                ),
              );
          const pieces = mergeEquipment(
            regionEntries.length === 12 ? mergeRegionCaps(rows) : rows,
          ).map((row) => {
            try {
              return {
                ...batch(row.node, row.transform, center, size, row.role, region, row.identity),
                tint: row.tint,
              };
            } finally {
              if (row.temporary) row.node.geometry.dispose();
            }
          });
          palette.regions.push({
            name: region,
            parent: definition.parent ?? null,
            aggregate: definition.aggregate ?? region,
            center: center.toArray(),
            size: size.toArray(),
            support: support.toArray(),
            pieces,
          });
        }
        palette.calls = new Set(palette.regions.flatMap((r) => r.pieces.map((p) => p.shape))).size;
        staged.calls = Math.max(staged.calls, palette.calls);
        staged.byIdentity.set(identity, palette);
      }
      const buffers = new Set();
      for (const mesh of [...staged.pools.values(), ...staged.probes])
        for (const attribute of [
          ...Object.values(mesh.geometry.attributes),
          mesh.geometry.index,
          mesh.instanceMatrix,
          mesh.instanceColor,
        ])
          if (attribute?.array) buffers.add(attribute.array.buffer);
      staged.derivedBytes = [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
      for (const texture of staged.textures)
        staged.derivedBytes += texture.image?.data?.byteLength ?? 0;
      valid = true;
    } catch {
      releaseAppearance(staged, false);
    }
    releaseAppearance(appearance);
    appearance = valid && inputs.length ? staged : null;
    if (valid && !inputs.length) releaseAppearance(staged, false);
    recipes.clear();
    clearPools();
    if (appearance) {
      for (const probe of appearance.probes) root.add(probe);
      for (const [name, mesh] of appearance.pools) {
        pools.set(name, mesh);
        root.add(mesh);
      }
    }
    return valid;
  }
  function setAppearanceParts(input) {
    if (input && appearance?.inputs.length === 1 && appearance.inputs[0] === input) return true;
    return setAppearancePartsTemplates(input === null ? [] : [input]);
  }
  function appearanceRecipe(record, palette, dismember, bloody = false, detail = 'high') {
    const parts = [],
      outcome = breakupOutcome(record, dismember),
      factors = [
        record.radius / 1000 / palette.radius,
        record.height / 1000 / palette.height,
        record.radius / 1000 / palette.radius,
      ];
    for (const region of palette.regions) {
      const attachment = parts.length;
      for (const [index, piece] of region.pieces.entries()) {
        if (!dismember && piece.interior) continue;
        parts.push({
          shape: piece.shape,
          size: region.size.map((n, axis) => n * factors[axis]),
          supportSize: region.support.map((n, axis) => n * factors[axis]),
          tint: piece.tint,
          at: index
            ? [0, 0, 0]
            : region.center.map(
                (n, axis) => n * factors[axis] - (axis === 1 ? record.height / 2000 : 0),
              ),
          attachment: index ? attachment : -1,
          authored: true,
          capVisible: Boolean(piece.mergedCap && dismember),
          region: region.name,
          bodyAt: region.center.map(
            (n, axis) => n * factors[axis] - (axis === 1 ? record.height / 2000 : 0),
          ),
        });
      }
    }
    if (parts.length) {
      const indices = new Map();
      for (const [index, part] of parts.entries())
        if (part.attachment < 0) indices.set(part.region, index);
      const torso = indices.get('chest') ?? indices.get('torso') ?? 0;
      const severed = (name) =>
        dismember &&
        (outcome === 'explosive' ||
          (outcome === 'breakup' && !['chest', 'abdomen', 'pelvis', 'torso'].includes(name)) ||
          name === (random(record.seed, 102) < 0.5 ? 'leftForearm' : 'rightForearm') ||
          (palette.regions.length === 6 && name === 'leftArm'));
      for (const part of parts) {
        if (part.attachment >= 0 || part === parts[torso] || severed(part.region)) continue;
        const source = palette.regions.find((r) => r.name === part.region);
        const parent = indices.get(source.parent) ?? torso;
        part.at = part.bodyAt.map((n, axis) => n - parts[parent].bodyAt[axis]);
        part.attachment = parent;
      }
      const detailPart = (parent, shape, size, tint, at, rotation = [0, 0, 0]) => {
        parts.push({
          shape,
          size,
          supportSize: [...size],
          tint,
          at,
          rotation,
          attachment: parent,
          region: parts[parent].region,
          authored: true,
          optionalDetail: true,
        });
      };
      if (bloody) {
        for (const [name, index] of indices) {
          if (!severed(name)) continue;
          const part = parts[index],
            size = part.size;
          const sign = name === 'head' ? -1 : 1;
          const end = sign * (size[1] * 0.46);
          const paired = /Forearm|Shin/.test(name);
          // Small raised folds leave the admitted authored cut texture visible.
          // These never create another persistent root or replace body geometry.
          for (const side of detail === 'ultra' ? [-1, -0.35, 0.35, 1] : [-1, 1]) {
            detailPart(
              index,
              'wound',
              [size[0] * 0.22, 0.055, size[2] * 0.3],
              side < 0 ? '#8d1730' : '#be3c49',
              [side * size[0] * 0.3, end, size[2] * 0.11],
              [side * 0.12, side * 0.45, side * 0.14],
            );
          }
          const coreWidth = /chest|abdomen|pelvis|torso/.test(name) ? 0.04 : 0.025;
          for (const side of paired ? [-1, 1] : [0])
            detailPart(
              index,
              'bone',
              [coreWidth, 0.065, coreWidth],
              '#e0cfaa',
              [side * size[0] * 0.16, end + sign * 0.025, 0],
              [side * 0.12, 0, side * 0.08],
            );
          if (detail === 'ultra') {
            // A dark recess and a fabric-colored torn edge add depth rather
            // than blanketing the clothing, equipment or entire cut surface.
            detailPart(index, 'wound', [size[0] * 0.25, 0.018, size[2] * 0.2], '#390e19', [
              0,
              end + sign * 0.012,
              -size[2] * 0.2,
            ]);
            detailPart(
              index,
              'wound',
              [size[0] * 0.13, 0.055, size[2] * 0.14],
              actorVisual(record.appearance.family, record.appearance.cast).palette.coat,
              [-size[0] * 0.35, end - sign * 0.008, -size[2] * 0.18],
              [0.18, 0.3, 0.24],
            );
          }
        }
        // Keep an impact-local blood stain even when Brutal is off. It is a
        // surface layer, not an exposed cut or an extra dismembered fragment.
        const hit = record.impactPosition
          ? axes.map(
              (axis) =>
                (record.impactPosition[axis] - record.position[axis]) / 1000 -
                (axis === 'y' ? record.height / 2000 : 0),
            )
          : parts[torso].bodyAt;
        let target = torso,
          nearest = Infinity;
        for (const index of indices.values()) {
          const distance = parts[index].bodyAt.reduce(
            (sum, n, axis) => sum + (n - hit[axis]) ** 2,
            0,
          );
          if (distance < nearest) {
            target = index;
            nearest = distance;
          }
        }
        const targetPart = parts[target];
        const direction = axes.map(
          (axis) => record.impactDirection?.[axis] ?? (axis === 'z' ? 1 : 0),
        );
        const axis = direction.reduce(
          (best, value, index) => (Math.abs(value) > Math.abs(direction[best]) ? index : best),
          0,
        );
        const side = direction[axis] > 0 ? -1 : 1;
        const at = hit.map((value, index) =>
          clamp(
            value - targetPart.bodyAt[index],
            -targetPart.size[index] * 0.35,
            targetPart.size[index] * 0.35,
          ),
        );
        at[axis] = side * (targetPart.size[axis] * 0.5 + 0.004);
        const rotation =
          axis === 0 ? [0, 0, Math.PI / 2] : axis === 2 ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        detailPart(target, 'wound', [0.095, 0.008, 0.075], '#651325', at, rotation);
      }
      // Reorder parents ahead of children, preserving region identities across art/detail changes.
      const ordered = [],
        done = new Set();
      const place = (index) => {
        if (done.has(index)) return;
        const part = parts[index],
          parent = part.attachment;
        if (parent >= 0) place(parent);
        done.add(index);
        ordered.push({ ...part, oldIndex: index, oldParent: parent });
      };
      for (let i = 0; i < parts.length; i++) place(i);
      const remap = new Map(ordered.map((part, i) => [part.oldIndex, i]));
      for (const part of ordered) part.attachment = remap.get(part.oldParent) ?? -1;
      for (const part of ordered) part.ownSupportSize = [...part.supportSize];
      for (let i = ordered.length - 1; i >= 0; i--) {
        const part = ordered[i];
        if (part.attachment >= 0) {
          const parent = ordered[part.attachment];
          const childSupport = rotatedSupportSize(part);
          for (let axis = 0; axis < 3; axis++)
            parent.supportSize[axis] = Math.max(
              parent.supportSize[axis],
              Math.abs(part.at[axis]) * 2 + childSupport[axis],
            );
        }
      }
      return ordered;
    }
    return parts;
  }
  const put = (
    shape,
    at,
    size,
    tint,
    rotation = [0, 0, 0],
    surfaceNormal = null,
    capVisible = false,
  ) => {
    const mesh = pools.get(shape);
    if (!mesh || mesh.count >= mesh.instanceMatrix.count) return;
    pos.set(...at);
    scale.set(...size);
    if (surfaceNormal)
      quaternion
        .setFromUnitVectors(
          decalAxis,
          normal.set(surfaceNormal.x, surfaceNormal.y, surfaceNormal.z),
        )
        .multiply(decalTurn.setFromAxisAngle(decalAxis, rotation[2] ?? 0));
    else quaternion.setFromEuler(euler.set(...rotation));
    matrix.compose(pos, quaternion, scale);
    mesh.setMatrixAt(mesh.count, matrix);
    mesh.geometry.attributes.combatCapEnabled?.setX(mesh.count, capVisible ? 1 : 0);
    mesh.setColorAt(mesh.count++, color.set(tint));
  };
  const selectedDetail = () => {
    const value = typeof choice === 'function' ? choice() : choice;
    return ['auto', 'high', 'ultra'].includes(value) ? value : 'auto';
  };
  const bounds = (graphics, selected) =>
    graphics === 'low'
      ? 'low'
      : graphics === 'balanced'
        ? 'high'
        : selected === 'ultra'
          ? 'ultra'
          : 'high';
  let stats = { moving: 0, settled: 0, marks: 0, bursts: 0, calls: 0, tier: 'high' };
  function configure(options = {}) {
    if (options.preferences) getPreferences = options.preferences;
    if (Object.hasOwn(options, 'groundQuery')) query = options.groundQuery;
    if (options.detail !== undefined) {
      if (
        typeof options.detail !== 'function' &&
        !['auto', 'high', 'ultra'].includes(options.detail)
      )
        throw new TypeError('Unknown destruction detail');
      choice = options.detail;
    }
  }
  function clearPools() {
    for (const mesh of pools.values()) {
      mesh.count = 0;
      mesh.visible = false;
    }
  }
  function reset(id = '') {
    runId = id;
    currentTick = 0;
    presentationClock = 0;
    markSupports.clear();
    surfaceSupports.clear();
    pendingChecks.clear();
    ledger.reset(id);
    orderedRings.clear();
    bursts.clear();
    impacts.clear();
    recipes.clear();
    clearPools();
  }
  function observe(facts, options = {}) {
    if (disposed) return;
    const id = String(options.runId ?? runId);
    if (id !== runId) reset(id);
    const tick =
      options.tick ?? Math.max(currentTick, ...(facts ?? []).map((fact) => fact.tick ?? 0));
    if (tick < currentTick) {
      bursts.clear();
      impacts.clear();
    }
    presentationClock = Math.max(presentationClock, options.presentationClock ?? tick / 50);
    currentTick = tick;
    for (const record of ledger.add(facts, {
      runId,
      tick,
      groundQuery: options.groundQuery ?? query,
    })) {
      record.presentation ??= {
        born: Math.max(0, presentationClock - (tick - record.tick) / 50),
        pieces: {},
      };
      bursts.set(record.eventId, record.presentation.born);
      if (record.kind === 'surface-impact') impacts.set(record.eventId, record);
    }
    for (const fact of facts ?? []) {
      if (!['impact', 'explosion'].includes(fact.type) || impacts.has(fact.eventId)) continue;
      const record = normalizeCombatDefeat({
        ...fact,
        type: 'defeat',
        sourceId: fact.sourceId || 'surface',
      });
      record.presentation ??= {
        born: Math.max(0, presentationClock - (tick - record.tick) / 50),
        pieces: {},
      };
      impacts.set(fact.eventId, record);
      if (impacts.size > 32) impacts.delete(impacts.keys().next().value);
    }
    const retained = new Set(
      [...ledger.records(), ...ledger.impacts()].map((record) => record.eventId),
    );
    for (const id of recipes.keys()) if (!retained.has(id)) recipes.delete(id);
    for (const id of markSupports.keys()) if (!retained.has(id)) markSupports.delete(id);
    for (const id of surfaceSupports.keys()) if (!retained.has(id)) surfaceSupports.delete(id);
    for (const id of pendingChecks.keys()) if (!retained.has(id)) pendingChecks.delete(id);
    for (const [id, began] of bursts) if (presentationClock - began > 2) bursts.delete(id);
    for (const [id, fact] of impacts)
      if (presentationClock - fact.presentation.born > 0.8) impacts.delete(id);
  }
  function update({
    tick = currentTick,
    presentationClock: suppliedClock = null,
    originMm = { x: 0, y: 0, z: 0 },
    cameraPosition = null,
    graphicsQuality = 'balanced',
    reducedMotion = false,
    frameMs = null,
  } = {}) {
    if (disposed) return;
    presentationClock = Math.max(
      presentationClock,
      Number.isFinite(suppliedClock) ? suppliedClock : tick / 50,
    );
    clearPools();
    const selected = selectedDetail();
    if (selected === 'auto' && Number.isFinite(frameMs)) {
      slow = frameMs > 22 ? slow + 1 : 0;
      // A normal 60 Hz frame is 16.7 ms. Recovery must remain reachable on a
      // 60 Hz display after a temporary stall, with a longer stable interval.
      fast = frameMs < 18 ? fast + 1 : 0;
      if (slow > 90) {
        autoTier = 'low';
        slow = 0;
      }
      if (fast > 300) {
        autoTier = 'high';
        fast = 0;
      }
    }
    const prefs = getPreferences(),
      treatment = `${!!prefs.brutal}/${!!prefs.blood}`;
    if (previousTreatment !== null && treatment !== previousTreatment) {
      recipes.clear();
    }
    previousTreatment = treatment;
    if (appearance) appearance.blood.value = Boolean(prefs.blood);
    for (const mesh of appearance?.pools.values() ?? [])
      if (mesh.userData.combatCleanMaterial)
        mesh.material = prefs.blood
          ? mesh.userData.combatOriginalMaterial
          : mesh.userData.combatCleanMaterial;
    const tier = bounds(graphicsQuality, selected),
      pressureReduced = selected === 'auto' && autoTier === 'low' && tier !== 'low',
      // Reduce density under pressure, keeping the chosen character's complete
      // silhouette instead of silently changing its artwork.
      limits = pressureReduced
        ? {
            ...COMBAT_EFFECT_LIMITS[tier],
            ...Object.fromEntries(
              ['bursts', 'moving', 'settled', 'marks'].map((key) => [
                key,
                COMBAT_EFFECT_LIMITS.low[key],
              ]),
            ),
          }
        : COMBAT_EFFECT_LIMITS[tier];
    stats = {
      moving: 0,
      settled: 0,
      marks: 0,
      bursts: 0,
      calls: 0,
      triangles: 0,
      surfaceQueries: 0,
      authoredClusters: 0,
      completeAuthoredClusters: 0,
      authoredRegions: 0,
      proceduralClusters: 0,
      deferredAuthoredClusters: 0,
      tier,
      pressureReduced,
    };
    // Support revalidation is cosmetic maintenance. Spread it across frames so
    // a full archive or an unloaded chunk cannot trigger thousands of scene rays.
    let supportChecks = 0;
    const supportCheckBudget = 64,
      bodySupportBudget = 48;
    const querySurface = (...args) => {
      stats.surfaceQueries++;
      return query(...args);
    };
    const markSurface = (record) => {
      if (!query) return record.renderSurface ?? record.surface;
      let cached = surfaceSupports.get(record.eventId);
      if (
        (!cached || presentationClock - cached.at >= 0.25) &&
        supportChecks < supportCheckBudget
      ) {
        supportChecks++;
        const previous = record.renderSurface;
        const attached = previous?.surfaceId && previous.localPosition;
        const accepted = record.surface;
        let rendered = null;
        try {
          const result = attached
            ? querySurface(previous.position, previous.normal, { attachment: previous })
            : querySurface(
                accepted?.position ?? record.position,
                accepted?.normal ?? record.normal,
              );
          const candidate = surfaceOf(result);
          if (
            attached
              ? result?.attached === true && candidate?.surfaceId === previous.surfaceId
              : candidate && (!accepted || sameContact(accepted, candidate))
          )
            rendered = candidate;
        } catch {}
        cached = { at: presentationClock, valid: !!rendered };
        surfaceSupports.set(record.eventId, cached);
        if (rendered) {
          if (
            !previous ||
            axes.some(
              (axis) =>
                previous.position[axis] !== rendered.position[axis] ||
                previous.normal[axis] !== rendered.normal[axis],
            )
          )
            markSupports.delete(record.eventId);
          record.renderSurface = rendered;
        }
      }
      return cached?.valid ? record.renderSurface : null;
    };
    // Reserve the shared transient pools before admitting complete body clusters.
    const reserved = new Set(['mark', 'wound', 'spark', 'smoke']);
    // Nonfatal glass/dust can use a pool not needed by the nearest body. Reserve
    // that active pool too so adding hit feedback cannot overflow a full budget.
    if (!reducedMotion)
      for (const record of impacts.values()) {
        const age = presentationClock - record.presentation.born;
        if (age < 0 || age > 0.3) continue;
        const bloody = record.material === 'organic' && prefs.blood && !record.protected;
        if (!bloody && record.material === 'glass') reserved.add('glass');
        else if (
          !bloody &&
          ['stone', 'earth', 'concrete', 'organic'].includes(record.material) &&
          !record.protected
        )
          reserved.add('cloth');
      }
    let reservedCalls = [...reserved].reduce(
      (sum, name) => sum + (pools.get(name)?.userData.combatCalls ?? 1),
      0,
    );
    const ordered = nearestRecords(ledger.records(), cameraPosition, originMm);
    const fresh = reducedMotion
      ? []
      : ordered
          .filter(
            (record) =>
              bursts.has(record.eventId) && presentationClock - bursts.get(record.eventId) < 1.25,
          )
          .slice(0, limits.bursts);
    const animatedIds = new Set(fresh.map((record) => record.eventId));
    const records = [...fresh, ...ordered.filter((record) => !animatedIds.has(record.eventId))];
    const smoke = [];
    // A fresh hit remains visible even if its body awaits streamed support or
    // cannot fit as a complete cluster. The same global limits still apply.
    const burstQuota = Math.floor((limits.moving * 0.4) / Math.max(1, fresh.length));
    for (const record of fresh) {
      const age = Math.max(0, presentationClock - bursts.get(record.eventId));
      const organic = record.material === 'organic';
      const bloody = organic && prefs.blood && !record.protected;
      const hard = bloody && prefs.brutal;
      const explosive = record.outcome === 'explosive';
      const force = impactStrength(record);
      const origin = axes.map(
        (axis) => ((record.impactPosition ?? record.position)[axis] - originMm[axis]) / 1000,
      );
      if (!record.impactPosition)
        origin[1] += organic ? record.height / 2000 : record.radius / 2000;
      const heading = Math.atan2(
        record.impactDirection?.z ?? record.velocity.z,
        record.impactDirection?.x ?? record.velocity.x,
      );
      const surface = record.renderSurface ?? record.surface;
      const mist = hard && age > 0.025 && age < 0.55 ? Math.min(6, burstQuota) : 0;
      const core = hard && age < 0.24 ? Math.min(3, burstQuota - mist) : 0;
      const desired = bloody
        ? hard
          ? tier === 'ultra'
            ? 128
            : tier === 'low'
              ? 36
              : 80
          : 24
        : 32;
      const count = Math.min(desired, Math.max(0, burstQuota - mist - core));
      // A brief dense rupture establishes the silhouette before the finer spray
      // separates. Shared opaque folds avoid a fullscreen transparent blood fog.
      for (let i = 0; i < core; i++) {
        const angle = heading + i * 2.4;
        const spread = age * (explosive ? 4 : 2.8);
        const scale = Math.sin(Math.min(1, age / 0.24) * Math.PI) ** 0.6;
        put(
          'wound',
          [
            origin[0] + Math.cos(angle) * spread,
            origin[1] + (random(record.seed, i + 460) - 0.3) * spread,
            origin[2] + Math.sin(angle) * spread,
          ],
          [scale * 0.26, scale * 0.18, scale * (explosive ? 0.52 : 0.36)],
          i % 2 ? '#740d22' : '#b72239',
          [random(record.seed, i + 470) * 3, angle, age * 5],
        );
        stats.moving++;
      }
      for (let i = 0; i < count; i++) {
        // Fast radial sheets, directional jets, tumbling clots and delayed spray
        // have different lifetimes; no slow expanding ring of identical beads.
        const phase = bloody ? i % (hard ? 4 : 3) : 0;
        const elapsed = age - (phase === 2 ? 0.065 : phase === 3 ? 0.015 : 0);
        const lifetime = bloody ? [0.32, 1.2, 0.7, 0.42][phase] : 0.7;
        if (elapsed < 0 || elapsed >= lifetime) continue;
        const angle =
          heading +
          (random(record.seed, i + 340) - 0.5) *
            (explosive || phase === 3 ? Math.PI * 2 : phase === 0 ? 0.85 : 2.8);
        const speed =
          force * (phase === 1 ? 1.2 : 2.4) * (0.65 + random(record.seed, i + 400) * 1.5);
        const lift =
          (record.impactDirection?.y ?? 0) * speed * 0.65 +
          (0.4 + random(record.seed, i + 440) * (phase === 3 ? 3 : 2)) * (hard ? 1.2 : 1);
        const at = [
          origin[0] + Math.cos(angle) * elapsed * speed,
          origin[1] + lift * elapsed - 4.9 * elapsed * elapsed,
          origin[2] + Math.sin(angle) * elapsed * speed,
        ];
        if (
          surface &&
          axes.reduce(
            (sum, axis, j) =>
              sum +
              (at[j] - (surface.position[axis] - originMm[axis]) / 1000) * surface.normal[axis],
            0,
          ) < 0.012
        )
          continue;
        const fade = Math.min(1, (lifetime - elapsed) * 8);
        const drop = (0.026 + random(record.seed, i + 910) * (hard ? 0.065 : 0.03)) * fade;
        const size = !bloody
          ? [0.025, 0.025, 0.14]
          : phase === 3
            ? [drop * 2.8, drop * 0.35, drop * (3 + speed * 0.3)]
            : phase === 0
              ? [drop * (hard ? 1.7 : 1), drop * 0.6, drop * (3 + speed * 0.7)]
              : phase === 1
                ? [drop * 1.35, drop, drop * 1.7]
                : [drop * 0.4, drop * 0.4, drop * 1.7];
        put(
          bloody ? 'wound' : 'spark',
          at,
          size,
          bloody ? ['#b51532', '#5c091a', '#c72a40', '#8b1128'][phase] : '#ffd287',
          [elapsed * (phase === 1 ? 9 : 2), Math.PI / 2 - angle, elapsed * 3],
        );
        stats.moving++;
      }
      for (let i = 0; i < mist; i++) {
        const angle = heading + (i - 1) * 1.7;
        smoke.push({
          at: [
            origin[0] + Math.cos(angle) * age * 2,
            origin[1] + age * (0.4 + i * 0.2),
            origin[2] + Math.sin(angle) * age * 2,
          ],
          size: (0.65 + age * 5) * Math.min(1, (0.55 - age) * 6),
          tint: i % 2 ? '#95182b' : '#631020',
        });
        stats.moving++;
      }
      if (
        !organic &&
        record.material !== 'wood' &&
        record.material !== 'glass' &&
        age < 0.18 &&
        stats.moving < limits.moving
      ) {
        const radius =
          (0.3 + Math.sin((age / 0.18) * Math.PI) * 1.4) * Math.max(0.5, record.radius / 700);
        put('spark', origin, [radius, radius * 0.8, radius], age < 0.05 ? '#fff8cf' : '#ff862d');
        stats.moving++;
      }
      if (
        !organic &&
        record.material !== 'glass' &&
        age > 0.15 &&
        age < 0.8 &&
        stats.moving + 3 <= limits.moving
      ) {
        for (let i = 0; i < 3; i++)
          smoke.push({
            at: [origin[0] + i * 0.13, origin[1] + age * 0.9, origin[2]],
            size: 0.2 + age * (0.5 + i * 0.1),
            tint: record.material === 'wood' ? '#918675' : '#59605e',
          });
        stats.moving += 3;
      }
      stats.bursts++;
    }
    let examinedPieces = 0;
    for (const record of records) {
      record.presentation ??= {
        born: Math.max(0, presentationClock - (tick - record.tick) / 50),
        pieces: {},
      };
      const age = Math.max(0, presentationClock - record.presentation.born),
        organic = record.material === 'organic',
        bloody = organic && prefs.blood && !record.protected,
        dismember = organic && prefs.brutal && !record.protected && record.outcome !== 'intact';
      const animated = animatedIds.has(record.eventId);
      if (!animated && prefs.showRemains === false) continue;
      const palette =
        organic &&
        (appearance?.byIdentity.get(`${record.appearance.family}/${record.appearance.cast}`) ??
          appearance?.byIdentity.get(`${record.appearance.family}/*`));
      const authored = palette && tier !== 'low';
      const variants = recipes.get(record.eventId) ?? new Map();
      recipes.set(record.eventId, variants);
      const cachedFor = (style, make) => {
        if (!variants.has(style)) variants.set(style, { parts: make() });
        return variants.get(style);
      };
      const style = authored
        ? `${appearance.hash}/${palette.identity}/${dismember}/${bloody}/${tier}`
        : `current/${dismember}/${bloody}/${tier}`;
      const full = cachedFor(style, () =>
        authored
          ? appearanceRecipe(record, palette, dismember, bloody, tier)
          : combatFragmentRecipe(record, { ...prefs, detail: tier }),
      );
      let cached = full;
      if (full.parts.some((part) => part.optionalDetail)) {
        const fullShapes = new Set(full.parts.map((part) => part.shape));
        const fullCalls = [...fullShapes].reduce(
          (sum, name) =>
            sum + (reserved.has(name) ? 0 : (pools.get(name)?.userData.combatCalls ?? 1)),
          reservedCalls,
        );
        const allRootsSettled = full.parts.every(
          (part, index) =>
            part.attachment >= 0 ||
            record.presentation.pieces[canonicalRegion(part.region ?? `fragment-${index}`)]
              ?.settled,
        );
        if (
          fullCalls > limits.calls ||
          full.parts.length > limits.settled - stats.settled ||
          (!allRootsSettled && full.parts.length > limits.moving - stats.moving)
        ) {
          cached = full.essential ??= (() => {
            const kept = full.parts
              .map((part, index) => ({ part, index }))
              .filter(({ part }) => !part.optionalDetail);
            const remap = new Map(kept.map(({ index }, i) => [index, i]));
            const parts = kept.map(({ part }) => ({
              ...part,
              supportSize: [...(part.ownSupportSize ?? part.supportSize ?? part.size)],
              attachment: remap.get(part.attachment) ?? -1,
            }));
            for (let index = parts.length - 1; index >= 0; index--) {
              const part = parts[index];
              if (part.attachment < 0) continue;
              const parent = parts[part.attachment],
                support = rotatedSupportSize(part);
              for (let axis = 0; axis < 3; axis++)
                parent.supportSize[axis] = Math.max(
                  parent.supportSize[axis],
                  Math.abs(part.at[axis]) * 2 + support[axis],
                );
            }
            return { parts };
          })();
        }
      }
      const parts = cached.parts;
      // Variant-specific counts can be stale after another detail variant has
      // advanced the shared region poses. Admission below reads those poses.
      if (examinedPieces + parts.length > limits.moving + limits.settled) continue;
      if (
        parts.length > limits.settled - stats.settled &&
        parts.length > limits.moving - stats.moving
      )
        continue;
      const shapes = (cached.shapes ??= [...new Set(parts.map((part) => part.shape))].map(
        (name) => ({ name, calls: pools.get(name)?.userData.combatCalls ?? 1 }),
      ));
      const requiredCalls = shapes.reduce(
        (sum, shape) => sum + (reserved.has(shape.name) ? 0 : shape.calls),
        reservedCalls,
      );
      const triangles = authored
        ? (cached.triangles ??= parts.reduce(
            (n, part) => n + (pools.get(part.shape).userData.combatTriangles ?? 0),
            0,
          ))
        : 0;
      if (requiredCalls > limits.calls || stats.triangles + triangles > limits.triangles) {
        // Keep the selected appearance. A complete authored cluster that cannot
        // fit remains logical instead of being silently redrawn as Current art.
        if (authored) stats.deferredAuthoredClusters++;
        continue;
      }
      cached.multiplicity ??= parts.reduce(
        (counts, part) => counts.set(part.shape, (counts.get(part.shape) ?? 0) + 1),
        new Map(),
      );
      if (
        [...cached.multiplicity].some(
          ([name, count]) => pools.get(name).count + count > pools.get(name).instanceMatrix.count,
        )
      )
        continue;

      // Admit a complete cluster before any surface queries. Offscreen archives
      // remain logical records and do not each run their own fragment simulation.
      const topology = (cached.topology ??= parts.map((part, index) => {
        let root = index;
        while (parts[root].attachment >= 0) root = parts[root].attachment;
        return {
          root,
          key: canonicalRegion(parts[root].region ?? `fragment-${root}`),
          isRoot: root === index,
        };
      }));
      const rootStates = topology.map((row) =>
        row.isRoot ? record.presentation.pieces[row.key] : null,
      );
      if (
        topology.every((row, index) => !row.isRoot || rootStates[index]?.settled) &&
        parts.length > limits.settled - stats.settled
      )
        continue;
      const movingParents = topology.reduce(
        (count, row) => count + (rootStates[row.root] && !rootStates[row.root].settled ? 1 : 0),
        0,
      );
      if (!reducedMotion && movingParents > limits.moving - stats.moving) continue;
      examinedPieces += parts.length;

      const origin = axes.map((axis) => (record.position[axis] - originMm[axis]) / 1000);
      origin[1] += organic ? record.height / 2000 : record.radius / 2000;
      const surface = bloody && prefs.showRemains !== false ? markSurface(record) : record.surface;
      const direction = Math.atan2(
        record.impactDirection?.z ?? record.velocity.z,
        record.impactDirection?.x ?? record.velocity.x,
      );
      const impact = impactStrength(record);
      const poses = [];
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        if (part.attachment >= 0) {
          const parent = poses[part.attachment];
          euler.set(...parent.rotation);
          quaternion.setFromEuler(euler);
          const offset = pieceOffset.set(...part.at).applyQuaternion(quaternion);
          const at = parent.at.map((n, axis) => n + offset.getComponent(axis));
          quaternion.multiply(decalTurn.setFromEuler(euler.set(...(part.rotation ?? [0, 0, 0]))));
          euler.setFromQuaternion(quaternion);
          poses.push({
            at,
            rotation: [euler.x, euler.y, euler.z],
            settled: parent.settled,
            pending: parent.pending,
          });

          continue;
        }
        const key = canonicalRegion(part.region ?? `fragment-${index}`);
        const angle =
          direction +
          (random(record.seed, index * 4) - 0.5) *
            (record.outcome === 'explosive' ? Math.PI * 2 : 3.8);
        const launch =
          1.4 + random(record.seed, index * 4 + 2) * (record.outcome === 'explosive' ? 4.5 : 2.4);
        const speed = (0.7 + random(record.seed, index * 4 + 1) * 1.8) * impact;
        const state = (record.presentation.pieces[key] ??= {
          at: [
            record.position.x / 1000 + part.at[0],
            record.position.y / 1000 +
              (organic ? record.height / 2000 : record.radius / 2000) +
              part.at[1],
            record.position.z / 1000 + part.at[2],
          ],
          rotation: [0, angle, 0],
          velocity: [Math.cos(angle) * speed, launch, Math.sin(angle) * speed],
          time: 0,
          settled: false,
          pending: false,
          surface: null,
        });
        const resting = [Math.PI / 2, angle + 0.8, (random(record.seed, index + 200) - 0.5) * 0.2];
        const supportSize = part.supportSize ?? part.size;
        const boundsKey = supportSize.join('/');
        const restOnSurface = (contact, rotation = resting) => {
          const n = contact.normal;
          matrix.makeRotationFromEuler(euler.set(...rotation));
          const m = matrix.elements;
          const extent =
            (Math.abs(n.x * m[0] + n.y * m[1] + n.z * m[2]) * supportSize[0] +
              Math.abs(n.x * m[4] + n.y * m[5] + n.z * m[6]) * supportSize[1] +
              Math.abs(n.x * m[8] + n.y * m[9] + n.z * m[10]) * supportSize[2]) /
            2;
          const signed = axes.reduce(
            (sum, axis, i) => sum + (state.at[i] - contact.position[axis] / 1000) * n[axis],
            0,
          );
          state.at = state.at.map((v, i) => v + n[axes[i]] * (extent + 0.006 - signed));
          state.rotation = [...rotation];
          state.surface = contact;
          state.velocity = [0, 0, 0];
          state.settled = true;
          state.pending = false;
          restingBounds.set(state, boundsKey);
        };
        const changedBounds = state.settled && restingBounds.get(state) !== boundsKey;
        const checks = pendingChecks.get(record.eventId) ?? new Map();
        pendingChecks.set(record.eventId, checks);
        // A resting pose is durable data, not proof that its supporting chunk is
        // currently present. Validate visible support on a bounded cadence and
        // retain the original anchor while streaming has temporarily removed it.
        if (
          state.settled &&
          query &&
          supportChecks < bodySupportBudget &&
          ((changedBounds && !state.pending) ||
            presentationClock - (checks.get(key) ?? -Infinity) >= 0.25)
        ) {
          supportChecks++;
          checks.set(key, presentationClock);
          const previous = state.surface;
          let support = null,
            attached = false;
          try {
            if (previous) {
              const result = querySurface(previous.position, previous.normal, {
                attachment: previous,
              });
              support = surfaceOf(result);
              attached = result?.attached === true;
            }
          } catch {}
          const matches =
            support &&
            (!previous.surfaceId || support.surfaceId === previous.surfaceId) &&
            (attached ||
              (Math.hypot(...axes.map((axis) => support.position[axis] - previous.position[axis])) <
                50 &&
                axes.reduce((sum, axis) => sum + support.normal[axis] * previous.normal[axis], 0) >
                  0.98));
          state.pending = !matches;
          if (matches) {
            const changedNormal = axes.some(
              (axis) => Math.abs(support.normal[axis] - previous.normal[axis]) > 1e-6,
            );
            if (changedNormal) {
              const turn = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(previous.normal.x, previous.normal.y, previous.normal.z),
                new THREE.Vector3(support.normal.x, support.normal.y, support.normal.z),
              );
              pieceOffset
                .set(...state.at)
                .sub(
                  new THREE.Vector3(
                    previous.position.x / 1000,
                    previous.position.y / 1000,
                    previous.position.z / 1000,
                  ),
                )
                .applyQuaternion(turn);
              state.at = axes.map(
                (axis, i) => support.position[axis] / 1000 + pieceOffset.getComponent(i),
              );
              quaternion.setFromEuler(euler.set(...state.rotation)).premultiply(turn);
              euler.setFromQuaternion(quaternion);
              state.rotation = [euler.x, euler.y, euler.z];
            } else {
              state.at = state.at.map(
                (value, i) =>
                  value + (support.position[axes[i]] - previous.position[axes[i]]) / 1000,
              );
            }
            if (changedBounds || changedNormal) restOnSurface(support, state.rotation);
            else state.surface = support;
          }
        }
        if (changedBounds && restingBounds.get(state) !== boundsKey) {
          if (!query && state.surface) restOnSurface(state.surface, state.rotation);
          else state.pending = true;
        }
        const retryReady =
          !state.pending || presentationClock - (checks.get(key) ?? -Infinity) >= 0.25;
        // Legacy recoveries have accepted defeat facts but no resting poses. Resolve
        // directly against admitted support; do not replay four seconds of breakup.
        if (
          !state.settled &&
          state.time === 0 &&
          age > 1.25 &&
          !bursts.has(record.eventId) &&
          retryReady &&
          (!query || supportChecks < bodySupportBudget)
        ) {
          const point = Object.fromEntries(axes.map((axis, i) => [axis, state.at[i] * 1000]));
          let support = null;
          if (query) supportChecks++;
          try {
            support = query ? surfaceOf(querySurface(point, { x: 0, y: 1, z: 0 })) : surface;
          } catch {}
          if (support && support.normal.y >= 0.25) restOnSurface(support);
          else {
            state.pending = true;
            checks.set(key, presentationClock);
          }
        }
        // The actual swept surface decides when a piece stops. No lifetime is a floor.
        const targetTime = reducedMotion ? Math.max(4, age) : age;
        if (
          state.pending &&
          !state.settled &&
          retryReady &&
          !(state.time === 0 && age > 1.25 && !bursts.has(record.eventId))
        )
          state.pending = false;
        for (
          let step = 0;
          !state.settled && !state.pending && state.time + 1e-6 < targetTime && step < 200;
          step++
        ) {
          const dt = Math.min(0.02, targetTime - state.time);
          const from = [...state.at];
          const to = from.map(
            (n, axis) => n + state.velocity[axis] * dt - (axis === 1 ? 4.9 * dt * dt : 0),
          );
          const fromMm = Object.fromEntries(axes.map((axis, i) => [axis, from[i] * 1000]));
          const toMm = Object.fromEntries(axes.map((axis, i) => [axis, to[i] * 1000]));
          const radius = Math.min(...supportSize) / 2;
          let contact = null,
            admitted = false;
          if (query) {
            try {
              const result = querySurface(
                toMm,
                { x: 0, y: 1, z: 0 },
                { fromMm, toMm, radiusMm: radius * 1000 },
              );
              admitted = result?.clear === true || !!surfaceOf(result);
              const candidate = surfaceOf(result);
              if (candidate) {
                // Older down-ray providers return a future support, not a swept hit.
                const signed = (p) =>
                  axes.reduce(
                    (sum, axis, i) =>
                      sum + (p[i] - candidate.position[axis] / 1000) * candidate.normal[axis],
                    0,
                  );
                if (signed(to) <= radius + 0.005 && signed(from) >= -radius) contact = candidate;
              }
            } catch {
              /* Missing streamed geometry remains pending. */
            }
          } else if (
            surface &&
            Math.hypot(toMm.x - surface.position.x, toMm.z - surface.position.z) < record.radius * 8
          ) {
            admitted = true;
            const signed = (p) =>
              axes.reduce(
                (sum, axis, i) =>
                  sum + (p[i] - surface.position[axis] / 1000) * surface.normal[axis],
                0,
              );
            if (signed(to) <= radius + 0.005 && signed(from) >= -radius) contact = surface;
          }
          state.pending = !admitted;
          if (!admitted) {
            checks.set(key, presentationClock);
            break;
          }
          state.at = to;
          state.time += dt;
          state.velocity[1] -= 9.8 * dt;
          state.rotation = [
            state.time * (2 + random(record.seed, index + 180)),
            angle + state.time,
            state.time * 2,
          ];
          if (contact && (contact.normal.y < 0.25 || state.velocity[1] > 0)) {
            // Walls and undersides deflect fragments; they are not resting floors.
            const n = contact.normal;
            const velocityNormal = axes.reduce(
              (sum, axis, i) => sum + state.velocity[i] * n[axis],
              0,
            );
            state.velocity = state.velocity.map(
              (v, i) => v - Math.min(0, velocityNormal) * 1.12 * n[axes[i]],
            );
            const signed = axes.reduce(
              (sum, axis, i) => sum + (to[i] - contact.position[axis] / 1000) * n[axis],
              0,
            );
            state.at = to.map((v, i) => v + n[axes[i]] * (radius + 0.004 - signed));
          } else if (contact) {
            // Project the complete connected cluster onto its real supporting normal.
            restOnSurface(contact);
          }
        }
        const at = state.at.map((n, i) => n - originMm[axes[i]] / 1000);
        poses.push({
          at,
          rotation: state.rotation,
          settled: state.settled,
          pending: state.pending,
        });
      }
      cached.allSettled = poses.every((pose) => pose.settled);
      cached.movingCount = poses.filter((pose) => !pose.settled).length;
      // Streaming can temporarily remove the supporting geometry. Retain the
      // complete logical cluster, but never display it as a frozen airborne pose.
      if (poses.some((pose) => pose.pending)) continue;
      const visiblePoses = poses
        .map((pose, i) => ({ ...pose, part: parts[i] }))
        .filter((pose) => prefs.showRemains !== false || !pose.settled);
      const movingCount = reducedMotion ? 0 : visiblePoses.filter((p) => !p.settled).length;
      const settledCount = visiblePoses.length - movingCount;
      if (
        stats.moving + movingCount > limits.moving ||
        stats.settled + settledCount > limits.settled
      )
        continue;
      for (const shape of shapes) reserved.add(shape.name);
      reservedCalls = requiredCalls;
      if (visiblePoses.length) {
        if (authored) {
          const visibleRegions = new Set(visiblePoses.map((pose) => pose.part.region)).size;
          stats.authoredClusters++;
          stats.authoredRegions += visibleRegions;
          if (visibleRegions === palette.regions.length) stats.completeAuthoredClusters++;
        } else stats.proceduralClusters++;
      }
      stats.triangles += triangles;
      stats.moving += movingCount;
      stats.settled += settledCount;
      for (const { at, rotation, part } of visiblePoses)
        put(part.shape, at, part.size, part.tint, rotation, null, part.capVisible);
      if (
        bloody &&
        prefs.showRemains !== false &&
        stats.marks + 4 <= Math.ceil(limits.marks * 0.6)
      ) {
        const footprints = [];
        const hard = prefs.brutal && !record.protected;
        const splashes = hard ? (tier === 'ultra' ? 9 : tier === 'low' ? 5 : 7) : 4;
        if (surface)
          for (let mark = 0; mark < splashes; mark++)
            footprints.push({
              surface,
              scatter: mark,
              radius: mark
                ? (mark < 4 ? 0.16 : 0.065) + random(record.seed, mark + 290) * (hard ? 0.27 : 0.16)
                : 0.75 + impact * 0.16,
              stretch: mark ? (hard ? 1.6 + random(record.seed, mark + 291) * 1.1 : 1.3) : 1.7,
              distance: mark ? (hard ? 0.45 + random(record.seed, mark + 292) * 1.8 : 0.4) : 0,
              delay: mark ? 0.18 + random(record.seed, mark + 293) * 0.5 : 0.1,
            });
        // Contact is owned by the settled region, so a severed limb gets a pool
        // where it actually lands, including elevated and moving surfaces.
        if (tier !== 'low')
          for (const row of topology) {
            if (!row.isRoot || footprints.length >= (tier === 'ultra' ? 18 : 12)) continue;
            const state = record.presentation.pieces[row.key];
            if (!state?.settled || state.pending || !state.surface) continue;
            footprints.push({
              surface: state.surface,
              scatter: 0,
              radius: /chest|torso|pelvis/.test(row.key)
                ? hard
                  ? 0.68
                  : 0.52
                : hard
                  ? 0.32
                  : 0.24,
              stretch: 1.5,
              delay: state.time,
            });
          }
        for (let mark = 0; mark < footprints.length; mark++) {
          if (stats.marks >= Math.ceil(limits.marks * 0.6)) break;
          const footprint = footprints[mark],
            surface = footprint.surface,
            radius = footprint.radius;
          const wetAge = age - (footprint.delay ?? 0);
          if (wetAge < 0) continue;
          const base = axes.map(
            (axis) =>
              (surface.position[axis] - originMm[axis]) / 1000 + surface.normal[axis] * 0.006,
          );
          const at = [...base];
          if (footprint.scatter) {
            const angle =
              direction +
              (random(record.seed, mark + 294) - 0.5) *
                (record.outcome === 'explosive' ? Math.PI * 2 : 3.8);
            at[0] += Math.cos(angle) * footprint.distance;
            at[2] += Math.sin(angle) * footprint.distance;
          }
          // Offset the mark along the accepted tangent plane, including slopes.
          if (Math.abs(surface.normal.y) > 0.15)
            at[1] -=
              ((at[0] - base[0]) * surface.normal.x + (at[2] - base[2]) * surface.normal.z) /
              surface.normal.y;
          const size = [radius * footprint.stretch, radius, 1],
            turn = random(record.seed, mark + 700) * Math.PI * 2;
          if (typeof query === 'function') {
            let cached = markSupports.get(record.eventId);
            if (!cached && supportChecks + 9 <= bodySupportBudget) {
              cached = { at: presentationClock, values: [] };
              markSupports.set(record.eventId, cached);
            }
            if (!cached) continue;
            const checks = cached.values;
            const worldCenter = at.map((value, i) => Math.round(value * 1000 + originMm[axes[i]]));
            const signature = `${surface.surfaceId ?? ''}/${worldCenter.join('/')}/${axes.map((axis) => surface.normal[axis]).join('/')}/${size.join('/')}/${turn}`;
            const changedSupport = checks[mark]?.signature !== signature;
            const needsCheck = changedSupport || presentationClock - checks[mark].checkedAt >= 0.25;
            // Keep draining unvalidated footprints over rendered frames, even
            // when a paused preview holds the accepted presentation time still.
            const canCheck = supportChecks + 9 <= bodySupportBudget;
            if (needsCheck && canCheck) {
              supportChecks += 9;
              const orient = new THREE.Quaternion()
                .setFromUnitVectors(
                  decalAxis,
                  new THREE.Vector3(surface.normal.x, surface.normal.y, surface.normal.z),
                )
                .multiply(new THREE.Quaternion().setFromAxisAngle(decalAxis, turn));
              const supported = [-0.5, 0, 0.5].every((x) =>
                [-0.5, 0, 0.5].every((y) => {
                  const offset = new THREE.Vector3(x * size[0], y * size[1], 0).applyQuaternion(
                    orient,
                  );
                  const point = Object.fromEntries(
                    axes.map((axis, i) => [
                      axis,
                      (at[i] + offset.getComponent(i)) * 1000 + originMm[axis],
                    ]),
                  );
                  try {
                    const hit = surfaceOf(querySurface(point, surface.normal));
                    return (
                      hit &&
                      Math.hypot(...axes.map((axis) => hit.position[axis] - point[axis])) < 50 &&
                      (!surface.surfaceId || hit.surfaceId === surface.surfaceId) &&
                      axes.reduce((n, axis) => n + hit.normal[axis] * surface.normal[axis], 0) >
                        0.98
                    );
                  } catch {
                    return false;
                  }
                }),
              );
              checks[mark] = { signature, supported, checkedAt: presentationClock };
            }
            // Keep individually validated footprints while the bounded queue
            // checks other pieces; never reuse validation at a different contact.
            if (changedSupport && !canCheck) continue;
            if (!checks[mark]?.supported) continue;
          }
          const spread = 0.25 + 0.75 * (1 - Math.exp(-wetAge * (footprint.scatter ? 8 : 1.2)));
          put(
            'mark',
            at,
            [size[0] * spread, size[1] * spread, 1],
            age > 20 ? '#43131a' : mark % 2 ? '#701024' : HUNT_PRESENTATION_CATALOG.palette.blood,
            [0, 0, turn],
            surface.normal,
          );
          stats.marks++;
        }
      }
    }
    // Surface impacts have their own logical ring; an old corpse cannot erase a bullet hit.
    if (prefs.showRemains !== false) {
      let bulletMarks = 0,
        blastMarks = 0,
        examinedImpacts = 0;
      for (const record of nearestRecords(ledger.impacts(), cameraPosition, originMm)) {
        if (stats.marks >= limits.marks || examinedImpacts++ >= limits.marks * 2) break;
        if (record.material === 'organic' && !prefs.blood) continue;
        const blast = /rocket|bomb|charge|explosion/.test(`${record.weapon}/${record.cause}`);
        const quota = Math.max(4, Math.floor(limits.marks * 0.2));
        if (blast ? blastMarks >= quota : bulletMarks >= quota) continue;
        const surface = markSurface(record);
        if (!surface) continue;
        const radius = blast
          ? Math.min(1.2, 0.35 + record.severity * 0.35)
          : record.weapon === 'precision'
            ? 0.075
            : 0.04;
        const key = record.eventId;
        let cached = markSupports.get(key);
        if (
          (!cached || presentationClock - cached.at >= 0.25) &&
          supportChecks + 4 <= supportCheckBudget
        ) {
          supportChecks += 4;
          let supported;
          supported = true;
          if (query) {
            supported = [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ].every(([x, z]) => {
              try {
                const orient = new THREE.Quaternion().setFromUnitVectors(
                  decalAxis,
                  new THREE.Vector3(surface.normal.x, surface.normal.y, surface.normal.z),
                );
                const offset = new THREE.Vector3(
                  x * radius * 1000,
                  z * radius * 1000,
                  0,
                ).applyQuaternion(orient);
                const point = Object.fromEntries(
                  axes.map((axis, i) => [axis, surface.position[axis] + offset.getComponent(i)]),
                );
                const hit = surfaceOf(querySurface(point, surface.normal));
                return (
                  hit &&
                  Math.hypot(...axes.map((axis) => hit.position[axis] - point[axis])) < 50 &&
                  (!surface.surfaceId || hit.surfaceId === surface.surfaceId) &&
                  axes.reduce((sum, axis) => sum + hit.normal[axis] * surface.normal[axis], 0) >
                    0.98
                );
              } catch {
                return false;
              }
            });
          }
          cached = { at: presentationClock, supported };
          markSupports.set(key, cached);
        }
        if (!cached?.supported) continue;
        const at = axes.map(
          (axis) => (surface.position[axis] - originMm[axis]) / 1000 + surface.normal[axis] * 0.005,
        );
        put(
          'mark',
          at,
          [radius * (blast ? 1.5 : 1), radius, 1],
          record.material === 'organic' ? '#711c2c' : blast ? '#38332b' : '#343a36',
          [0, 0, random(record.seed, 300) * Math.PI * 2],
          surface.normal,
        );
        stats.marks++;
        if (blast) blastMarks++;
        else bulletMarks++;
      }
    }
    // Nonfatal hits share the same materials, but never create a corpse record.
    if (!reducedMotion)
      for (const record of [...impacts.values()].reverse()) {
        const age = presentationClock - record.presentation.born;
        if (age < 0 || age > 0.3 || stats.bursts >= limits.bursts) continue;
        const bloody = record.material === 'organic' && prefs.blood && !record.protected;
        const count = Math.min(bloody ? 12 : 6, limits.moving - stats.moving);
        if (!count) break;
        stats.bursts++;
        const origin = axes.map(
          (axis) => ((record.impactPosition ?? record.position)[axis] - originMm[axis]) / 1000,
        );
        if (!record.impactPosition)
          origin[1] += record.material === 'organic' ? record.height / 2000 : record.radius / 2000;
        const angle = Math.atan2(
          record.impactDirection?.z ?? (record.velocity.z || record.normal.z),
          record.impactDirection?.x ?? (record.velocity.x || record.normal.x),
        );
        for (let i = 0; i < count; i++) {
          const heading = angle + (random(record.seed, i + 800) - 0.5) * 1.8,
            spread = age * (0.7 + random(record.seed, i + 850) * 2);
          put(
            bloody
              ? 'wound'
              : record.material === 'glass'
                ? 'glass'
                : ['stone', 'earth', 'concrete', 'organic'].includes(record.material) &&
                    !record.protected
                  ? 'cloth'
                  : 'spark',
            [
              origin[0] + Math.cos(heading) * spread,
              origin[1] + age * 0.9 - 4.9 * age * age,
              origin[2] + Math.sin(heading) * spread,
            ],
            [0.025, 0.025, 0.05],
            bloody
              ? '#a62b47'
              : ['stone', 'earth', 'concrete'].includes(record.material)
                ? '#b2a996'
                : record.material === 'organic' && !record.protected
                  ? '#a4a08c'
                  : '#ffcf81',
            [age * 3, -heading, age],
          );
          stats.moving++;
        }
      }
    // Transparency is isolated and sorted back-to-front; solid fragments keep depth writes.
    smoke.sort((a, b) =>
      cameraPosition
        ? b.at.reduce((sum, n, i) => sum + (n - cameraPosition[axes[i]]) ** 2, 0) -
          a.at.reduce((sum, n, i) => sum + (n - cameraPosition[axes[i]]) ** 2, 0)
        : 0,
    );
    for (const item of smoke)
      put(
        'smoke',
        item.at,
        [item.size, item.size, 1],
        item.tint,
        [0, 0, 0],
        cameraPosition
          ? normalOf(
              Object.fromEntries(axes.map((axis, i) => [axis, cameraPosition[axis] - item.at[i]])),
            )
          : { x: 0, y: 0, z: 1 },
      );
    for (const mesh of pools.values()) {
      mesh.visible = mesh.count > 0;
      if (mesh.visible) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        if (mesh.geometry.attributes.combatCapEnabled)
          mesh.geometry.attributes.combatCapEnabled.needsUpdate = true;
        stats.calls += mesh.userData.combatCalls ?? 1;
      }
    }
  }
  return {
    configure,
    setAppearanceParts,
    setAppearancePartsTemplates,
    prepareTextures(upload) {
      if (typeof upload !== 'function' || !appearance) return;
      const textures = new Set();
      for (const mesh of appearance.pools.values())
        for (const paint of [
          mesh.userData.combatOriginalMaterial ?? mesh.material,
          mesh.userData.combatCleanMaterial,
        ]
          .filter(Boolean)
          .flat()) {
          for (const value of Object.values(paint)) if (value?.isTexture) textures.add(value);
          for (const texture of paint.userData.combatCapTextures ?? []) textures.add(texture);
        }
      for (const texture of textures) upload(texture);
    },
    prepareMaterials() {
      for (const mesh of pools.values()) mesh.visible = true;
      for (const probe of appearance?.probes ?? []) probe.visible = true;
      return () => {
        for (const mesh of pools.values()) mesh.visible = mesh.count > 0;
        for (const probe of appearance?.probes ?? []) probe.visible = false;
      };
    },
    observe,
    update,
    reset,
    export() {
      const archive = ledger.export();
      for (const record of [...archive.records, ...archive.impactRecords])
        record.presentation = compactFragmentArchive(record.presentation);
      return { ...archive, presentationClock };
    },
    restore(input, options) {
      ledger.restore(input, { ...options, groundQuery: options?.groundQuery ?? query });
      orderedRings.clear();
      markSupports.clear();
      surfaceSupports.clear();
      runId = ledger.snapshot().runId;
      currentTick = ledger.snapshot().tick;
      presentationClock = Number.isFinite(input?.presentationClock)
        ? Math.max(0, input.presentationClock)
        : currentTick / 50;
      for (const record of [...ledger.records(), ...ledger.impacts()])
        record.presentation ??= {
          born: Math.max(0, presentationClock - Math.max(4, (currentTick - record.tick) / 50)),
          pieces: {},
        };
      bursts.clear();
      impacts.clear();
      recipes.clear();
      pendingChecks.clear();
      clearPools();
    },
    resources: () => ({
      ...stats,
      ...ledger.snapshot(),
      presentationClock,
      pendingFragments: ledger
        .records()
        .reduce(
          (n, r) => n + Object.values(r.presentation?.pieces ?? {}).filter((p) => p.pending).length,
          0,
        ),
      maxDrawCalls: COMBAT_EFFECT_LIMITS[stats.tier].calls,
      registeredPools: pools.size,
      appearanceReady: Boolean(appearance),
      appearanceHash: appearance?.hash ?? null,
      appearanceDrawCalls: appearance?.calls ?? 0,
      appearanceCharacters: appearance?.byIdentity.size ?? 0,
      appearanceDerivedDecodedBytes: appearance?.derivedBytes ?? 0,
      appearanceDerivedGpuBytes: appearance?.derivedBytes ?? 0,
      appearanceDerivedMaterials: appearance?.materials.size ?? 0,
      appearanceDerivedTextures: appearance?.textures.size ?? 0,
      maxAppearanceTriangles: COMBAT_EFFECT_LIMITS[stats.tier].triangles,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      releaseAppearance(appearance);
      appearance = null;
      for (const mesh of pools.values()) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.dispose();
      }
      mistTexture.dispose();
      pools.clear();
      bursts.clear();
      impacts.clear();
      recipes.clear();
      markSupports.clear();
      surfaceSupports.clear();
      pendingChecks.clear();
      orderedRings.clear();
      shared?.dispose();
      display?.dispose();
    },
  };
}
