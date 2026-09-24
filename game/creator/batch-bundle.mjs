import { exactKeys, required } from '../data-json.mjs';
import { assembleCreatorBatchPackage, assembleCreatorBatchProject } from './batch.mjs';
import { prepareCreatorBundle } from './bundle.mjs';

/** Adapter seam for Studio review results. It selects only prepared runtime
 * derivatives referenced by the assembled project; retained source originals,
 * thumbnails and unrelated media never enter the portable bundle input. */
export function creatorBatchBundleInput(batch, settings) {
  required(settings && typeof settings === 'object', 'Review batch sharing information.');
  exactKeys(settings, ['themes', 'credits', 'plan', 'part'], 'batch bundle settings');
  const planned = settings.plan !== undefined || settings.part !== undefined;
  required(
    !planned || (settings.plan && Number.isInteger(settings.part)),
    'Choose both the reviewed split plan and one of its parts.',
  );
  const assembled = planned
    ? assembleCreatorBatchPackage(batch, settings.plan, settings.part)
    : assembleCreatorBatchProject(batch);
  const wanted = new Set(assembled.project.assets.map((asset) => asset.sha256));
  const found = new Map();
  for (const item of batch.items) {
    const runtime = item.image?.runtime;
    if (runtime && wanted.has(runtime.sha256) && !found.has(runtime.sha256))
      found.set(runtime.sha256, Object.freeze({ sha256: runtime.sha256, blob: runtime.blob }));
  }
  required(
    found.size === wanted.size && [...wanted].every((sha256) => found.has(sha256)),
    'Regenerate a missing runtime picture before preparing this package.',
  );
  return Object.freeze({
    content: Object.freeze({
      project: assembled.project,
      packId: assembled.packId,
      themes: settings.themes,
      provenance: assembled.provenance,
      credits: settings.credits,
    }),
    assets: Object.freeze([...wanted].sort().map((sha256) => found.get(sha256))),
    part: planned ? assembled.part : 1,
    parts: planned ? assembled.parts : 1,
  });
}

export async function prepareCreatorBatchBundle(batch, settings, options = {}) {
  const input = creatorBatchBundleInput(batch, settings);
  const prepared = await prepareCreatorBundle(input.content, input.assets, options);
  return Object.freeze({ ...input, prepared });
}
