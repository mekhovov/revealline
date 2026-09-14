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
  componentPose,
} from '../../authoring/motion-lab/animation.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const presets = await json('../../authoring/motion-lab/presets.json');
const prior = await json(
  '../../authoring/production/history/e857a548bccaa9649d86ccb6443fbf9fd37f8ff4de8e3f6a7a7da900b92ed8cb.json',
);
const first = await json('../../authoring/library/ukraine-role-presentations/presentations.json');
const wide = await json('../../authoring/library/ukraine-role-wide-variants/variants.json');
const themes = (await json('../content/themes.json')).themes;
const campaign = await json('../content/campaign.json');
const config = await json('../build-config.json');
const set = presets.characterPresentations.sets.find((entry) => entry.id === 'ukraine-roles-v1');
const ukraine = themes.find((theme) => theme.id === 'ukraine');
const selected = [
  ['scout', 'atlas-swallow-v3', wide, 'ukraine-role-wide-variants'],
  ['bomber', 'atlas-pottery-courier-v1', first, 'ukraine-role-presentations'],
  ['carrier', 'atlas-carved-chest-v1', first, 'ukraine-role-presentations'],
  ['interceptor', 'atlas-falcon-crest-v3', wide, 'ukraine-role-wide-variants'],
  ['fiber', 'atlas-weaver-shuttle-v3', wide, 'ukraine-role-wide-variants'],
  ['impact', 'atlas-bell-warden-v1', first, 'ukraine-role-presentations'],
  ['trapper', 'atlas-woven-basket-v1', first, 'ukraine-role-presentations'],
];

test('seven selected originals and wing recipes are exact; historical presets and FPV set remain intact', async () => {
  assert.equal(Object.keys(prior.characters).length, 21);
  for (const [id, body] of Object.entries(prior.characters))
    assert.deepEqual(presets.characters[id], body);
  for (const [id, recipe] of Object.entries(prior.animationRecipes))
    assert.deepEqual(presets.animationRecipes[id], recipe);
  assert.deepEqual(
    presets.characterPresentations.sets.slice(0, -1),
    prior.characterPresentations.sets,
  );
  for (const key of Object.keys(prior).filter(
    (key) => !['characters', 'animationRecipes', 'characterPresentations'].includes(key),
  ))
    assert.deepEqual(presets[key], prior[key], key);
  assert.deepEqual(set.classBodies, Object.fromEntries(selected.map(([role, id]) => [role, id])));
  assert.deepEqual(set.matchClassBodies, ukraine.classBodies);
  let total = 0;
  const paths = [];
  for (const [classId, id, source, area] of selected) {
    const role = source.roles.find((entry) => entry.classId === classId),
      body = presets.characters[id];
    const path = `authoring/library/${area}/${role.body.src}`;
    paths.push(path);
    assert.equal(body.originalSha256, role.sha256);
    assert.equal(body.src, `../library/${area}/${role.body.src}`);
    for (const key of Object.keys(role.body).filter((key) => key !== 'src'))
      assert.deepEqual(body[key], role.body[key]);
    assert.deepEqual(presets.animationRecipes[body.animationRecipe], role.recipe);
    const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), role.sha256);
    assert.ok(bytes.length < 4 * 1024 * 1024);
    total += bytes.length;
  }
  assert.equal(total, 5873332);
  assert.deepEqual(
    config.include.filter((path) => path.startsWith('authoring/library/ukraine-role')),
    paths,
  );
  assert.ok(
    52816659 + total + 65536 < 64 * 1024 * 1024,
    'Projected core allowance; an actual candidate build is separate.',
  );
});

test('complete Ukraine guard owns its input and preserves custom maps and FPV recommendations', () => {
  const input = structuredClone(presets),
    adapter = createCharacterPresentations(input);
  input.characterPresentations.sets.find((entry) => entry.id === set.id).classBodies.scout =
    'ukrainian-bird';
  for (const [role, id] of Object.entries(set.classBodies)) {
    assert.equal(adapter.recommendedBody(ukraine, role), id);
    assert.equal(recommendedBody(ukraine, role), 'ukrainian-bird');
  }
  for (const custom of [
    { ...ukraine, id: 'custom' },
    { ...ukraine, family: 'custom' },
    { ...ukraine, player: 'neutral-marker' },
    { ...ukraine, classBodies: { ...ukraine.classBodies, carrier: 'neutral-marker' } },
    { ...ukraine, classBodies: { scout: 'ukrainian-bird' } },
    { ...ukraine, classBodies: { ...ukraine.classBodies, future: 'ukrainian-bird' } },
  ])
    assert.equal(adapter.recommendedBody(custom, 'scout'), recommendedBody(custom, 'scout'));
  assert.equal(adapter.recommendedBody(ukraine, 'unknown-class'), 'ukrainian-bird');
  for (const other of prior.characterPresentations.sets) {
    const theme = themes.find((entry) => entry.id === other.themeId);
    for (const [role, id] of Object.entries(other.classBodies))
      assert.equal(adapter.recommendedBody(theme, role), id);
  }
});

test('new availability is cosmetic and manual old/new IDs round-trip without granting progress rewards', () => {
  const progress = emptyProgress(campaign),
    before = structuredClone(progress);
  const earned = unlockedBodies(progress, campaign),
    earnedBefore = [...earned];
  const available = createCharacterPresentations(presets).availableBodies(earned);
  assert.deepEqual([...earned], earnedBefore);
  assert.deepEqual(progress, before);
  assert.deepEqual(newAppearanceBodies(progress, before, campaign), []);
  assert.equal(available.has('fpv-night'), false);
  for (const id of set.starterBodies) assert.equal(available.has(id), true);
  for (const bodyId of [
    'ukrainian-bird',
    'neutral-marker',
    ...set.starterBodies,
    'future-unregistered-body',
  ]) {
    const library = updatePreferences(emptyLibrary(), {
      themeId: 'ukraine',
      bodyId,
      matchClassAppearance: false,
    });
    const restored = importLibrary(exportLibrary(library));
    assert.deepEqual(restored.preferences, library.preferences);
    assert.deepEqual(restored.gallery, []);
    assert.deepEqual(restored.campaigns, {});
  }
});

test('strict wing admission rejects unsupported fields, false identities, misplaced roots and oversized envelopes', () => {
  const mutations = [
    (body) => {
      body.originalSha256 = [body.originalSha256];
    },
    (body) => {
      body.rotors = [{ x: 0, y: 0 }];
    },
    (_, wing) => {
      wing.type = 'thruster';
    },
    (_, wing) => {
      wing.actionStates = [];
    },
    (_, wing) => {
      wing.anchors[0].push(0);
    },
    (_, wing) => {
      wing.anchors.reverse();
    },
    (_, wing) => {
      wing.anchors[0][2] = 1;
    },
    (_, wing) => {
      wing.anchors[0][0] = '0.2';
    },
    (_, wing) => {
      wing.anchors[0][1] = NaN;
    },
    (_, wing) => {
      wing.span = 0.8;
    },
    (_, wing) => {
      wing.foldFraction = 0.8;
    },
    (_, wing) => {
      wing.frequencyHz = 0;
    },
    (_, wing) => {
      wing.color = 'ivory';
    },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(presets),
      body = candidate.characters[set.classBodies.scout];
    mutate(body, candidate.animationRecipes[body.animationRecipe].components[0]);
    assert.throws(() => createCharacterPresentations(candidate));
  }
  let calls = 0;
  const candidate = structuredClone(presets);
  Object.defineProperty(candidate.characters[set.classBodies.scout], 'src', {
    enumerable: true,
    get() {
      calls++;
      return 'assets/a.png';
    },
  });
  assert.throws(() => createCharacterPresentations(candidate));
  assert.equal(calls, 0);
});

test('existing size helper and wing clocks preserve loaded-only compact sizing, pause and reduced motion', () => {
  const travel = { visualSpeed: 3, cruiseSpeed: 3 },
    image = { naturalWidth: 1254, naturalHeight: 1254 };
  for (const id of set.starterBodies) {
    const body = presets.characters[id],
      old = { ...body },
      recipe = presets.animationRecipes[body.animationRecipe];
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
    const initial = createAnimationState(),
      moved = advanceAnimation(initial, recipe, travel, 1 / 60);
    assert.ok(moved.phases.wings > 0);
    assert.equal(initial.time, 0);
    assert.deepEqual(advanceAnimation(moved, recipe, travel, 0.2, { paused: true }), moved);
    assert.deepEqual(advanceAnimation(moved, recipe, travel, 0.2, { reducedMotion: true }), moved);
    const pose = componentPose(recipe.components[0], moved, 1);
    assert.ok(Number.isFinite(pose.angle) && pose.span > 0);
    assert.equal(componentPose(recipe.components[0], moved, 1, true).flap, 0);
    assert.deepEqual(travel, { visualSpeed: 3, cruiseSpeed: 3 });
  }
});

test('actual painter resolves every selected original and keeps explicit replacement and neutral fallback', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image'),
    loaded = [];
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
  for (const [, id] of selected) {
    await painter.setLook(ukraine, id);
    assert.ok(loaded.at(-1).endsWith(presets.characters[id].src.slice(2)));
    assert.equal(painter.body, presets.characters[id]);
  }
  await painter.setLook(ukraine, set.classBodies.fiber, {
    player: { dataUrl: 'data:image/png;base64,explicit' },
  });
  assert.equal(loaded.at(-1), 'data:image/png;base64,explicit');
  await painter.setLook(ukraine, 'future-unregistered-body');
  assert.equal(painter.body, presets.characters['neutral-marker']);
  assert.match(warnings.at(-1), /not registered/);
  await painter.setLook(ukraine, set.classBodies.scout, { player: { dataUrl: 'missing' } });
  assert.equal(painter.image, null);
  assert.match(warnings.at(-1), /unavailable/);
});
