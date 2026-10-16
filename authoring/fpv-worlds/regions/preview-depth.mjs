/** Authoring-only camera depth; does not change any source or collision. */
import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
export function configureSceneryPreviewDepth(camera, group, { overview = false, far = 1400 } = {}) {
  camera.near = 0.1;
  camera.far = far;
  let minimumDepth = null,
    maximumDepth = null;
  if (overview) {
    camera.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    minimumDepth = Infinity;
    maximumDepth = -Infinity;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const depth = -new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse).z;
          minimumDepth = Math.min(minimumDepth, depth);
          maximumDepth = Math.max(maximumDepth, depth);
        }
    if (Number.isFinite(minimumDepth) && Number.isFinite(maximumDepth)) {
      // Retain a fourfold foreground margin and never use this for close pilot views.
      camera.near = Math.max(0.1, Math.min(10, minimumDepth / 4));
      camera.far = Math.max(far, maximumDepth * 1.05);
    }
  }
  camera.updateProjectionMatrix();
  return { near: camera.near, far: camera.far, minimumDepth, maximumDepth };
}
