import { isAuthoredJourneyRouteId } from './mode-href.mjs';
import { createAuthoredJourneyRouteDefinition } from './route-definition.mjs';
import { loadRouteSnapshot } from './route-snapshot.mjs';

// Replaced only in a newly built distribution. Historical source routes stay exact.
const SHIPPED_ROUTE_SNAPSHOT = null;

/** Load only the explicitly selected source family. Imports are fixed local
 * modules, never URLs derived from user/imported data. Keep source construction
 * and validation unchanged; module failures propagate to the existing boot UI. */
export async function loadAuthoredJourneyRoute(id, options = {}) {
  if (!isAuthoredJourneyRouteId(id)) return null;
  if (SHIPPED_ROUTE_SNAPSHOT?.id === id) return loadRouteSnapshot(SHIPPED_ROUTE_SNAPSHOT, options);
  let factories;
  if (id === 'pursuit-campaigns-v1') {
    factories = await import('./pursuit-campaign-candidates.mjs');
  } else if (id === 'pursuit-pilots-v1') {
    factories = await import('./pursuit-pilot-candidates.mjs');
  } else if (id === 'snake-hunt-v1') {
    factories = await import('./snake-hunt-candidates.mjs');
  } else if (id === 'humanoid-hunt-v1') {
    factories = await import('./hunt-training-candidates.mjs');
  } else if (id === 'whole-spatial-v38') {
    factories = await import('./cooling-loop-erosion-candidates.mjs');
  } else if (id === 'whole-spatial-v37') {
    factories = await import('./pressure-corridor-triptych-candidates.mjs');
  } else if (id === 'whole-spatial-v36') {
    factories = await import('./contested-wall-triptych-candidates.mjs');
  } else if (id === 'whole-spatial-v35') {
    factories = await import('./current-remix-pressure-candidates.mjs');
  } else if (id === 'whole-spatial-v34') {
    factories = await import('./cultural-pressure-triptych-candidates.mjs');
  } else if (id === 'whole-spatial-v33') {
    factories = await import('./cultural-timed-bonus-pressure-candidates.mjs');
  } else if (id === 'whole-spatial-v32') {
    factories = await import('./border-frontier-pocket-candidates.mjs');
  } else if (id === 'whole-spatial-v31') {
    factories = await import('./border-cultural-completion-candidates.mjs');
  } else if (id === 'whole-spatial-v30') {
    factories = await import('./rover-cultural-completion-candidates.mjs');
  } else if (id === 'whole-spatial-v29') {
    factories = await import('./neon-cultural-completion-candidates.mjs');
  } else if (id === 'whole-spatial-v28') {
    factories = await import('./fracture-apex-cultural-completion-candidates.mjs');
  } else if (id === 'whole-spatial-v27') {
    factories = await import('./crosswind-cultural-completion-candidates.mjs');
  } else if (id === 'whole-spatial-v26') {
    factories = await import('./relay-cultural-completion-candidates.mjs');
  } else if (id === 'whole-spatial-v25') {
    factories = await import('./apex-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v24') {
    factories = await import('./sentinel-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v23') {
    factories = await import('./crosswind-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v22') {
    factories = await import('./relay-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v21') {
    factories = await import('./livewire-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v20') {
    factories = await import('./phaseworks-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v19') {
    factories = await import('./fracture-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v18') {
    factories = await import('./rover-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v17') {
    factories = await import('./neon-cultural-routes-finale-candidates.mjs');
  } else if (id === 'whole-spatial-v16') {
    factories = await import('./neon-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v15') {
    factories = await import('./signal-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v14') {
    factories = await import('./early-cultural-routes-candidates.mjs');
  } else if (id === 'whole-spatial-v13') {
    factories = await import('./border-signal-cultural-next-batch-candidates.mjs');
  } else if (id === 'whole-spatial-v12') {
    factories = await import('./border-cultural-next-batch-candidates.mjs');
  } else if (id === 'whole-ornament-v2') {
    factories = await import('./ukrainian-ornament-atlas.mjs');
  } else if (id === 'whole-ornament-v1') {
    factories = await import('./ukrainian-ornament-candidates.mjs');
  } else if (id === 'whole-spatial-v11') {
    factories = await import('./horizon-next-batch-candidates.mjs');
  } else if (id === 'whole-spatial-v10') {
    factories = await import('./spatial-next-batch-candidates.mjs');
  } else if (id.startsWith('whole-spatial-')) {
    factories = await import('./whole-spatial-candidates.mjs');
  } else if (id.startsWith('whole-originals')) {
    factories = await import('./whole-journey-candidates.mjs');
  } else {
    const opening = import('./horizon-candidates.mjs');
    const border = id === 'authored' ? import('./border-candidates.mjs') : null;
    const [first, second] = await Promise.all([opening, border]);
    factories = { ...first, ...second };
  }
  return createAuthoredJourneyRouteDefinition(id, factories);
}
