import { compileContentProject, resolveMission } from './project.mjs';
import { createTeamCampaignTestPack } from './team-export.mjs';
import { dataIdentity, required } from '../data-json.mjs';
import { freezeDesign } from './catalogs.mjs';

/** An ordinary ContentProjectV1 is the portable editable chapter recipe. This
 * projection uses existing asset and runtime contracts, not a second importer. */
export function multiplayerChapterSource(source, campaignId, mode) {
  required(['team', 'versus'].includes(mode), 'Choose Team or Duel.');
  const project = compileContentProject(source);
  const campaign = project.source.campaigns.find((c) => c.id === campaignId && !c.archived);
  required(campaign, 'Choose an active multiplayer chapter.');
  const missions = campaign.missionIds.map((id) =>
    project.source.missions.find((m) => m.id === id),
  );
  required(
    missions.every((m) => !m.archived && m.modes.length === 1 && m.modes[0] === mode),
    'Expansion chapters require explicitly authored missions for exactly one mode.',
  );
  const assets = new Set(missions.map((m) => m.presentation.backgroundAssetId).filter(Boolean));
  const result = {
    ...project.source,
    id:
      `${project.source.id}-${campaignId}`.length <= 96
        ? `${project.source.id}-${campaignId}`
        : `multiplayer-chapter-${dataIdentity([project.source.id, campaignId])}`,
    name: campaign.name,
    missions,
    maps: project.source.maps.filter((map) =>
      missions.some((m) => m.map.id === map.id && m.map.revision === map.revision),
    ),
    campaigns: [campaign],
    packs: [
      {
        format: 'PackDesignV1',
        id: `${campaignId}-pack`,
        revision: campaign.revision,
        name: campaign.name,
        campaignIds: [campaignId],
      },
    ],
    assets: project.source.assets.filter((a) => assets.has(a.id)),
  };
  return structuredClone(compileContentProject(result).source);
}

export function inspectMultiplayerChapter(source, campaignId, mode, difficulty = 'standard') {
  const recipe = multiplayerChapterSource(source, campaignId, mode);
  const project = compileContentProject(recipe);
  const manifests = project.missions.map((m) =>
    resolveMission(project, m.id, { mode, difficulty }),
  );
  required(
    manifests.every((m) => !m.diagnostics.some((d) => d.severity === 'error')),
    'Resolve chapter topology errors before export.',
  );
  return freezeDesign({
    source: recipe,
    mode,
    difficulty,
    gameplay:
      mode === 'team'
        ? createTeamCampaignTestPack(project, campaignId, difficulty)
        : {
            protocol: 'xonix-duel.untimed.v1',
            seconds: 0,
            // The receiving host still compiles/owns the exact source; this is evidence.
            levels: manifests.map((m) => m.level),
          },
    assets: recipe.assets,
    simulationIdentities: manifests.map((m) => m.simulationIdentity),
    validation: 'compiled-candidate-not-playtested',
  });
}

/** Ignore names, IDs, art and rectangle partitioning. All eight orientations
 * compare equally, including reflected/reordered authoring geometry. */
export function multiplayerGeometryFingerprint(map) {
  const { width, height } = map;
  const cells = Array.from({ length: height }, () => Array(width).fill(0));
  for (const [rectangles, value] of [
    [map.foundations ?? [], 1],
    [map.walls ?? [], 2],
    [map.terrain ?? [], null],
  ]) {
    for (const r of rectangles)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          cells[y][x] = value ?? (r.kind === 'slow' ? 3 : r.kind === 'lethal' ? 4 : 5);
  }
  const forms = [];
  let oriented = cells;
  for (let turn = 0; turn < 4; turn++) {
    forms.push(JSON.stringify(oriented), JSON.stringify(oriented.map((row) => [...row].reverse())));
    oriented = oriented[0].map((_, x) => oriented.map((row) => row[x]).reverse());
  }
  return dataIdentity(forms.sort()[0]);
}

export function auditMultiplayerVariety(sources) {
  const seen = new Map(),
    duplicates = [],
    decisions = new Map(),
    repeatedDecisions = [];
  for (const source of sources) {
    const project = compileContentProject(source);
    for (const mission of project.source.missions.filter((m) => !m.archived)) {
      const map = project.source.maps.find(
        (m) => m.id === mission.map.id && m.revision === mission.map.revision,
      );
      const identity = `${source.id}/${mission.id}`;
      const signature = multiplayerGeometryFingerprint(map);
      if (seen.has(signature)) duplicates.push({ first: seen.get(signature), second: identity });
      else seen.set(signature, identity);
      const decision = mission.design.routeDecision.trim().toLowerCase();
      if (decisions.has(decision))
        repeatedDecisions.push({ first: decisions.get(decision), second: identity });
      else decisions.set(decision, identity);
    }
  }
  return freezeDesign({ distinctGeometry: seen.size, duplicates, repeatedDecisions });
}
