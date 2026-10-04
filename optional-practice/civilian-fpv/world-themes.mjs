import { boundedJSON, dataIdentity, exactKeys, required, stableId } from '../../game/data-json.mjs';
import { validateIndustrialEnvironmentPin } from '../../game/presentation/industrial-environments.mjs';

import {
  BUILTIN_SIM_VISUAL_COLLECTIONS,
  SIM_COLLECTION_PALETTES,
  getThemeFamily,
  resolveSimVisualCollection,
} from '../../game/presentation/theme-system.mjs';
export {
  SIM_MODEL_ROLES,
  SIM_MATERIAL_ROLES,
  SIM_EFFECT_ROLES,
  BUILTIN_SIM_VISUAL_COLLECTIONS,
  validateSimVisualCollection,
  resolveSimVisualCollection,
  resolveSimEffects,
} from '../../game/presentation/theme-system.mjs';

export const WORLD_SURFACE_COATING_EXTENSION = 'REVEALLINE_surface_coating';
/** One canonical capability declaration, shared by import and actual GLTF loading. */
export function validateWorldSurfaceCoatings(doc) {
  const marked = new Set();
  for (const [index, material] of (doc.materials ?? []).entries()) {
    if (!Object.hasOwn(material.extensions ?? {}, WORLD_SURFACE_COATING_EXTENSION)) continue;
    const value = material.extensions[WORLD_SURFACE_COATING_EXTENSION];
    required(
      value &&
        Object.keys(value).length === 2 &&
        Object.hasOwn(value, 'version') &&
        Object.hasOwn(value, 'kind') &&
        value.version === 1 &&
        value.kind === 'opaque-finish',
      'Unsupported surface coating declaration.',
    );
    required(
      (material.alphaMode ?? 'OPAQUE') === 'OPAQUE' &&
        (material.pbrMetallicRoughness?.baseColorFactor?.[3] ?? 1) === 1 &&
        (material.extensions?.KHR_materials_transmission?.transmissionFactor ?? 0) === 0,
      'Surface coatings require an opaque material.',
    );
    marked.add(index);
  }
  if (
    marked.size ||
    doc.extensionsUsed?.includes(WORLD_SURFACE_COATING_EXTENSION) ||
    doc.extensionsRequired?.includes(WORLD_SURFACE_COATING_EXTENSION)
  ) {
    required(
      marked.size > 0 &&
        ['extensionsUsed', 'extensionsRequired'].every(
          (key) =>
            Array.isArray(doc[key]) &&
            doc[key].filter((name) => name === WORLD_SURFACE_COATING_EXTENSION).length === 1,
        ),
      'Surface coatings must declare their required capability.',
    );
    for (const mesh of doc.meshes ?? [])
      for (const primitive of mesh.primitives ?? [])
        required(
          !marked.has(primitive.material) || [4, 5, 6].includes(primitive.mode ?? 4),
          'Surface coatings require triangle geometry.',
        );
  }
  return marked;
}

const title = (en, uk) => ({ en, uk });
const profile = (id, names, palette, extras = {}) =>
  Object.freeze({
    format: 'ThemeProfile.v1',
    id,
    revision: 'r1',
    title: names,
    palette,
    textureFilter: 'linear',
    drone: 'racer',
    characters: 'civilian',
    assets: {
      gate: 'builtin:gate',
      marker: 'builtin:beacon',
      enemy: 'builtin:sentry',
      vehicle: 'builtin:vehicle',
    },
    audio: { ambience: 'hangar', motor: 'quad', gate: 'chime' },
    ui: { accent: '#a2dfcf', font: 'system-ui', borderRadius: 12 },
    ...extras,
  });
export const THEME_PROFILES = Object.freeze([
  profile('academy', title('Flight Academy', 'Льотна академія'), {
    sky: 0xb5d5e2,
    fog: 0xc5d7d9,
    ground: 0x526963,
    wall: 0x375164,
    accent: 0xa9ebbd,
    warm: 0xe5b881,
  }),
  profile(
    'ukrainian',
    title('Ukrainian Horizons', 'Українські обрії'),
    {
      sky: 0xbad7e8,
      fog: 0xc7d9d4,
      ground: 0x6e835d,
      wall: 0xe4d5b6,
      accent: 0x6fbcdf,
      warm: 0xf1cf66,
    },
    {
      characters: 'civilian',
      assets: {
        gate: 'builtin:timber-gate',
        marker: 'builtin:ceramic-beacon',
        enemy: 'builtin:practice-drone',
        vehicle: 'builtin:utility-van',
      },
      audio: { ambience: 'woodland', motor: 'quad', gate: 'bell' },
      ui: { accent: '#e5c36e', font: 'system-ui', borderRadius: 12 },
    },
  ),
  profile(
    'pixel',
    title('Pixel Circuit', 'Піксельні перегони'),
    {
      sky: 0x233348,
      fog: 0x344657,
      ground: 0x33404c,
      wall: 0x344657,
      accent: 0x66e6dc,
      warm: 0xf1ae75,
    },
    {
      textureFilter: 'nearest',
      drone: 'pixel',
      characters: 'arcade',
      assets: {
        gate: 'builtin:neon-gate',
        marker: 'builtin:pixel-beacon',
        enemy: 'builtin:arcade-rival',
        vehicle: 'builtin:pixel-truck',
      },
      audio: { ambience: 'stadium', motor: 'arcade', gate: 'digital' },
      ui: { accent: '#bd9cfc', font: 'monospace', borderRadius: 2 },
    },
  ),
  profile(
    'operations',
    title('Field Operations', 'Польові операції'),
    {
      sky: 0xc4d0d5,
      fog: 0xabbfc2,
      ground: 0x66716b,
      wall: 0x50616a,
      accent: 0x91c7bc,
      warm: 0xefb76b,
    },
    {
      drone: 'utility',
      characters: 'training-patrol',
      assets: {
        gate: 'builtin:utility-gate',
        marker: 'builtin:signal-beacon',
        enemy: 'builtin:sentry',
        vehicle: 'builtin:patrol-rover',
      },
      audio: { ambience: 'industrial', motor: 'utility', gate: 'radio' },
      ui: { accent: '#a5c581', font: 'system-ui', borderRadius: 4 },
    },
  ),
  profile(
    'industrial-workshop',
    title('Industrial Workshop', 'Індустріальна майстерня'),
    {
      sky: 0xb9c5c8,
      fog: 0xb9c5c8,
      ground: 0x696a60,
      wall: 0x465052,
      accent: 0xe8b45c,
      warm: 0xe5cc97,
    },
    {
      drone: 'utility',
      characters: 'training-patrol',
      assets: BUILTIN_SIM_VISUAL_COLLECTIONS['industrial-workshop'].assets,
      ui: { accent: '#e8b45c', font: 'system-ui', borderRadius: 2 },
    },
  ),
  ...Object.entries(SIM_COLLECTION_PALETTES).map(([id, palette]) => {
    const family = getThemeFamily(id);
    return profile(id, title(family.name, family.name), palette, {
      drone: 'utility',
      characters: id === 'dos' ? 'arcade' : 'training-patrol',
      assets: BUILTIN_SIM_VISUAL_COLLECTIONS[id].assets,
      ui: {
        accent: `#${palette.accent.toString(16).padStart(6, '0')}`,
        font: id === 'dos' ? 'monospace' : 'system-ui',
        borderRadius: 2,
      },
    });
  }),
]);

/** Renderer-only selection. It never changes the course's rules or collision data. */
export function normalizeSimPresentation(value = {}) {
  const collectionId = value.collectionId ?? value.simCollectionId ?? 'authored',
    revision = value.revision === 1 ? 'r1' : (value.revision ?? 'r1'),
    resolved = resolveSimVisualCollection({ collectionId, revision });
  if (resolved.fallbackReason === 'collection-unavailable')
    throw new TypeError('Unknown SIM visual collection.');
  if (resolved.fallbackReason) throw new TypeError('Unsupported SIM visual collection revision.');
  return Object.freeze({ collectionId, revision: resolved.collection.revision });
}

export function resolveSimThemeProfile(course = {}, presentation = {}) {
  const selected = normalizeSimPresentation(presentation),
    { collection } = resolveSimVisualCollection(selected),
    authored = resolveThemeProfile(course);
  if (collection.profileId !== null)
    return authored.id === collection.profileId && authored.revision === collection.revision
      ? authored
      : validateThemeProfile(THEME_PROFILES.find((item) => item.id === collection.profileId));
  const pinnedCollection = collectionForProfile(authored);
  if (!pinnedCollection || pinnedCollection.revision === authored.revision) return authored;
  if (authored.authoredFallback) return validateThemeProfile(authored.authoredFallback);
  // A saved profile is part of World proof identity. Remove an unavailable
  // collection only from this render input, never from the retained course.
  return environmentThemeProfile(course);
}
function environmentThemeProfile(course) {
  const environmentLayer = (layer) => {
    const result = { ...layer };
    delete result.theme;
    delete result.themeId;
    delete result.themeProfile;
    return result;
  };
  return resolveThemeProfile({
    ...environmentLayer(course),
    world: environmentLayer(course.world),
  });
}
const collectionForProfile = (profile) =>
  Object.values(BUILTIN_SIM_VISUAL_COLLECTIONS).find((item) => item.profileId === profile.id);

/** New World recordings retain one exact authored fallback in their course snapshot. */
export function snapshotSimThemeProfile(course = {}, presentation = {}) {
  const selected = resolveSimThemeProfile(course, presentation);
  if (selected.format === 'ThemeProfile.v3') return selected;
  if (!collectionForProfile(selected)) return selected;
  const authored = resolveThemeProfile(course);
  const authoredFallback =
    selected.authoredFallback ??
    authored.authoredFallback ??
    (collectionForProfile(authored) ? environmentThemeProfile(course) : authored);
  return validateThemeProfile({ ...selected, format: 'ThemeProfile.v2', authoredFallback });
}

/** World snapshots pin collection revisions inside the existing course profile. */
export function recordedSimAppearance(course = {}) {
  const profile = resolveThemeProfile(course),
    collection = collectionForProfile(profile),
    drone = course.themeProfile?.drone ?? course.world?.themeProfile?.drone;
  return validateSimAppearance({
    collectionId: collection?.id ?? 'authored',
    revision: collection ? profile.revision : 'r1',
    ...(drone ? { drone } : {}),
  });
}
export const WORLD_RULESETS = Object.freeze([
  {
    format: 'Ruleset.v1',
    id: 'open-practice',
    revision: 'r1',
    rules: { collisionDamage: 0, playerHealth: 100 },
    conditions: { profile: 'clear', revision: 'r1' },
  },
  {
    format: 'Ruleset.v1',
    id: 'clean-racing',
    revision: 'r1',
    rules: { collisionDamage: 0, playerHealth: 100 },
    conditions: { profile: 'clear', revision: 'r1' },
  },
  {
    format: 'Ruleset.v1',
    id: 'pulse-encounter',
    revision: 'r1',
    rules: {
      collisionDamage: 0,
      playerHealth: 100,
      playerDamage: 25,
      fireCooldown: 8,
      projectileSpeed: 20000,
      projectileTicks: 150,
    },
    conditions: { profile: 'clear', revision: 'r1' },
  },
]);

const merge = (a, b) => {
  const result = { ...a };
  for (const [key, value] of Object.entries(b ?? {})) {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      throw new TypeError('Unsafe theme property.');
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? merge(a?.[key] ?? {}, value)
        : value;
  }
  return result;
};
function copy(value) {
  return boundedJSON(value, { maxBytes: 64 * 1024, maxNodes: 4096, maxDepth: 10, maxArray: 128 });
}
export function validateThemeProfile(input) {
  const value = copy(input);
  if (
    !['ThemeProfile.v1', 'ThemeProfile.v2', 'ThemeProfile.v3'].includes(value.format) ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(value.id) ||
    typeof value.revision !== 'string'
  )
    throw new TypeError('Invalid theme profile.');
  if (['ThemeProfile.v2', 'ThemeProfile.v3'].includes(value.format)) {
    exactKeys(
      value,
      [
        'format',
        'id',
        'revision',
        'title',
        'palette',
        'textureFilter',
        'drone',
        'characters',
        'assets',
        'audio',
        'ui',
        'authoredFallback',
        ...(value.format === 'ThemeProfile.v3' ? ['artRevision', 'industrialEnvironment'] : []),
      ],
      'pinned theme profile',
    );
    if (
      !collectionForProfile(value) ||
      !/^[a-zA-Z0-9._-]{1,64}$/.test(value.revision) ||
      value.authoredFallback?.format !== 'ThemeProfile.v1' ||
      Object.hasOwn(value.authoredFallback, 'authoredFallback') ||
      collectionForProfile(value.authoredFallback)
    )
      throw new TypeError('Invalid authored theme fallback.');
    value.authoredFallback = validateThemeProfile(value.authoredFallback);
    if (value.format === 'ThemeProfile.v3') {
      required(
        value.id === 'military-field' && value.revision === 'r1',
        'Industrial environment needs its retained collection.',
      );
      required(
        value.artRevision === 'industrial-roster-v3',
        'Industrial environment needs its retained actor art.',
      );
      value.industrialEnvironment = validateIndustrialEnvironmentPin(value.industrialEnvironment);
      required(value.industrialEnvironment !== null, 'Industrial environment pin required.');
    }
  } else if (Object.hasOwn(value, 'authoredFallback'))
    throw new TypeError('Authored theme fallback requires ThemeProfile.v2.');
  if (
    value.format !== 'ThemeProfile.v3' &&
    (Object.hasOwn(value, 'industrialEnvironment') || Object.hasOwn(value, 'artRevision'))
  )
    throw new TypeError('Industrial environment requires ThemeProfile.v3.');
  for (const key of ['sky', 'fog', 'ground', 'wall', 'accent', 'warm'])
    if (
      !Number.isInteger(value.palette?.[key]) ||
      value.palette[key] < 0 ||
      value.palette[key] > 0xffffff
    )
      throw new TypeError(`Invalid theme color: ${key}.`);
  if (
    !['linear', 'nearest'].includes(value.textureFilter) ||
    !['racer', 'pixel', 'utility'].includes(value.drone)
  )
    throw new TypeError('Unsupported theme presentation.');
  for (const slot of ['gate', 'marker', 'enemy', 'vehicle'])
    if (
      typeof value.assets?.[slot] !== 'string' ||
      value.assets[slot].length > 240 ||
      /^(https?:|data:|javascript:)/i.test(value.assets[slot])
    )
      throw new TypeError(`Missing or invalid theme asset slot: ${slot}.`);
  if (
    !/^#[a-f\d]{6}$/i.test(value.ui?.accent) ||
    !['system-ui', 'monospace'].includes(value.ui.font) ||
    !Number.isFinite(value.ui.borderRadius) ||
    value.ui.borderRadius < 0 ||
    value.ui.borderRadius > 24
  )
    throw new TypeError('Invalid theme UI profile.');
  return value;
}

/** Visual overrides never change rules, physical shape, sight lines or scoring. */
export function resolveThemeProfile(
  course = {},
  { profiles = THEME_PROFILES, campaign = null } = {},
) {
  const fallback = ['woodland', 'courtyard'].includes(course.environment)
    ? 'ukrainian'
    : ['warehouse', 'stadium'].includes(course.environment)
      ? 'pixel'
      : ['container-yard', 'garage'].includes(course.environment)
        ? 'operations'
        : 'academy';
  const all = [...THEME_PROFILES, ...profiles],
    find = (id) => all.findLast((p) => p.id === id);
  let value = copy(find('academy'));
  for (const layer of [campaign, course.world, course]) {
    const id = typeof layer?.theme === 'string' ? layer.theme : layer?.themeId;
    if (id) {
      const selected = find(id);
      if (!selected) throw new TypeError(`Missing theme profile: ${id}.`);
      value = merge(value, selected);
    }
    if (layer?.themeProfile) value = merge(value, layer.themeProfile);
  }
  if (
    !campaign?.theme &&
    !campaign?.themeId &&
    !course.world?.theme &&
    !course.theme &&
    !course.themeId &&
    !course.themeProfile
  )
    value = merge(value, find(fallback));
  return validateThemeProfile(value);
}

export function resolveThemeExperience({
  course,
  campaign = null,
  profiles = THEME_PROFILES,
  rulesets = WORLD_RULESETS,
} = {}) {
  const theme = resolveThemeProfile(course, { campaign, profiles });
  const id = course.rulesetId ?? campaign?.rulesetId ?? 'open-practice';
  const ruleset = [...WORLD_RULESETS, ...rulesets].findLast((r) => r.id === id);
  if (!ruleset) throw new TypeError(`Missing ruleset: ${id}.`);
  const rules = merge(ruleset.rules, course.rules),
    conditions = merge(ruleset.conditions, course.conditions);
  const compiled = {
    ...course,
    rules,
    conditions,
    world: { ...course.world, theme: theme.id, themeProfile: theme },
  };
  delete compiled.rulesetId;
  delete compiled.theme;
  delete compiled.themeId;
  delete compiled.themeProfile;
  return {
    theme,
    ruleset: copy(ruleset),
    course: compiled,
    compatibility: dataIdentity({
      ruleset: { id: ruleset.id, revision: ruleset.revision },
      rules,
      conditions,
    }),
  };
}

// Independent SIM selection intent and immutable per-attempt appearance.

export const SIM_APPEARANCE_KEY = 'revealline.fpv.appearance.v1';
const choices = ['follow-game', ...Object.keys(BUILTIN_SIM_VISUAL_COLLECTIONS)];
const oldKeys = [
  'revealline.fpv.world-settings.v1',
  'revealline.fpv.academy-sticks.v1',
  'revealline.fpv.academy-menu-sound.v1',
  'revealline.flight-profiles.v1',
];
const copyAppearance = (value) => structuredClone(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Cosmetic metadata is never admitted into Academy's course/proof identity. */
export function validateSimAppearance(input) {
  const value = boundedJSON(input, { maxBytes: 1024, maxNodes: 16, maxDepth: 2 });
  exactKeys(value, ['collectionId', 'revision', 'drone'], 'SIM appearance');
  required(stableId(value.collectionId), 'Invalid SIM appearance collection');
  required(
    typeof value.revision === 'string' && /^[a-zA-Z0-9._-]{1,64}$/.test(value.revision),
    'Invalid SIM appearance revision',
  );
  required(
    value.drone === undefined || ['racer', 'pixel', 'utility'].includes(value.drone),
    'Invalid SIM drone appearance',
  );
  return Object.freeze(value);
}

export function resolveSimAppearance({
  choice = 'authored',
  familyId = 'legacy',
  familyRevision,
  simCollection,
  drone,
} = {}) {
  const family = getThemeFamily(familyId, familyRevision);
  const binding = simCollection ?? family?.sim;
  const requested = choice === 'follow-game' ? (binding?.id ?? 'authored') : choice;
  const { collection, fallbackReason } = resolveSimVisualCollection({
    collectionId: requested,
    ...(choice === 'follow-game' && binding ? { revision: binding.revision } : {}),
  });
  return Object.freeze({
    requested,
    appearance: validateSimAppearance({
      collectionId: collection.id,
      revision: collection.revision,
      ...(drone ? { drone } : {}),
    }),
    fallbackReason,
  });
}

export function playableSimAppearance(input) {
  const value = validateSimAppearance(input);
  const { collection, fallbackReason } = resolveSimVisualCollection(value);
  return {
    appearance: !fallbackReason
      ? value
      : validateSimAppearance({
          collectionId: collection.id,
          revision: collection.revision,
          ...(value.drone ? { drone: value.drone } : {}),
        }),
    fallbackReason: fallbackReason ? 'collection-unavailable' : null,
  };
}

export function createSimAppearancePreferences({
  storage,
  window: win,
  onWarning = () => {},
} = {}) {
  let value;
  let absent = false;
  try {
    const saved = storage?.getItem(SIM_APPEARANCE_KEY);
    absent = saved === null || saved === undefined;
    if (saved) {
      if (saved.length > 1024) throw new Error('SIM preferences exceed the budget');
      const parsed = JSON.parse(saved);
      if (parsed.format !== 'SimAppearancePreferences.v1')
        throw new Error('Unsupported SIM preferences');
      for (const name of ['interface', 'world'])
        if (!choices.includes(parsed[name]) && !stableId(parsed[name]))
          throw new Error('Invalid SIM appearance choice');
      value = { format: parsed.format, interface: parsed.interface, world: parsed.world };
    }
  } catch (error) {
    onWarning(error);
  }
  if (!value) {
    let existing = false;
    try {
      existing = oldKeys.some(
        (key) => storage?.getItem(key) !== null && storage?.getItem(key) !== undefined,
      );
    } catch {
      /* A denied storage read never prevents a usable session. */
    }
    value = {
      format: 'SimAppearancePreferences.v1',
      interface: existing ? 'authored' : 'follow-game',
      world: existing ? 'authored' : 'follow-game',
    };
    // Commit the one-time default so settings saved later cannot reclassify a
    // new player as a pre-theme installation on their next visit.
    if (absent) {
      try {
        storage?.setItem(SIM_APPEARANCE_KEY, JSON.stringify(value));
      } catch (error) {
        onWarning(error);
      }
    }
  }
  const listeners = new Set();
  let pendingMigration = absent;
  const publish = (persist = true) => {
    try {
      if (persist) storage?.setItem(SIM_APPEARANCE_KEY, JSON.stringify(value));
    } catch (error) {
      onWarning(error);
    }
    for (const listener of listeners) listener(copyAppearance(value));
    return copyAppearance(value);
  };
  const receive = (event) => {
    if (event.key !== SIM_APPEARANCE_KEY || event.storageArea !== storage) return;
    try {
      const raw = storage?.getItem(SIM_APPEARANCE_KEY);
      if (typeof raw !== 'string' || raw.length > 1024 || event.newValue !== raw) return;
      const next = JSON.parse(raw);
      exactKeys(next, ['format', 'interface', 'world'], 'SIM preferences');
      if (next.format !== 'SimAppearancePreferences.v1') return;
      for (const name of ['interface', 'world'])
        if (!choices.includes(next[name]) && !stableId(next[name])) return;
      if (equal(value, next)) return;
      value = next;
      pendingMigration = false;
      publish(false);
    } catch {
      /* Malformed remote preferences never interrupt a running attempt. */
    }
  };
  win?.addEventListener?.('storage', receive);
  return Object.freeze({
    snapshot: () => copyAppearance(value),
    set(patch) {
      exactKeys(patch, ['interface', 'world'], 'SIM preference change');
      for (const choice of Object.values(patch))
        required(choices.includes(choice) || stableId(choice), 'Invalid SIM appearance choice');
      pendingMigration = false;
      value = { ...value, ...patch };
      return publish();
    },
    adoptExisting(hasSavedActivity) {
      if (!pendingMigration) return false;
      pendingMigration = false;
      if (!hasSavedActivity) return false;
      value = { ...value, interface: 'authored', world: 'authored' };
      publish();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      win?.removeEventListener?.('storage', receive);
      listeners.clear();
    },
  });
}

/** Selection remains mutable until the first successful arm. Pausing or
 * disarming never releases the appearance accepted for an attempt. */
export function createSimAppearanceSession() {
  let accepted = null,
    wanted = null,
    frozen = false;
  return Object.freeze({
    begin(appearance, { retained = false } = {}) {
      accepted = validateSimAppearance(appearance);
      wanted = accepted;
      frozen = retained;
      return copyAppearance(accepted);
    },
    select(appearance) {
      wanted = validateSimAppearance(appearance);
      if (frozen) return false;
      accepted = wanted;
      return true;
    },
    arm(status) {
      if (status === 'active') frozen = true;
      return frozen;
    },
    current: () => accepted && copyAppearance(accepted),
    pending: () => frozen && !equal(accepted, wanted),
    frozen: () => frozen,
  });
}

export function readAcademyRecording(input) {
  const value = boundedJSON(input, {
    maxBytes: 1024 * 1024 + 2048,
    maxNodes: 220100,
    maxArray: 36000,
    maxDepth: 10,
  });
  if (value.format !== 'FlightRecording.v1') return { proof: value, presentation: null };
  exactKeys(value, ['format', 'proof', 'presentation'], 'Academy recording');
  required(value.proof?.format === 'FlightAttempt.v1', 'Academy recording requires a flight proof');
  return { proof: value.proof, presentation: validateSimAppearance(value.presentation) };
}

export function academyRecording(proof, presentation) {
  return presentation
    ? {
        format: 'FlightRecording.v1',
        proof: copyAppearance(proof),
        presentation: copyAppearance(validateSimAppearance(presentation)),
      }
    : copyAppearance(proof);
}
