import { createCulturalWorkshopCandidates } from './cultural-workshop-candidates.mjs';
import { createSpatialBalanceCandidates } from './spatial-balance-candidates.mjs';
import { CULTURAL_WORKSHOP_ART_CANDIDATES } from './cultural-workshop-art.mjs';
import { compileContentProject } from './project.mjs';

/** Explicit candidate picture edition. Never changes greybox defaults, maps,
 * physics, theme roles, public enrollment or another edition's media pins. */
export function createCulturalWorkshopArtCandidates({ spatial = false } = {}) {
  if (typeof spatial !== 'boolean') throw new Error('Spatial edition choice must be boolean.');
  const source = spatial ? createSpatialBalanceCandidates() : createCulturalWorkshopCandidates();
  const project = structuredClone(source);
  project.id = `${source.id}-art-r1`;
  project.revision = `${source.revision}-art-r1`;
  project.name = `${source.name} · original candidate pictures`;
  project.assets = structuredClone(CULTURAL_WORKSHOP_ART_CANDIDATES);
  if (project.assets.length !== 8 || project.missions.length !== 8)
    throw new Error('The pictured study requires all eight mission/asset bindings.');
  for (const mission of project.missions) {
    const id = `cultural-workshop-${mission.id}`;
    if (project.assets.filter((asset) => asset.id === id).length !== 1)
      throw new Error(`Missing or duplicate picture for ${mission.id}.`);
    mission.presentation.backgroundAssetId = id;
  }
  for (const item of [...project.missions, ...project.campaigns, ...project.packs])
    item.revision = `${item.revision}-art-r1`;
  return structuredClone(compileContentProject(project).source);
}
