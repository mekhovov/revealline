import { freezePresentation } from '../presentation/model.mjs';

/** Exact starter-pack parity reuse of the approved Orchard and Foundry derivatives.
 * The injected lease verifies these identities before reading or decoding; other
 * imports/themes have no implicit procedural or wider FPV-picture fallback.
 * Lease output retains the complete frame with contain fit and nearest sampling.
 * Canonical fpv62 integrates the accepted58 reader/session lineage with the
 * separately recorded37 scoped functional recipe reviews. Picture and actor
 * originals are unchanged. Exact accepted58 and retained59/60/61
 * attempts remain admitted; the separately archived alternate fpv55–57 lineage
 * is not a runtime fallback. This finite picture association grants no additional
 * artwork or physical-play approval.
 */
export const COOP_PICTURE_BINDINGS = freezePresentation([
  {
    packId: 'relay-rescue-starter',
    packRevision: 2,
    packSha256: '51735f71d1ac5c7f9dfe72d3032ea78d48a8113179385132fb4aec03078a32d5',
    levelId: 'first-connection',
    levelRevision: 2,
    levelSha256: '31041ad693f59418fb34e91f6f7bdae4d46fb6294b5e4ba49f8035aab4e79246',
    themeId: 'fpv',
    themeRevision: 62,
    collection: null,
    picture: {
      slot: 'scene.reveal.wide',
      assetId: 'scene.reveal.wide.field-kit',
      assetRevision: 2,
      bytes: 52720,
      height: 576,
      mime: 'image/png',
      sha256: '53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850',
      width: 1152,
    },
  },
  {
    packId: 'relay-rescue-starter',
    packRevision: 2,
    packSha256: '51735f71d1ac5c7f9dfe72d3032ea78d48a8113179385132fb4aec03078a32d5',
    levelId: 'relay-yard',
    levelRevision: 2,
    levelSha256: 'fcb1014f8b2c60047a2d10e4c0558b9ca03dcfe50c23ad48a5d2dabf9852c2a7',
    themeId: 'fpv',
    themeRevision: 62,
    collection: null,
    picture: {
      slot: 'picture.fpv.adf5c9eea274ba7f',
      assetId: 'picture.fpv.adf5c9eea274ba7f.field-kit',
      assetRevision: 2,
      bytes: 38090,
      height: 576,
      mime: 'image/png',
      sha256: 'd76f309d8385cd5d20fc2fff72b7f3abc19299cccdde767d76dd9f4a4960929d',
      width: 1152,
    },
  },
]);

/** Explicit approved scenery for valid historical imports outside closed binding
 * namespaces. This is an association policy, not approval of imported level art.
 * Each attempt pins the complete imported pack/level and this exact picture.
 */
export const COOP_HISTORICAL_IMPORT_PICTURE_POLICY = freezePresentation({
  version: 'revealline-team-historical-import-picture.v1',
  themeId: 'fpv',
  themeRevision: 62,
  collection: null,
  picture: {
    slot: 'scene.reveal.wide',
    assetId: 'scene.reveal.wide.field-kit',
    assetRevision: 2,
    bytes: 52720,
    height: 576,
    mime: 'image/png',
    sha256: '53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850',
    width: 1152,
  },
});

/** Retained attempts use the same immutable content/picture identities under the
 * explicitly preserved58,59,60 and61 themes. Current-only callers keep the two-row exports.
 */
export const COOP_RETAINED_PICTURE_BINDINGS = freezePresentation(
  [58, 59, 60, 61].flatMap((themeRevision) =>
    COOP_PICTURE_BINDINGS.map((row) => ({ ...row, themeRevision })),
  ),
);
export const COOP_SUPPORTED_PICTURE_BINDINGS = freezePresentation([
  ...COOP_PICTURE_BINDINGS,
  ...COOP_RETAINED_PICTURE_BINDINGS,
]);
export const COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY = freezePresentation({
  ...COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
  themeRevision: 59,
});
export const COOP_HISTORICAL_IMPORT_PICTURE_POLICIES = freezePresentation([
  COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
  { ...COOP_HISTORICAL_IMPORT_PICTURE_POLICY, themeRevision: 58 },
  COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY,
  { ...COOP_HISTORICAL_IMPORT_PICTURE_POLICY, themeRevision: 60 },
  { ...COOP_HISTORICAL_IMPORT_PICTURE_POLICY, themeRevision: 61 },
]);
