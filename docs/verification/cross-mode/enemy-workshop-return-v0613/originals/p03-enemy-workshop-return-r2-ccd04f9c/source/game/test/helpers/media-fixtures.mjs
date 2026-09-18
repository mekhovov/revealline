import { createExecutionCatalog } from '../../campaign-contexts.mjs';
import {
  createMediaIdentityCatalog,
  MEDIA_LIBRARY_FORMAT,
  MEDIA_PRESENTATION_FORMAT,
  STILL_ASSET_FORMAT,
} from '../../media-library.mjs';

// Injected test content, never registered, imported into a host or shipped as art.
export const pngBytes = () =>
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
    'base64',
  );
export const provenance = () => ({
  kind: 'original',
  credit: 'Test fixture',
  source: 'Explicit injected still fixture; no production-art claim.',
});
export function mediaFixture(classic = false) {
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'media-fixture',
    revision: '1',
    levels: [
      {
        version: classic ? 'xonix-level.v4' : 'xonix-level.v1',
        id: 'same-map',
        revision: 'authored-1',
        name: 'Media identity fixture',
        width: classic ? 72 : 48,
        height: 36,
        spawn: { x: classic ? 36.5 : 24.5, y: 0.5 },
        goal: { coverage: 0.4 },
        enemies: [
          { id: 'field-seed', type: 'bouncer', x: classic ? 60.5 : 38.5, y: 20.5, vx: 0, vy: 0 },
        ],
        ...(classic
          ? {
              encounter: null,
              classic: { version: 'classic.v1', terrain: [], powerups: [] },
              rules: { stopOnCapture: true },
            }
          : {}),
      },
    ],
  };
  const catalog = createExecutionCatalog([
    {
      campaign,
      sourcePackId: 'injected-pack',
      themes: ['fpv', 'ukraine', 'retro', 'network'].map((id) => ({ id })),
    },
  ]);
  const identityCatalog = createMediaIdentityCatalog(catalog);
  const standard = catalog.entries[0];
  const identity = {
    baseCampaignKey: standard.baseCampaignKey,
    levelId: 'same-map',
    levelRevision: 'authored-1',
    themeId: 'fpv',
  };
  const request = (mode = 'standard', themeId = 'fpv') => {
    const entry = catalog.entries.find((item) => item.difficulty === mode),
      level = entry.campaign.levels[0];
    return {
      executionKey: entry.executionKey,
      levelId: level.id,
      levelRevision: level.revision,
      themeId,
    };
  };
  return { campaign, catalog, identityCatalog, identity, request };
}
export const assetRecord = (id = 'picture-a') => ({
  format: STILL_ASSET_FORMAT,
  id,
  sha256: 'a'.repeat(64),
  bytes: 68,
  mime: 'image/png',
  width: 1,
  height: 1,
  provenance: provenance(),
});
export const presentationRecord = (identity, revision = 1, assetId = 'picture-a') => ({
  format: MEDIA_PRESENTATION_FORMAT,
  id: 'map-picture',
  revision,
  identity: structuredClone(identity),
  poster: { assetId, fit: 'contain', sampling: 'nearest' },
  story: null,
  description: `Original still revision ${revision}.`,
});
export const libraryRecord = (identity) => ({
  format: MEDIA_LIBRARY_FORMAT,
  assets: [assetRecord()],
  presentations: [presentationRecord(identity)],
  assignments: [
    { identity: structuredClone(identity), presentationId: 'map-picture', revision: 1 },
  ],
});
export function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
