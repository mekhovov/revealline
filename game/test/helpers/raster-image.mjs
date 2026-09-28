// Only the native decoding boundary is modeled. Actual source bytes, supported
// raster headers, limits and dimensions still pass the shared image inspector.
import assert from 'node:assert/strict';
import { Buffer, resolveObjectURL } from 'node:buffer';
import { inspectImageDataUrl } from '../../content.mjs';

export async function rasterDimensions(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const mime =
    blob.type ||
    (bytes[0] === 0xff && bytes[1] === 0xd8
      ? 'image/jpeg'
      : bytes.subarray(0, 4).toString() === 'RIFF'
        ? 'image/webp'
        : 'image/png');
  const result = inspectImageDataUrl(`data:${mime};base64,${bytes.toString('base64')}`);
  assert.equal(result.valid, true, 'Raster fixture requires valid supported original bytes.');
  return { width: result.width, height: result.height };
}

export class RasterImage {
  source = '';
  pending = Promise.resolve();
  set src(value) {
    this.source = value;
    if (!value) return;
    this.pending = Promise.resolve().then(async () => {
      const data = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(value);
      const blob =
        resolveObjectURL(value) ??
        (data ? new Blob([Buffer.from(value.split(',')[1], 'base64')], { type: data[1] }) : null);
      assert(blob, 'Raster fixture requires actual blob or raster data bytes.');
      const { width, height } = await rasterDimensions(blob);
      if (this.source !== value) return;
      this.width = this.naturalWidth = width;
      this.height = this.naturalHeight = height;
    });
    void this.pending.then(
      () => {
        if (this.source === value) this.onload?.();
      },
      () => {
        if (this.source === value) this.onerror?.();
      },
    );
  }
  get src() {
    return this.source;
  }
  decode() {
    return this.pending;
  }
  removeAttribute(name) {
    if (name === 'src') this.source = '';
  }
}
