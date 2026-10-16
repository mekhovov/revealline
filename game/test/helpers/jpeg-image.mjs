import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import { RasterImage } from './raster-image.mjs';

// Full bounded pixel decoding for JPEG-only Node ownership fixtures. The DOM
// event interface is modeled; this does not qualify browser color or rendering.
export class JPEGImage extends RasterImage {
  async inspect(blob) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    const { width, height, data } = jpeg.decode(bytes, {
      useTArray: true,
      tolerantDecoding: false,
      maxResolutionInMP: 4,
      maxMemoryUsageInMB: 64,
    });
    assert.equal(data.length, width * height * 4);
    return { width, height };
  }
}
