import { canonicalJSON, required } from '../data-json.mjs';
import {
  FORMATS,
  freezePresentation,
  resolvePresentation,
  validateAssetSlotSpec,
  validateThemeBundle,
} from './model.mjs';

const PURPOSES = Object.freeze({
  'joint-capture':
    'Two pilots joined their cuts. A small joint cut need not earn Joint Cut credit; this icon celebrates teamwork, never a medal or invented reward.',
  'team-recovery':
    'Both pilots returned through one shared reserve. This is distinct from a personal contact rescue or an individual reserve revival; no protective radius or extra life is implied.',
});
const DIMENSIONS = Object.freeze({ 'joint-capture': 32, 'team-recovery': 32 });
export const TEAM_EVENT_SLOTS = freezePresentation(
  ['joint-capture', 'team-recovery'].map((state) => ({
    id: `team.event.${state}`,
    state,
    label: `Team event: ${state}`,
  })),
);
export const teamEventSlot = (id) => TEAM_EVENT_SLOTS.find((row) => row.id === id) ?? null;
export function teamEventSlotSpecs() {
  return TEAM_EVENT_SLOTS.map((row) =>
    validateAssetSlotSpec({
      format: FORMATS.slot,
      id: row.id,
      revision: 1,
      label: row.label,
      group: 'effects',
      screens: ['couch', 'studio'],
      kinds: ['recipe', 'image'],
      recipes: ['team.event.v1'],
      required: false,
      dimensions: { width: DIMENSIONS[row.state], height: DIMENSIONS[row.state] },
      alpha: 'required',
      sampling: 'nearest',
      states: ['default'],
      requirements: [
        PURPOSES[row.state],
        'A 32×32 centered transparent status icon outside playable cells, alongside an authoritative text caption. Never add a world position, capture boundary or collision radius.',
        'Use distinct readable silhouettes. Keep both participants legible without relying on colour alone; no text, number, trophy, medal, progress, blur, baked glow or background.',
        'The runtime retains an actual per-step event for a short simulation-time cue. Pause retains its timing; reduced effects uses the same meaning without decorative animation. No repeated sound or rewards.',
        'Inspect both arenas Joint capture and Relay Yard Team reserve recovery in Field context. First Connection has no approved Team reserve recovery specimen.',
      ],
      prompt: `Create an original ${row.label.toLowerCase()} status icon for Reveal Line's resolved theme. ${PURPOSES[row.state]} Export exactly 32 by 32 transparent pixels with centered pivot and deliberate crisp clusters. Use the resolved palette; keep two participants identifiable by shape as well as colour. No words, number, trophy, medal, progress, blur, baked glow, background or invented protection range. This icon appears beside an authoritative HUD caption outside playable cells, never over the field or controls. Inspect at 24 and 32 CSS pixels, standard/large text and reduced effects. For joint capture, inspect both existing arenas; for shared reserve recovery, inspect the command-earned Relay Yard scene. Keep source, prepared PNG, provenance and exact immutable revisions. Do not change capture credit, reserves, rescue, grace duration or gameplay.`,
      budget: { maxBytes: 131072 },
      palette: ['#070b12', '#101923', '#f3f0db', '#78dce8', '#f4bf62', '#f07879', '#9dbb7a'],
      geometry: {
        frame: { x: 0, y: 0, width: DIMENSIONS[row.state], height: DIMENSIONS[row.state] },
        pivot: { x: 0.5, y: 0.5 },
        occupiedBounds: null,
        rotorAnchors: [],
        nineSlice: null,
      },
      dependencies: [],
      owner: null,
    }),
  );
}
export function checkTeamEventContracts(incoming) {
  const selected = incoming.slots.filter((slot) => teamEventSlot(slot.id));
  required(
    !selected.length || selected.length === TEAM_EVENT_SLOTS.length,
    'Imported Team events must include both slot contracts.',
  );
  const expected = new Map(teamEventSlotSpecs().map((slot) => [slot.id, slot]));
  for (const slot of selected)
    required(
      canonicalJSON(slot) === canonicalJSON(expected.get(slot.id)),
      `Unsupported imported Team event contract: ${slot.id}.`,
    );
}
export function prepareTeamEventSlots(source) {
  const previous = validateThemeBundle(source);
  checkTeamEventContracts(previous);
  const view = resolvePresentation(previous);
  if (TEAM_EVENT_SLOTS.every((row) => view.assets[row.id])) return previous;
  const next = structuredClone(previous),
    bindings = {};
  for (const spec of teamEventSlotSpecs()) {
    if (!next.slots.some((slot) => slot.id === spec.id)) next.slots.push(spec);
    if (view.assets[spec.id]) continue;
    const id = `${spec.id}.procedural`,
      revision =
        Math.max(
          0,
          ...next.assets.filter((asset) => asset.id === id).map((asset) => asset.revision),
        ) + 1;
    next.assets.push({
      format: FORMATS.asset,
      id,
      revision,
      kind: 'recipe',
      description: `${spec.label}: the existing authoritative status message; local editable starting point, visual review required.`,
      provenance: {
        creator: 'Reveal Line',
        source: 'game/couch/relay-rescue.mjs per-step event status',
        license: 'Project-authored procedural presentation',
        prompt: spec.prompt,
        parent: null,
      },
      file: null,
      recipe: { id: 'team.event.v1' },
      geometry: null,
      quality: {
        stage: 'source',
        evidence: [
          'Existing runtime status meaning; registration does not certify a theme or replacement artwork.',
        ],
      },
    });
    bindings[spec.id] = { id, revision };
  }
  const current = next.themes.find(
    (theme) =>
      theme.id === next.selection.theme.id && theme.revision === next.selection.theme.revision,
  );
  const collection =
    next.selection.collection &&
    next.collections.find(
      (item) =>
        item.id === next.selection.collection.id &&
        item.revision === next.selection.collection.revision,
    );
  const theme = {
    ...structuredClone(current),
    revision:
      Math.max(
        ...next.themes.filter((item) => item.id === current.id).map((item) => item.revision),
      ) + 1,
    parent: { id: current.id, revision: current.revision },
    tokens: {},
    bindings: { ...collection?.bindings, ...bindings },
  };
  next.themes.push(theme);
  next.selection.theme = { id: theme.id, revision: theme.revision };
  next.selection.collection = null;
  next.revision++;
  return validateThemeBundle(next, { previous, expectedRevision: previous.revision });
}
