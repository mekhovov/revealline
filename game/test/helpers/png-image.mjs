// Model browser PNG decoding while keeping the actual bytes and dimensions.
// Ownership, hashes, media validation and asynchronous preparation stay real.
import assert from 'node:assert/strict';
import { Buffer, resolveObjectURL } from 'node:buffer';

export class PNGImage {
  source = '';
  pending = Promise.resolve();
  set src(value) {
    this.source = value;
    if (!value) return;
    this.pending = Promise.resolve().then(async () => {
      const blob = resolveObjectURL(value);
      const bytes = blob
        ? Buffer.from(await blob.arrayBuffer())
        : /^data:image\/png;base64,/.test(value)
          ? Buffer.from(value.split(',')[1], 'base64')
          : null;
      assert.ok(bytes, 'PNG fixture requires actual blob or PNG data bytes.');
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      const width = bytes.readUInt32BE(16),
        height = bytes.readUInt32BE(20);
      assert.ok(width > 0 && height > 0);
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
