import { journeyMissionId } from '../game/journey/catalog.mjs';
import { libraryMissionId } from '../game/mission-library/library.mjs';
import { classicLibrarySources } from '../game/mission-library/classic-source.mjs';
import { authoredPackageId } from '../game/content-design/offline-packages.mjs';
import { classifyContent } from '../game/content-design/content-lifecycle.mjs';

const paths = { solo: 'game/', versus: 'game/couch/', team: 'game/couch/relay-rescue.html' };
const runtimes = (mode) => (mode === 'solo' ? ['shared'] : [`runtime:${mode}`]);

/** Exact code-owned handoff IDs. Browser consumers never parse opaque IDs. */
export function buildOfflineDestinations({ journeys, teamProjects, classicIndex, arenas }) {
  const records = [];
  const record = (mode, routeId, groups, libraryId) => ({
    path: paths[mode],
    mode,
    routeId,
    runtimeGroups: runtimes(mode),
    groups: [...new Set(groups)],
    ...(libraryId ? { libraryId } : {}),
  });
  const addJourney = (route, source, modes, team = false) => {
    for (const mode of modes) {
      const rows = [];
      for (const pack of source.packs)
        for (const campaign of source.campaigns.filter((item) =>
          pack.campaignIds.includes(item.id),
        )) {
          for (const id of campaign.missionIds) {
            const mission = source.missions.find(
              (item) => item.id === id && item.modes.includes(mode),
            );
            if (!mission) continue;
            const classification = classifyContent({ family: 'team', id: route.id });
            const group = team
              ? classification === 'current'
                ? `team:${pack.id}`
                : `${classification === 'tooling' ? 'tooling' : 'archive'}:team:${route.id}`
              : authoredPackageId(route.id, mode, pack.id);
            const missionId = journeyMissionId({
              source: 'candidate',
              packId: pack.id,
              campaignId: campaign.id,
              levelId: id,
            });
            rows.push(
              record(
                mode,
                route.id,
                [group],
                libraryMissionId({
                  owner: `journey:${route.id}`,
                  edition: route.id,
                  campaign: JSON.stringify(['candidate', pack.id, campaign.id]),
                  mission: missionId,
                }),
              ),
            );
          }
        }
      if (rows.length) {
        records.push(record(mode, route.id, rows[0].groups));
        records.push(...rows);
      }
    }
  };
  for (const { route } of journeys) addJourney(route, route.source, ['solo', 'versus']);
  for (const { routeId, source } of teamProjects)
    addJourney({ id: routeId }, source, ['team'], true);
  for (const mode of ['solo', 'versus'])
    records.push(
      record(mode, 'legacy', [
        mode === 'versus' ? 'destination:versus:classic:base' : 'classic:base',
      ]),
    );
  for (const source of classicLibrarySources(classicIndex, {
    availability: () => ({ state: 'ready' }),
    launch: () => false,
  })) {
    for (const entry of source.entries) {
      const info = source.describe(entry);
      const id = libraryMissionId({
        owner: source.id,
        edition: source.editionId,
        campaign: info.campaignKey,
        mission: info.id,
        revision: info.revision ?? '',
      });
      for (const mode of info.modes) {
        const group = entry.packId ? `chapter:${entry.packId}` : 'classic:base';
        records.push(
          record(mode, 'legacy', [mode === 'versus' ? `destination:versus:${group}` : group], id),
        );
      }
    }
  }
  records.push(record('team', 'legacy', ['runtime:team']));
  for (const row of arenas.rows)
    records.push(
      record(
        'team',
        'legacy',
        ['runtime:team'],
        libraryMissionId({
          owner: arenas.sourceId,
          edition: arenas.editionId,
          campaign: arenas.packId,
          mission: row.levelId,
          revision: arenas.revision,
        }),
      ),
    );
  return records;
}

/** The worker needs only optional bootstrap files, never the large mission table. */
export function buildNavigationBootstraps({ journeys, currentRouteId }) {
  return journeys.flatMap(({ route, descriptor }) => [
    ...(route.id === currentRouteId
      ? []
      : [
          {
            path: 'game/index.html',
            routeId: route.id,
            files: [`game/content-design/${descriptor.path}`],
          },
        ]),
    {
      path: 'game/couch/index.html',
      routeId: route.id,
      files: [`game/content-design/${descriptor.path}`],
    },
  ]);
}
