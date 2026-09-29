import { TOKEN_DEFAULTS } from './model.mjs';
import { presentationCSSVariables } from './runtime.mjs';

// Menu chrome only. These immutable records are not authored theme, collection,
// asset or canvas revisions and never replace a release's resolved snapshot.
export const UKRAINIAN_MENU_STYLE = Object.freeze({
  id: 'fpv.ukrainian-menu',
  revision: 1,
  tokens: Object.freeze({
    ink: '#071527',
    panel: '#10243e',
    panelRaised: '#10243e',
    text: '#f6f3e8',
    muted: '#a8b8cc',
    line: '#a8b8cc',
    controlLine: '#67aaff',
    cyan: '#67aaff',
    amber: '#ffd64a',
    hazard: '#ff7169',
  }),
  decorativeBlue: '#0057b7',
});

const menuColors = Object.freeze([
  'bg',
  'panel',
  'panel-raised',
  'text',
  'muted',
  'line',
  'control-line',
  'cyan',
  'amber',
  'hazard',
]);

export function menuStyleVariables() {
  const colors = presentationCSSVariables({
    tokens: { ...TOKEN_DEFAULTS, ...UKRAINIAN_MENU_STYLE.tokens },
    assets: {},
  });
  return Object.freeze({
    ...Object.fromEntries(menuColors.map((name) => [`--rl-menu-${name}`, colors[`--fk-${name}`]])),
    '--rl-menu-decorative': UKRAINIAN_MENU_STYLE.decorativeBlue,
  });
}

export function resolveMenuStyle({ palette, ornaments }, themeId) {
  if (!['auto', 'ukrainian'].includes(palette)) throw new TypeError('Invalid menu palette.');
  if (!['off', 'subtle', 'rich'].includes(ornaments))
    throw new TypeError('Invalid menu ornaments.');
  return Object.freeze({
    palette: palette === 'ukrainian' || themeId === 'fpv' ? 'ukrainian' : 'authored',
    ornaments,
  });
}
