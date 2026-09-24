import { createWholeSortingCandidates } from './whole-spatial-candidates.mjs';
import { createSentinelInnerCandidates } from './sentinel-inner-candidates.mjs';
import { createSpatialChallengeCandidates } from './spatial-challenge-candidates.mjs';

/** Phase A composes the independently reviewed inner-receiver study with five
 * spatial successors. Historical factories and original picture bindings stay
 * immutable; no historical suspended attempt is reinterpreted as this edition. */
export function createSpatialChallengeJourney({ artwork = false } = {}) {
  const source = createWholeSortingCandidates({ artwork });
  const study = createSentinelInnerCandidates();
  const replacement = study.missions.find((mission) => mission.id === 'twin-receivers');
  const index = source.missions.findIndex((mission) => mission.id === replacement.id);
  const previous = source.missions[index];
  source.missions[index] = { ...replacement, presentation: previous.presentation };
  const sameMap = (a, b) => a.id === b.id && a.revision === b.revision;
  source.maps = source.maps.filter(
    (map) =>
      !sameMap(map, previous.map) || source.missions.some((mission) => sameMap(map, mission.map)),
  );
  const map = study.maps.find((candidate) => sameMap(candidate, replacement.map));
  if (!source.maps.some((candidate) => sameMap(candidate, map))) source.maps.push(map);
  return createSpatialChallengeCandidates({ artwork, source });
}
