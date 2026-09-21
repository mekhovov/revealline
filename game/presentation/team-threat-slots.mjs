import { canonicalJSON, required } from '../data-json.mjs';
import {
  FORMATS,
  freezePresentation,
  resolvePresentation,
  validateAssetSlotSpec,
  validateThemeBundle,
} from './model.mjs';

const PURPOSES = Object.freeze({
  'emitter-warning':
    'Emitter warning at the exact targeted trail cell. Runtime draws the ray from the core and the target border; this is a warning, not a moving projectile.',
  spark:
    'Travelling spark at its exact position on an existing cut. Runtime keeps the true contact center; no homing, extra attack or damage radius.',
  shield:
    'Shielded relay core. Capture its anchors before the core; this is an objective state, not a radius of protection for players.',
});
const DIMENSIONS = Object.freeze({ 'emitter-warning': 32, spark: 16, shield: 64 });
export const TEAM_THREAT_SLOTS = freezePresentation(
  ['emitter-warning', 'spark', 'shield'].map((state) => ({
    id: `team.threat.${state}`,
    state,
    label: `Team threat: ${state}`,
  })),
);
export const teamThreatSlot = (id) => TEAM_THREAT_SLOTS.find((row) => row.id === id) ?? null;
export function teamThreatSlotSpecs() {
  return TEAM_THREAT_SLOTS.map((row) =>
    validateAssetSlotSpec({
      format: FORMATS.slot,
      id: row.id,
      revision: 1,
      label: row.label,
      group: 'effects',
      screens: ['couch', 'studio'],
      kinds: ['recipe', 'image'],
      recipes: ['team.threat.v1'],
      required: false,
      dimensions: { width: DIMENSIONS[row.state], height: DIMENSIONS[row.state] },
      alpha: 'required',
      sampling: 'nearest',
      states: ['default'],
      requirements: [
        PURPOSES[row.state],
        'Transparent pixel overlay at the exact runtime position, never a detached status badge. The image cannot move or enlarge collision geometry.',
        'Keep the center open. Runtime labels, warning paths and true contact markers draw above this image; shields sit beneath core bodies; board edges clip artwork without relocating its source.',
        'No text, player number, progress, arrow suggesting motion, glow, blur, background, extra range ring or invented attack.',
        'Review Relay Yard initial, emitter-warning and spark scenes with normal/reduced effects, light/dark art and phone sizes. First Connection has no strongholds or emitters.',
      ],
      prompt: `Create an original ${row.label.toLowerCase()} overlay for Reveal Line's resolved theme. ${PURPOSES[row.state]} Export exactly ${DIMENSIONS[row.state]} by ${DIMENSIONS[row.state]} transparent pixels with centered pivot, an open center and crisp deliberate clusters. Use the resolved palette. No text, number, progress, blur, baked glow, background or additional range. This overlay uses the exact state position beneath functional markers; shields sit beneath core bodies, warning and spark accents above decorative bodies. It is clipped at the board edge, never relocated. Inspect the matching Relay Yard scene at actual phone and desktop size, including reduced effects and light/dark artwork. Preserve source, prepared derivative, provenance and exact immutable revisions. Do not alter core/anchor capture, warning duration, projectile speed/path, collision or gameplay.`,
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
export function checkTeamThreatContracts(incoming) {
  const selected = incoming.slots.filter((slot) => teamThreatSlot(slot.id));
  required(
    !selected.length || selected.length === TEAM_THREAT_SLOTS.length,
    'Imported Team threats must include all three slot contracts.',
  );
  const expected = new Map(teamThreatSlotSpecs().map((slot) => [slot.id, slot]));
  for (const slot of selected)
    required(
      canonicalJSON(slot) === canonicalJSON(expected.get(slot.id)),
      `Unsupported imported Team threat contract: ${slot.id}.`,
    );
}
export function prepareTeamThreatSlots(source) {
  const previous = validateThemeBundle(source);
  checkTeamThreatContracts(previous);
  const view = resolvePresentation(previous);
  if (TEAM_THREAT_SLOTS.every((row) => view.assets[row.id])) return previous;
  const next = structuredClone(previous),
    bindings = {};
  for (const spec of teamThreatSlotSpecs()) {
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
      description: `${spec.label}: the existing authoritative procedural threat cue; local editable starting point, visual review required.`,
      provenance: {
        creator: 'Reveal Line',
        source: 'game/couch/coop-view.mjs procedural threat',
        license: 'Project-authored procedural presentation',
        prompt: spec.prompt,
        parent: null,
      },
      file: null,
      recipe: { id: 'team.threat.v1' },
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
