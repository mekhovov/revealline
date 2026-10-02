import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import * as visuals from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import * as themes from '../../optional-practice/civilian-fpv/world-themes.mjs';
import { contrastRatio } from '../presentation/theme-system.mjs';
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
  source = source.replace('export function createFlightRenderer', 'function createFlightRenderer');
  const sprites = [];
  let drawnCamera;
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
    }
  }
  const create = vm.runInNewContext(`${source}; createFlightRenderer`, {
    ...themes,
    ...visuals,
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
  return { renderer, sprites, camera: () => drawnCamera };
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
