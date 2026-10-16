import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { collectBuildFiles, readBuildConfig } from '../../scripts/game-cli.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../../publishing/optional-package-policy.mjs';
import {
  prepareNativeIndustrialAttempt,
  restoreNativeIndustrialCourse,
  detachNativeIndustrialCourse,
  assertNativeIndustrialEdit,
} from '../../optional-practice/civilian-fpv/industrial-environment.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { NATIVE_PURSUIT_PLAYLIST } from '../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import { SNAKE_HUNT_EXPRESSIVE_IDENTITY } from '../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';
import {
  validateThemeProfile,
  snapshotSimThemeProfile,
  recordedSimAppearance,
  resolveThemeExperience,
} from '../../optional-practice/civilian-fpv/world-themes.mjs';
import {
  validateWorldCourse,
  initWorldRuntime,
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  worldStateIdentity,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  splitCourseDefinition,
  compileChallengeDefinition,
  compileContentProject,
} from '../../optional-practice/civilian-fpv/content-definitions.mjs';
import { preparePack, inspectPack } from '../../optional-practice/civilian-fpv/world-content.mjs';
import {
  exportEditableZip,
  importEditableZip,
} from '../../optional-practice/civilian-fpv/world-zip.mjs';
import { resolveIndustrialEnvironment } from '../presentation/industrial-environments.mjs';
import { industrialMaterialPixels } from '../presentation/industrial-materials.mjs';
import { createWorkshopTexture } from '../../optional-practice/civilian-fpv/world-visuals.mjs';

const presentation = { collectionId: 'military-field', revision: 'r1', drone: 'racer' };
const artRevision = 'industrial-roster-v3';
const nativeRefs = new Set(
  NATIVE_PURSUIT_PLAYLIST.entries.map((r) => `${r.packIdentity}:${r.levelId}`),
);
const sources = WORLD_CATALOGUE.filter(
  (e) =>
    e.packIdentity === SNAKE_HUNT_EXPRESSIVE_IDENTITY ||
    nativeRefs.has(`${e.packIdentity}:${e.id}`),
);
const runner = sources.find((e) => e.id === 'native-pursuit-runner-court');
const prepare = (entry = runner, mode = 'self-level', extra = {}) =>
  prepareNativeIndustrialAttempt({ entry, mode, presentation, artRevision, ...extra });
const project = (courses) => ({
  format: 'FPVWorldProject.v1',
  id: 'retained-industrial',
  title: 'Retained official attempts',
  world: { id: courses[0].world.id },
  courses,
  themes: [],
  campaigns: [],
  playlists: [],
});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('all 18 exact current courses admit both native modes without changing their gameplay', async () => {
  assert.equal(sources.length, 18);
  const sourcePins = new Set();
  for (const entry of sources)
    for (const mode of ['self-level', 'acro']) {
      const before = structuredClone(entry),
        accepted = await prepare(entry, mode);
      assert.ok(accepted, `${entry.id}/${mode}`);
      assert.equal(accepted.course.world.themeProfile.format, 'ThemeProfile.v3');
      assert.equal(accepted.artRevision, artRevision);
      assert.equal(resolveIndustrialEnvironment(accepted.pin).collection.id, 'military-field');
      sourcePins.add(accepted.pin.sourceKey);
      assert.deepEqual(entry, before);
      const bare = validateWorldCourse(entry.course),
        retained = structuredClone(accepted.course);
      retained.world = bare.world;
      assert.deepEqual(retained, bare, 'only the accepted presentation changes');
      const restored = await restoreNativeIndustrialCourse(
        JSON.parse(JSON.stringify(accepted.course)),
        { mode },
      );
      assert.deepEqual(restored.course, accepted.course);
      assert.equal(restored.mode, mode);
      assert.notEqual(restored.pin, accepted.pin, 'restore issues fresh renderer authority');
    }
  assert.equal(sourcePins.size, 36, 'each native mode owns its accepted source identity');
});

test('new admission requires exact source, native owner, current revision and explicit appearance', async () => {
  for (const extra of [
    { artRevision: null },
    { presentation: { collectionId: 'authored', revision: 'r1' } },
    { presentation: { collectionId: 'military-field', revision: 'r2' } },
    { retained: true },
  ])
    assert.equal(await prepare(runner, 'self-level', extra), null);
  for (const change of [
    (e) => (e.packIdentity = 'copied-package'),
    (e) => (e.projectId = 'creator'),
    (e) => (e.course.locales.en.title += ' edited'),
    (e) => (e.course.obstacles[0].min.x += 1),
  ]) {
    const entry = structuredClone(runner);
    change(entry);
    assert.equal(await prepare(entry), null, 'a familiar ID is insufficient');
  }
  const historical = WORLD_CATALOGUE.find(
    (e) => e.id === 'native-pursuit-refuge-return' && !nativeRefs.has(`${e.packIdentity}:${e.id}`),
  );
  assert.ok(historical, 'the historical r1 refuge source remains in the retained catalogue');
  assert.equal(await prepare(historical), null);
  assert.equal(await prepare(runner, 'unsupported'), null);
});

test('v3 structural pins do not grant rendering authority, and retained complete sources reject tampering', async () => {
  const accepted = await prepare();
  assert.throws(
    () => resolveIndustrialEnvironment(accepted.course.world.themeProfile.industrialEnvironment),
    /accepted or restored/,
  );
  const profile = validateThemeProfile(accepted.course.world.themeProfile);
  assert.throws(
    () => resolveIndustrialEnvironment(profile.industrialEnvironment),
    /accepted or restored/,
  );
  for (const change of [
    (c) => (c.spawn.x += 1),
    (c) => (c.locales.uk.title += ' changed'),
    (c) => (c.world.themeProfile.palette.ground ^= 1),
    (c) => (c.world.themeProfile.assets.enemy = 'models/custom.glb'),
    (c) => (c.world.themeProfile.authoredFallback.palette.ground ^= 1),
    (c) => (c.world.themeProfile.artRevision = 'industrial-sample-v1'),
    (c) => (c.world.themeProfile.industrialEnvironment.contentSha256 = '0'.repeat(64)),
  ]) {
    const modified = structuredClone(accepted.course);
    change(modified);
    await assert.rejects(restoreNativeIndustrialCourse(modified), TypeError);
  }
  await assert.rejects(
    restoreNativeIndustrialCourse(accepted.course, { mode: 'acro' }),
    /does not match/,
  );
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(prepare(runner, 'self-level', { signal: aborted.signal }), {
    name: 'AbortError',
  });
});

test('Retry and restore retain art, drone and mode independently of current preferences', async () => {
  const first = await prepare(runner, 'acro');
  const retry = await prepare({ ...runner, course: first.course }, 'acro', {
    artRevision: null,
    presentation: { collectionId: 'authored', revision: 'r1', drone: 'utility' },
    retained: true,
  });
  assert.deepEqual(retry.course, first.course);
  assert.equal(retry.artRevision, artRevision);
  assert.equal(retry.course.world.themeProfile.drone, 'racer');
  assert.deepEqual(recordedSimAppearance(retry.course), presentation);
  assert.equal((await restoreNativeIndustrialCourse(first.course)).mode, 'acro');
});

test('historical v1/v2 presentation remains intact; explicit detach enables creator edits', async () => {
  const raw = validateWorldCourse(runner.course);
  const old = snapshotSimThemeProfile(raw, presentation);
  assert.equal(old.format, 'ThemeProfile.v2');
  const legacy = { ...raw, world: { ...raw.world, theme: old.id, themeProfile: old } };
  assert.equal(await restoreNativeIndustrialCourse(legacy), null);
  assert.equal(
    await prepare({ ...runner, course: legacy }, 'self-level', { retained: true }),
    null,
  );
  assert.deepEqual(validateThemeProfile(old), old);
  const accepted = await prepare();
  const changed = structuredClone(accepted.course);
  changed.spawn.x += 1;
  assert.throws(
    () => assertNativeIndustrialEdit(accepted.course, changed),
    /Choose a creator theme/,
  );
  assert.doesNotThrow(() =>
    assertNativeIndustrialEdit(accepted.course, structuredClone(accepted.course)),
  );
  const detached = detachNativeIndustrialCourse(accepted.course);
  assert.equal(detached.world.themeProfile.format, 'ThemeProfile.v2');
  assert.equal(detached.world.themeProfile.industrialEnvironment, undefined);
  assert.equal(detached.world.themeProfile.artRevision, undefined);
  assert.deepEqual(
    detached.world.themeProfile.authoredFallback,
    accepted.course.world.themeProfile.authoredFallback,
  );
  assert.doesNotThrow(() =>
    assertNativeIndustrialEdit(accepted.course, detached, { detach: true }),
  );
  detached.spawn.x += 1;
  assert.equal(await restoreNativeIndustrialCourse(detached), null);
  assert.throws(() => assertNativeIndustrialEdit(detached, accepted.course), /Import and validate/);
});

test('industrial snapshots retain native replay identity and reproduce real consumed flight input', async () => {
  await initWorldRuntime();
  const accepted = await prepare(),
    a = createWorldFlight({ course: runner.course }),
    b = createWorldFlight({ course: accepted.course });
  try {
    assert.deepEqual(a.identity, b.identity);
    a.arm();
    b.arm();
    const recorder = createWorldRecorder(b);
    for (let i = 0; i < 40; i++) {
      const command = { throttle: 0.53, yaw: 0.1, pitch: 0.05, roll: 0 };
      a.step(command);
      b.step(command);
      recorder.record();
    }
    assert.deepEqual(a.snapshot(), b.snapshot());
    const proof = recorder.export(),
      restored = await replayWorldFlight(accepted.course, proof);
    assert.equal(worldStateIdentity(restored.state), proof.finalStateIdentity);
  } finally {
    a.dispose();
    b.dispose();
  }
});

test('course definitions keep retained presentation per challenge and preserve legacy round-trips', async () => {
  const accepted = await prepare(),
    split = splitCourseDefinition(accepted.course);
  assert.equal(split.world.presentation.themeProfile, undefined);
  assert.deepEqual(split.challenge.recordedThemeProfile, accepted.course.world.themeProfile);
  const compiled = compileChallengeDefinition(split).course;
  assert.deepEqual(compiled, accepted.course);
  await restoreNativeIndustrialCourse(compiled);
  const legacy = validateWorldCourse(runner.course),
    old = splitCourseDefinition(legacy);
  assert.equal(old.challenge.recordedThemeProfile, undefined);
  assert.deepEqual(
    compileChallengeDefinition(old).course,
    validateWorldCourse(resolveThemeExperience({ course: legacy }).course),
  );
  const second = structuredClone(split.challenge);
  second.id = 'creator-neighbor';
  delete second.recordedThemeProfile;
  const definitions = {
    worlds: [split.world],
    layouts: [split.layout],
    challenges: [split.challenge, second],
  };
  const rows = compileContentProject(definitions).map((r) => r.course);
  assert.equal(rows[0].world.themeProfile.format, 'ThemeProfile.v3');
  assert.notEqual(
    rows[1].world.themeProfile.format,
    'ThemeProfile.v3',
    'a shared World does not spread an official pin',
  );
});

test('rlpack and editable ZIP authenticate exact official snapshots before adoption or export', async () => {
  const accepted = await prepare(),
    source = project([accepted.course]);
  const pack = await preparePack(source),
    read = await inspectPack(pack);
  assert.deepEqual(read.project.courses, [accepted.course]);
  const zip = await exportEditableZip(source),
    roundtrip = await importEditableZip(zip);
  assert.deepEqual(roundtrip.project.courses, [accepted.course]);
  const bad = structuredClone(source);
  bad.courses[0].spawn.x += 1;
  await assert.rejects(preparePack(bad), /no longer matches/);
  await assert.rejects(exportEditableZip(bad), /no longer matches/);
  const bytes = new Uint8Array(await pack.arrayBuffer()),
    size = new DataView(bytes.buffer).getUint32(8, true);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + size)));
  manifest.project.courses[0].locales.en.title = 'Changed title';
  const json = new TextEncoder().encode(JSON.stringify(manifest)),
    header = bytes.slice(0, 12);
  new DataView(header.buffer).setUint32(8, json.length, true);
  await assert.rejects(
    inspectPack(new Blob([header, json, bytes.subarray(12 + size)])),
    /no longer matches/,
  );
});

test('chapter variants map only procedural material pixels while historical samples remain exact', async () => {
  const accepted = await prepare(),
    binding = resolveIndustrialEnvironment(accepted.pin);
  for (const role of ['concrete', 'steel', 'grass', 'timber']) {
    const options = { collectionId: 'military-field', reviewRevision: artRevision },
      ordinary = createWorkshopTexture(role, options);
    const texture = createWorkshopTexture(role, { ...options, industrialEnvironment: binding });
    try {
      const recipe = binding.sim[role];
      assert.equal(
        digest(texture.image.data),
        digest(
          industrialMaterialPixels({ width: 128, height: 128 }, recipe.material, {
            revision: binding.materialRevision,
            variant: recipe.variant,
          }).rgba,
        ),
      );
      assert.equal(texture.userData.materialRole, role);
      assert.equal(texture.userData.industrialEnvironment.id, binding.id);
      const again = createWorkshopTexture(role, options);
      assert.deepEqual(again.image.data, ordinary.image.data);
      again.dispose();
    } finally {
      ordinary.dispose();
      texture.dispose();
    }
  }
  assert.throws(
    () =>
      createWorkshopTexture('concrete', {
        collectionId: 'industrial-workshop',
        reviewRevision: artRevision,
        industrialEnvironment: binding,
      }),
    /differs/,
  );
});

// The main distribution and standalone optional archives have separate explicit
// allowlists. An admitted optional package must also be complete when bundled.
test('main distribution supplies both bundled native optional runtime source closures', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const files = new Set(await collectBuildFiles(root, await readBuildConfig(root)));
  for (const id of ['civilian-fpv', 'fpv-worlds']) {
    const policy = OPTIONAL_PACKAGE_POLICIES[id];
    for (const name of [
      ...policy.localFiles.map((file) => policy.root + file),
      ...policy.sharedFiles,
    ])
      assert.ok(files.has(name), `${id} is incomplete in the main distribution: ${name}`);
  }
});
