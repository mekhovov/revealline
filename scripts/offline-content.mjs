import { soundtrackDownloadVolumes } from '../game/soundtrack-download-volumes.mjs';
import { createHash } from 'node:crypto';
import { SOUNDTRACK_CATALOGUE } from '../game/content/soundtrack-catalogue.mjs';
import { soundtrackRights } from '../game/soundtrack.mjs';
import { authoredPackageId } from '../game/content-design/offline-packages.mjs';
import { classifyContent } from '../game/content-design/content-lifecycle.mjs';
import { addAuthoredRuntimeSnapshots } from './authored-runtime-snapshots.mjs';
import { selectOfflineCore } from './offline-core-closure.mjs';
import { downloadFiles } from '../game/download-catalogue.mjs';
import { buildOfflineDestinations, buildNavigationBootstraps } from './offline-destinations.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
/** Built from the exact frozen bytes, never a second, independently maintained asset list. */
export async function buildOfflineContent(entries, excluded, version) {
  const snapshots = await addAuthoredRuntimeSnapshots(entries);
  for (const chapter of snapshots?.chapters || [])
    if (!chapter.descriptor.core) excluded.add(chapter.path);
  for (const item of snapshots?.routes || [])
    excluded.add(`game/content-design/${item.descriptor.path}`);
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const parse = (name, fallback) =>
    byPath.has(name) ? JSON.parse(byPath.get(name).bytes) : fallback;
  const classicIndex = parse('game/content/mission-library-index.json', { missions: [] });
  const missions = classicIndex.missions;
  const external = parse('game/content/external-worlds.json', { chapters: [] }).chapters;
  const archivedPacks = new Set(
    parse('game/content/packs/archive-catalog.json', { packs: [] }).packs.map((pack) => pack.id),
  );
  const groups = [],
    authoredMissions = [],
    teamProjects = [],
    authoredPaths = new Set();
  const currentChapter = new Map((snapshots?.chapters || []).map((item) => [item.pack.id, item]));
  const routeSnapshots = new Map(
    (snapshots?.routes || []).map((item) => [
      item.route.id,
      `game/content-design/${item.descriptor.path}`,
    ]),
  );
  function addGroup(group) {
    const previous = groups.find((item) => item.id === group.id);
    if (previous) {
      previous.files = [...new Set([...previous.files, ...group.files])];
      previous.modes = [...new Set([...previous.modes, ...group.modes])];
    } else groups.push(group);
  }
  function addProject(edition, source, { routeId, routeLabel, team = false } = {}) {
    if (team) teamProjects.push({ routeId, source });
    const classification = classifyContent({ family: team ? 'team' : 'journey', id: routeId });
    const current = classification === 'current';
    for (const asset of source.assets || []) {
      const name = `game/${asset.path}`,
        entry = byPath.get(name);
      if (!entry || entry.bytes.length !== asset.bytes || digest(entry.bytes) !== asset.sha256)
        throw new Error(`Authored offline dependency is not shipped exactly: ${edition}/${name}`);
      authoredPaths.add(name);
      excluded.add(name);
    }
    const records = new Map();
    for (const pack of source.packs) {
      const campaigns = source.campaigns.filter((item) => pack.campaignIds.includes(item.id));
      const missionIDs = new Set(campaigns.flatMap((item) => item.missionIds));
      const owned = source.missions.filter((item) => missionIDs.has(item.id));
      const modes = [...new Set(owned.flatMap((item) => item.modes || ['team']))];
      for (const mode of modes) {
        const selected = owned.filter((item) => (item.modes || ['team']).includes(mode));
        const assetIDs = new Set(selected.map((item) => item.presentation.backgroundAssetId));
        const id = team
          ? current
            ? `team:${pack.id}`
            : `${classification === 'tooling' ? 'tooling' : 'archive'}:team:${routeId}`
          : authoredPackageId(routeId, mode, pack.id);
        const snapshot = current && !team ? currentChapter.get(pack.id) : null;
        const modeLabel = mode === 'versus' ? 'Versus' : mode === 'team' ? 'Team' : 'Solo';
        const chapterTitle =
          pack.id === 'journey-opening'
            ? 'Horizon'
            : campaigns.map((campaign) => campaign.name.replace(/ · optional$/, '')).join(' · ');
        addGroup({
          id,
          title: current
            ? `${modeLabel} · ${chapterTitle}`
            : `${team ? 'Team' : 'Journey'} · ${(routeLabel || source.name).replace(/ · (?:balance pending|test candidates|unvalidated.*)$/, '')} · ${classification === 'tooling' ? 'Studio' : 'Archive'}`,
          kind: 'gameplay',
          category: current
            ? id === 'solo:horizon-starter'
              ? 'starter'
              : 'chapter'
            : classification === 'tooling'
              ? 'tooling'
              : 'archive',
          classification,
          current,
          modes: [mode],
          requires: team
            ? ['shared', 'runtime:team']
            : !current || mode === 'versus'
              ? ['shared', 'runtime:versus']
              : ['shared'],
          files: [
            ...(snapshot && !snapshot.descriptor.core ? [snapshot.path] : []),
            ...(!current && !team && routeSnapshots.has(routeId)
              ? [routeSnapshots.get(routeId)]
              : []),
            ...(source.assets || [])
              .filter((item) => assetIDs.has(item.id))
              .map((item) => `game/${item.path}`),
          ],
        });
        for (const mission of selected) {
          const key = `${edition}/${mission.id}/${mission.revision}/${mode}`;
          const record = records.get(key) || {
            id: key,
            routeId,
            missionId: mission.id,
            modes: [mode],
            current,
            classification,
            groups: [],
          };
          record.groups.push(id);
          records.set(key, record);
        }
      }
    }
    authoredMissions.push(...records.values());
  }
  if (byPath.has('game/content-design/route-loader.mjs')) {
    const { AUTHORED_JOURNEY_ROUTE_IDS } = await import('../game/content-design/mode-href.mjs');
    const { loadAuthoredJourneyRoute } = await import('../game/content-design/route-loader.mjs');
    for (const id of AUTHORED_JOURNEY_ROUTE_IDS) {
      const route = await loadAuthoredJourneyRoute(id);
      addProject(`journey:${id}`, route.source, {
        routeId: id,
        routeLabel: route.label,
      });
    }
    for (const [module, factory, routeId] of [
      ['team-journey-candidates', 'createTeamJourneyCandidates', 'team-originals'],
      [
        'team-pressure-originals',
        'createTeamPressureOriginalCandidates',
        'team-pressure-originals-1',
      ],
      ['team-spatial-originals', 'createTeamSpatialOriginalCandidates', 'team-spatial-originals-1'],
      [
        'team-impact-originals',
        'createTeamImpactOriginalCandidates',
        'team-trail-impact-originals-1',
      ],
      [
        'team-specialist-originals',
        'createTeamSpecialistOriginalCandidates',
        'team-specialist-originals-1',
      ],
      [
        'team-complete-specialist-originals',
        'createTeamCompleteSpecialistOriginalCandidates',
        'team-complete-specialist-originals-1',
      ],
      ['team-timed-originals', 'createTeamTimedOriginalCandidates', 'team-timed-originals'],
      [
        'team-window-spatial-candidates',
        'createTeamWindowSpatialCandidates',
        'team-window-spatial-1',
      ],
      ['team-depot-spatial-candidates', 'createTeamDepotSpatialCandidates', 'team-depot-spatial-1'],
    ]) {
      const source = (await import(`../game/content-design/${module}.mjs`))[factory]({
        artwork: true,
      });
      addProject(`team:${module}`, source, { routeId, team: true });
    }
  }
  const chapterPaths = new Set(missions.map((mission) => mission.sourceFile.path));
  for (const chapter of external) {
    chapterPaths.add(chapter.pack.path);
    chapterPaths.add(chapter.media.path);
  }
  for (const mission of missions) {
    const path = mission.sourceFile.path,
      entry = byPath.get(path);
    if (
      !entry ||
      entry.bytes.length !== mission.sourceFile.bytes ||
      digest(entry.bytes) !== mission.sourceFile.sha256
    )
      throw new Error(`Offline mission has no exact shipped dependency: ${mission.id}`);
    const id = mission.packId ? `chapter:${mission.packId}` : snapshots ? 'classic:base' : 'base';
    const companion = external.find((chapter) => chapter.id === mission.packId);
    const current =
      classifyContent({
        family: 'classic',
        id: mission.packId,
        source: archivedPacks.has(mission.packId)
          ? 'archived'
          : companion
            ? 'external'
            : mission.packId
              ? 'bundled'
              : 'base',
      }) === 'current';
    addGroup({
      id,
      title: mission.edition === 'Base game' ? 'Classic missions' : mission.campaignTitle,
      kind: 'gameplay',
      category: current ? 'chapter' : 'archive',
      current,
      modes: mission.modes || ['solo'],
      requires: ['shared'],
      files: [path, ...(companion ? [companion.media.path] : [])].filter((name) =>
        excluded.has(name),
      ),
    });
  }
  if (snapshots)
    for (const group of [...groups].filter(
      (item) => item.id === 'classic:base' || item.id.startsWith('chapter:'),
    )) {
      groups.push({
        id: `destination:versus:${group.id}`,
        title: group.title,
        kind: 'gameplay',
        category: 'destination',
        current: false,
        modes: ['versus'],
        requires: [group.id, 'runtime:versus'],
        files: [],
      });
    }
  const recordings = SOUNDTRACK_CATALOGUE.tracks.filter(
    (track) =>
      soundtrackRights(track, { catalogue: SOUNDTRACK_CATALOGUE }).offlineCache === 'allowed',
  );
  const recordingPaths = new Set(recordings.map((track) => track.path));
  for (const track of recordings) {
    const entry = byPath.get(track.path);
    if (
      entry &&
      (entry.bytes.length !== track.asset.bytes || digest(entry.bytes) !== track.asset.sha256)
    )
      throw new Error(`Shipped soundtrack differs from its catalogue: ${track.id}`);
  }
  const coreGraph = snapshots ? selectOfflineCore(entries, excluded) : null;
  const modePaths = new Set();
  const contentExcluded = new Set(excluded);
  if (coreGraph)
    for (const mode of ['versus', 'team']) {
      const closure = selectOfflineCore(entries, contentExcluded, { mode });
      const files = [...closure.retained].filter((path) => !coreGraph.retained.has(path));
      files.push(
        routeSnapshots.get(snapshots.route.id),
        ...snapshots.published.navigation.archives.map((item) => routeSnapshots.get(item.route.id)),
      );
      for (const path of files) {
        modePaths.add(path);
        excluded.add(path);
      }
      groups.push({
        id: `runtime:${mode}`,
        title: mode === 'versus' ? 'Versus mode' : 'Team mode',
        kind: 'gameplay',
        category: 'mode',
        current: true,
        modes: [mode],
        requires: ['shared'],
        files,
      });
    }
  const toolingPaths = new Set((coreGraph?.optional || []).filter((path) => !modePaths.has(path)));
  if (toolingPaths.size) {
    for (const name of toolingPaths) excluded.add(name);
    groups.push({
      id: 'tooling:workshop',
      title: 'Authoring tools and reference material',
      kind: 'gameplay',
      category: 'tooling',
      current: false,
      modes: [],
      requires: ['shared'],
      files: [...toolingPaths],
    });
  }
  const files = entries
    .filter((entry) => excluded.has(entry.name) && !recordingPaths.has(entry.name))
    .map((entry) => ({
      path: entry.name,
      bytes: entry.bytes.length,
      sha256: digest(entry.bytes),
      kind: 'gameplay',
    }));
  const assigned = new Set(groups.flatMap((group) => group.files));
  const unownedArtwork = files.filter(
    (file) => file.path.startsWith('game/content-design/assets/') && !assigned.has(file.path),
  );
  if (unownedArtwork.length)
    groups.push({
      id: 'tooling:artwork',
      title: 'Unused authoring artwork',
      kind: 'gameplay',
      category: 'tooling',
      current: false,
      modes: [],
      requires: [],
      files: unownedArtwork.map((file) => file.path),
    });
  const authoredSnapshotPaths = new Set((snapshots?.chapters || []).map((item) => item.path));
  groups.unshift({
    id: 'shared',
    title: 'Shared runtime support',
    kind: 'gameplay',
    category: 'shared',
    current: true,
    modes: ['solo', 'versus', 'team'],
    requires: [],
    files: files
      .filter(
        (file) =>
          !chapterPaths.has(file.path) &&
          !authoredPaths.has(file.path) &&
          !authoredSnapshotPaths.has(file.path) &&
          !file.path.startsWith('game/content-design/assets/') &&
          !toolingPaths.has(file.path) &&
          !modePaths.has(file.path) &&
          ![...routeSnapshots.values()].includes(file.path),
      )
      .map((file) => file.path),
  });
  if (snapshots)
    groups.unshift({
      id: 'base',
      title: 'Solo starter · Horizon',
      kind: 'gameplay',
      category: 'starter',
      current: true,
      modes: ['solo'],
      requires: ['shared', 'solo:horizon-starter'],
      files: [],
    });
  for (const track of recordings)
    files.push({
      ...track.asset,
      path: `soundtrack:${track.id}`,
      trackId: track.id,
      kind: 'soundtrack',
    });
  for (const volume of soundtrackDownloadVolumes(SOUNDTRACK_CATALOGUE)) {
    const tracks = volume.tracks.filter((track) => recordings.includes(track));
    if (tracks.length)
      groups.push({
        id: `music:${volume.playlistId || volume.id}`,
        title: volume.title,
        kind: 'soundtrack',
        requires: [],
        files: tracks.map((track) => `soundtrack:${track.id}`),
      });
  }
  // Stable sort preserves authored chapter order within a mode while keeping
  // historical editions and Studio packages below current playable choices.
  const groupRank = (group) =>
    group.id === 'base'
      ? 0
      : group.id === 'shared'
        ? 1
        : group.category === 'starter'
          ? 2
          : group.category === 'archive'
            ? 7
            : group.category === 'tooling'
              ? 8
              : group.kind === 'soundtrack'
                ? 6
                : group.modes.length === 1
                  ? 3 + ['solo', 'versus', 'team'].indexOf(group.modes[0])
                  : 5;
  groups.sort((left, right) => groupRank(left) - groupRank(right));
  const allAssigned = new Set(groups.flatMap((group) => group.files));
  if (files.some((file) => !allAssigned.has(file.path)))
    throw new Error('An offline asset has no download group.');
  const originals = [];
  for (const chapter of external) {
    const entry = byPath.get(chapter.media.path);
    if (!entry || entry.bytes.subarray(0, 8).toString() !== 'RLMDB1\r\n')
      throw new Error('Invalid official media bundle.');
    const length = entry.bytes.readUInt32BE(8),
      manifest = JSON.parse(entry.bytes.subarray(12, 12 + length));
    let offset = 12 + length;
    for (const asset of manifest.assets) {
      if (digest(entry.bytes.subarray(offset, offset + asset.bytes)) !== asset.sha256)
        throw new Error('Official original differs from its bundle.');
      originals.push({
        sha256: asset.sha256,
        bytes: asset.bytes,
        parent: chapter.media.sha256,
        offset,
        mime:
          manifest.document.library.assets.find((item) => item.sha256 === asset.sha256)?.mime ||
          'application/octet-stream',
      });
      offset += asset.bytes;
    }
    if (offset !== entry.bytes.length) throw new Error('Official media bundle has trailing bytes.');
  }
  return {
    format: snapshots ? 'revealline-offline-content.v2' : 'revealline-offline-content.v1',
    version,
    files,
    groups,
    ...(snapshots
      ? {
          navigationBootstraps: buildNavigationBootstraps({
            journeys: snapshots.routes,
            currentRouteId: snapshots.route.id,
          }),
          destinations: buildOfflineDestinations({
            journeys: snapshots.routes,
            teamProjects,
            classicIndex,
            arenas: snapshots.published.navigation.team.arenas,
          }),
        }
      : {}),
    originals,
    missions: [
      ...authoredMissions,
      ...missions.map((mission) => ({
        id: mission.id,
        missionId: mission.levelId,
        levelId: mission.levelId,
        packId: mission.packId,
        campaignId: mission.campaignId,
        modes: mission.modes,
        current:
          classifyContent({
            family: 'classic',
            id: mission.packId,
            source: archivedPacks.has(mission.packId)
              ? 'archived'
              : mission.packId
                ? 'bundled'
                : 'base',
          }) === 'current',
        groups: [
          mission.packId ? `chapter:${mission.packId}` : snapshots ? 'classic:base' : 'base',
        ],
      })),
    ],
    sharedPolicy:
      'The current lightweight catalogue keeps every mission visible. Original artwork belongs to its chapter; archives and soundtracks are separate optional downloads.',
  };
}

/** Publication evidence, generated after the worker to avoid a recursive content hash. */
export function buildOfflineInventory(entries, catalogue, core) {
  const corePaths = new Set(core.map((file) => file.path));
  const toolingPaths = new Set(
    catalogue.groups
      .filter((group) => group.category === 'tooling')
      .flatMap((group) => group.files),
  );
  const playablePaths = new Set(
    catalogue.groups
      .filter((group) => group.kind === 'gameplay' && group.category !== 'tooling')
      .flatMap((group) => group.files),
  );
  const recordingByPath = new Map(
    SOUNDTRACK_CATALOGUE.tracks.map((track) => [track.path, track.asset.sha256]),
  );
  const files = entries.map((entry) => ({
    path: entry.name,
    bytes: entry.bytes.length,
    sha256: digest(entry.bytes),
    kind: recordingByPath.has(entry.name)
      ? 'soundtrack'
      : entry.name === '_headers' ||
          (toolingPaths.has(entry.name) &&
            !playablePaths.has(entry.name) &&
            !corePaths.has(entry.name))
        ? 'tooling'
        : 'gameplay',
    delivery: recordingByPath.has(entry.name)
      ? 'optional-recording'
      : corePaths.has(entry.name)
        ? 'core'
        : catalogue.files.some((file) => file.path === entry.name)
          ? 'download'
          : 'installation-metadata',
  }));
  const recordings = catalogue.files.filter((file) => file.kind === 'soundtrack');
  const shippedRecordingHashes = new Set(
    entries
      .filter((entry) => recordingByPath.has(entry.name))
      .map((entry) => recordingByPath.get(entry.name)),
  );
  const currentGroups = catalogue.groups.filter(
    (group) =>
      group.kind === 'gameplay' &&
      group.current !== false &&
      !['archive', 'tooling'].includes(group.category),
  );
  const currentFiles = downloadFiles(
    catalogue,
    currentGroups.map((group) => group.id),
  );
  const required = [...core, ...currentFiles];
  const unique = [...new Map(required.map((file) => [file.sha256, file])).values()];
  const gameplayBytes = unique.reduce((sum, file) => sum + file.bytes, 0);
  const coreBytes = core.reduce((sum, file) => sum + file.bytes, 0);
  const gameplayStorageBytes =
    coreBytes +
    [...new Map(currentFiles.map((file) => [file.sha256, file])).values()].reduce(
      (sum, file) => sum + file.bytes,
      0,
    );
  const largestFileBytes = Math.max(0, ...unique.map((file) => file.bytes));
  const bytesFor = (files) =>
    [...new Map(files.map((file) => [file.sha256, file])).values()].reduce(
      (total, file) => total + file.bytes,
      0,
    );
  const starter = catalogue.groups.some((group) => group.id === 'base')
    ? downloadFiles(catalogue, ['base'])
    : [];
  return {
    format: 'revealline-offline-inventory.v1',
    version: catalogue.version,
    files: [
      ...files,
      ...recordings
        .filter((file) => !shippedRecordingHashes.has(file.sha256))
        .map((file) => ({ ...file, delivery: 'optional-recording' })),
    ],
    missions: catalogue.missions.map((mission) => ({ ...mission, requiresCore: true })),
    groups: catalogue.groups,
    sizes: {
      gameplayBytes,
      starterBytes: bytesFor([...core, ...starter]),
      allShippedGameplayAndToolsBytes: bytesFor([
        ...core,
        ...catalogue.files.filter((file) => file.kind === 'gameplay'),
      ]),
      coreBytes,
      gameplayStorageBytes,
      soundtrackBytes: [...new Map(recordings.map((file) => [file.sha256, file])).values()].reduce(
        (sum, file) => sum + file.bytes,
        0,
      ),
      largestFileBytes,
      firstDownloadPeakBytes: gameplayStorageBytes + largestFileBytes,
      worstCaseTwoEditionPeakBytes: 2 * gameplayStorageBytes + largestFileBytes,
    },
    updatePolicy:
      'Supplemental hashes are shared. Core hashes reuse network bytes but retain separate edition caches. Peak excludes browser overhead and player imports; the UI also estimates actual free origin storage.',
  };
}
