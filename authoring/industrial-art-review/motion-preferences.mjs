import { createDisplayPreferences } from '../../game/display-preferences.mjs';

const messages = {
  en: {
    local: 'This checkbox applies only to this review.',
    shared:
      'Your shared game setting requires Reduced effects. This checkbox only adds a local preference for this review.',
    system:
      'Your system requires reduced motion. This checkbox only adds a local preference for this review.',
  },
  uk: {
    local: 'Цей перемикач діє лише в цьому перегляді.',
    shared:
      'Спільні налаштування гри вимагають менше ефектів. Цей перемикач лише додає локальне налаштування для цього перегляду.',
    system:
      'Система вимагає зменшення руху. Цей перемикач лише додає локальне налаштування для цього перегляду.',
  },
};

/** The review can further reduce motion, but cannot override shared or OS
 * policy. Reading or toggling this local specimen control never saves settings. */
export function mountReviewMotionPreferences({ window, checkbox, notice, getLocale }) {
  const preferences = createDisplayPreferences({ window, getStorage: () => window.localStorage });
  const refresh = () => {
    const state = preferences.snapshot(),
      reason = state.reducedEffects ? 'shared' : state.effectiveReducedEffects ? 'system' : 'local',
      message = messages[getLocale() === 'uk' ? 'uk' : 'en'][reason];
    if (notice.textContent !== message) notice.textContent = message;
  };
  const unsubscribe = preferences.subscribe(refresh);
  return Object.freeze({
    reducedEffects: () => checkbox.checked || preferences.snapshot().effectiveReducedEffects,
    refresh,
    dispose() {
      unsubscribe();
      preferences.dispose();
    },
  });
}
