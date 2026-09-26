import { required } from '../data-json.mjs';

/** Verify selected dependency bytes before activating a presentation. Sequential
 * streaming bounds peak memory and never loads another edition's artwork. */
export async function verifyEditionAssets(
  bootstrap,
  { baseURL, fetcher = globalThis.fetch, signal, ids = null } = {},
) {
  const { catalog, selection } = bootstrap;
  const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const requested = new Set(
    ids ?? [
      ...selection.brand.assetIds,
      ...(selection.edition.assetIds ?? []),
      ...selection.campaigns.flatMap((campaign) => campaign.assetIds),
    ],
  );
  for (const id of requested) {
    const asset = assets.get(id);
    required(asset?.approved === true, `Presentation asset is unavailable: ${id}.`);
    for (const dependency of asset.dependencies) requested.add(dependency);
  }
  required(
    [...requested].reduce((sum, id) => sum + assets.get(id).bytes, 0) <= 64 * 1024 * 1024,
    'Presentation exceeds its offline budget.',
  );
  const verified = [];
  for (const id of requested) {
    const asset = assets.get(id);
    signal?.throwIfAborted();
    const response = await fetcher(new URL(asset.path, baseURL), { signal });
    required(
      response.ok && response.body?.getReader,
      `Presentation asset could not be loaded: ${id}.`,
    );
    const reader = response.body.getReader(),
      chunks = [];
    let length = 0;
    try {
      for (;;) {
        signal?.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        required(length <= asset.bytes, `Presentation asset exceeds its pinned size: ${id}.`);
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
    required(length === asset.bytes, `Presentation asset is incomplete: ${id}.`);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    required(hash === asset.sha256, `Presentation asset differs from its pinned revision: ${id}.`);
    verified.push(id);
  }
  return Object.freeze(verified);
}
