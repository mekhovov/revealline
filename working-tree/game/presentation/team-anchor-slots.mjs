import { canonicalJSON, required } from '../data-json.mjs';
import {
  FORMATS,
  freezePresentation,
  resolvePresentation,
  validateAssetSlotSpec,
  validateThemeBundle,
} from './model.mjs';

export const TEAM_ANCHOR_SLOTS = freezePresentation(
  ['available', 'captured'].map((state) => ({
    id: `team.anchor.${state}`,
    state,
    label: `Team relay anchor: ${state}`,
  })),
);
export const teamAnchorSlot = (id) => TEAM_ANCHOR_SLOTS.find((row) => row.id === id) ?? null;
export function teamAnchorSlotSpecs() {
  return TEAM_ANCHOR_SLOTS.map((row) =>
    validateAssetSlotSpec({
      format: FORMATS.slot,
      id: row.id,
      revision: 1,
      label: row.label,
      group: 'objectives',
      screens: ['couch', 'studio'],
      kinds: ['recipe', 'image'],
      recipes: ['team.anchor.v1'],
      required: false,
      dimensions: { width: 24, height: 24 },
      alpha: 'required',
      sampling: 'nearest',
      states: ['default'],
      requirements: [
        `Relay anchor ${row.state}; this is a stronghold objective, never an ordinary pickup or Support/Scan icon.`,
        'Runtime places the anchor letter or captured check beside the artwork. No text or progress may be baked into the artwork.',
        'Cosmetic 24×24 transparent pixel artwork. Cosmetic display has a 24 CSS-pixel minimum; the runtime keeps the exact capture marker, label, border, state and timing.',
        'Review both states together in Relay Yard and imported multi-stronghold maps, over light/dark art and black concealment.',
        'First Connection has no relay anchors; its preview must report this role as inactive rather than inventing an objective.',
      ],
      prompt: `Create an original ${row.label.toLowerCase()} marker for Reveal Line's resolved theme. Export a 24 by 24 transparent PNG with crisp pixel clusters, centred pivot and no text, blur, baked glow or background. Keep a silhouette distinct from pickups, Support and Scan. Preserve objective semantics and review available/captured as one pair at actual Team playing sizes. Retain original, prepared derivative, provenance and alpha/dimension validation. Artwork never changes capture geometry or gameplay.`,
      budget: { maxBytes: 131072 },
      palette: ['#070b12', '#101923', '#f3f0db', '#78dce8', '#f4bf62', '#f07879', '#9dbb7a'],
      geometry: {
        frame: { x: 0, y: 0, width: 24, height: 24 },
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
export function checkTeamAnchorContracts(incoming) {
  const selected = incoming.slots.filter((slot) => teamAnchorSlot(slot.id));
  required(
    !selected.length || selected.length === TEAM_ANCHOR_SLOTS.length,
    'Imported Team anchors must include both slot contracts.',
  );
  const expected = new Map(teamAnchorSlotSpecs().map((slot) => [slot.id, slot]));
  for (const slot of selected)
    required(
      canonicalJSON(slot) === canonicalJSON(expected.get(slot.id)),
      `Unsupported imported Team anchor contract: ${slot.id}.`,
    );
}
export function prepareTeamAnchorSlots(source) {
  const previous = validateThemeBundle(source);
  checkTeamAnchorContracts(previous);
  const view = resolvePresentation(previous);
  if (TEAM_ANCHOR_SLOTS.every((row) => view.assets[row.id])) return previous;
  const next = structuredClone(previous),
    bindings = {};
  for (const spec of teamAnchorSlotSpecs()) {
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
      description: `${spec.label}: the existing bounded procedural anchor; local editable starting point, visual review required.`,
      provenance: {
        creator: 'Reveal Line',
        source: 'game/couch/coop-view.mjs procedural anchor',
        license: 'Project-authored procedural presentation',
        prompt: spec.prompt,
        parent: null,
      },
      file: null,
      recipe: { id: 'team.anchor.v1' },
      geometry: null,
      quality: {
        stage: 'source',
        evidence: [
          'Existing runtime geometry; registration does not certify a theme or replacement artwork.',
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
