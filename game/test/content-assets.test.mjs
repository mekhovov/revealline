import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto, createHash } from 'node:crypto';
import {
  compileAssetRevision,
  loadPreviewArtwork,
  verifiedPreviewBackground,
} from '../content-design/assets.mjs';
import { HORIZON_ART_CANDIDATES } from '../content-design/horizon-art.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
const asset = HORIZON_ART_CANDIDATES[0];
const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
const fetchAsset = async () => new Response(bytes);
const digest = (value) => webcrypto.subtle.digest('SHA-256', value);

test('original candidate image is pinned and artwork cannot change simulation identity', async () => {
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  assert.equal(bytes.readUInt32BE(16), asset.width);
  assert.equal(bytes.readUInt32BE(20), asset.height);
  const grey = compileContentProject(createOpeningCandidates());
  const artSource = createOpeningCandidates({ artwork: true });
  const art = compileContentProject(artSource);
  assert.equal(
    resolveMission(grey, 'first-return').simulationIdentity,
    resolveMission(art, 'first-return').simulationIdentity,
  );
  const media = await loadPreviewArtwork(asset, { fetchAsset, digest });
  const theme = JSON.parse(
    await readFile(new URL('../content/themes.json', import.meta.url)),
  ).themes.find((t) => t.id === 'retro');
  const preview = prepareContentPreview(artSource, 'first-return', { theme, artwork: media });
  assert.equal(preview.scenario.visualOverrides.background.dataUrl, media.dataUrl);
  assert.equal(preview.manifest.background.sha256, asset.sha256);
  assert.equal(preview.manifest.officialProgressEligible, false);
  assert(
    preview.manifest.diagnostics.some((d) => d.code === 'candidate-art-not-visually-qualified'),
  );
  assert.throws(() => prepareContentPreview(artSource, 'first-return', { theme }), /verify/);
  assert.throws(() => verifiedPreviewBackground({ ...asset, revision: 'r2' }, media), /verify/);
  assert.throws(() => verifiedPreviewBackground(asset, { ...media }), /verify/);
});

test('unresolved, hostile and external asset references are rejected before any fetch', () => {
  const project = createOpeningCandidates();
  project.missions[0].presentation.backgroundAssetId = 'missing';
  assert.throws(() => compileContentProject(project), /Missing pinned/);
  for (const path of [
    'https://example.com/a.png',
    '/content-design/assets/a.png',
    'content-design/assets/../a.png',
    'content-design/assets//a.png',
    'content-design/assets/a.svg',
    'content-design/assets/a.png?x',
  ])
    assert.throws(() => compileAssetRevision({ ...asset, path }));
  assert.throws(() => compileAssetRevision({ ...asset, sha256: [asset.sha256] }));
  assert.throws(() => compileAssetRevision({ ...asset, review: 'approved' }));
  assert.throws(() => compileAssetRevision({ ...asset, bytes: 5 * 1024 * 1024 }));
});

test('artwork rejects changed bytes, length, dimensions and redirects', async () => {
  await assert.rejects(
    loadPreviewArtwork({ ...asset, sha256: '0'.repeat(64) }, { fetchAsset, digest }),
    /digest/,
  );
  await assert.rejects(
    loadPreviewArtwork({ ...asset, bytes: bytes.length - 1 }, { fetchAsset, digest }),
    /length/,
  );
  await assert.rejects(
    loadPreviewArtwork({ ...asset, bytes: bytes.length + 1 }, { fetchAsset, digest }),
    /length/,
  );
  await assert.rejects(
    loadPreviewArtwork({ ...asset, width: asset.width + 1 }, { fetchAsset, digest }),
    /dimensions/,
  );
  await assert.rejects(
    loadPreviewArtwork(asset, { fetchAsset: async () => ({ ok: true, redirected: true }) }),
    /redirection/,
  );
});

test('stalled artwork transport is bounded and closure cancels even an uncooperative fetch', async () => {
  await assert.rejects(
    loadPreviewArtwork(asset, { fetchAsset: () => new Promise(() => {}), timeoutMs: 5 }),
    /in time/,
  );
  const controller = new AbortController();
  const loading = loadPreviewArtwork(asset, {
    fetchAsset: () => new Promise(() => {}),
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(loading, { name: 'AbortError' });
});
