import { canonicalJSON } from '../../game/data-json.mjs';
import {
  prepareIndustrialEnvironmentSource,
  acceptIndustrialEnvironment,
  restoreIndustrialEnvironment,
  resolveIndustrialEnvironment,
} from '../../game/presentation/industrial-environments.mjs';
import {
  NATIVE_PURSUIT_CATALOGUE,
  NATIVE_PURSUIT_V2_CATALOGUE,
  NATIVE_PURSUIT_PLAYLIST,
} from './native-pursuit-courses.mjs';
import { SNAKE_HUNT_CATALOGUE, SNAKE_HUNT_EXPRESSIVE_IDENTITY } from './snake-hunt-catalogue.mjs';
import { validateWorldCourse } from './world-model.mjs';
import { snapshotSimThemeProfile, validateThemeProfile } from './world-themes.mjs';

const modes = ['self-level', 'acro'];
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const native = [...NATIVE_PURSUIT_V2_CATALOGUE, ...NATIVE_PURSUIT_CATALOGUE];
// Retain old native sources independently of the current playlist. Registry
// membership still decides whether any one source ever owned an environment.
const retainedSources = freeze(
  [
    ...SNAKE_HUNT_CATALOGUE.filter(
      (entry) => entry.packIdentity === SNAKE_HUNT_EXPRESSIVE_IDENTITY,
    ),
    ...native,
  ].map((entry) => ({
    id: entry.id,
    packIdentity: entry.packIdentity,
    course: validateWorldCourse(entry.course),
  })),
);
const currentNative = new Set(
  NATIVE_PURSUIT_PLAYLIST.entries.map((entry) => `${entry.packIdentity}:${entry.levelId}`),
);
const sources = retainedSources.filter(
  (entry) =>
    entry.packIdentity === SNAKE_HUNT_EXPRESSIVE_IDENTITY ||
    currentNative.has(`${entry.packIdentity}:${entry.id}`),
);
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const origin = (entry) => ({
  kind: 'builtin',
  catalogueId: entry.packIdentity,
  catalogueRevision: '1',
  sourceForm: 'validated-native-v1',
});
const candidate = (entry, mode, signal) =>
  prepareIndustrialEnvironmentSource({
    engine: 'sim',
    mode,
    source: validateWorldCourse(entry.course),
    origin: origin(entry),
    signal,
  });

function prepared(source, pin, drone) {
  const binding = resolveIndustrialEnvironment(pin);
  const profile = snapshotSimThemeProfile(source, {
    collectionId: binding.collection.id,
    revision: binding.collection.revision,
  });
  const themeProfile = validateThemeProfile({
    ...profile,
    ...(drone ? { drone } : {}),
    format: 'ThemeProfile.v3',
    artRevision: binding.artRevision,
    industrialEnvironment: pin,
  });
  return validateWorldCourse({
    ...source,
    world: { ...source.world, theme: themeProfile.id, themeProfile },
  });
}

/** Only exact code-owned catalogue sources can opt into a new official overlay. */
export async function prepareNativeIndustrialAttempt({
  entry,
  mode,
  presentation,
  artRevision,
  retained = false,
  signal,
}) {
  signal?.throwIfAborted();
  if (entry.legacy) return null;
  const course = validateWorldCourse(entry.course);
  if (course.world.themeProfile?.format === 'ThemeProfile.v3')
    return restoreNativeIndustrialCourse(course, { mode, signal });
  if (
    retained ||
    entry.projectId ||
    !modes.includes(mode) ||
    artRevision !== 'industrial-roster-v3' ||
    presentation?.collectionId !== 'military-field' ||
    presentation.revision !== 'r1'
  )
    return null;
  const trusted = sources.find(
    (item) =>
      item.id === entry.id &&
      item.packIdentity === entry.packIdentity &&
      item.course.revision === course.revision &&
      same(validateWorldCourse(item.course), course),
  );
  if (!trusted) return null;
  const accepted = acceptIndustrialEnvironment(await candidate(trusted, mode, signal), {
    collection: { id: presentation.collectionId, revision: presentation.revision },
    artRevision,
  });
  signal?.throwIfAborted();
  if (!accepted) return null;
  const source = validateWorldCourse(trusted.course);
  return freeze({
    course: prepared(source, accepted, presentation.drone),
    sourceCourse: source,
    mode,
    pin: accepted,
    artRevision: resolveIndustrialEnvironment(accepted).artRevision,
  });
}

/** Gameplay proof deliberately excludes presentation. Authenticate the WHOLE
 * retained snapshot separately, never by stripping allegedly cosmetic fields. */
export async function restoreNativeIndustrialCourse(input, { mode, signal } = {}) {
  signal?.throwIfAborted();
  const course = validateWorldCourse(input),
    profile = course.world.themeProfile;
  if (profile?.format !== 'ThemeProfile.v3') return null;
  const possible = retainedSources.filter(
    (entry) => entry.id === course.id && entry.course.revision === course.revision,
  );
  if (!possible.length) throw new TypeError('Retained industrial course source is unavailable.');
  let failure;
  for (const trusted of possible)
    for (const acceptedMode of mode === undefined ? modes : [mode]) {
      if (!modes.includes(acceptedMode)) throw new TypeError('Unsupported industrial flight mode.');
      let pin;
      try {
        pin = restoreIndustrialEnvironment(
          profile.industrialEnvironment,
          await candidate(trusted, acceptedMode, signal),
        );
      } catch (error) {
        signal?.throwIfAborted();
        failure = error;
        continue;
      }
      signal?.throwIfAborted();
      const source = validateWorldCourse(trusted.course),
        expected = prepared(source, pin, profile.drone);
      if (!same(course, expected))
        throw new TypeError(
          'Industrial presentation no longer matches its complete retained course. Choose a creator theme or create a copy before editing.',
        );
      return freeze({
        course,
        sourceCourse: source,
        mode: acceptedMode,
        pin,
        artRevision: profile.artRevision,
      });
    }
  throw failure;
}

/** Explicit authoring action: preserve the selected base appearance, while
 * releasing the official course-specific overlay before changing its identity. */
export function detachNativeIndustrialCourse(input) {
  const course = validateWorldCourse(input),
    profile = course.world.themeProfile;
  if (profile?.format !== 'ThemeProfile.v3') return course;
  const base = { ...profile };
  delete base.industrialEnvironment;
  delete base.artRevision;
  course.world.themeProfile = validateThemeProfile({ ...base, format: 'ThemeProfile.v2' });
  return course;
}

export async function validateNativeIndustrialCourses(courses, { signal } = {}) {
  for (const course of courses) {
    signal?.throwIfAborted();
    if (course.world?.themeProfile?.format === 'ThemeProfile.v3')
      await restoreNativeIndustrialCourse(course, { signal });
  }
}

/** Synchronous edit guard after one source-authenticated draft was adopted. */
export function assertNativeIndustrialEdit(before, after, { detach = false } = {}) {
  const previous = before.world?.themeProfile,
    next = after.world?.themeProfile;
  if (previous?.format === 'ThemeProfile.v3' && !same(before, after)) {
    if (!detach || next?.format === 'ThemeProfile.v3')
      throw new TypeError(
        'This appearance is pinned to an official course. Choose a creator theme or create a copy before editing.',
      );
  } else if (next?.format === 'ThemeProfile.v3' && !same(before, after))
    throw new TypeError(
      'Import and validate the complete retained course before using its official appearance.',
    );
}
