import { soundtrackDownloadVolumes } from '../game/soundtrack-download-volumes.mjs';
import { createHash } from 'node:crypto';
import { SOUNDTRACK_CATALOGUE } from '../game/content/soundtrack-catalogue.mjs';
import { soundtrackRights } from '../game/soundtrack.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
/** Built from the exact frozen bytes, never a second, independently maintained asset list. */
export async function buildOfflineContent(entries, excluded, version) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const parse = (name, fallback) =>
    byPath.has(name) ? JSON.parse(byPath.get(name).bytes) : fallback;
  const missions = parse('game/content/mission-library-index.json', { missions: [] }).missions;
  const external = parse('game/content/external-worlds.json', { chapters: [] }).chapters;
  const chapterPaths = new Set(missions.map((mission) => mission.sourceFile.path));
  for (const chapter of external) {
    chapterPaths.add(chapter.pack.path);
    chapterPaths.add(chapter.media.path);
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
  const files = entries
    .filter((entry) => excluded.has(entry.name) && !recordingPaths.has(entry.name))
    .map((entry) => ({
      path: entry.name,
      bytes: entry.bytes.length,
      sha256: digest(entry.bytes),
      kind: 'gameplay',
    }));
  const groups = [
    {
      id: 'shared',
      title: 'Shared game, modes and original reward artwork',
      kind: 'gameplay',
      requires: [],
      files: files.filter((file) => !chapterPaths.has(file.path)).map((file) => file.path),
    },
  ];
  const chapterGroups = new Map();
  for (const mission of missions) {
    const path = mission.sourceFile.path;
    const entry = byPath.get(path);
    if (
      !entry ||
      entry.bytes.length !== mission.sourceFile.bytes ||
      digest(entry.bytes) !== mission.sourceFile.sha256
    )
      throw new Error(`Offline mission has no exact shipped dependency: ${mission.id}`);
    const id = mission.packId ? `chapter:${mission.packId}` : 'base';
    if (!chapterGroups.has(id)) {
      const companion = external.find((chapter) => chapter.id === mission.packId);
      chapterGroups.set(id, {
        id,
        title: mission.edition === 'Base game' ? 'Base game' : mission.campaignTitle,
        kind: 'gameplay',
        requires: ['shared'],
        files: [path, ...(companion ? [companion.media.path] : [])].filter((name) =>
          excluded.has(name),
        ),
      });
    }
  }
  groups.push(...chapterGroups.values());
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
  const assigned = new Set(groups.flatMap((group) => group.files));
  if (files.some((file) => !assigned.has(file.path)))
    throw new Error('An offline asset has no download group.');
  const originals = [];
  for (const chapter of external) {
    const entry = byPath.get(chapter.media.path);
    if (!entry || entry.bytes.subarray(0, 8).toString() !== 'RLMDB1\r\n')
      throw new Error('Invalid official media bundle.');
    const length = entry.bytes.readUInt32BE(8);
    const manifest = JSON.parse(entry.bytes.subarray(12, 12 + length));
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
  const authoredMissions = [];
  function addProject(edition, source) {
    for (const asset of source.assets || []) {
      const name = `game/${asset.path}`,
        entry = byPath.get(name);
      if (!entry || entry.bytes.length !== asset.bytes || digest(entry.bytes) !== asset.sha256)
        throw new Error(`Authored offline dependency is not shipped exactly: ${edition}/${name}`);
    }
    for (const mission of source.missions)
      authoredMissions.push({
        id: `${edition}/${mission.id}/${mission.revision}`,
        modes: mission.modes || ['team'],
        groups: ['base'],
      });
  }
  if (byPath.has('game/content-design/route-loader.mjs')) {
    const { AUTHORED_JOURNEY_ROUTE_IDS } = await import('../game/content-design/mode-href.mjs');
    const { loadAuthoredJourneyRoute } = await import('../game/content-design/route-loader.mjs');
    for (const id of AUTHORED_JOURNEY_ROUTE_IDS)
      addProject(`journey:${id}`, (await loadAuthoredJourneyRoute(id)).source);
    for (const [module, factory] of [
      ['team-journey-candidates', 'createTeamJourneyCandidates'],
      ['team-pressure-originals', 'createTeamPressureOriginalCandidates'],
      ['team-spatial-originals', 'createTeamSpatialOriginalCandidates'],
      ['team-impact-originals', 'createTeamImpactOriginalCandidates'],
      ['team-specialist-originals', 'createTeamSpecialistOriginalCandidates'],
      ['team-timed-originals', 'createTeamTimedOriginalCandidates'],
      ['team-window-spatial-candidates', 'createTeamWindowSpatialCandidates'],
      ['team-depot-spatial-candidates', 'createTeamDepotSpatialCandidates'],
    ]) {
      const source = (await import(`../game/content-design/${module}.mjs`))[factory]({
        artwork: true,
      });
      addProject(`team:${module}`, source);
    }
  }
  return {
    format: 'revealline-offline-content.v1',
    version,
    files,
    groups,
    originals,
    missions: [
      ...authoredMissions,
      ...missions.map((mission) => ({
        id: mission.id,
        modes: mission.modes,
        groups: [mission.packId ? `chapter:${mission.packId}` : 'base'],
      })),
    ],
    // Conservative shared closure includes tools reachable from gameplay and all authored reward pictures.
    sharedPolicy:
      'Core runtime, reachable tools and original artwork are shared dependencies of every chapter.',
  };
}

/** Publication evidence, generated after the worker to avoid a recursive content hash. */
export function buildOfflineInventory(entries, catalogue, core) {
  const corePaths = new Set(core.map((file) => file.path));
  const recordingByPath = new Map(
    SOUNDTRACK_CATALOGUE.tracks.map((track) => [track.path, track.asset.sha256]),
  );
  const files = entries.map((entry) => ({
    path: entry.name,
    bytes: entry.bytes.length,
    sha256: digest(entry.bytes),
    kind: recordingByPath.has(entry.name)
      ? 'soundtrack'
      : /(^|\/)(authoring|tools)\//.test(entry.name) || entry.name === '_headers'
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
  const required = [...core, ...catalogue.files.filter((file) => file.kind === 'gameplay')];
  const unique = [...new Map(required.map((file) => [file.sha256, file])).values()];
  const gameplayBytes = unique.reduce((sum, file) => sum + file.bytes, 0);
  const coreBytes = core.reduce((sum, file) => sum + file.bytes, 0);
  const gameplayStorageBytes =
    coreBytes +
    [
      ...new Map(
        catalogue.files
          .filter((file) => file.kind === 'gameplay')
          .map((file) => [file.sha256, file]),
      ).values(),
    ].reduce((sum, file) => sum + file.bytes, 0);
  const largestFileBytes = Math.max(0, ...unique.map((file) => file.bytes));
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
