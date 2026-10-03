import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  BUILTIN_THEME_FAMILIES,
  INSTALLED_THEME_FAMILIES,
  SIM_MODEL_ROLES,
  SIM_MATERIAL_ROLES,
  SIM_EFFECT_ROLES,
  getThemeFamily,
  getInterfaceTheme,
  resolvePresentation,
  resolveSimVisualCollection,
  validateInterfaceTheme,
  validatePresentationCoverage,
  contrastRatio,
} from '../presentation/theme-system.mjs';
import {
  getArcadeCollection,
  industrialTexturePixels,
  selectedArcadeCollection,
} from '../presentation/industrial-arcade.mjs';
import { FIELD_KIT_SPRITE_IDS, pixelArtForSlot } from '../presentation/pixel-art.mjs';
import { TEAM_RUNTIME_IMAGE_SLOTS } from '../presentation/team-runtime-slots.mjs';
import {
  createWorkshopTexture,
  getSimVisualCollection,
} from '../../optional-practice/civilian-fpv/world-visuals.mjs';

const darkAdditions = ['obsidian-reliquary', 'deep-space', 'moonlit-grove'];
const additions = ['pocket-lcd', 'copper-observatory', 'sakura-station', ...darkAdditions];
const digest = (value) => createHash('sha256').update(value).digest('hex');
function spriteDigest(collection) {
  const hash = createHash('sha256');
  for (const slot of FIELD_KIT_SPRITE_IDS)
    hash.update(industrialTexturePixels(pixelArtForSlot(slot), slot, collection).rgba);
  return hash.digest('hex');
}

test('current red Vyshyvanka has new exact interface/Arcade pins while the original bytes and SIM binding remain retained', () => {
  const old = getThemeFamily('vyshyvanka', 'r1'),
    current = getThemeFamily('vyshyvanka');
  assert.equal(current.revision, 'r2');
  assert.deepEqual(current.interface, { id: 'vyshyvanka', revision: 'r2' });
  assert.deepEqual(current.arcade, { id: 'vyshyvanka', revision: 'r2' });
  assert.deepEqual(current.sim, { id: 'vyshyvanka', revision: 'r1' });
  assert.deepEqual(old.interface, { id: 'vyshyvanka', revision: 'r1' });
  assert.deepEqual(old.arcade, { id: 'vyshyvanka', revision: 'r1' });
  assert.deepEqual(old.sim, current.sim);
  assert.equal(
    digest(JSON.stringify(getInterfaceTheme('vyshyvanka', 'r1'))),
    '8f5f4ff894c663d0960bb9764974380fffd7f5ac833b4b86fba370f619190c21',
    'pre-change r1 interface document remains byte-identical',
  );
  assert.equal(
    spriteDigest(getArcadeCollection('vyshyvanka', 'r1')),
    'bb519487441bb54ff778aab392265b24c3ca4b9179b773c5af65fd1398f19981',
    'all pre-change r1 sprite pixels retain their exact interface basis',
  );
  assert.notEqual(
    spriteDigest(getArcadeCollection('vyshyvanka', 'r1')),
    spriteDigest(getArcadeCollection('vyshyvanka', 'r2')),
  );
  const tokens = getInterfaceTheme('vyshyvanka', 'r2').tokens;
  assert.equal(tokens.accent, '#d3222a');
  assert.equal(tokens.ink, '#08090a');
  assert.equal(tokens.onAccent, '#ffffff');
  assert.equal(tokens.controlLine, '#867671');
  assert.equal(tokens.focus, tokens.accent);
  assert.ok(contrastRatio(tokens.focus, tokens.panelRaised) >= 3);
  assert.ok(contrastRatio(tokens.onAccent, tokens.accent) >= 4.5);
  assert.ok(contrastRatio(tokens.link, tokens.panelRaised) >= 4.5);
  assert.equal(getArcadeCollection('vyshyvanka', 'r3'), null);
});

test('Classic Field Kit changes its current display name through a new revision and keeps exact legacy documents', () => {
  const oldInterface = getInterfaceTheme('legacy', 'r1'),
    currentInterface = getInterfaceTheme('legacy'),
    oldFamily = getThemeFamily('legacy', 'r1'),
    currentFamily = getThemeFamily('legacy');
  assert.equal(oldInterface.name, 'Existing appearance');
  assert.equal(oldFamily.name, 'Existing appearance');
  assert.equal(currentInterface.name, 'Classic Field Kit');
  assert.equal(currentFamily.name, 'Classic Field Kit');
  assert.deepEqual(currentInterface, {
    ...oldInterface,
    revision: 'r2',
    name: 'Classic Field Kit',
  });
  assert.deepEqual(currentFamily, {
    ...oldFamily,
    revision: 'r2',
    name: 'Classic Field Kit',
    interface: { id: 'legacy', revision: 'r2' },
  });
  assert.equal(currentFamily.arcade, null);
  assert.equal(currentFamily.sim, null);
});

test('each new family resolves complete interface, Arcade and SIM contracts with readable state pairs', () => {
  for (const id of additions) {
    const family = getThemeFamily(id),
      theme = getInterfaceTheme(id),
      arcade = selectedArcadeCollection({ familyId: id, arcadeArt: 'follow-game' }),
      sim = resolveSimVisualCollection({
        collectionId: family.sim.id,
        revision: family.sim.revision,
      });
    assert.equal(BUILTIN_THEME_FAMILIES.filter((item) => item.id === id).length, 1);
    assert.equal(family.revision, 'r1');
    assert.equal(validateInterfaceTheme(theme).id, id);
    assert.equal(arcade, getArcadeCollection(id, 'r1'));
    assert.equal(sim.fallbackReason, null);
    assert.equal(sim.collection.id, id);
    for (const role of [...FIELD_KIT_SPRITE_IDS, ...TEAM_RUNTIME_IMAGE_SLOTS])
      assert.ok(arcade.roles.includes(role), `${id}: ${role}`);
    assert.deepEqual(Object.keys(sim.collection.models), SIM_MODEL_ROLES);
    assert.deepEqual(Object.keys(sim.collection.assets), SIM_MODEL_ROLES);
    assert.deepEqual(Object.keys(sim.collection.materials), SIM_MATERIAL_ROLES);
    assert.deepEqual(Object.keys(sim.collection.effects), SIM_EFFECT_ROLES);
    assert.notEqual(sim.collection.effects.playerPulse, sim.collection.effects.hostilePulse);
    assert.notEqual(sim.collection.effects.goalActive, sim.collection.effects.goalInactive);
    for (const highContrast of [false, true]) {
      const view = resolvePresentation({ familyId: id, accessibility: { highContrast } });
      assert.deepEqual(validatePresentationCoverage(view).errors, [], id);
      for (const [role, component] of Object.entries(view.components))
        for (const [state, pair] of Object.entries(component.states))
          assert.ok(
            contrastRatio(pair.foreground, pair.background) >=
              (state === 'disabled' ? 3 : highContrast ? 7 : 4.5),
            `${id}/${role}/${state}`,
          );
      for (const surface of ['ink', 'panel', 'panelRaised'])
        for (const cue of ['controlLine', 'focus'])
          assert.ok(
            contrastRatio(view.tokens[cue], view.tokens[surface]) >= 3,
            `${id}: ${cue}/${surface}`,
          );
    }
    for (const [fg, bg] of [
      ['onAccent', 'accent'],
      ['onSelection', 'selection'],
      ['inputText', 'input'],
      ['onHazard', 'hazard'],
      ['onSafe', 'safe'],
    ])
      assert.ok(contrastRatio(theme.tokens[fg], theme.tokens[bg]) >= 4.5, `${id}: ${fg}/${bg}`);
  }
  assert.equal(
    new Set(INSTALLED_THEME_FAMILIES.map((family) => `${family.id}@${family.revision}`)).size,
    INSTALLED_THEME_FAMILIES.length,
  );
});

test('new Arcade finishes are distinct, deterministic and leave alpha, dimensions and source pixels intact', () => {
  const identities = new Set();
  for (const id of additions) {
    const collection = getArcadeCollection(id, 'r1');
    identities.add(spriteDigest(collection));
    for (const slot of FIELD_KIT_SPRITE_IDS) {
      const source = pixelArtForSlot(slot),
        before = new Uint8ClampedArray(source.rgba),
        rendered = industrialTexturePixels(source, slot, collection);
      assert.deepEqual(source.rgba, before);
      assert.equal(rendered.width, source.width);
      assert.equal(rendered.height, source.height);
      assert.deepEqual(rendered.rgba, industrialTexturePixels(source, slot, collection).rgba);
      for (let i = 3; i < before.length; i += 4)
        assert.equal(rendered.rgba[i], before[i], `${id}/${slot}: alpha`);
    }
  }
  assert.equal(identities.size, additions.length);
});

test('dark additions retain dark reading surfaces and distinct complete SIM pixel libraries', () => {
  const libraries = new Set(),
    motifs = new Set();
  for (const id of darkAdditions) {
    assert.equal(resolvePresentation({ familyId: id }).colorScheme, 'dark');
    const collection = getSimVisualCollection(id),
      hash = createHash('sha256');
    assert.deepEqual(Object.keys(collection.materials), SIM_MATERIAL_ROLES);
    for (const role of SIM_MATERIAL_ROLES) {
      const first = createWorkshopTexture(role, { collectionId: id, quality: 'low' }),
        second = createWorkshopTexture(role, { collectionId: id, quality: 'high' });
      assert.deepEqual(
        first.image.data,
        second.image.data,
        'quality changes sampling, never source art',
      );
      assert.equal(first.image.width, 128);
      assert.equal(first.image.height, 128);
      assert.equal(first.generateMipmaps, true);
      assert.equal(first.anisotropy, 1);
      hash.update(first.image.data);
      if (role === 'enamel') {
        const values = first.image.data,
          luminance = Array.from(
            { length: values.length / 4 },
            (_, index) => values[index * 4] + values[index * 4 + 1] + values[index * 4 + 2],
          ),
          mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
        motifs.add(luminance.map((value) => (value > mean ? '1' : '0')).join(''));
      }
      first.dispose();
      second.dispose();
    }
    libraries.add(hash.digest('hex'));
  }
  assert.equal(libraries.size, darkAdditions.length);
  assert.equal(
    motifs.size,
    darkAdditions.length,
    'the materials have different structure, not only different pigments',
  );
});

test('new dark collections leave every previously installed exact interface, Arcade pixel and SIM material revision unchanged', () => {
  // Captured before this addition at 5bf3b15dc. Resolve exact historical pins,
  // so future current revisions may advance without erasing existing assets.
  const previous = [
    ['legacy', 'r2'],
    ['industrial-workshop', 'r2'],
    ['vyshyvanka', 'r2'],
    ['dnipro-porcelain', 'r1'],
    ['tryzub', 'r1'],
    ['windows-classic', 'r2'],
    ['dos', 'r2'],
    ['orchard-workshop', 'r1'],
    ['neon-ruins', 'r1'],
    ['pocket-lcd', 'r1'],
    ['copper-observatory', 'r1'],
    ['sakura-station', 'r1'],
  ];
  const hash = createHash('sha256');
  for (const [id, revision] of previous) {
    const family = getThemeFamily(id, revision);
    hash.update(JSON.stringify(family));
    hash.update(JSON.stringify(getInterfaceTheme(family.interface.id, family.interface.revision)));
    if (family.arcade)
      for (const slot of FIELD_KIT_SPRITE_IDS)
        hash.update(
          industrialTexturePixels(
            pixelArtForSlot(slot),
            slot,
            getArcadeCollection(family.arcade.id, family.arcade.revision),
          ).rgba,
        );
    if (family.sim) {
      const collectionId = family.sim.id;
      hash.update(
        JSON.stringify(
          resolveSimVisualCollection({ collectionId, revision: family.sim.revision }).collection,
        ),
      );
      hash.update(JSON.stringify(getSimVisualCollection(collectionId).materials));
      for (const role of SIM_MATERIAL_ROLES) {
        const texture = createWorkshopTexture(role, { collectionId });
        hash.update(texture.image.data);
        texture.dispose();
      }
    }
  }
  assert.equal(
    hash.digest('hex'),
    '27d078a53324ab337dc91537b8d620ee7dd8b87e24195a3d633753d4f4dd95d6',
  );
});
