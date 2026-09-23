import { TEAM_OUTCOME_SLOTS } from '../couch/coop-outcome-presentation.mjs';
import { TEAM_ENEMY_SLOTS } from '../couch/coop-enemy-slots.mjs';
import { TEAM_PILOT_SLOTS } from '../couch/coop-pilot-slots.mjs';
import { TEAM_RESCUE_SLOTS } from '../couch/coop-rescue-presentation.mjs';
import { TEAM_EMITTER_SLOTS } from '../couch/coop-emitter-presentation.mjs';
import { TEAM_SUPPORT_SLOTS } from '../couch/coop-support-presentation.mjs';
import { createDefaultThemeBundle } from './catalog.mjs';
import { validateThemeBundle, resolvePresentation } from './model.mjs';
import { TEAM_ANCHOR_SLOTS } from '../couch/coop-anchor-presentation.mjs';
import { TEAM_CORE_SLOTS } from '../couch/coop-core-presentation.mjs';
const TEAM_OBJECTIVE_SLOTS = Object.freeze([...TEAM_ANCHOR_SLOTS, ...TEAM_CORE_SLOTS]);
const TEAM_PRESENTATION_SLOTS = Object.freeze([
  ...TEAM_OBJECTIVE_SLOTS,
  ...TEAM_SUPPORT_SLOTS,
  ...TEAM_EMITTER_SLOTS,
  ...TEAM_RESCUE_SLOTS,
  ...TEAM_PILOT_SLOTS,
  ...TEAM_ENEMY_SLOTS,
  ...TEAM_OUTCOME_SLOTS,
]);

function needsSlots(source, ids) {
  const resolved = resolvePresentation(source);
  return ids.some((id) => !source.slots.some((slot) => slot.id === id) || !resolved.assets[id]);
}
export const needsTeamPresentationSlots = (source) => needsSlots(source, TEAM_PRESENTATION_SLOTS);
export const addTeamPresentationSlots = (source) =>
  addSlots(source, TEAM_PRESENTATION_SLOTS, 'Team presentation');
export const needsTeamAnchorSlots = (source) => needsSlots(source, TEAM_ANCHOR_SLOTS);
export const needsTeamObjectiveSlots = (source) => needsSlots(source, TEAM_OBJECTIVE_SLOTS);
export const addTeamAnchorSlots = (source) => addSlots(source, TEAM_ANCHOR_SLOTS, 'Team anchor');
export const addTeamObjectiveSlots = (source) =>
  addSlots(source, TEAM_OBJECTIVE_SLOTS, 'Team objective');

/** Explicit, undoable authoring change only. Append the missing contract and
 * a new selected theme revision; never rewrite old records or touch game saves. */
function addSlots(source, ids, label) {
  const previous = validateThemeBundle(source);
  if (!needsSlots(previous, ids)) throw new Error(`${label} slots are already available.`);
  const next = structuredClone(previous),
    defaults = createDefaultThemeBundle(),
    resolved = resolvePresentation(previous),
    bindings = {};
  for (const id of ids) {
    if (!next.slots.some((slot) => slot.id === id))
      next.slots.push(structuredClone(defaults.slots.find((slot) => slot.id === id)));
    if (resolved.assets[id]) continue;
    const original = defaults.assets.find((asset) => asset.id === `${id}.default`);
    const asset = {
      ...structuredClone(original),
      revision:
        Math.max(
          0,
          ...next.assets.filter((row) => row.id === original.id).map((row) => row.revision),
        ) + 1,
    };
    next.assets.push(asset);
    bindings[id] = { id: asset.id, revision: asset.revision };
  }
  const current = next.themes.find(
    (theme) =>
      theme.id === next.selection.theme.id && theme.revision === next.selection.theme.revision,
  );
  const selectedCollection =
    next.selection.collection &&
    next.collections.find(
      (item) =>
        item.id === next.selection.collection.id &&
        item.revision === next.selection.collection.revision,
    );
  const theme = {
    ...structuredClone(current),
    revision:
      Math.max(...next.themes.filter((row) => row.id === current.id).map((row) => row.revision)) +
      1,
    parent: { id: current.id, revision: current.revision },
    tokens: {},
    bindings: { ...selectedCollection?.bindings, ...bindings },
  };
  next.themes.push(theme);
  next.selection.theme = { id: theme.id, revision: theme.revision };
  next.selection.collection = null;
  next.revision++;
  return validateThemeBundle(next, { previous, expectedRevision: previous.revision });
}
