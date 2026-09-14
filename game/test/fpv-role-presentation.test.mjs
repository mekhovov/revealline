import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCharacterPresentations } from '../character-presentations.mjs';
import { recommendedBody } from '../content.mjs';
import { emptyProgress, unlockedBodies, newAppearanceBodies } from '../progress.mjs';
import { emptyLibrary, updatePreferences, exportLibrary, importLibrary } from '../library.mjs';
import { playerPaintSize, BoardPainter } from '../ui/render.mjs';
import {
  createAnimationState,
  advanceAnimation,
  rotorAnchors,
} from '../../authoring/motion-lab/animation.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const presets = await json('../../authoring/motion-lab/presets.json');
const source = await json('../../authoring/library/fpv-role-presentations/presentations.json');
const themes = (await json('../content/themes.json')).themes;
const campaign = await json('../content/campaign.json');
const config = await json('../build-config.json');
const set = presets.characterPresentations.sets[0];
const fpv = themes.find((theme) => theme.id === 'fpv');
const current = () => createCharacterPresentations(presets);

test('seven independent current bodies preserve exact originals, authored rigs and finite build paths', async () => {
  assert.equal(source.roles.length, 7);
  assert.equal(new Set(Object.values(set.classBodies)).size, 7);
  let total = 0;
  for (const role of source.roles) {
    const id = set.classBodies[role.classId],
      body = presets.characters[id];
    const expectedPath = `authoring/library/fpv-role-presentations/${role.body.src}`;
    assert.equal(body.originalSha256, role.sha256);
    assert.equal(body.src, `../library/fpv-role-presentations/${role.body.src}`);
    for (const key of Object.keys(role.body).filter((key) => key !== 'src'))
      assert.deepEqual(body[key], role.body[key], `${id}.${key}`);
    assert.deepEqual(presets.animationRecipes[body.animationRecipe], role.recipe);
    assert.equal(config.include.filter((path) => path === expectedPath).length, 1);
    assert.equal(config.include.includes('authoring/library/fpv-role-presentations'), false);
    const bytes = await readFile(new URL(`../../${expectedPath}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), role.sha256);
    assert.ok(bytes.length < 4 * 1024 * 1024);
    total += bytes.length;
  }
  assert.equal(total, 5772788);
});

test('only the complete canonical FPV map receives current recommendations; caller data stays owned', () => {
  const input = structuredClone(presets),
    adapter = createCharacterPresentations(input);
  input.characterPresentations.sets[0].classBodies.scout = 'fpv-body';
  for (const [classId, id] of Object.entries(set.classBodies)) {
    assert.equal(adapter.recommendedBody(fpv, classId), id);
    assert.equal(recommendedBody(fpv, classId), set.matchClassBodies[classId]);
  }
  for (const changed of [
    { ...fpv, id: 'custom' },
    { ...fpv, family: 'custom' },
    { ...fpv, player: 'neutral-marker' },
    { ...fpv, classBodies: { ...fpv.classBodies, carrier: 'heavy-custom' } },
    { ...fpv, classBodies: { scout: 'scout-quad' } },
  ])
    assert.equal(adapter.recommendedBody(changed, 'scout'), recommendedBody(changed, 'scout'));
  assert.equal(adapter.recommendedBody(fpv, 'unknown-class'), fpv.player);
  for (const theme of themes.filter(
    (theme) => !presets.characterPresentations.sets.some((entry) => entry.themeId === theme.id),
  ))
    for (const role of source.roles)
      assert.equal(
        adapter.recommendedBody(theme, role.classId),
        recommendedBody(theme, role.classId),
      );
  const original = structuredClone(presets);
  delete original.characterPresentations;
  assert.equal(createCharacterPresentations(original).recommendedBody(fpv, 'scout'), 'scout-quad');
});

test('current starter availability neither mutates nor grants historical progress rewards', () => {
  const progress = emptyProgress(campaign),
    before = structuredClone(progress);
  const earned = unlockedBodies(progress, campaign),
    saved = [...earned];
  const available = current().availableBodies(earned);
  assert.deepEqual([...earned], saved);
  assert.deepEqual(progress, before);
  assert.deepEqual(
    [...available],
    [...saved, ...presets.characterPresentations.sets.flatMap((entry) => entry.starterBodies)],
  );
  for (const id of ['fpv-racer', 'fixedwing-body', 'fpv-night', 'delta-interceptor'])
    assert.equal(available.has(id), false);
  assert.deepEqual(newAppearanceBodies(progress, before, campaign), []);
  const legitimate = new Set([...earned, 'fpv-night']);
  assert.equal(current().availableBodies(legitimate).has('fpv-night'), true);
  assert.throws(() => current().availableBodies([]));
});

test('catalog refuses ambiguous, unregistered, unsupported and non-data presentation declarations', () => {
  const mutations = [
    (p) => {
      p.characterPresentations.extra = true;
    },
    (p) => {
      p.characterPresentations.sets.push(structuredClone(set));
    },
    (p) => {
      p.characterPresentations.sets[0].classBodies.scout = 'missing';
    },
    (p) => {
      p.characterPresentations.sets[0].starterBodies.pop();
    },
    (p) => {
      p.characters[set.classBodies.scout].originalSha256 = [source.roles[0].sha256];
    },
    (p) => {
      p.characters[set.classBodies.scout].compactMinimumCSSPixels = 24;
    },
    (p) => {
      p.characters[set.classBodies.scout].rotors[0].frame = 1;
    },
    (p) => {
      p.animationRecipes[p.characters[set.classBodies.scout].animationRecipe].components[0].atlas =
        [];
    },
    (p) => {
      p.animationRecipes[p.characters[set.classBodies.scout].animationRecipe].components[0].radius =
        Infinity;
    },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(presets);
    mutate(candidate);
    assert.throws(() => createCharacterPresentations(candidate));
  }
  let calls = 0;
  const accessor = {
    get player() {
      calls++;
      return 'fpv-body';
    },
  };
  assert.throws(() => current().recommendedBody(accessor, 'scout'));
  assert.equal(calls, 0);
});

test('manual old and new body identities survive the unchanged library format', () => {
  for (const bodyId of [
    'fpv-body',
    'scout-quad',
    ...set.starterBodies,
    'future-unregistered-body',
  ]) {
    const library = updatePreferences(emptyLibrary(), { bodyId, matchClassAppearance: false });
    const restored = importLibrary(exportLibrary(library));
    assert.equal(restored.preferences.bodyId, bodyId);
    assert.equal(restored.preferences.matchClassAppearance, false);
    assert.deepEqual(restored.gallery, []);
    assert.deepEqual(restored.campaigns, {});
  }
});

test('compact minimum changes only registered loaded bodies and keeps desktop, fallback and rotor clocks', () => {
  const image = { naturalWidth: 1254, naturalHeight: 1254 };
  for (const id of set.starterBodies) {
    const body = presets.characters[id],
      old = { ...body };
    delete old.compactMinimumCSSPixels;
    for (const width of [294, 390, 600, 1152]) {
      const options = {
        screenScale: width / 1152,
        canvasCSSWidth: width,
        style: 'hybrid',
        scale: 1,
      };
      const actual = playerPaintSize(body, image, options);
      if (width < 480) assert.ok(actual.diameter * options.screenScale >= 20 - 1e-10);
      else assert.deepEqual(actual, playerPaintSize(old, image, options));
      assert.deepEqual(playerPaintSize(body, null, options), playerPaintSize(old, null, options));
    }
    for (const screenScale of [0.1, 0.25, 0.5, 1, 4]) {
      const options = { screenScale, canvasCSSWidth: 600, style: 'hybrid', scale: 1 };
      assert.deepEqual(playerPaintSize(body, image, options), playerPaintSize(old, image, options));
    }
    const recipe = presets.animationRecipes[body.animationRecipe];
    const initial = createAnimationState(),
      travel = { visualSpeed: 3, cruiseSpeed: 3 };
    const moved = advanceAnimation(initial, recipe, travel, 1 / 60);
    assert.ok(moved.phases['main-rotors'] > 0);
    assert.deepEqual(advanceAnimation(moved, recipe, travel, 0.2, { paused: true }), moved);
    assert.deepEqual(advanceAnimation(moved, recipe, travel, 0.2, { reducedMotion: true }), moved);
    assert.deepEqual(rotorAnchors(body), body.rotors);
    assert.equal(initial.time, 0);
  }
});

test('actual painter keeps explicit originals, reports missing assets and retains neutral unknown fallback', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const loaded = [];
  class Image {
    set src(url) {
      loaded.push(url);
      this.naturalWidth = this.naturalHeight = 1254;
      queueMicrotask(() => (url === 'missing' ? this.onerror?.() : this.onload?.()));
    }
  }
  Object.defineProperty(globalThis, 'Image', { value: Image, configurable: true });
  t.after(() =>
    previous ? Object.defineProperty(globalThis, 'Image', previous) : delete globalThis.Image,
  );
  class Painter extends BoardPainter {
    makeArt() {
      return null;
    }
  }
  const warnings = [],
    painter = new Painter(presets, { onAsset: (text) => warnings.push(text) });
  await painter.setLook(fpv, set.classBodies.scout);
  assert.ok(
    loaded.at(-1).endsWith('/authoring/library/fpv-role-presentations/originals/scout.png'),
  );
  await painter.setLook(fpv, set.classBodies.carrier, {
    player: { dataUrl: 'data:image/png;base64,explicit' },
  });
  assert.equal(loaded.at(-1), 'data:image/png;base64,explicit');
  assert.equal(painter.body, presets.characters[set.classBodies.carrier]);
  await painter.setLook(fpv, 'future-unregistered-body');
  assert.equal(painter.body, presets.characters['neutral-marker']);
  assert.match(warnings.at(-1), /not registered/);
  await painter.setLook(fpv, set.classBodies.impact, { player: { dataUrl: 'missing' } });
  assert.equal(painter.image, null);
  assert.match(warnings.at(-1), /unavailable/);
});
