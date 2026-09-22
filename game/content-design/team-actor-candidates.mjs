import { createTeamJourneyCandidates } from './team-journey-candidates.mjs';
import { journeyActorThemeMaterial } from '../presentation/journey-actor-materials.mjs';

// Purpose-built Team arcs, not a positional mapping onto the twelve Solo packs.
const themes = Object.freeze({
  'twin-landings': 'horizon',
  'stepping-exchange': 'horizon',
  'divided-workshop': 'horizon',
  'switchback-partners': 'horizon',
  'shared-detour': 'signal-gardens',
  'crossed-gardens': 'signal-gardens',
  'split-orchards': 'signal-gardens',
  'weaver-crossing': 'signal-gardens',
  'shared-lookout': 'rover-yard',
  'twin-depots': 'rover-yard',
  'changing-courtyard': 'rover-yard',
  'last-rendezvous': 'rover-yard',
});

/** Explicit successor source only. The live host must still prepare the exact
 * presentation/picture lease; declaring a theme never grants drawing authority. */
export function createTeamActorCandidates() {
  const source = createTeamJourneyCandidates({ artwork: true });
  source.id = 'team-journey-actor-review';
  source.name = 'Team Journey · unvalidated actor material review';
  source.revision += '-actors-1';
  for (const key of ['missions', 'campaigns', 'packs'])
    for (const item of source[key]) item.revision += '-actors-1';
  for (const mission of source.missions) {
    const base = Object.hasOwn(themes, mission.id) ? themes[mission.id] : null;
    if (!base || !journeyActorThemeMaterial(`${base}-actors-v1`))
      throw new Error(`Team material review needs an authored treatment: ${mission.id}.`);
    mission.presentation.themeId = `${base}-actors-v1`;
  }
  return source;
}
