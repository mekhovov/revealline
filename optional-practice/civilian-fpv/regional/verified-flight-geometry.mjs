/** Trusted authoring geometry profiles; only verified companion layers may be composed. */
import { createVerifiedTerrainWindow } from './verified-terrain-window.mjs';
import { createVerifiedSceneryWindow } from './verified-scenery-window.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';

export function createVerifiedFlightGeometry(
  manifest,
  {
    profile = 'terrain-v1',
    source,
    scenery: companion = null,
    budgets,
    retainCommitted = false,
  } = {},
) {
  if (profile === 'terrain-scenery-v1')
    return createVerifiedMixedWindow(manifest, {
      ...budgets,
      source,
      scenery: companion,
      retainCommitted,
    });
  if (companion !== null) throw new TypeError('Scenery companion requires explicit mixed profile');
  if (!['terrain-v1', 'scenery-v1'].includes(profile))
    throw new TypeError('Unsupported regional geometry profile; mixed frames are not admitted');
  const scenery = profile === 'scenery-v1';
  const owner = scenery
    ? createVerifiedSceneryWindow(manifest, { ...source, retainCommitted })
    : createVerifiedTerrainWindow(manifest, { ...source, retainCommitted });
  const snapshot = () => {
    const state = owner.snapshot();
    return {
      ...state,
      geometryProfile: profile,
      // Keep the existing host envelope; ready means this one verified profile is prepared.
      terrainReady: scenery ? state.sceneryReady : state.terrainReady,
    };
  };
  const query = (result) => {
    if (!scenery) return result;
    if (result.status === 'scenery-hit') return { ...result, status: 'terrain-hit' };
    if (result.status === 'scenery-clear') return { ...result, status: 'terrain-clear' };
    return result; // Missing/unknown geometry can never become clear space.
  };
  return Object.freeze({
    snapshot,
    collisionSnapshot: () => owner.collisionSnapshot(),
    get group() {
      return owner.group;
    },
    async transition(...args) {
      await owner.transition(...args);
      return snapshot();
    },
    flightSupport(...args) {
      return owner.flightSupport(...args);
    },
    castMotion(...args) {
      return owner.castMotion(...args);
    },
    support(...args) {
      return query(owner.support(...args));
    },
    sweep(...args) {
      return query(owner.sweep(...args));
    },
    cancel() {
      owner.cancel();
    },
    dispose() {
      return owner.dispose();
    },
  });
}
