#!/usr/bin/env node
/** Deterministic content ownership audit. Does not mutate gameplay, saves or originals. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalJSON, dataIdentity } from '../game/data-json.mjs';
import { normalizedLevel } from '../game/core/level.mjs';
import { campaignKey } from '../game/library.mjs';
import { inventoryCurrentArt } from './generate-current-art.mjs';
import { readExternalDistributionEntries } from './external-distribution.mjs';
import { createAuthoredJourneyRoute } from '../game/content-design/route.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../game/content-design/mode-href.mjs';
import { resolveContentJourney } from '../game/content-design/journey.mjs';
import {
  classifyContent,
  TEAM_CONTENT_ROUTES,
  CONTENT_LIFECYCLE_VERSION,
} from '../game/content-design/content-lifecycle.mjs';
import { COOP_STARTER_PACK } from '../game/coop/library.mjs';
import { createSceneArt } from '../game/ui/scene-art.mjs';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  GAMEPLAY_TUNING_VERSION,
} from '../game/gameplay-tuning.mjs';
import { decodeOriginalPNG } from '../authoring/library/four-worlds-chapters/verify-images.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const CONTENT_INVENTORY_FORMAT = 'revealline-content-inventory.v1';
export const CONTENT_INVENTORY_PATH = 'docs/content-offline/inventory.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identity = (value) => sha(canonicalJSON(value));
const ordered = (a, b) => a.id.localeCompare(b.id, 'en');
const unique = (items) => [...new Set(items)].sort();
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** Keep every physics field; only labels and revision identities are excluded.
 * Entity references are renamed consistently, not deleted. Array order stays
 * significant: it can affect simultaneous-event resolution. */
export function normalizedGameplay(level) {
  const ids = new Map();
  function collect(value, top = false) {
    if (!value || typeof value !== 'object') return;
    if (!top && typeof value.id === 'string' && !ids.has(value.id))
      ids.set(value.id, `entity-${ids.size}`);
    for (const item of Object.values(value)) collect(item);
  }
  collect(level, true);
  function visit(value, top = false) {
    if (Array.isArray(value)) return value.map((item) => visit(item));
    if (!value || typeof value !== 'object')
      return typeof value === 'string' && ids.has(value) ? ids.get(value) : value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter(
          (key) =>
            !(top && ['id', 'revision', 'name', 'themeId', 'musicId', 'metadata'].includes(key)),
        )
        .map((key) => [key, visit(value[key])]),
    );
  }
  return visit(level, true);
}

export function geometrySignature(level) {
  return identity(
    normalizedGameplay(
      Object.fromEntries(
        [
          'width',
          'height',
          'spawn',
          'spawns',
          'walls',
          'foundations',
          'safeRects',
          'terrain',
          'objectives',
          'supplies',
          'signalZones',
          'hangars',
        ]
          .filter((key) => level[key] !== undefined)
          .map((key) => [key, level[key]]),
      ),
    ),
  );
}

export function duplicateGroups(rows, key, { distinct = (row) => row.id } = {}) {
  const groups = new Map();
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups]
    .filter(([, owners]) => new Set(owners.map(distinct)).size > 1)
    .map(([hash, owners]) => ({ hash, owners: owners.map((owner) => owner.id).sort() }))
    .sort((a, b) => a.hash.localeCompare(b.hash));
}

const TEAM_FACTORIES = {
  'team-greybox': ['team-journey-candidates', 'createTeamJourneyCandidates', {}],
  'team-originals': ['team-journey-candidates', 'createTeamJourneyCandidates', { artwork: true }],
  'team-pressure-originals-1': ['team-pressure-originals', 'createTeamPressureOriginalCandidates'],
  'team-spatial-originals-1': ['team-spatial-originals', 'createTeamSpatialOriginalCandidates'],
  'team-trail-impact-originals-1': ['team-impact-originals', 'createTeamImpactOriginalCandidates'],
  'team-specialist-originals-1': [
    'team-specialist-originals',
    'createTeamSpecialistOriginalCandidates',
  ],
  'team-complete-specialist-originals-1': [
    'team-complete-specialist-originals',
    'createTeamCompleteSpecialistOriginalCandidates',
  ],
  'team-timed-originals': ['team-timed-originals', 'createTeamTimedOriginalCandidates'],
  'team-window-spatial-1': [
    'team-window-spatial-candidates',
    'createTeamWindowSpatialCandidates',
    { artwork: true },
  ],
  'team-depot-spatial-1': [
    'team-depot-spatial-candidates',
    'createTeamDepotSpatialCandidates',
    { artwork: true },
  ],
};

function sceneSnapshot(theme, level, seed = 0) {
  const commands = [];
  const context = new Proxy(
    {},
    {
      set(target, key, value) {
        commands.push(['set', key, value]);
        target[key] = value;
        return true;
      },
      get(target, key) {
        return target[key] ?? ((...args) => commands.push([key, ...args]));
      },
    },
  );
  createSceneArt(theme, level, seed, () => ({ getContext: () => context }));
  return { seed, commandHash: identity(commands), commands };
}

export async function buildContentInventory({
  root = ROOT,
  externalEntries,
  onProgress = () => {},
} = {}) {
  const rows = [],
    routes = [],
    artwork = new Map(),
    boards = new Map(),
    gameplayContexts = new Map(),
    designs = new Map(),
    packages = [];
  const fileCache = new Map();
  const read = async (relative) => {
    if (!fileCache.has(relative)) fileCache.set(relative, fs.readFile(path.join(root, relative)));
    return fileCache.get(relative);
  };
  const json = async (relative) => JSON.parse(await read(relative));
  async function addArt(asset, sourcePath) {
    if (artwork.has(asset.sha256)) return asset.sha256;
    const bytes = await read(sourcePath);
    if (bytes.length !== asset.bytes || sha(bytes) !== asset.sha256)
      throw new Error(`Original image differs: ${sourcePath}`);
    const decoded = decodeOriginalPNG(`data:image/png;base64,${bytes.toString('base64')}`);
    artwork.set(asset.sha256, {
      id: asset.sha256,
      kind: 'original',
      path: sourcePath,
      bytes: asset.bytes,
      width: decoded.naturalWidth,
      height: decoded.naturalHeight,
      pixelsSha256: decoded.pixelsSha256,
      description: asset.alt ?? asset.description ?? '',
    });
    return asset.sha256;
  }
  function addBoard(level) {
    const hash = identity(level);
    if (!boards.has(hash)) boards.set(hash, { id: hash, level });
    return hash;
  }
  function addRow(row, level, context = {}) {
    const contextId = identity(context);
    if (!gameplayContexts.has(contextId))
      gameplayContexts.set(contextId, { id: contextId, context });
    const { design, ...owned } = row;
    const designId = design ? identity(design) : null;
    if (designId && !designs.has(designId)) designs.set(designId, { id: designId, design });
    rows.push({
      ...owned,
      ...(designId ? { designId } : {}),
      board: addBoard(level),
      gameplayContext: contextId,
      gameplayHash: identity({ level: normalizedGameplay(level), context }),
      geometryHash: geometrySignature(level),
    });
  }

  onProgress('Validating Classic originals and procedural presentations');
  const classicArt = await inventoryCurrentArt({ projectRoot: root });
  for (const row of classicArt) {
    if (row.image) {
      if (!row.sourceImagePath) throw new Error(`Missing source original: ${row.id}`);
      await addArt({ ...row.image, description: row.description }, row.sourceImagePath);
    } else {
      const preview = sceneSnapshot(row.theme, row.level, row.seed);
      artwork.set(row.id, {
        id: row.id,
        kind: 'procedural',
        renderer: 'game/ui/scene-art.mjs',
        width: 384,
        height: 288,
        themeId: row.theme.id,
        ...preview,
        description: row.description,
      });
    }
  }
  onProgress('Validating complete external pack/media pairs');
  const external =
    externalEntries ??
    (await readExternalDistributionEntries(root, {
      format: 'revealline-external-distribution.v1',
      catalog: 'game/content/external-worlds.json',
    }));
  const externalByPath = new Map(external.map(({ name, bytes }) => [name, bytes]));
  const sourcePacks = new Map();
  const classicIndex = await json('game/content/mission-library-index.json');
  const baseClasses = await json('game/content/classes.json');
  for (const mission of classicIndex.missions) {
    const sourcePath = mission.sourceFile.path;
    if (!sourcePacks.has(sourcePath)) {
      const bytes = externalByPath.get(sourcePath) ?? (await read(sourcePath));
      if (sha(bytes) !== mission.sourceFile.sha256 || bytes.length !== mission.sourceFile.bytes)
        throw new Error(`Mission browsing index source differs: ${sourcePath}`);
      sourcePacks.set(sourcePath, JSON.parse(bytes));
    }
    const pack = sourcePacks.get(sourcePath);
    const campaign = pack.campaigns?.find((item) => item.id === mission.campaignId) ?? pack;
    const level = normalizedLevel(campaign.levels.find((item) => item.id === mission.levelId));
    const pictures = classicArt.filter(
      (row) =>
        row.owner.baseCampaignKey === mission.campaignKey &&
        row.owner.levelId === mission.levelId &&
        row.owner.levelRevision === mission.levelRevision,
    );
    if (!pictures.length) throw new Error(`Missing effective Classic presentation: ${mission.id}`);
    for (const mode of mission.modes) {
      addRow(
        {
          id: `${mission.id}/${mode}`,
          family: 'classic',
          classification: classifyContent({
            family: 'classic',
            id: mission.packId,
            source: mission.source,
          }),
          mode,
          route: 'legacy',
          packId: mission.packId,
          campaignId: mission.campaignId,
          missionId: mission.levelId,
          revision: mission.levelRevision,
          name: mission.name,
          chapter: mission.campaignTitle,
          originalIdentity: {
            campaignKey: mission.campaignKey,
            levelId: mission.levelId,
            levelRevision: mission.levelRevision,
          },
          artworks: pictures.map((picture) => ({
            id: picture.image?.sha256 ?? picture.id,
            themeId: picture.owner.themeId,
            presentationId: picture.id,
          })),
          dependencies: [
            mission.sourceFile,
            ...(pictures[0].source.contracts ?? []),
            ...(pictures[0].source.media ? [pictures[0].source.media] : []),
          ],
        },
        level,
        {
          classRecipes: (pack.classRecipes ?? baseClasses).filter(
            (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
          ),
        },
      );
    }
  }
  // These two explicit legacy Team arenas remain reachable; they do not use Solo artwork.
  for (const level of COOP_STARTER_PACK.levels)
    addRow(
      {
        id: `team/legacy/${level.id}`,
        family: 'team-legacy',
        classification: 'current',
        mode: 'team',
        route: 'legacy',
        packId: COOP_STARTER_PACK.id,
        campaignId: COOP_STARTER_PACK.id,
        missionId: level.id,
        revision: String(level.revision),
        name: level.name,
        chapter: COOP_STARTER_PACK.name,
        originalIdentity: {
          packId: COOP_STARTER_PACK.id,
          packRevision: COOP_STARTER_PACK.revision,
          levelId: level.id,
          levelRevision: level.revision,
        },
        artworks: [],
        dependencies: [{ path: 'game/coop/library.mjs' }],
        presentation: 'Legacy Team board renderer; no recorded reward picture.',
      },
      level,
    );

  async function addRoute(route, family, modes) {
    const source = route.source;
    const classification = classifyContent({ family, id: route.id });
    routes.push({
      id: `${family}/${route.id}`,
      route: route.id,
      family,
      classification,
      sourceId: source.id,
      sourceRevision: source.revision,
      sourceSha256: identity(source),
      missionCount: source.missions.length,
      profileKey: route.profileKey ?? null,
      sessionKey: route.sessionKey ?? null,
      assets: source.assets.map((asset) => asset.sha256).sort(),
    });
    for (const asset of source.assets) await addArt(asset, `game/${asset.path}`);
    for (const mode of modes) {
      const resolved = resolveContentJourney(source, { mode, difficulty: 'standard' });
      for (const campaign of resolved.campaigns) {
        const runtimeKey =
          mode === 'team'
            ? `${campaign.runtime.id}/${encodeURIComponent(campaign.runtime.revision)}/${dataIdentity(campaign.runtime)}`
            : campaignKey(campaign.runtime);
        for (const manifest of campaign.manifests) {
          const mission = source.missions.find((entry) => entry.id === manifest.missionId);
          addRow(
            {
              id: `${family}/${route.id}/${mode}/${campaign.packId}/${campaign.campaignId}/${manifest.missionId}`,
              family,
              classification,
              mode,
              route: route.id,
              packId: campaign.packId,
              campaignId: campaign.campaignId,
              missionId: manifest.missionId,
              revision: mission.revision,
              name: manifest.level.name,
              chapter: source.packs.find((item) => item.id === campaign.packId).name,
              originalIdentity: {
                sourceId: source.id,
                sourceRevision: source.revision,
                campaignKey: runtimeKey,
                simulationIdentity: manifest.simulationIdentity,
                policyId: manifest.policyId,
              },
              artworks: manifest.background
                ? [
                    {
                      id: manifest.background.sha256,
                      themeId: manifest.presentation.themeId,
                      assetId: manifest.background.id,
                      assetRevision: manifest.background.revision,
                    },
                  ]
                : [],
              dependencies: manifest.background
                ? [
                    {
                      path: `game/${manifest.background.path}`,
                      bytes: manifest.background.bytes,
                      sha256: manifest.background.sha256,
                    },
                  ]
                : [],
              design: manifest.design,
            },
            manifest.level,
          );
        }
      }
    }
    if (classification === 'current') {
      for (const pack of source.packs) {
        const selected = rows.filter(
          (row) => row.family === family && row.route === route.id && row.packId === pack.id,
        );
        const assets = unique(selected.flatMap((row) => row.artworks.map((a) => a.id)));
        packages.push({
          id: `${family}/${route.id}/${pack.id}`,
          classification,
          modes,
          missionOwners: selected.map((row) => row.id),
          assetHashes: assets,
          originalArtworkBytes: assets.reduce((sum, id) => sum + artwork.get(id).bytes, 0),
          sizeScope:
            'Original artwork only; runtime, metadata, transfer encoding and storage overhead excluded.',
        });
      }
    }
  }
  for (const id of AUTHORED_JOURNEY_ROUTE_IDS) {
    onProgress(`Compiling Journey ${id}`);
    await addRoute(createAuthoredJourneyRoute(id), 'journey', ['solo', 'versus']);
  }
  for (const { id } of TEAM_CONTENT_ROUTES) {
    onProgress(`Compiling Team ${id}`);
    const [module, name, options] = TEAM_FACTORIES[id];
    const source = (await import(`../game/content-design/${module}.mjs`))[name](options);
    const profileKey = ['team-greybox', 'team-originals'].includes(id)
      ? 'journey'
      : id === 'team-timed-originals'
        ? 'team-shared-windows-originals'
        : id;
    await addRoute({ id, source, profileKey }, 'team', ['team']);
  }
  rows.sort(ordered);
  routes.sort(ordered);
  packages.sort(ordered);
  const current = rows.filter((row) => row.classification === 'current');
  const originalRows = rows.flatMap((row) =>
    row.artworks
      .filter((art) => artwork.get(art.id)?.kind === 'original')
      .map((art) => ({ ...row, artId: art.id })),
  );
  const sharedClassic = duplicateGroups(
    classicArt.filter((row) => row.image),
    (row) => row.image.sha256,
  );
  const historical = duplicateGroups(
    originalRows.filter((row) => ['journey', 'team'].includes(row.family)),
    (row) => row.artId,
    { distinct: (row) => `${row.family}/${row.route}` },
  );
  const currentArt = duplicateGroups(
    originalRows.filter((row) => row.classification === 'current'),
    (row) => row.artId,
  );
  const comparisons = {
    classicSharedOriginals: sharedClassic,
    authoredRevisionReuse: historical,
    currentSharedOriginals: currentArt,
    currentIdenticalGameplay: duplicateGroups(current, (row) => row.gameplayHash),
    currentSimilarGeometry: duplicateGroups(current, (row) => row.geometryHash),
  };
  const compatibilityRoots = routes
    .filter((route) => route.classification === 'archived')
    .map((route) => ({
      id: `compatibility/${route.id}`,
      classification: 'compatibility-only',
      route: route.route,
      sourceSha256: route.sourceSha256,
      profileKey: route.profileKey,
      sessionKey: route.sessionKey,
      missionOwners: rows
        .filter((row) => row.family === route.family && row.route === route.route)
        .map((row) => row.id),
      originalArtworkHashes: route.assets,
      retention:
        'Keep the exact historical source factory, policy/catalogue versions, runtime reader and every referenced asset. This is a retention root, not a downloadable-package closure.',
    }));
  return finalizeContentInventory({
    format: CONTENT_INVENTORY_FORMAT,
    lifecycleVersion: CONTENT_LIFECYCLE_VERSION,
    method: {
      originalDecoder:
        'authoring/library/four-worlds-chapters/verify-images.mjs (bounded RGB8 PNG)',
      decoderSha256: sha(await read('authoring/library/four-worlds-chapters/verify-images.mjs')),
      gameplayComparison:
        'Standard runtime physics with display/revision identities removed and entity references consistently renamed. Mode host rules are reported separately; equal definitions are review findings, not proof of equal experience.',
      geometryComparison:
        'Static placements only; timing, threat behaviour and rules remain in full gameplay comparisons.',
      proceduralComparison:
        'Exact renderer command hash at seed0; different seeds do not establish different compositions.',
      coverage:
        'All fixed Solo/Versus authored routes; all reachable Team route factories; Classic base/bundled/archived/optional/external; legacy Team arenas. Imported user content is not classified.',
      limitations: [
        'Perceptual, crop, rotation/reflection and human visual checks remain required before uniqueness approval.',
        'Package artwork counts are not complete download totals; use the generated offline catalogue for dependency closures and full sizes.',
        'Archive policy changes discovery only. Historical readers, original bytes and saved identities remain unchanged.',
      ],
    },
    summary: {
      missionModeOwners: rows.length,
      currentMissionModeOwners: current.length,
      journeyRoutes: AUTHORED_JOURNEY_ROUTE_IDS.length,
      teamRoutes: TEAM_CONTENT_ROUTES.length,
      classicPicturePresentations: classicArt.length,
      classicSharedOriginalGroups: sharedClassic.length,
      authoredOriginalsSharedAcrossRoutes: historical.length,
      currentSharedOriginalGroups: currentArt.length,
      currentIdenticalGameplayGroups: comparisons.currentIdenticalGameplay.length,
      currentSimilarGeometryGroups: comparisons.currentSimilarGeometry.length,
    },
    routes,
    compatibilityRoots,
    packages,
    missions: rows,
    artwork: [...artwork.values()].sort(ordered),
    boards: [...boards.values()].sort(ordered),
    gameplayContexts: [...gameplayContexts.values()].sort(ordered),
    designs: [...designs.values()].sort(ordered),
    classicPresentations: classicArt.map((row) => ({
      id: row.id,
      owner: row.owner,
      label: row.label,
      sourcePath: row.sourceImagePath ?? row.source.path ?? null,
      artwork: row.image?.sha256 ?? row.id,
      classification: classifyContent({
        family: 'classic',
        id: row.source.packId ?? row.source.descriptorId,
        source: row.source.kind,
      }),
    })),
    comparisons,
  });
}

/** Current hosts apply a versioned tuning recipe after authored compilation.
 * Keep authored identities and standard effective physics independently visible. */
export function finalizeContentInventory(report) {
  const boards = new Map(report.boards.map((entry) => [entry.id, entry.level]));
  const contexts = new Map(
    (report.gameplayContexts ?? []).map((entry) => [entry.id, entry.context]),
  );
  const designs = new Map((report.designs ?? []).map((entry) => [entry.id, entry]));
  for (const row of report.missions) {
    if (row.design) {
      row.designId = identity(row.design);
      designs.set(row.designId, { id: row.designId, design: row.design });
      delete row.design;
    }
    const level = boards.get(row.board);
    const context = contexts.get(row.gameplayContext) ?? {};
    row.authoredGameplayHash = identity({ level: normalizedGameplay(level), context });
    row.gameplayHash = identity({
      level: normalizedGameplay(applyGameplayTuning(level, resolveGameplayTuning('standard'))),
      context,
    });
  }
  report.designs = [...designs.values()].sort(ordered);
  report.method.currentGameplayTuning = GAMEPLAY_TUNING_VERSION;
  report.method.gameplayComparison =
    'Standard host physics after the current versioned gameplay-tuning recipe, including Classic class recipes; authored physics is separately hashed. Display/revision identities are removed and entity references consistently renamed. Mode host rules remain separate; equal definitions require design review.';
  report.comparisons.currentIdenticalGameplay = duplicateGroups(
    report.missions.filter((row) => row.classification === 'current'),
    (row) => row.gameplayHash,
  );
  report.summary.currentIdenticalGameplayGroups =
    report.comparisons.currentIdenticalGameplay.length;
  const retained = new Map((report.compatibilityRoots ?? []).map((entry) => [entry.id, entry]));
  for (const row of report.missions.filter(
    (entry) => entry.family === 'classic' && entry.classification === 'archived',
  )) {
    const id = `compatibility/classic/${row.originalIdentity.campaignKey}`;
    if (!retained.has(id))
      retained.set(id, {
        id,
        classification: 'compatibility-only',
        campaignKey: row.originalIdentity.campaignKey,
        missionOwners: [],
        dependencies: row.dependencies,
        originalArtworkHashes: [],
        retention:
          'Retain the exact pack/media pair and historical runtime readers for saved runs, imports, replays and earned pictures; never substitute a current same-named mission.',
      });
    const root = retained.get(id);
    if (!root.missionOwners.includes(row.id)) root.missionOwners.push(row.id);
    root.originalArtworkHashes = unique([
      ...root.originalArtworkHashes,
      ...row.artworks.map((entry) => entry.id),
    ]);
  }
  report.compatibilityRoots = [...retained.values()].sort(ordered);
  return report;
}

export function boardSVG(level) {
  const rects = (list, fill) =>
    (list ?? [])
      .map(
        (r) =>
          `<rect x="${r.x}" y="${r.y}" width="${r.w ?? r.width ?? 1}" height="${r.h ?? r.height ?? 1}" fill="${fill}"/>`,
      )
      .join('');
  const dots = (list, fill) =>
    (list ?? [])
      .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y))
      .map((r) => `<circle cx="${r.x}" cy="${r.y}" r=".8" fill="${fill}"/>`)
      .join('');
  return `<svg role="img" aria-label="${escape(level.name ?? level.id)} board geometry" viewBox="0 0 ${level.width} ${level.height}"><rect width="100%" height="100%" fill="#101722"/>${rects(level.walls, '#7c8799')}${rects(level.foundations ?? level.safeRects, '#3c8e77')}${rects(level.terrain ?? level.classic?.terrain, '#99733c')}${dots(level.spawn ? [level.spawn] : level.spawns, '#a4edff')}${dots(level.enemies, '#ff7188')}${dots(level.objectives ?? level.goal?.cores, '#ffd870')}</svg>`;
}

function sceneSVG(art) {
  let fill = '#000',
    stroke = '#000',
    width = 1,
    route = '';
  const output = [];
  for (const [command, ...args] of art.commands) {
    if (command === 'set') {
      if (args[0] === 'fillStyle') fill = args[1];
      if (args[0] === 'strokeStyle') stroke = args[1];
      if (args[0] === 'lineWidth') width = args[1];
    } else if (command === 'fillRect' || command === 'strokeRect')
      output.push(
        `<rect x="${args[0]}" y="${args[1]}" width="${args[2]}" height="${args[3]}" fill="${command === 'fillRect' ? fill : 'none'}" stroke="${command === 'strokeRect' ? stroke : 'none'}" stroke-width="${width}"/>`,
      );
    else if (command === 'beginPath') route = '';
    else if (command === 'moveTo' || command === 'lineTo')
      route += `${command === 'moveTo' ? 'M' : 'L'}${args[0]} ${args[1]} `;
    else if (command === 'closePath') route += 'Z';
    else if (command === 'fill' || command === 'stroke')
      output.push(
        `<path d="${route}" fill="${command === 'fill' ? fill : 'none'}" stroke="${command === 'stroke' ? stroke : 'none'}" stroke-width="${width}"/>`,
      );
  }
  return `<svg role="img" aria-label="Procedural seed0 preview" viewBox="0 0 384 288">${output.join('')}</svg>`;
}

export function contentInventoryHTML(report) {
  const art = new Map(report.artwork.map((item) => [item.id, item])),
    rows = new Map(report.missions.map((row) => [row.id, row])),
    boards = new Map(report.boards.map((item) => [item.id, item.level])),
    classic = new Map(report.classicPresentations.map((row) => [row.id, row]));
  const preview = (id) => {
    const entry = art.get(id);
    return entry?.kind === 'original'
      ? `<img loading="lazy" src="../../${escape(entry.path)}" alt="${escape(entry.description)}"><p><code>${escape(entry.path)}</code><br>${escape(id)}</p>`
      : entry
        ? sceneSVG(entry)
        : '<p>No recorded picture.</p>';
  };
  const owners = (ids, map = rows) =>
    `<ul>${ids
      .map((id) => {
        const row = map.get(id);
        return `<li><a href="#${escape(id)}">${escape(row?.label ?? `${row?.name} · ${row?.mode} · ${row?.route}`)}</a> <small>${escape(row?.classification)}</small></li>`;
      })
      .join('')}</ul>`;
  const groups = (title, list, image = true, map = rows) =>
    `<section><h2>${title} (${list.length})</h2>${list
      .map(
        (group) =>
          `<details><summary>${escape(group.hash)} · ${group.owners.length} owners</summary>${image ? preview(group.hash) : ''}${owners(group.owners, map)}${
            !image
              ? `<div class="grid">${group.owners
                  .map((id) => {
                    const row = rows.get(id);
                    return `<figure>${boardSVG(boards.get(row.board))}<figcaption>${escape(row.name)} · ${escape(row.mode)}<br>${escape(row.chapter)}</figcaption></figure>`;
                  })
                  .join('')}</div>`
              : ''
          }</details>`,
      )
      .join('')}</section>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Reveal Line content ownership inventory</title><style>body{max-width:1200px;margin:2rem auto;padding:0 1rem;font:16px/1.5 system-ui;background:#111722;color:#e5edf5}a{color:#8edfff}code,small{overflow-wrap:anywhere}summary{cursor:pointer}details{padding:.7rem;border:1px solid #435166;margin:.6rem 0}img,svg{width:100%;max-width:500px;height:auto}h1,h2,h3{line-height:1.2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem}figure{margin:.5rem}dt{font-weight:bold}dd{margin:0 0 1rem}table{border-collapse:collapse}td,th{text-align:left;padding:.4rem;border-bottom:1px solid #435166}</style><h1>Content ownership inventory</h1><p>Generated by <code>node scripts/content-inventory.mjs --write</code>. Findings are pending design/visual review, not a uniqueness approval. Source originals remain unchanged.</p><pre>${escape(JSON.stringify(report.summary, null, 2))}</pre><p>Board legend: grey walls; green initial safe ground; amber terrain; cyan starts; red enemies; yellow objectives. Diagrams do not simulate timing or prove a solution.</p>${groups('Classic shared originals (historical and presentation reuse included)', report.comparisons.classicSharedOriginals, true, classic)}${groups('Authored originals shared across route revisions', report.comparisons.authoredRevisionReuse)}${groups('Current shared originals across mission/mode owners', report.comparisons.currentSharedOriginals)}${groups('Current identical normalized gameplay definitions', report.comparisons.currentIdenticalGameplay, false)}${groups('Current matching static geometry (suspected, not confirmed duplicates)', report.comparisons.currentSimilarGeometry, false)}<section><h2>Every Classic presentation</h2>${report.classicPresentations.map((row) => `<details id="${escape(row.id)}"><summary>${escape(row.label)} · ${escape(row.classification)}</summary>${preview(row.artwork)}<p><code>${escape(JSON.stringify(row.owner))}</code></p></details>`).join('')}</section><section><h2>All mission/mode owners (${report.missions.length})</h2>${report.missions.map((row) => `<details id="${escape(row.id)}"><summary>${escape(row.name)} · ${escape(row.mode)} · ${escape(row.route)} · ${escape(row.classification)}</summary><p>${escape(row.chapter)} · revision ${escape(row.revision)} · <a href="#board-${row.board}">Board diagram</a></p><p>${row.artworks.map((a) => `<a href="#art-${escape(a.id)}">${escape(a.themeId ?? 'Original')} artwork</a>`).join(' · ')}</p><pre>${escape(JSON.stringify(row.originalIdentity, null, 2))}</pre></details>`).join('')}</section><section><h2>Board diagrams</h2>${report.boards.map(({ id, level }) => `<details id="board-${id}"><summary>${escape(level.name)} · ${escape(level.revision)}</summary>${boardSVG(level)}</details>`).join('')}</section><section><h2>Originals and procedural previews</h2>${report.artwork.map((entry) => `<details id="art-${escape(entry.id)}"><summary>${escape(entry.description || entry.id)}</summary>${preview(entry.id)}</details>`).join('')}</section><section><h2>Limitations</h2><ul>${report.method.limitations.map((value) => `<li>${escape(value)}</li>`).join('')}</ul></section></html>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? '--check';
  if (!['--write', '--check', '--summary'].includes(mode) || process.argv.length > 3)
    throw new Error('Usage: content-inventory.mjs [--write|--check|--summary]');
  const report = await buildContentInventory({
    onProgress: (message) => process.stderr.write(`${message}\n`),
  });
  const outputs = new Map([
    [CONTENT_INVENTORY_PATH, `${canonicalJSON(report)}\n`],
    ['docs/content-offline/inventory.html', contentInventoryHTML(report)],
  ]);
  if (mode !== '--summary')
    for (const [relative, body] of outputs) {
      if (mode === '--write') {
        await fs.mkdir(path.dirname(path.join(ROOT, relative)), { recursive: true });
        await fs.writeFile(path.join(ROOT, relative), body);
      } else if ((await fs.readFile(path.join(ROOT, relative), 'utf8')) !== body)
        throw new Error(`Content inventory drift: regenerate ${relative}`);
    }
  console.log(JSON.stringify(report.summary, null, 2));
}
