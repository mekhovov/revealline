/** Optional authoring light rig. One capped shadow target; never changes collision geometry. */
import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';

export function createSceneryLighting(scene, renderer, style = 'plain') {
  if (!['plain', 'urban'].includes(style)) throw new TypeError('Unknown scenery lighting profile');
  const urban = style === 'urban';
  scene.background = new THREE.Color(urban ? '#9db7c6' : '#bfd0d4');
  const hemisphere = new THREE.HemisphereLight(
    urban ? 0xbad2e7 : 0xc7e7fa,
    urban ? 0x6f675e : 0x6c5845,
    urban ? 0.75 : 2,
  );
  const sun = new THREE.DirectionalLight(urban ? 0xffe0b1 : 0xffe9c3, 2);
  sun.position.set(100, 300, 80);
  scene.add(hemisphere, sun, sun.target);
  if (urban) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    sun.castShadow = false;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.12;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 900;
  }
  function release() {
    sun.castShadow = false;
    sun.shadow.dispose();
    sun.shadow.map = null;
    sun.shadow.mapPass = null;
  }
  let disposed = false;
  return Object.freeze({
    focus(group, target, overview = false) {
      if (disposed) throw new TypeError('Scenery lighting disposed');
      if (!urban) return;
      if (!Array.isArray(target) || target.length !== 3 || !target.every(Number.isFinite))
        throw new TypeError('Scenery lighting needs a local target');
      sun.castShadow = true;
      group.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      sun.target.position.fromArray(target);
      sun.position.set(target[0] - 180, target[1] + 300, target[2] - 140);
      const extent = overview ? 260 : 110;
      Object.assign(sun.shadow.camera, {
        left: -extent,
        right: extent,
        top: extent,
        bottom: -extent,
      });
      sun.shadow.camera.updateProjectionMatrix();
      sun.target.updateMatrixWorld();
      sun.shadow.needsUpdate = true;
    },
    release,
    snapshot: () => ({
      style,
      configuredShadowTargets: urban && !disposed ? 1 : 0,
      shadowMapSize: urban ? 1024 : 0,
      disposed,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      hemisphere.removeFromParent();
      sun.removeFromParent();
      sun.target.removeFromParent();
      release();
    },
  });
}
