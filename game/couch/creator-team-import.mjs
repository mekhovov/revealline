import { boundedJSON, required } from '../data-json.mjs';
import { COOP_PACK_MAX_BYTES } from '../coop/recipes.mjs';
import { readCoopPack } from '../coop/library.mjs';
import {
  CREATOR_TEAM_PORTABLE_FORMAT,
  CREATOR_TEAM_PORTABLE_MIME,
  importCreatorTeamCampaign,
} from '../creator/team.mjs';

const ownedBlob = (source) => {
  required(source instanceof Blob, 'Choose a Team campaign file.');
  const size = Reflect.apply(
      Reflect.getOwnPropertyDescriptor(Blob.prototype, 'size').get,
      source,
      [],
    ),
    type = Reflect.apply(Reflect.getOwnPropertyDescriptor(Blob.prototype, 'type').get, source, []);
  required(size > 0 && size <= COOP_PACK_MAX_BYTES, 'Choose a Team campaign under 1 MiB.');
  return Reflect.apply(Blob.prototype.slice, source, [0, size, type]);
};

/** Production Team accepts both its historical raw co-op JSON and the Creator
 * portable envelope. The latter is fully replay-verified before its pack can
 * enter the existing picture preparation and deliberate Start transaction. */
export async function readPlayableTeamCampaign(source, { signal } = {}) {
  const blob = ownedBlob(source);
  if (signal?.aborted) throw new DOMException('Team import cancelled.', 'AbortError');
  const text = await blob.text();
  if (signal?.aborted) throw new DOMException('Team import cancelled.', 'AbortError');
  let document = null;
  try {
    document = boundedJSON(text, {
      maxBytes: COOP_PACK_MAX_BYTES,
      maxNodes: 50000,
      maxDepth: 20,
      maxArray: 1024,
    });
  } catch {
    // Keep the historical reader's user-facing JSON/schema diagnostics.
  }
  if (
    blob.type === CREATOR_TEAM_PORTABLE_MIME ||
    document?.format === CREATOR_TEAM_PORTABLE_FORMAT
  ) {
    const prepared = await importCreatorTeamCampaign(blob, { signal });
    return Object.freeze({ kind: 'creator', pack: prepared.pack, prepared });
  }
  return Object.freeze({ kind: 'raw', pack: readCoopPack(text), prepared: null });
}
