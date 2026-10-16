import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createCreatorStore } from './installed.mjs';
import { createCreatorDraftBackend } from './drafts.mjs';
import { required } from '../data-json.mjs';

/** Advanced Studio may resolve only the runtime dependency of its explicit
 * creator draft. Local originals and other library bytes are outside this path. */
export async function loadCreatorDraftArtwork(draftId, asset, { signal } = {}) {
  const store = createCreatorStore();
  try {
    const checkpoint = await createCreatorDraftBackend(store).read(draftId, { signal });
    const source = checkpoint?.source;
    required(
      source?.document.content.project.assets.some(
        (a) => a.path === asset.path && a.sha256 === asset.sha256,
      ),
      'Picture is outside this creator draft. Return to My creations and attach it again.',
    );
    const bytes = source.assets.find((a) => a.sha256 === asset.sha256);
    return await loadPreviewArtwork(asset, {
      signal,
      fetchAsset: async () => new Response(bytes.blob),
    });
  } finally {
    store.close();
  }
}
