import { isAuthoredJourneyRouteId } from './mode-href.mjs';
import { createAuthoredJourneyRouteDefinition } from './route-definition.mjs';

/** Load only the explicitly selected source family. Imports are fixed local
 * modules, never URLs derived from user/imported data. Keep source construction
 * and validation unchanged; module failures propagate to the existing boot UI. */
export async function loadAuthoredJourneyRoute(id) {
  if (!isAuthoredJourneyRouteId(id)) return null;
  let factories;
  if (id === 'whole-spatial-v15') {
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
