import { matchingSlots } from './helpers.mjs';

export const STUDIO_INVENTORY_HISTORY_KEY = 'reveallineStudioInventory';
const plain = (value) =>
  value !== null &&
  typeof value === 'object' &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value, limit = 512) =>
  typeof value === 'string' && value.length <= limit ? value : '';

/** This view hint never carries workspace, asset, theme or player data. */
export function normalizeStudioInventoryView(value, document, presentation) {
  const input = plain(value) ? value : {};
  const pick = (key, choices) => (choices.includes(input[key]) ? input[key] : '');
  const filters = {
    query: text(input.query),
    screen: pick(
      'screen',
      document.slots.flatMap((slot) => slot.screens),
    ),
    state: pick(
      'state',
      document.slots.flatMap((slot) => slot.states),
    ),
    kind: pick('kind', ['image', 'recipe', 'font', 'audio']),
    quality: pick('quality', ['unfinished', 'missing', 'source', 'produced', 'reviewed']),
  };
  const rows = matchingSlots(document.slots, presentation, filters);
  // Filtering does not dismiss a valid inspector selection in the live Studio.
  const selected =
    document.slots.find((slot) => slot.id === text(input.selected))?.id ??
    rows[0]?.id ??
    document.slots[0]?.id;
  return { version: 1, selected, ...filters };
}

export function createStudioInventoryHistory(host) {
  return {
    read() {
      try {
        const state = host.history.state;
        const value = plain(state) ? state[STUDIO_INVENTORY_HISTORY_KEY] : null;
        return plain(value) && value.version === 1 ? { ...value } : null;
      } catch {
        return null;
      }
    },
    write(view) {
      try {
        const state = host.history.state;
        // A foreign primitive, array or special object must keep its exact shape.
        if (state !== null && !plain(state)) return false;
        const value = { version: 1 };
        for (const key of ['selected', 'query', 'screen', 'state', 'kind', 'quality'])
          value[key] = text(view[key]);
        host.history.replaceState({ ...state, [STUDIO_INVENTORY_HISTORY_KEY]: value }, '');
        return true;
      } catch {
        return false;
      }
    },
  };
}
