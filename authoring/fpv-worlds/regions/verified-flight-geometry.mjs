/** Trusted authoring geometry profiles. Mixed terrain/scenery frames are not admitted. */
import { createVerifiedTerrainWindow } from './verified-terrain-window.mjs';
import { createVerifiedSceneryWindow } from './verified-scenery-window.mjs';

export function createVerifiedFlightGeometry(manifest, { profile = 'terrain-v1', source } = {}) {
  if (!['terrain-v1', 'scenery-v1'].includes(profile))
    throw new TypeError('Unsupported regional geometry profile; mixed frames are not admitted');
  const scenery = profile === 'scenery-v1';
  const owner = scenery
    ? createVerifiedSceneryWindow(manifest, source)
    : createVerifiedTerrainWindow(manifest, source);
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
    get group() {
      return owner.group;
    },
    async transition(...args) {
      await owner.transition(...args);
      return snapshot();
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
