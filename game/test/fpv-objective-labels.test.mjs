import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import * as visuals from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import * as themes from '../../optional-practice/civilian-fpv/world-themes.mjs';
import * as soldiers from '../../optional-practice/civilian-fpv/industrial-soldiers.mjs';
import * as vehicles from '../../optional-practice/civilian-fpv/industrial-vehicles.mjs';
import { contrastRatio } from '../presentation/theme-system.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { resolveIndustrialEnvironment } from '../presentation/industrial-environments.mjs';
import { prepareNativeIndustrialAttempt } from '../../optional-practice/civilian-fpv/industrial-environment.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { actorVisual } from '../hunt/actor-catalog.mjs';
import { sharedActorAppearance, runtimeActorArtRevision } from '../hunt/preferences.mjs';
import {
  ACCEPTANCE_CASES,
  acceptanceRoute,
  acceptanceFrame,
} from '../../authoring/fpv-worlds/acceptance-protocol.mjs';

const course = ACCEPTANCE_CASES.find((entry) => entry.id === 'gym').course;
const projection = (sprite, camera, height) => {
  camera.updateMatrixWorld();
  const centre = sprite
    .getWorldPosition(new THREE.Vector3())
    .applyMatrix4(camera.matrixWorldInverse);
  const bottom = centre
    .clone()
    .add(new THREE.Vector3(0, -sprite.center.y * sprite.scale.y, 0))
    .applyMatrix4(camera.projectionMatrix);
  const top = centre
    .clone()
    .add(new THREE.Vector3(0, (1 - sprite.center.y) * sprite.scale.y, 0))
    .applyMatrix4(camera.projectionMatrix);
  return { height: ((top.y - bottom.y) * height) / 2, bottom: bottom.y };
};

test('objective plates pair readable text with every collection panel while authored profiles retain the old path', () => {
  const before = JSON.stringify(course);
  for (const id of Object.keys(visuals.SIM_VISUAL_COLLECTIONS)) {
    const profile = themes.resolveSimThemeProfile(course, { collectionId: id, revision: 'r1' });
    const style = visuals.simObjectiveLabelStyle(profile);
    assert.ok(style, id);
    assert.equal(style.background, `#${profile.palette.wall.toString(16).padStart(6, '0')}`);
    assert.ok(contrastRatio(style.foreground, style.background) >= 4.5, id);
  }
  const dnipro = visuals.simObjectiveLabelStyle(
    themes.resolveSimThemeProfile(course, { collectionId: 'dnipro-porcelain', revision: 'r1' }),
  );
  assert.equal(dnipro.foreground, '#101820');
  assert.equal(visuals.simObjectiveLabelStyle(themes.resolveSimThemeProfile(course)), null);
  assert.equal(
    visuals.simObjectiveLabelStyle({ id: 'industrial-workshop', revision: 'missing' }),
    null,
  );
  assert.equal(JSON.stringify(course), before);
});

test('active label projection uses the current lens and CSS height, caps world size, and fixes the original lower edge', () => {
  const camera = new THREE.PerspectiveCamera(82, 16 / 9, 0.035, 300);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.position.set(0, 0, -24);
  const baseSize = 0.72;
  for (const [fov, height, depth] of [
    [82, 600, 6],
    [82, 600, 24],
    [60, 900, 24],
    [100, 844, 24],
    [82, 600, 100],
  ]) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    sprite.position.z = -depth;
    sprite.scale.set(baseSize, baseSize, 1);
    sprite.center.set(0.5, 0.5);
    const original = projection(sprite, camera, height);
    const layout = visuals.simObjectiveLabelLayout({
      baseSize,
      active: true,
      viewDepth: depth,
      projectionY: camera.projectionMatrix.elements[5],
      viewportHeight: height,
    });
    sprite.scale.set(layout.size, layout.size, 1);
    sprite.center.set(0.5, layout.centerY);
    const after = projection(sprite, camera, height);
    assert.ok(Math.abs(original.bottom - after.bottom) < 1e-12);
    assert.ok(layout.size >= baseSize && layout.size <= baseSize * 2);
    assert.ok(
      Math.abs(after.height - Math.max(original.height, Math.min(18, original.height * 2))) < 1e-9,
    );
  }
  sprite.material.dispose();
});

test('inactive, behind-camera and invalid viewport labels retain original bounds', () => {
  const valid = {
    baseSize: 0.72,
    active: true,
    viewDepth: 24,
    projectionY: 1,
    viewportHeight: 600,
  };
  for (const patch of [
    { active: false },
    { viewDepth: -10 },
    { viewDepth: Infinity },
    { projectionY: NaN },
    { viewportHeight: 0 },
    { viewportHeight: Infinity },
  ])
    assert.deepEqual(visuals.simObjectiveLabelLayout({ ...valid, ...patch }), {
      size: 0.72,
      centerY: 0.5,
    });
});

async function rendererFixture() {
  let source = await fs.readFile(
    new URL('../../optional-practice/civilian-fpv/renderer.mjs', import.meta.url),
    'utf8',
  );
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const item of ast.body.filter((item) => item.type === 'ImportDeclaration').reverse())
    source = source.slice(0, item.start) + source.slice(item.end);
  source = source.replaceAll('export function ', 'function ');
  const sprites = [];
  let drawnCamera, drawnScene;
  const canvas = {
    width: 1166,
    height: 600,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ width: 1166, height: 600 }),
    ownerDocument: {
      createElement: () => {
        const surface = {};
        const context = {
          beginPath() {},
          arc() {},
          fill() {},
          stroke() {},
          fillText(text) {
            surface.label = { text, foreground: this.fillStyle, font: this.font };
          },
        };
        context.fill = () => {
          surface.background = context.fillStyle;
        };
        surface.getContext = () => context;
        return surface;
      },
    },
  };
  class Renderer {
    constructor() {
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 8 };
      this.info = {
        programs: [],
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0 },
      };
    }
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
    getContext() {
      return { isContextLost: () => false };
    }
    render(scene, camera) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      drawnCamera = camera;
      drawnScene = scene;
    }
  }
  const create = vm.runInNewContext(`${source}; createFlightRenderer`, {
    ...themes,
    ...visuals,
    ...soldiers,
    ...vehicles,
    actorVisual,
    sharedActorAppearance,
    runtimeActorArtRevision,
    canonicalJSON,
    resolveIndustrialEnvironment,
    structuredClone,
    THREE: {
      ...THREE,
      WebGLRenderer: Renderer,
      Sprite: class extends THREE.Sprite {
        constructor(...args) {
          super(...args);
          sprites.push(this);
        }
      },
    },
    buildWorldVisuals({ world, course, presentation }) {
      const profile = themes.resolveSimThemeProfile(course, presentation);
      return {
        theme: profile.palette,
        profile,
        indoor: true,
        center: [0, 0],
        width: 40,
        depth: 60,
        backdrop: world,
      };
    },
    createEnvironmentLight: () => ({ texture: null, dispose() {} }),
    buildDroneVisual: ({ material }) => ({ tint: material(0xffffff), rotors: [] }),
  });
  const renderer = create({ canvas, window: { devicePixelRatio: 2 } });
  return { renderer, sprites, camera: () => drawnCamera, scene: () => drawnScene };
}

test('real renderer path enlarges only the active themed badge with depth occlusion and authored appearance preserved', async () => {
  for (const collectionId of ['authored', 'industrial-workshop', 'dnipro-porcelain']) {
    const fixture = await rendererFixture();
    const { renderer } = fixture;
    const before = JSON.stringify(course);
    renderer.setPresentation({ collectionId, revision: 'r1' });
    renderer.setCourse(course);
    const route = acceptanceRoute(course),
      sample = acceptanceFrame(course, route, 0, 'far');
    const badge = fixture.sprites.find(
      (item) =>
        item.material.map.image.label.text === String(sample.state.step + 1).padStart(2, '0'),
    );
    const position = badge.position.clone();
    renderer.draw(sample.state, sample.options);
    assert.equal(badge.material.depthTest, true);
    assert.equal(badge.material.depthWrite, false);
    assert.equal(badge.material.fog, true);
    assert.equal(badge.material.opacity, 1);
    assert.deepEqual(badge.position, position);
    assert.equal(fixture.camera().fov, 82);
    if (collectionId === 'authored') {
      assert.equal(badge.scale.x, 0.72);
      assert.equal(badge.center.y, 0.5);
      assert.equal(badge.material.map.image.label.font, '700 66px sans-serif');
    } else {
      assert.ok(badge.scale.x > 0.72 && badge.scale.x <= 1.44);
      assert.ok(Math.abs(projection(badge, fixture.camera(), 600).height - 18) < 1e-6);
      const image = badge.material.map.image;
      assert.ok(contrastRatio(image.label.foreground, image.background) >= 4.5);
      // Returning to a near view restores the original world size, not a new permanent enlargement.
      const near = acceptanceFrame(course, route, 0, 'near');
      renderer.draw(near.state, near.options);
      assert.equal(badge.scale.x, 0.72);
      assert.equal(badge.center.y, 0.5);
    }
    const inactive = fixture.sprites.find((item) => item.material.map.image.label.text === '01');
    assert.equal(inactive.scale.x, 0.72);
    assert.equal(inactive.material.opacity, 0.35);
    assert.equal(JSON.stringify(course), before);
    renderer.dispose();
  }
});

test('active gate bracket geometry stays outside the original frame on both axes with bounded paired contrast', () => {
  for (const collectionId of Object.keys(visuals.SIM_VISUAL_COLLECTIONS)) {
    const create = visuals.createSimGateCueFactory(
      themes.resolveSimThemeProfile(course, { collectionId, revision: 'r1' }),
    );
    const root = new THREE.Group();
    for (const axis of ['x', 'z'])
      for (const [span, height] of [
        [0.2, 0.2],
        [3, 2],
        [18, 6],
      ]) {
        const cue = create({ axis, span, height });
        root.add(cue);
        assert.equal(cue.visible, false);
        assert.equal(cue.children.length, 2);
        assert.equal(cue.children[0].geometry, cue.children[1].geometry);
        const colors = cue.children.map((item) => `#${item.material.color.getHexString()}`);
        assert.ok(contrastRatio(...colors) >= 15, collectionId);
        for (const batch of cue.children) {
          assert.equal(batch.count, 8);
          assert.equal(batch.castShadow, false);
          assert.equal(batch.receiveShadow, false);
          assert.equal(batch.material.isMeshBasicMaterial, true);
          assert.equal(batch.material.depthTest, true);
          assert.equal(batch.material.depthWrite, false);
          assert.equal(batch.material.toneMapped, false);
          assert.equal(batch.material.fog, true);
          for (let i = 0; i < batch.count; i++) {
            const transform = new THREE.Matrix4();
            batch.getMatrixAt(i, transform);
            const bounds = new THREE.Box3(
              new THREE.Vector3(-0.5, -0.5, -0.5),
              new THREE.Vector3(0.5, 0.5, 0.5),
            ).applyMatrix4(transform);
            const across = axis === 'z' ? 'x' : 'z',
              depth = axis === 'z' ? 'z' : 'x',
              x = span / 2 + 0.0225,
              y = height / 2 + 0.0225,
              epsilon = 1e-6;
            assert.ok(
              bounds.min[across] >= x - epsilon ||
                bounds.max[across] <= -x + epsilon ||
                bounds.min.y >= y - epsilon ||
                bounds.max.y <= -y + epsilon,
              'every bracket lies outside the existing frame, not just outside its centre',
            );
            assert.ok(bounds.min[across] >= -x - 0.12 - epsilon);
            assert.ok(bounds.max[across] <= x + 0.12 + epsilon);
            assert.ok(bounds.min.y >= -y - 0.12 - epsilon);
            assert.ok(bounds.max.y <= y + 0.12 + epsilon);
            assert.ok(bounds.min[depth] >= -0.0225 - epsilon);
            assert.ok(bounds.max[depth] <= 0.0225 + epsilon);
          }
        }
      }
    assert.equal(
      new Set(root.children.flatMap((cue) => cue.children.map((item) => item.geometry))).size,
      1,
    );
    assert.equal(
      new Set(root.children.flatMap((cue) => cue.children.map((item) => item.material))).size,
      2,
    );
    visuals.disposeSimVisualGroup(root);
    assert.equal(create({ axis: 'y', span: 3, height: 2 }), null);
    assert.equal(create({ axis: 'z', span: Infinity, height: 2 }), null);
  }
  assert.equal(visuals.createSimGateCueFactory(themes.resolveSimThemeProfile(course)), null);
  assert.equal(
    visuals.createSimGateCueFactory({ id: 'dnipro-porcelain', revision: 'missing' }),
    null,
  );
});

test('renderer exposes only the active themed gate brackets at every quality and releases shared resources once', async () => {
  const course = ACCEPTANCE_CASES.find((entry) => entry.id === 'warehouse').course,
    before = JSON.stringify(course),
    route = acceptanceRoute(course),
    far = acceptanceFrame(course, route, 0, 'far');
  let originalRails;
  for (const collectionId of ['authored', ...Object.keys(visuals.SIM_VISUAL_COLLECTIONS)])
    for (const quality of ['low', 'balanced', 'high']) {
      const fixture = await rendererFixture(),
        { renderer } = fixture;
      renderer.setQuality(quality);
      renderer.setPresentation({ collectionId, revision: 'r1' });
      renderer.setCourse(course);
      renderer.draw(far.state, far.options);
      const active = fixture.sprites.find(
        (item) =>
          item.material.map.image.label.text === String(far.state.step + 1).padStart(2, '0'),
      ).parent;
      const rails = active.children
        .filter(
          (item) =>
            !item.isInstancedMesh &&
            item.geometry?.type === 'BoxGeometry' &&
            Math.max(
              item.geometry.parameters.width,
              item.geometry.parameters.height,
              item.geometry.parameters.depth,
            ) > 0.32,
        )
        .map((item) => ({
          dimensions: item.geometry.parameters,
          position: item.position.toArray(),
        }));
      originalRails ??= rails;
      assert.deepEqual(
        rails,
        originalRails,
        'physical frame dimensions and positions stay original',
      );
      const cues = [];
      fixture.scene().traverse((item) => {
        if (item.name === 'active-gate-corner-cue') cues.push(item);
      });
      if (collectionId === 'authored') {
        assert.equal(cues.length, 0);
      } else {
        assert.ok(cues.length > 1);
        assert.equal(cues.filter((item) => item.visible).length, 1);
        assert.equal(cues.find((item) => item.visible).parent, active);
        const resourceOwners = new Set();
        for (const cue of cues)
          for (const batch of cue.children) {
            resourceOwners.add(batch);
            resourceOwners.add(batch.geometry);
            resourceOwners.add(batch.material);
            if (batch.customDepthMaterial) resourceOwners.add(batch.customDepthMaterial);
          }
        const disposals = new Map();
        for (const owner of resourceOwners)
          owner.addEventListener('dispose', () =>
            disposals.set(owner, (disposals.get(owner) ?? 0) + 1),
          );
        // Returning to a non-gate step removes the marker without changing the inactive hierarchy.
        renderer.draw({ ...far.state, step: 0 }, far.options);
        assert.equal(cues.filter((item) => item.visible).length, 0);
        assert.equal(active.children.find((item) => item.isLineSegments).material.opacity, 0.18);
        renderer.setPresentation({ collectionId: 'authored' });
        renderer.setCourse(course);
        for (const owner of resourceOwners) assert.equal(disposals.get(owner), 1);
        renderer.dispose();
        for (const owner of resourceOwners) assert.equal(disposals.get(owner), 1);
        continue;
      }
      renderer.dispose();
    }
  assert.equal(JSON.stringify(course), before);
});

test('renderer requires a branded native environment before replacing its accepted scene', async () => {
  const { renderer } = await rendererFixture();
  const entry = WORLD_CATALOGUE.find((e) => e.id === 'native-pursuit-runner-court');
  const accepted = await prepareNativeIndustrialAttempt({
    entry,
    mode: 'self-level',
    presentation: { collectionId: 'military-field', revision: 'r1' },
    artRevision: 'industrial-roster-v3',
  });
  try {
    renderer.setPresentation({ collectionId: 'military-field', revision: 'r1' });
    assert.throws(() => renderer.setCourse(accepted.course), /authenticated source/);
    assert.throws(
      () =>
        renderer.setCourse(accepted.course, 'self-level', {
          industrialEnvironment: accepted.course.world.themeProfile.industrialEnvironment,
          artRevision: accepted.artRevision,
        }),
      /accepted or restored/,
    );
    assert.throws(
      () =>
        renderer.setCourse(accepted.course, 'self-level', {
          industrialEnvironment: accepted.pin,
          artRevision: null,
        }),
      /matching actor art/,
    );
    assert.doesNotThrow(() =>
      renderer.setCourse(accepted.course, 'self-level', {
        industrialEnvironment: accepted.pin,
        artRevision: accepted.artRevision,
      }),
    );
    assert.throws(
      () =>
        renderer.setCourse(entry.course, 'self-level', {
          industrialEnvironment: accepted.pin,
          artRevision: accepted.artRevision,
        }),
      /accepted native appearance/,
    );
  } finally {
    renderer.dispose();
  }
});
