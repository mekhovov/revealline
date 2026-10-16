import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedEnemyArtwork } from '../hunt/preferences.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  installSimThemeHost,
  mountSimAppearanceControls,
  simAppearanceDefaultFromURL,
} from '../../optional-practice/civilian-fpv/sim-presentation.mjs';
import {
  BUILTIN_THEME_FAMILIES,
  BUILTIN_SIM_VISUAL_COLLECTIONS,
  DEFAULT_THEME_PREFERENCES,
  THEME_PREFERENCES_KEY,
} from '../presentation/theme-system.mjs';
import {
  SIM_APPEARANCE_KEY,
  createSimAppearanceSession,
  resolveSimAppearance,
  snapshotSimThemeProfile,
  recordedSimAppearance,
  resolveSimThemeProfile,
  academyRecording,
  readAcademyRecording,
} from '../../optional-practice/civilian-fpv/world-themes.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';

function fixture(values = {}) {
  const document = new Document(),
    window = new Events(),
    data = new Map(Object.entries(values));
  Object.assign(window, {
    location: new URL(
      'https://example.test/optional-practice/fpv-worlds/index.html?appearanceFamily=tryzub&appearanceRevision=r1',
    ),
    localStorage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    },
    matchMedia: () => ({ matches: false }),
  });
  return { document, window, data };
}

test('SIM admits only a bounded complete cosmetic context pair from optional launcher URLs', () => {
  const base = 'https://example.test/sim?';
  assert.deepEqual(
    simAppearanceDefaultFromURL(base + 'appearanceFamily=tryzub&appearanceRevision=r1'),
    { familyId: 'tryzub', revision: 'r1' },
  );
  assert.deepEqual(
    simAppearanceDefaultFromURL(base + 'appearanceFamily=future-family&appearanceRevision=r8'),
    { familyId: 'future-family', revision: 'r8' },
  );
  for (const query of [
    'appearanceFamily=tryzub',
    'appearanceRevision=r1',
    'appearanceFamily=tryzub&appearanceRevision=bad',
    'appearanceFamily=tryzub&appearanceRevision=r1&appearanceRevision=r2',
    'appearanceFamily=__proto__&appearanceRevision=r1',
  ])
    assert.equal(simAppearanceDefaultFromURL(base + query), null);
});

test('SIM follows context or personal family, preserves independent overrides, and complete apply resets them', () => {
  const f = fixture(),
    received = [];
  const controls = mountSimAppearanceControls({
    ...f,
    container: f.document.body,
    onChange: (a) => received.push(a),
  });
  assert.equal(controls.resolve().appearance.collectionId, 'tryzub');
  const select = f.document.getElementById('sim-appearance-world');
  assert.equal(
    select.children.length,
    Object.keys(BUILTIN_SIM_VISUAL_COLLECTIONS).length + 1,
    'follow plus every installed collection, including authored',
  );
  controls.preferences.set({ interface: 'dos', world: 'vyshyvanka' });
  assert.equal(controls.resolve().appearance.collectionId, 'vyshyvanka');
  assert.equal(f.document.documentElement.dataset.interfaceTheme, 'dos');
  f.data.set(
    THEME_PREFERENCES_KEY,
    JSON.stringify({ ...DEFAULT_THEME_PREFERENCES, familyId: 'orchard-workshop' }),
  );
  f.window.emit('storage', {
    key: THEME_PREFERENCES_KEY,
    newValue: f.data.get(THEME_PREFERENCES_KEY),
    storageArea: f.window.localStorage,
  });
  assert.equal(
    controls.resolve().appearance.collectionId,
    'vyshyvanka',
    'independent SIM choice remains selected',
  );
  f.window.emit('revealline:complete-theme');
  assert.equal(controls.resolve().appearance.collectionId, 'orchard-workshop');
  assert.equal(f.document.documentElement.dataset.interfaceTheme, 'orchard-workshop');
  assert.ok(received.some((a) => a.collectionId === 'orchard-workshop'));
  controls.dispose();
  assert.equal(f.window.listeners.get('revealline:complete-theme').size, 0);
});

test('injected context precedes launcher pin and unavailable revisions remain visible in host diagnostics', () => {
  const f = fixture(),
    host = installSimThemeHost({
      ...f,
      getStorage: () => f.window.localStorage,
      getAppearanceDefault: () => ({ familyId: 'neon-ruins', revision: 'r99' }),
    });
  host.refresh();
  assert.equal(host.snapshot().familySelection.requested.familyId, 'neon-ruins');
  assert.match(host.snapshot().familySelection.fallbackReason, /neon-ruins@r99/);
  assert.equal(host.snapshot().familySelection.family.id, 'industrial-workshop');
  host.dispose();
});

test('all production family collection pins round-trip through World and Academy presentation metadata', () => {
  const course = FLIGHT_COURSES[0],
    before = JSON.stringify(course);
  for (const family of BUILTIN_THEME_FAMILIES.filter((f) => f.id !== 'legacy')) {
    const appearance = resolveSimAppearance({
      choice: 'follow-game',
      familyId: family.id,
    }).appearance;
    assert.equal(appearance.collectionId, family.sim.id);
    const pinned = snapshotSimThemeProfile(course, appearance),
      saved = { ...course, themeProfile: pinned };
    assert.equal(recordedSimAppearance(saved).collectionId, family.id);
    assert.equal(resolveSimThemeProfile(saved).id, family.id);
    const wrapped = academyRecording(
      { format: 'FlightAttempt.v1', session: 'practice' },
      appearance,
    );
    assert.deepEqual(readAcademyRecording(wrapped).presentation, appearance);
    const missing = structuredClone(saved);
    missing.themeProfile.revision = 'r99';
    assert.equal(resolveSimThemeProfile(missing).id, pinned.authoredFallback.id);
    assert.equal(missing.themeProfile.revision, 'r99');
  }
  assert.equal(JSON.stringify(course), before);
});

test('complete apply from another tab updates SIM intent while preserving the armed appearance', () => {
  const f = fixture(),
    session = createSimAppearanceSession();
  session.begin({ collectionId: 'dos', revision: 'r1' });
  session.arm('active');
  const controls = mountSimAppearanceControls({
    ...f,
    container: f.document.body,
    onChange: (a) => session.select(a),
    accepted: () => session.current(),
    pending: () => session.pending(),
  });
  controls.preferences.set({ interface: 'dos', world: 'dos' });
  f.data.set(
    SIM_APPEARANCE_KEY,
    JSON.stringify({
      format: 'SimAppearancePreferences.v1',
      interface: 'follow-game',
      world: 'follow-game',
    }),
  );
  f.window.emit('storage', {
    key: SIM_APPEARANCE_KEY,
    newValue: f.data.get(SIM_APPEARANCE_KEY),
    storageArea: f.window.localStorage,
  });
  assert.equal(controls.resolve().appearance.collectionId, 'tryzub');
  assert.equal(session.current().collectionId, 'dos');
  assert.equal(session.pending(), true);
  controls.dispose();
  assert.equal(f.window.listeners.get('storage').size, 0);
});

test('SIM offers fixed Classic Field Kit separately from Authored without changing the selected world', () => {
  const f = fixture(),
    received = [];
  const controls = mountSimAppearanceControls({
    ...f,
    container: f.document.body,
    onChange: (appearance) => received.push(appearance),
  });
  const input = f.document.getElementById('sim-appearance-interface');
  const world = f.document.getElementById('sim-appearance-world');
  assert.deepEqual(
    Array.from(input.children, (option) => option.value),
    ['follow-game', 'authored', ...BUILTIN_THEME_FAMILIES.map((family) => family.id)],
  );
  assert.equal(
    Array.from(world.children).some((option) => option.value === 'legacy'),
    false,
    'Classic has no world collection and must not be advertised as one.',
  );
  const original = controls.resolve().appearance;
  const changes = received.length;
  input.focus();
  input.value = 'legacy';
  input.emit('change');
  assert.equal(controls.preferences.snapshot().interface, 'legacy');
  assert.equal(f.document.documentElement.dataset.interfaceTheme, 'legacy');
  assert.equal(f.document.documentElement.dataset.themeStyled, 'true');
  assert.equal(f.document.activeElement, input);
  input.value = 'authored';
  input.emit('change');
  assert.equal(
    f.document.documentElement.dataset.themeStyled,
    'false',
    'Authored retains the pinned r1 adapter.',
  );
  input.value = 'follow-game';
  input.emit('change');
  assert.equal(f.document.documentElement.dataset.interfaceTheme, 'tryzub');
  assert.deepEqual(controls.resolve().appearance, original);
  assert.equal(
    received.length,
    changes,
    'Interface-only changes do not request a new world or release the armed appearance.',
  );
  controls.dispose();
});

test('SIM notifies pre-Arm artwork changes even when the world profile is unchanged and disposes that subscription', () => {
  const f = fixture(),
    artwork = sharedEnemyArtwork(),
    original = artwork.snapshot().style,
    received = [];
  artwork.set({ style: 'authored' });
  const controls = mountSimAppearanceControls({
    ...f,
    container: f.document.body,
    onChange: (appearance) => received.push(appearance),
  });
  try {
    const current = controls.resolve().appearance;
    received.length = 0;
    artwork.set({ style: 'military' });
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], current);
    controls.dispose();
    artwork.set({ style: 'authored' });
    assert.equal(received.length, 1, 'Disposed flight controls must not rebuild a scene.');
  } finally {
    artwork.set({ style: original });
  }
});
