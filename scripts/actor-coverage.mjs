#!/usr/bin/env node
/** Bounded current-entry audit: metadata only, never decodes or replaces artwork. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../game/data-json.mjs';
import { resolveJourneyRequest } from '../game/content-design/default-entry.mjs';
import { createAuthoredJourneyRoute } from '../game/content-design/route.mjs';
import { resolveContentJourney } from '../game/content-design/journey.mjs';
import { journeyActors } from '../game/content-design/catalogs.mjs';
import { journeyActorThemeMaterial } from '../game/presentation/journey-actor-materials.mjs';
import { validateAssetRevision } from '../game/presentation/model.mjs';
import { loadInventoryTeamRoute } from './content-inventory.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const ACTOR_COVERAGE_PATH = 'docs/verification/actor-motion/current-coverage.json';
const sha = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const unique = (items) => [...new Set(items)].sort();
const MODES = ['solo', 'versus', 'team'];
const relevantSlot = (slot) => /^(player\.|enemy\.|team\.(pilot\.|enemy\.|core\.))/.test(slot);

/** Different counts alone cannot distinguish newer maps from an older edition. */
export function inventoryDefaultDrift(inventory, defaults) {
  return MODES.flatMap((mode) => {
    const family = mode === 'team' ? 'team' : 'journey';
    const recorded = (inventory?.routes ?? [])
      .filter((route) => route.family === family && route.classification === 'current')
      .map((route) => route.route)
      .sort();
    return recorded.includes(defaults[mode]) ? [] : [{ mode, expected: defaults[mode], recorded }];
  });
}

/** A production raster can be kept while its moving-part treatment needs repair.
 * These are source dispositions, never a visual or gameplay certificate. */
export function actorAssetDisposition(slot, source) {
  const asset = validateAssetRevision(source);
  const needsPatrolRig =
    slot === 'enemy.border-patrol' && asset.kind === 'image' && !asset.geometry.rotorAnchors.length;
  return {
    disposition: needsPatrolRig ? 'Repair' : 'Keep',
    scope: needsPatrolRig ? 'moving-part-rig' : 'retained-source',
    reason: needsPatrolRig
      ? 'Prepared patrol quad has no registered rotor anchors. Review a new rig; do not add blades to historical originals with baked parts.'
      : 'Preserve this exact source/revision while actual-scale, motion and state review remains pending. Source presence does not approve appearance.',
  };
}

function actorSlot(type, mode) {
  if (mode === 'team')
    return (
      {
        drifter: 'enemy.bouncer',
        hunter: 'enemy.border-patrol',
        'claimed-rover': 'enemy.claimed-rover',
      }[type] ?? null
    );
  return type === 'combat-patrol' ? null : `enemy.${type}`;
}

function missionRow({ mode, route, source, campaign, manifest }) {
  const authored = source.missions.find((mission) => mission.id === manifest.missionId);
  const catalog = journeyActors(source.actorCatalogId);
  const actors = authored.actors.map((actor) => {
    const role = catalog.roles[actor.role];
    const runtime = manifest.level.enemies.find((enemy) => enemy.id === actor.id);
    // Optional combat actors deliberately live outside the ordinary enemy list.
    const type = runtime?.type ?? role.type;
    return {
      id: actor.id,
      role: actor.role,
      runtimeType: type,
      fpvBodySlot: actorSlot(type, mode),
      ...(role.combatRole ? { optionalCombatRole: role.combatRole } : {}),
    };
  });
  return {
    mode,
    route,
    packId: campaign.packId,
    campaignId: campaign.campaignId,
    campaignRevision: campaign.runtime.revision,
    missionId: manifest.missionId,
    missionRevision: manifest.level.revision,
    simulationIdentity: manifest.simulationIdentity,
    themeId: manifest.presentation.themeId,
    campaignMaterialId: journeyActorThemeMaterial(manifest.presentation.themeId)?.id ?? null,
    artwork: manifest.background
      ? {
          id: manifest.background.id,
          revision: manifest.background.revision,
          sha256: manifest.background.sha256,
          review: manifest.background.review,
        }
      : null,
    actors,
    supportRoles: manifest.level.supportRoles ?? [],
    evidence: 'compiled-source-only',
  };
}

export async function buildActorCoverage({
  root = ROOT,
  defaults = Object.fromEntries(
    MODES.map((mode) => [mode, resolveJourneyRequest(new URLSearchParams(), { mode })]),
  ),
  loadJourneyRoute = createAuthoredJourneyRoute,
  loadTeamRoute = loadInventoryTeamRoute,
} = {}) {
  const read = async (relative) => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
  const [compiled, presets, inventory] = await Promise.all([
    read('game/presentation/compiled/runtime.json'),
    read('authoring/motion-lab/presets.json'),
    read('docs/content-offline/inventory.json'),
  ]);
  const assets = compiled.resolved.assets;
  const assetRows = Object.entries(assets)
    .filter(([slot]) => relevantSlot(slot))
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([slot, asset]) => ({
      slot,
      id: asset.id,
      revision: asset.revision,
      kind: asset.kind,
      file: asset.file,
      geometry: asset.geometry,
      recipe: asset.recipe,
      sourceStage: asset.quality.stage,
      ...actorAssetDisposition(slot, asset),
      evidence: 'compiled-metadata-only',
    }));
  const sourceCache = new Map(),
    routes = [],
    missions = [];
  for (const mode of MODES) {
    const id = defaults[mode];
    if (typeof id !== 'string' || !id) throw new Error(`Missing current route for ${mode}`);
    const key = `${mode === 'team' ? 'team' : 'journey'}/${id}`;
    if (!sourceCache.has(key))
      sourceCache.set(key, await (mode === 'team' ? loadTeamRoute(id) : loadJourneyRoute(id)));
    const route = sourceCache.get(key);
    if (!route?.source) throw new Error(`Unresolved current route: ${key}`);
    const source = route.source;
    const resolved = resolveContentJourney(source, { mode, difficulty: 'standard' });
    routes.push({
      mode,
      route: id,
      sourceId: source.id,
      sourceRevision: source.revision,
      sourceSha256: sha(source),
      actorCatalog: source.actorCatalogId,
      policyId: source.policyId,
      difficultyCatalog: source.difficultyCatalogId,
      missions: resolved.missions.length,
      campaigns: resolved.campaigns.length,
    });
    for (const campaign of resolved.campaigns)
      for (const manifest of campaign.manifests)
        missions.push(missionRow({ mode, route: id, source, campaign, manifest }));
  }
  const requestedSlots = unique(
    missions.flatMap((mission) => mission.actors.map((a) => a.fpvBodySlot)).filter(Boolean),
  );
  const missingSlots = requestedSlots.filter((slot) => !assets[slot]);
  const fpv = presets.characterPresentations.sets.find((set) => set.themeId === 'fpv');
  const playerRoles = Object.entries(fpv.classBodies).map(([role, appearance]) => {
    const body = presets.characters[appearance];
    return {
      role,
      appearance,
      animationRecipe: body.animationRecipe,
      slots: ['compact', 'detailed'].map((treatment) => `player.${role}.${treatment}`),
      sourceRotorAnchors: body.rotors?.length ?? 0,
      evidence: 'catalogued-capability-not-per-mission-selection',
    };
  });
  for (const slot of playerRoles.flatMap((role) => role.slots))
    if (!assets[slot]) missingSlots.push(slot);
  return {
    format: 'revealline-live-actor-coverage.v1',
    defaults,
    presentation: { theme: compiled.resolved.theme, sha256: sha(compiled) },
    summary: {
      missionOwners: missions.length,
      modeMissionCounts: Object.fromEntries(routes.map((route) => [route.mode, route.missions])),
      actorRoles: unique(missions.flatMap((mission) => mission.actors.map((a) => a.role))),
      fpvPlayerClasses: playerRoles.length,
      actorSlots: assetRows.length,
      missingSlots: unique(missingSlots),
      repairSlots: assetRows
        .filter((asset) => asset.disposition === 'Repair')
        .map((asset) => asset.slot),
      staleSavedInventory: inventoryDefaultDrift(inventory, defaults),
    },
    routes,
    playerRoles,
    assets: assetRows,
    missions,
    limitations: [
      'Current queryless entry only; historical, installed, imported and optional explicitly addressed routes remain separate C7 work.',
      'Standard source projection only; this is not every difficulty/encounter configuration or a playthrough.',
      'FPV body slots describe the available explicit FPV actor override. Campaign materials and manual uploads retain their own precedence; they are not falsely reported as compiled FPV images.',
      'Team state recipes may inherit prepared bodies. Presence, reviewed source stage and declared anchors do not prove loaded image bytes, visible spin or complete state playback.',
      'Keep means preserve the registered source pending visual review, not complete production acceptance. No automatic Replace verdict is inferred from filenames or mission counts.',
      'Performance, actual-scale rendered frames, hardware input, offline recovery and human play sessions are not measured by this metadata audit.',
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? '--summary';
  if (!['--write', '--check', '--summary'].includes(mode) || process.argv.length > 3)
    throw new Error('Usage: actor-coverage.mjs [--write|--check|--summary]');
  const report = await buildActorCoverage();
  if (mode !== '--summary') {
    const output = path.join(ROOT, ACTOR_COVERAGE_PATH),
      bytes = `${canonicalJSON(report)}\n`;
    if (mode === '--write') {
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, bytes);
    } else if ((await fs.readFile(output, 'utf8')) !== bytes)
      throw new Error('Actor coverage drift: regenerate from the current entry resolver.');
  }
  console.log(JSON.stringify(report.summary, null, 2));
}
