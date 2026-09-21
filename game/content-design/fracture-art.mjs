import { freezeDesign } from './catalogs.mjs';

// Decorative originals only. Missing compositions stay explicitly unbound;
// candidate review does not imply full campaign artwork or human qualification.
export const FRACTURE_ART_CANDIDATES = freezeDesign([
  {
    format: 'AssetRevisionV1',
    id: 'fracture-coastal-first-fracture',
    revision: 'r1',
    kind: 'reveal-background',
    path: 'content-design/assets/fracture-coastal-r1/first-fracture.png',
    sha256: '5dbd2da2a014f43842a7e04c4652d158a3a7aa254129bf49ec3991cdca7478e6',
    bytes: 2369540,
    width: 1774,
    height: 887,
    alt: 'An intact stone landing and copper repair crane overlook a tidal basin beside a broken embankment and a blue-roofed coastal station at dawn.',
    review: 'candidate',
  },
]);
