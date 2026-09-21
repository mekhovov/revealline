import { createRoverCandidates } from './rover-candidates.mjs';

/** Explicit successor under qualification. Historical sources/replays are not
 * reinterpreted. First closures now demonstrate the new movement domain, rather
 * than letting most of the introduction finish while its roamer sleeps remotely.
 * This factory alone does not enroll the successor in a playable Journey. */
export function createRoverTeachingCandidates(options = {}) {
  const source = createRoverCandidates(options);
  source.id = 'rover-teaching-candidates';
  source.name = 'Rover Yard · first-capture teaching review';
  source.revision = 'teaching-1';
  source.campaigns.find((c) => c.id === 'rover-yard').revision = 'teaching-1';
  source.packs.find((p) => p.id === 'journey-rover').revision = 'teaching-1';
  for (const [id, actorId, x, y] of [
    ['wake-the-yard', 'sleeper', 32.5, 7.5],
    ['split-berths', 'near-sleeper', 18.5, 5.5],
  ]) {
    const mission = source.missions.find((m) => m.id === id);
    mission.revision = 'teaching-1';
    Object.assign(
      mission.actors.find((a) => a.id === actorId),
      { x, y, heading: [0, 1] },
    );
    // Introduction/practice are learning stages, not an inferred inventory of
    // every enemy present. Advanced combinations follow in Stepped return.
    mission.design.combines = mission.design.combines.filter((role) => role !== 'reclaimed-roamer');
  }
  const opening = source.missions.find((m) => m.id === 'wake-the-yard');
  opening.actors = opening.actors.filter((a) => a.role !== 'perimeter-patrol');
  opening.design.combines = ['field-keeper'];
  opening.design.difficulty.threatDensity = 2;
  opening.design.routeDecision =
    'Wake the sleeper on the short island connection, or build a side return before reclaiming its corridor?';
  opening.design.counterplay =
    'The first island return wakes the sleeper behind you. Watch its one-second warning, then use either side of the broad platform for your next departure.';
  opening.design.memorableMoment =
    'Your first thin connection wakes a threat on the very ground you just reclaimed; the broad landing gives room to choose a way out.';
  const practice = source.missions.find((m) => m.id === 'split-berths');
  practice.design.counterplay =
    'The near sleeper wakes behind your first return. Leave its narrow connection for the broad berth; choose when to connect the far sleeper’s separate network.';
  return source;
}
