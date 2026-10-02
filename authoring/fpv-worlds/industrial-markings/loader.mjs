import { SRGBColorSpace } from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { GLTFLoader } from '../../../optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js';
import { configureWorldGLTFLoader } from '../../../optional-practice/civilian-fpv/renderer.mjs';

export function createMarkingLoader() {
  return configureWorldGLTFLoader(new GLTFLoader());
}

export function requireMarkingColorTexture(material) {
  if (!material.map)
    throw Error('Embedded PNG could not be decoded. Check the image request and browser console.');
  if (material.map.colorSpace !== SRGBColorSpace) throw Error('Base-color texture is not sRGB.');
  return material.map;
}
