import { freezeDesign } from './catalogs.mjs';

// Theme IDs are authored identities, not title/substring matches. Palette and
// render definitions live only in themes.json; this table binds chapter sources.
// No music preference, actor behavior, image, collision or release enrollment.
export const JOURNEY_CAMPAIGN_THEMES = freezeDesign({
  horizon: 'horizon',
  border: 'border-bloom',
  signal: 'signal-gardens',
  neon: 'neon-contours',
  rover: 'rover-yard',
  fracture: 'fractured-grid',
  phase: 'phaseworks',
  livewire: 'livewire-foundry',
  relay: 'relay-labyrinth',
  crosswind: 'crosswind-array',
  sentinel: 'sentinel-crown',
  apex: 'apex-aurora',
});

/** Copy-on-write explicit successor. Never reinterpret an old replay or silently
 * change a default factory's presentation identity. Mixed-theme chapters need a
 * separately reviewed projection, not partial rewriting of their inheritance. */
export function withCampaignPresentation(source, chapterId) {
  const themeId = Object.hasOwn(JOURNEY_CAMPAIGN_THEMES, chapterId)
    ? JOURNEY_CAMPAIGN_THEMES[chapterId]
    : null;
  if (!themeId) throw new Error('Unknown Journey presentation chapter.');
  if (!source.missions?.length) throw new Error('A presentation chapter needs missions.');
  const copy = structuredClone(source);
  if (new Set(copy.missions.map((mission) => mission.presentation.themeId)).size !== 1)
    throw new Error('A mixed-theme chapter needs an explicit presentation design.');
  if (copy.missions.every((mission) => mission.presentation.themeId === themeId)) return copy;
  const revision = (value) => `${value}-theme-1`;
  copy.id = `${copy.id}-themes`;
  copy.revision = revision(copy.revision);
  for (const key of ['missions', 'campaigns', 'packs'])
    for (const item of copy[key]) item.revision = revision(item.revision);
  for (const mission of copy.missions) mission.presentation.themeId = themeId;
  return copy;
}
