import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { playCurrentTeamRoute } from './helpers/current-team-route.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';

const source = createTeamJourneyCandidates({ artwork: true });
const originals = new Map(
  await Promise.all(
    source.assets.map(async (asset) => [
      asset.path,
      await readFile(new URL('../' + asset.path, import.meta.url)),
    ]),
  ),
);
const decodedOriginals = new WeakSet();
const currentImage = (f) => f.drawImages.findLast((image) => decodedOriginals.has(image));

function environment(install, failures) {
  const BaseImage = globalThis.Image,
    actorFetch = globalThis.fetch;
  class CandidateImage extends BaseImage {
    releases = 0;
    async decode() {
      if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
      const bytes = Buffer.from(this.source.split(',')[1], 'base64');
      this.width = this.naturalWidth = bytes.readUInt32BE(16);
      this.height = this.naturalHeight = bytes.readUInt32BE(20);
      this.sha256 = createHash('sha256').update(bytes).digest('hex');
      decodedOriginals.add(this);
    }
    removeAttribute(name) {
      if (name === 'src') this.releases++;
      super.removeAttribute(name);
    }
  }
  install('Image', { value: CandidateImage });
  install('crypto', { value: webcrypto });
  install('fetch', {
    value: async (url, options = {}) => {
      const pathname = new URL(url).pathname;
      const asset = source.assets.find((row) => pathname.endsWith('/' + row.path));
      if (
        !asset &&
        /\/presentation\/compiled\/(?:runtime(?:\.[a-f0-9]{64})?\.json|assets\/[a-f0-9]{64}\.(?:png|jpg|webp|ttf|otf|woff2))$/.test(
          pathname,
        )
      )
        return actorFetch(url, options);
      assert(asset, 'Only registered candidate image paths may be fetched in this fixture');
      if (failures.has(asset.id)) throw new Error('Modeled original offline');
      return new Response(originals.get(asset.path));
    },
  });
}

function clear(f, missionId) {
  return playCurrentTeamRoute(f, source, missionId);
}

test('twelve real-host Team clears reveal exact originals through eleven Next handovers and one failed preload', async (t) => {
  const failures = new Set();
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-originals',
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    beforeImport: ({ install }) => environment(install, failures),
  });
  assert.ok(
    f.actorTransport.requests.some(({ relative }) => relative.startsWith('runtime')),
    'Team uses the current compiled actor presentation authority',
  );
  assert.match(
    f.$('coop-advanced-note').textContent,
    /original-art test.*human validation pending/,
  );
  assert.doesNotMatch(f.$('coop-preview-caption').textContent, /not authored/);
  f.$('coop-start').focus();
  f.tap('Enter');
  for (const [index, mission] of source.missions.entries()) {
    const asset = source.assets.find((a) => a.id === mission.presentation.backgroundAssetId);
    assert.equal(f.$('coop-level').value, mission.id);
    assert.equal(f.$('coop-menu').hidden, true);
    f.tick();
    const image = currentImage(f);
    assert.equal(image.sha256, asset.sha256);
    assert.equal(image.width, asset.width);
    assert.equal(image.releases, 0);
    clear(f, mission.id);
    assert.equal(currentImage(f), image, 'Victory retains its exact picture');
    assert.equal(f.$('coop-reserves').textContent, '2 reserves');
    assert.deepEqual(f.visits, []);
    if (index === 0) {
      const nextAsset = source.missions[1].presentation.backgroundAssetId;
      failures.add(nextAsset);
      f.$('coop-next').focus();
      f.tap('Enter');
      await waitFor(
        () => f.$('coop-next-status').textContent.includes('Try Next again'),
        () => f.$('coop-next-status').textContent,
      );
      assert.equal(f.$('coop-level').value, mission.id);
      assert.equal(f.$('coop-overlay').hidden, false);
      assert.equal(image.releases, 0);
      failures.delete(nextAsset);
    }
    if (index < source.missions.length - 1) {
      f.$('coop-next').focus();
      f.tap('Enter');
      await waitFor(
        () => f.$('coop-overlay').hidden,
        () => f.$('coop-next-status').textContent,
      );
      assert.equal(image.releases, 1);
      assert.equal(f.$('coop-coverage').textContent, '0.0%');
    } else assert.equal(f.$('coop-next').hidden, true);
  }
  t.diagnostic(
    'Actual host/commands and original bytes; finite DOM/decode, not native performance or human enjoyment.',
  );
});

test('initial candidate picture failure retries deliberately and chooser starts another original in one action', async (t) => {
  const firstAsset = source.missions[0].presentation.backgroundAssetId;
  const failures = new Set([firstAsset]);
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-originals',
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    waitPicture: false,
    beforeImport: ({ install }) => environment(install, failures),
  });
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'error');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.drawImages.length, 0);
  failures.clear();
  f.$('coop-picture-retry').focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
  assert.equal(f.$('coop-menu').hidden, false, 'Retry picture is not Start');
  const first = f.previewDrawImages.at(-1);
  assert.equal(first.sha256, source.assets.find((a) => a.id === firstAsset).sha256);
  f.$('coop-discovery-open').focus();
  f.tap('Enter');
  await waitFor(() => f.$('journey-chooser')?.open);
  const selected = [...f.$('journey-cards').querySelectorAll('.journey-card')].find(
    (button) => button.querySelector('strong').textContent === 'Shared lookout',
  );
  assert.match(selected.textContent, /Original-art test; visual qualification pending/);
  assert.equal(first.releases, 0, 'Opening chooser does not retire the prepared start');
  selected.focus();
  f.tap('Enter');
  await waitFor(
    () => !f.$('journey-chooser').open && f.$('coop-menu').hidden,
    () => f.$('coop-discovery-status').textContent,
  );
  f.tick(2);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-level').value, 'shared-lookout');
  assert.equal(first.releases, 1);
  const mission = source.missions.find((m) => m.id === 'shared-lookout');
  assert.equal(
    currentImage(f).sha256,
    source.assets.find((a) => a.id === mission.presentation.backgroundAssetId).sha256,
  );
  assert.equal(f.$('coop-clock').textContent, '0:00');
});
