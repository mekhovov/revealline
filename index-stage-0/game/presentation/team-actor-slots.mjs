import { checkTeamEventContracts, teamEventSlot } from './team-event-slots.mjs';
import { checkTeamThreatContracts, teamThreatSlot } from './team-threat-slots.mjs';
import { checkTeamEffectContracts, teamEffectSlot } from './team-effect-slots.mjs';
import { checkTeamAnchorContracts, teamAnchorSlot } from './team-anchor-slots.mjs';
import { canonicalJSON, required } from '../data-json.mjs';
import {
  freezePresentation,
  resolvePresentation,
  validateAssetSlotSpec,
  validateThemeBundle,
} from './model.mjs';

const pilotStates = Object.freeze({
  normal: 'Active craft on a safe boundary; no damage or cut indication is baked into its body.',
  cutting: 'Active craft tracing a cut; the runtime owns the bright trail and exact cutting head.',
  downed:
    'Disabled craft awaiting rescue; rotors stop and the numbered rescue marker stays readable.',
  crawling:
    'Downed craft moving slowly toward safety; runtime displacement turns the body while rotors stay stopped.',
  rescuing:
    'Active craft supporting its downed partner; the runtime names the rescue target and owns progress.',
  recovery:
    'Recently recovered craft; the runtime owns the grace indicator and its actual duration.',
});
const rows = [];
for (const seat of [1, 2])
  for (const [state, purpose] of Object.entries(pilotStates))
    for (const treatment of ['compact', 'detailed'])
      rows.push({
        id: `team.player.${seat}.${state}.${treatment}`,
        source: `player.scout.${treatment}`,
        label: `Team player ${seat}: ${state} (${treatment})`,
        state,
        seat,
        treatment,
        purpose,
      });
for (const [state, purpose] of [
  ['patrol', 'Hunter searching before a lock; it is distinct from the independent field drifter.'],
  [
    'warning',
    'Hunter locking a player; the runtime keeps its warning line, target and LOCK label visible.',
  ],
  [
    'charge',
    'Hunter committed to a charge; the runtime keeps the actual contact footprint and CHARGE label.',
  ],
  [
    'recovery',
    'Hunter recovering after a charge; the runtime owns recovery timing and the RECOVER label.',
  ],
])
  rows.push({
    id: `team.hunter.${state}`,
    source: 'enemy.border-patrol',
    label: `Team hunter: ${state}`,
    state,
    purpose,
  });
rows.push({
  id: 'team.drifter.normal',
  source: 'enemy.bouncer',
  label: 'Team drifter',
  state: 'normal',
  purpose:
    'Independent field drifter. Preserve a silhouette distinct from a hunter; it does not inherit hunter attacks.',
});
for (const [state, purpose] of [
  [
    'shielded',
    'Relay core protected by its anchors; the runtime draws the shield and anchor objectives.',
  ],
  [
    'exposed',
    'Relay core exposed after its anchors are captured; it still needs the required capture.',
  ],
  [
    'secured',
    'Completed relay core; the runtime keeps the secured label and subdued body treatment.',
  ],
])
  rows.push({
    id: `team.core.${state}`,
    source: 'enemy.relay-sentinel',
    label: `Team relay core: ${state}`,
    state,
    purpose,
  });
export const TEAM_ACTOR_SLOTS = freezePresentation(rows);
const byId = new Map(TEAM_ACTOR_SLOTS.map((row) => [row.id, row]));
export const teamActorSlot = (id) => byId.get(id) ?? null;

/** State selection reads cosmetic observations, never writes or advances simulation. */
export function teamActorSlotId(kind, actor, { state, treatment = 'detailed' } = {}) {
  if (
    kind === 'pilot' &&
    [0, 1].includes(actor.id) &&
    Object.hasOwn(pilotStates, state) &&
    ['compact', 'detailed'].includes(treatment)
  )
    return `team.player.${actor.id + 1}.${state}.${treatment}`;
  if (kind === 'enemy') {
    if (actor.type === 'drifter') return 'team.drifter.normal';
    if (actor.type === 'hunter') {
      const phase = actor.phase === 'commit' ? 'charge' : actor.phase;
      return byId.has(`team.hunter.${phase}`) ? `team.hunter.${phase}` : null;
    }
  }
  if (kind === 'core')
    return `team.core.${actor.defeated ? 'secured' : actor.shielded ? 'shielded' : 'exposed'}`;
  return null;
}

/** Optional additions leave every historical slot, theme, asset and collection intact. */
export function teamActorSlotSpecs(source) {
  const slots = new Map(source.slots.map((slot) => [slot.id, slot]));
  return TEAM_ACTOR_SLOTS.map((row) => {
    const original = slots.get(row.source);
    required(original, `Team authoring needs the ${row.source} slot contract.`);
    return validateAssetSlotSpec({
      ...structuredClone(original),
      id: row.id,
      revision: 1,
      label: row.label,
      screens: ['couch', 'studio'],
      kinds: ['image'],
      recipes: [],
      required: false,
      states: ['default'],
      dependencies: [],
      owner: null,
      requirements: [
        row.purpose,
        'Cosmetic body only. Preserve gameplay, collision geometry, timers and the runtime cues above it.',
        row.seat
          ? `Player ${row.seat} retains its number and ${row.seat === 1 ? 'circle' : 'diamond'} marker independently of colour. Runtime rotors use the declared motor hubs; do not paint propeller blades.`
          : 'Keep contact and warning indicators distinct over light and dark revealed artwork.',
        'North-facing transparent pixel artwork. Keep attachments inside occupied bounds, retain exact dimensions and inspect at actual playing size.',
        'This Team slot does not replace Solo or Versus bodies. Review this state in both Team arenas and applicable imported maps.',
      ],
      prompt: `Create an original ${row.label.toLowerCase()} body for Reveal Line. ${row.purpose} Export exactly ${original.dimensions.width} by ${original.dimensions.height} pixels as a transparent PNG using deliberate pixel clusters and the resolved theme palette. Preserve the approved mechanical silhouette, frame, pivot and motor hub contract. No text, player number, background, blur, baked glow or propeller blades. Functional warnings, identity shapes and timers remain runtime overlays. Retain the source, prepared PNG, provenance and validation at native size and actual Team playing scale. This is a new cosmetic revision, never a gameplay change.`,
    });
  });
}

/** Import only this known additive contract. Arbitrary foreign slots remain unsupported. */
export function mergeTeamActorSlotContracts(source, incoming) {
  checkTeamAnchorContracts(incoming);
  checkTeamEffectContracts(incoming);
  checkTeamThreatContracts(incoming);
  checkTeamEventContracts(incoming);
  const incomingTeam = incoming.slots.filter((slot) => byId.has(slot.id));
  required(
    !incomingTeam.length || incomingTeam.length === TEAM_ACTOR_SLOTS.length,
    'Imported Team actor contracts must include all 32 slots.',
  );
  const next = [...source.slots],
    current = new Map(next.map((slot) => [slot.id, slot]));
  let expected = null;
  for (const slot of incoming.slots) {
    if (
      teamAnchorSlot(slot.id) ||
      teamEffectSlot(slot.id) ||
      teamThreatSlot(slot.id) ||
      teamEventSlot(slot.id)
    ) {
      if (current.has(slot.id))
        required(
          canonicalJSON(slot) === canonicalJSON(current.get(slot.id)),
          `Conflicting Team objective/feedback contract: ${slot.id}.`,
        );
      else next.push(slot);
      continue;
    }
    if (current.has(slot.id)) {
      if (byId.has(slot.id))
        required(
          canonicalJSON(slot) === canonicalJSON(current.get(slot.id)),
          `Conflicting Team slot contract: ${slot.id}.`,
        );
      continue;
    }
    required(byId.has(slot.id), `Unsupported imported slot contract: ${slot.id}.`);
    expected ??= new Map(teamActorSlotSpecs(source).map((entry) => [entry.id, entry]));
    required(
      canonicalJSON(slot) === canonicalJSON(expected.get(slot.id)),
      `Unsupported imported slot contract: ${slot.id}.`,
    );
    next.push(slot);
  }
  return next;
}

/** An explicit local draft operation; never writes a player save or marks art reviewed. */
export function prepareTeamActorSlots(source) {
  const previous = validateThemeBundle(source),
    specs = teamActorSlotSpecs(previous),
    existing = previous.slots.filter((slot) => byId.has(slot.id));
  if (existing.length) {
    required(
      existing.length === specs.length,
      'Team actor slot contracts are incomplete. Import the complete compatible collection.',
    );
    mergeTeamActorSlotContracts(previous, { slots: specs });
  }
  const view = resolvePresentation(previous),
    next = structuredClone(previous),
    bindings = {};
  if (TEAM_ACTOR_SLOTS.every((row) => view.assets[row.id])) return previous;
  for (const [index, spec] of specs.entries()) {
    const row = TEAM_ACTOR_SLOTS[index],
      original = view.assets[row.source];
    if (view.assets[row.id]) continue;
    required(
      original?.kind === 'image',
      `Prepare a real ${row.source} image before creating Team actor slots.`,
    );
    const id = `${row.id}.template`;
    const revision =
      Math.max(
        0,
        ...next.assets.filter((asset) => asset.id === id).map((asset) => asset.revision),
      ) + 1;
    const asset = {
      ...structuredClone(original),
      id,
      revision,
      description: `${row.label}: editable starting body inherited from ${original.id}@${original.revision}; Team-state visual review remains required.`,
      provenance: {
        ...structuredClone(original.provenance),
        parent: { id: original.id, revision: original.revision },
        prompt: spec.prompt,
      },
      quality: {
        stage: 'source',
        evidence: [
          'Seeded from exact existing body bytes; this does not approve a complete Team state or theme.',
        ],
      },
    };
    if (!existing.length) next.slots.push(spec);
    next.assets.push(asset);
    bindings[spec.id] = { id: asset.id, revision: asset.revision };
  }
  const current = next.themes.find(
      (theme) =>
        theme.id === next.selection.theme.id && theme.revision === next.selection.theme.revision,
    ),
    collection =
      next.selection.collection &&
      next.collections.find(
        (item) =>
          item.id === next.selection.collection.id &&
          item.revision === next.selection.collection.revision,
      ),
    theme = {
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
