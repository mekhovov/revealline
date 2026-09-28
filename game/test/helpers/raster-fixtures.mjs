import { pngBytes } from './media-fixtures.mjs';

// Test-only 1x1 containers. JPEG deliberately contains only a frame header;
// callers must inject a decoder or verify that real decoding rejects it.
export const rasterFixtures = () => [
  { extension: 'png', mime: 'image/png', bytes: pngBytes() },
  {
    extension: 'jpg',
    mime: 'image/jpeg',
    bytes: Buffer.from([255, 216, 255, 192, 0, 11, 8, 0, 1, 0, 1, 1, 1, 17, 0, 255, 217]),
  },
  {
    extension: 'webp',
    mime: 'image/webp',
    bytes: Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64'),
  },
];
