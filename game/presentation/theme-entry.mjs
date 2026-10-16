import { installThemeHost } from './theme-host.mjs';
import { loadAcceptedAppearance } from './theme-system.mjs';

// Auxiliary pages reuse only a recently accepted, bounded cosmetic context.
// Main game/profile hosts continue to supply their admitted edition inventory.
const doc = globalThis.document;
if (doc?.documentElement) {
  let accepted = null;
  try {
    accepted = loadAcceptedAppearance(globalThis.sessionStorage);
  } catch {
    /* Denied storage uses the ordinary app fallback. */
  }
  const data = doc.documentElement.dataset;
  const compiled =
    /^[a-z][a-z0-9-]{0,63}$/.test(data.appearanceFamily ?? '') &&
    /^r[1-9][0-9]{0,8}$/.test(data.appearanceRevision ?? '')
      ? { familyId: data.appearanceFamily, revision: data.appearanceRevision }
      : null;
  installThemeHost({
    studio: data.themeDensity === 'studio',
    appearanceThemes: accepted ? [accepted] : [],
    appearanceDefault:
      compiled ??
      (accepted ? { familyId: accepted.family.id, revision: accepted.family.revision } : undefined),
  });
}
