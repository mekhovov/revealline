import { freezePresentation } from './model.mjs';

/** Runtime records are a publication projection, never replacement authoring
 * revisions. Pin identity is the hash of the complete projected runtime bytes.
 * Original creator notes, prompts, parent history and QA evidence stay private.
 * License attribution is retained for distribution. */
export function projectPlayerPresentation(resolved) {
  const value = structuredClone(resolved);
  for (const asset of Object.values(value.assets)) {
    asset.description = asset.id;
    asset.provenance = {
      creator: 'Published presentation',
      source: 'Player edition',
      license: asset.provenance.license,
      prompt: '',
      parent: null,
    };
    asset.quality = { stage: asset.quality.stage, evidence: [] };
  }
  return freezePresentation(value);
}

export function isPlayerPresentationProjection(resolved) {
  return Object.values(resolved.assets).every(
    (asset) =>
      asset.description === asset.id &&
      asset.provenance.creator === 'Published presentation' &&
      asset.provenance.source === 'Player edition' &&
      asset.provenance.prompt === '' &&
      asset.provenance.parent === null &&
      asset.quality.evidence.length === 0,
  );
}
