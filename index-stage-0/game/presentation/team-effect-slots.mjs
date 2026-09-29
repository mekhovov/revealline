import { canonicalJSON, required } from '../data-json.mjs';
import {
  FORMATS,
  freezePresentation,
  resolvePresentation,
  validateAssetSlotSpec,
  validateThemeBundle,
} from './model.mjs';

const PURPOSES = Object.freeze({
  support:
    'Support pulse at its actual origin, lasting 0.3 seconds; not damage, Scan or proof that an enemy was slowed.',
  slowed:
    'Temporary enemy slowdown, following the affected active enemy; distinct from the shorter Support pulse.',
  rescue:
    'Held rescue by the active helper of a downed teammate; target number and progress remain runtime-owned.',
  recovery: 'Revived player grace, following that player; never the hunter recovery phase.',
});
export const TEAM_EFFECT_SLOTS = freezePresentation(
  ['support', 'slowed', 'rescue', 'recovery'].map((state) => ({
    id: `team.effect.${state}`,
    state,
    label: `Team feedback: ${state}`,
  })),
);
export const teamEffectSlot = (id) => TEAM_EFFECT_SLOTS.find((row) => row.id === id) ?? null;
export function teamEffectSlotSpecs() {
  return TEAM_EFFECT_SLOTS.map((row) =>
    validateAssetSlotSpec({
      format: FORMATS.slot,
      id: row.id,
      revision: 1,
      label: row.label,
      group: 'effects',
      screens: ['couch', 'studio'],
      kinds: ['recipe', 'image'],
      recipes: ['team.effect.v1'],
      required: false,
      dimensions: { width: 32, height: 32 },
      alpha: 'required',
      sampling: 'nearest',
      states: ['default'],
      requirements: [
        PURPOSES[row.state],
        'A cosmetic 32×32 transparent pixel badge supplements the existing authoritative cue. Runtime labels, ranges, countdowns and contact points stay visible.',
        'No text, player number, progress bar, damage, Scan sweep or simulated range may be baked into this badge.',
        'Inspect the matching earned scene in Field context → Couch Team with normal and reduced effects; inactive states must remain inactive.',
        'Art may be suppressed when no clear nearby placement fits. It never replaces the functional cue or changes gameplay timing.',
      ],
      prompt: `Create an original ${row.label.toLowerCase()} badge for Reveal Line's resolved theme. ${PURPOSES[row.state]} Export exactly 32 by 32 transparent PNG with crisp pixel clusters, centered pivot, binary transparency and the resolved palette. No text, number, progress, blur, baked glow, background, Scan sweep or damage claim. This cosmetic badge supplements runtime warnings, labels and progress. Distinguish all four feedback roles by shape. Inspect at 24 CSS pixels in both starter arenas over dark/light artwork with reduced effects. Preserve source, derivative and provenance; validate dimensions, alpha, frame and pivot. Never alter the simulation, duration or effect radius.`,
      budget: { maxBytes: 131072 },
      palette: ['#070b12', '#101923', '#f3f0db', '#78dce8', '#f4bf62', '#f07879', '#9dbb7a'],
      geometry: {
        frame: { x: 0, y: 0, width: 32, height: 32 },
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
export function checkTeamEffectContracts(incoming) {
  const selected = incoming.slots.filter((slot) => teamEffectSlot(slot.id));
  required(
    !selected.length || selected.length === TEAM_EFFECT_SLOTS.length,
    'Imported Team effects must include all four slot contracts.',
  );
  const expected = new Map(teamEffectSlotSpecs().map((slot) => [slot.id, slot]));
  for (const slot of selected)
    required(
      canonicalJSON(slot) === canonicalJSON(expected.get(slot.id)),
      `Unsupported imported Team effect contract: ${slot.id}.`,
    );
}
export function prepareTeamEffectSlots(source) {
  const previous = validateThemeBundle(source);
  checkTeamEffectContracts(previous);
  const view = resolvePresentation(previous);
  if (TEAM_EFFECT_SLOTS.every((row) => view.assets[row.id])) return previous;
  const next = structuredClone(previous),
    bindings = {};
  for (const spec of teamEffectSlotSpecs()) {
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
      description: `${spec.label}: the existing authoritative procedural feedback; local editable starting point, visual review required.`,
      provenance: {
        creator: 'Reveal Line',
        source: 'game/couch/coop-view.mjs procedural effect',
        license: 'Project-authored procedural presentation',
        prompt: spec.prompt,
        parent: null,
      },
      file: null,
      recipe: { id: 'team.effect.v1' },
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
