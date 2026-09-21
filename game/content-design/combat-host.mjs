import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import { TURN_POLICIES } from '../core/registry.mjs';
import { COMBAT_MODES } from '../combat-preferences.mjs';
import { compileContentProject } from './project.mjs';
import { setMissionCombatEnabled } from './combat-authoring.mjs';
import { createCandidateSoloHost } from './solo-host.mjs';
import { createCandidateVersusHost } from './versus-host.mjs';
import { freezeDesign } from './catalogs.mjs';

/** Each choice derives from the same immutable authored source, never from the
 * previously selected variant. On does not insert robots into unauthored maps. */
export function combatEditionSources(source) {
  const canonical = compileContentProject(source).source;
  const sources = new Map(),
    unique = new Map();
  for (const mode of COMBAT_MODES) {
    let variant = canonical;
    if (mode !== 'authored')
      for (const mission of canonical.missions)
        if (mission.combat) variant = setMissionCombatEnabled(variant, mission.id, mode === 'on');
    const key = JSON.stringify(variant);
    if (!unique.has(key)) unique.set(key, freezeDesign(variant));
    sources.set(mode, unique.get(key));
  }
  return sources;
}

function hostsFor(source, options, factory) {
  const sources = combatEditionSources(source),
    unique = new Map(),
    byMode = new Map();
  for (const [mode, variant] of sources) {
    if (!unique.has(variant)) unique.set(variant, factory(variant, options));
    byMode.set(mode, unique.get(variant));
  }
  return { byMode, hosts: [...unique.values()], catalog: byMode.get('authored').catalog };
}
const selectedHost = (byMode, getMode) => {
  const mode = getMode();
  required(COMBAT_MODES.includes(mode), 'Choose an explicit optional robot preference.');
  return byMode.get(mode);
};
const innerMission = (host, mission) => host.catalog.find(mission.id);

/** Union ownership for restoration; only prospective selection reads preference. */
export function createCombatSoloHost(
  source,
  { getCombatMode = () => 'authored', ...options } = {},
) {
  const { byMode, hosts, catalog } = hostsFor(source, options, createCandidateSoloHost);
  const entries = hosts.flatMap((host) => host.entries),
    owners = new Map();
  for (const host of hosts) for (const entry of host.entries) owners.set(entry, host);
  let prepared = null,
    preparedOwner = null,
    disposed = false,
    generation = 0;
  const cancel = () => {
    const ticket = ++generation;
    prepared = preparedOwner = null;
    for (const host of hosts) {
      host.preparer.cancel();
      // Aborting a load may synchronously start a newer preparation in another
      // edition. Only retire the generation this cancel actually owns.
      if (generation !== ticket) return;
    }
  };
  const preparer = Object.freeze({
    async prepare(request, controls) {
      required(!disposed, 'Combat candidate preparer is disposed.');
      const selected = boundedJSON(request, { maxBytes: 8192, maxNodes: 16, maxDepth: 1 });
      exactKeys(
        selected,
        ['missionId', 'difficulty', 'seed', 'turnPolicy', 'executionKey'],
        'combat candidate attempt',
      );
      const mission = catalog.find(selected.missionId);
      required(mission, 'Choose an owned combat candidate mission.');
      required(
        Number.isInteger(selected.seed) && selected.seed >= 0 && selected.seed <= 0xffffffff,
        'Candidate seed must be an unsigned 32-bit integer.',
      );
      required(
        TURN_POLICIES.includes(selected.turnPolicy),
        'Unsupported candidate steering policy.',
      );
      const entry = entries.find(
        (entry) =>
          entry.sourcePackId === mission.packId &&
          entry.campaignId === mission.campaignId &&
          entry.executionKey === selected.executionKey &&
          entry.difficulty === selected.difficulty,
      );
      required(entry, 'Choose the exact owned combat execution, not the current preference.');
      if (controls?.signal?.aborted)
        throw new DOMException('Candidate preparation cancelled.', 'AbortError');
      const ticket = generation + 1;
      cancel();
      if (disposed || generation !== ticket)
        throw new DOMException('Candidate preparation cancelled.', 'AbortError');
      const owner = owners.get(entry),
        { executionKey: _key, ...inner } = selected;
      const result = await owner.preparer.prepare(inner, controls);
      // Another request/cancel is also forwarded to this exact inner preparer.
      required(
        !disposed && generation === ticket && owner.preparer.current(result),
        'Combat candidate preparation was replaced.',
      );
      prepared = result;
      preparedOwner = owner;
      return result;
    },
    cancel,
    current: (value) =>
      !disposed && value != null && prepared === value && preparedOwner.preparer.current(value),
    take(value) {
      required(
        !disposed && value != null && prepared === value,
        'Combat candidate is no longer current.',
      );
      const owner = preparedOwner;
      prepared = preparedOwner = null;
      return owner.preparer.take(value);
    },
    dispose() {
      disposed = true;
      prepared = preparedOwner = null;
      for (const host of hosts) host.preparer.dispose();
    },
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    catalog,
    preparer,
    owns: (entry) => owners.has(entry),
    visualThemeSelection: (entry, level) =>
      owners.get(entry)?.visualThemeSelection(entry, level) ?? null,
    select(mission, difficulty) {
      if (catalog.find(mission?.id) !== mission) return null;
      const host = selectedHost(byMode, getCombatMode);
      return host.select(innerMission(host, mission), difficulty);
    },
    card(mission, difficulty = 'standard') {
      if (catalog.find(mission?.id) !== mission) return null;
      const host = selectedHost(byMode, getCombatMode);
      return host.card(innerMission(host, mission), difficulty);
    },
    mission(entry, index) {
      const mission = owners.get(entry)?.mission(entry, index);
      return mission ? catalog.find(mission.id) : null;
    },
    isCore: byMode.get('authored').isCore,
    next: byMode.get('authored').next,
  });
}

/** One party intent selects one immutable row; createDuel still owns two boards. */
export function createCombatVersusHost(
  source,
  { getCombatMode = () => 'authored', ...options } = {},
) {
  const { byMode, hosts, catalog } = hostsFor(source, options, createCandidateVersusHost);
  const owners = new Map(),
    originals = new Map(),
    rows = [];
  for (const [index, host] of hosts.entries())
    for (const original of host.rows) {
      const row = Object.freeze({
        ...original,
        key: `${original.key}/combat-edition-${index}`,
        mission: catalog.find(original.mission.id),
      });
      rows.push(row);
      owners.set(row, host);
      originals.set(row, original);
    }
  return Object.freeze({
    rows: Object.freeze(rows),
    catalog,
    owns: (row) => owners.has(row),
    visualThemeSelection: (row, level) =>
      owners.get(row)?.visualThemeSelection(originals.get(row), level) ?? null,
    row(mission, difficulty) {
      if (catalog.find(mission?.id) !== mission) return null;
      const host = selectedHost(byMode, getCombatMode);
      return (
        rows.find(
          (row) =>
            owners.get(row) === host && row.mission === mission && row.difficulty === difficulty,
        ) ?? null
      );
    },
    card(mission, difficulty = 'standard') {
      if (catalog.find(mission?.id) !== mission) return null;
      const host = selectedHost(byMode, getCombatMode);
      return host.card(innerMission(host, mission), difficulty);
    },
    isCore: byMode.get('authored').isCore,
    next: byMode.get('authored').next,
  });
}
