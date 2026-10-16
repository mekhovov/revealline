import { createHash } from 'node:crypto';
import { canonicalJSON } from '../../data-json.mjs';
import { loadRuntimeContentProvider } from '../../runtime-content-provider.mjs';
import { captureEditionPresentation } from '../../editions/retained-presentation.mjs';
import { editionProviderFixture } from './edition-provider-fixture.mjs';

export async function retainedEditionFixture({ originalArtwork = false } = {}) {
  const f = await editionProviderFixture();
  const binary = new Map();
  const catalog = structuredClone(f.catalog);
  for (const path of ['game/editions/catalog.json', 'edition-catalog.json'])
    f.files.set(path, catalog);
  const fetcher = async (url) => {
    const target = new URL(url, 'http://localhost/game/');
    const path =
      target.protocol === 'file:'
        ? target.pathname.slice(new URL('../../../', import.meta.url).pathname.length)
        : target.pathname.slice(1);
    if (binary.has(path)) return new Response(binary.get(path));
    if (path.startsWith('game/editions/assets/')) return new Response('', { status: 404 });
    return f.fetcher(new URL(path, 'http://localhost/'));
  };
  const load = (presentation = null) =>
    loadRuntimeContentProvider({
      locationRef: {
        href: `http://localhost/game/index.html?edition=sample-public${presentation ? `&presentation=${presentation}` : ''}`,
      },
      documentRef: { documentElement: { dataset: {} } },
      fetcher,
    });
  if (originalArtwork) replacePicture('old-picture');
  const original = await load();
  const snapshot = await captureEditionPresentation(original.bootstrap);
  const payload = Buffer.from(canonicalJSON(snapshot) + '\n');
  const descriptor = {
    id: snapshot.authoredPresentationSha256,
    path: `game/editions/retained/${snapshot.authoredPresentationSha256}.json`,
    sha256: createHash('sha256').update(payload).digest('hex'),
    bytes: payload.length,
  };
  binary.set(descriptor.path, payload);
  catalog.editions[0].presentationHistory = [descriptor];
  function replacePicture(id = 'new-picture') {
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const asset = {
      format: 'AssetRevisionV1',
      id,
      revision: '1',
      kind: 'reveal-background',
      path: `editions/assets/${id}.png`,
      sha256: createHash('sha256').update(image).digest('hex'),
      bytes: image.length,
      width: 1,
      height: 1,
      alt: id,
      review: 'candidate',
    };
    f.source.assets = [asset];
    f.source.missions[0].presentation.backgroundAssetId = asset.id;
    catalog.assets.push({
      id: asset.id,
      path: `game/${asset.path}`,
      sha256: asset.sha256,
      bytes: asset.bytes,
      publication: 'public',
      approved: true,
      dependencies: [],
    });
    catalog.campaigns[0].assetIds = [asset.id];
    catalog.editions[0].revision++;
    binary.set(`game/${asset.path}`, image);
    return asset;
  }
  return { ...f, catalog, binary, fetcher, load, original, snapshot, descriptor, replacePicture };
}
