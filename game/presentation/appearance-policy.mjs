import { resolveActorStyleForBoundary } from './actor-style-policy.mjs';
import { resolveMenuStyle } from './menu-styles.mjs';

export const UI_SKINS = Object.freeze(['neon-arcade', 'fpv-field-kit']);
export const DEFAULT_UI_SKIN = 'neon-arcade';

const defaultMenuPreference = Object.freeze({ palette: 'auto', ornaments: 'subtle' });
const defaultActorPreference = Object.freeze({ actorStyle: 'fpv' });

function uiSkinForPalette(palette) {
  return palette === 'field-kit' ? 'fpv-field-kit' : 'neon-arcade';
}

/**
 * Resolve the two independent player-facing appearance choices at an explicit
 * attempt boundary. Menu chrome always follows the current menu preference;
 * actor presentation follows the retained/fresh boundary contract. This is a
 * pure decision and never reads storage, prepares assets, or rewrites a pin.
 */
export function resolveAppearanceForBoundary({
  menuPreference = defaultMenuPreference,
  actorPreference = defaultActorPreference,
  boundary,
  retainedActorStyle = null,
} = {}) {
  const menu = resolveMenuStyle(menuPreference);
  const actor = resolveActorStyleForBoundary({
    requested: actorPreference?.actorStyle,
    boundary,
    retainedStyle: retainedActorStyle,
  });
  return Object.freeze({
    uiSkin: uiSkinForPalette(menu.palette),
    menuPalette: menu.palette,
    ornaments: menu.ornaments,
    actorStyle: actor.actorStyle,
    actorSource: actor.source,
    actorDeferred: actor.deferred,
  });
}
