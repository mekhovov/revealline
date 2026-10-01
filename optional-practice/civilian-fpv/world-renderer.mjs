import { createFlightRenderer as createRenderer } from './renderer.mjs';

/** World-only extensions stay outside the original Academy package's closure. */
export function createFlightRenderer(options) {
  return createRenderer({
    ...options,
    loadGLTF: () => import('./vendor/addons/loaders/GLTFLoader.js'),
    loadTransformControls: () => import('./vendor/addons/controls/TransformControls.js'),
  });
}
