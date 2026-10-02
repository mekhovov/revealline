import {
  TextureLoader,
  SRGBColorSpace,
} from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { GLTFLoader } from '../../../optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js';

export function createMarkingLoader() {
  return new GLTFLoader().register((parser) => ({
    name: 'INDUSTRIAL_MARKING_IMAGE_ELEMENT',
    beforeRoot() {
      // ImageBitmapLoader fetches blob URLs, requiring connect-src blob:. The
      // pinned loader's image-element alternative uses the existing img-src
      // permission instead, without changing the GLB, vendor code, or CSP.
      parser.textureLoader = new TextureLoader(parser.options.manager)
        .setCrossOrigin(parser.options.crossOrigin)
        .setRequestHeader(parser.options.requestHeader);
    },
  }));
}

export function requireMarkingColorTexture(material) {
  if (!material.map)
    throw Error('Embedded PNG could not be decoded. Check the image request and browser console.');
  if (material.map.colorSpace !== SRGBColorSpace) throw Error('Base-color texture is not sRGB.');
  return material.map;
}
