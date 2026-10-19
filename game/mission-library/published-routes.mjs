import { journeyLibrarySource } from './journey-source.mjs';
import { combineJourneyLibrarySources } from './cross-mode-journey.mjs';
import { publishedTeamArenaSource } from '../content-design/published-journey.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { contentText } from '../i18n/content.mjs';
import { t } from '../i18n/index.mjs';
import { huntText } from '../hunt/copy.mjs';

/** Publisher-validated display records never become runtime ownership. Launches
 * stay with the active Solo host or the exact receiving route's validators. */
export function publishedJourneyLibrarySources({
  route,
  views,
  soloHost,
  profile,
  difficulty = () => 'standard',
  launchSolo,
  launchRemote,
}) {
  const source = (edition, view, options = {}) =>
    journeyLibrarySource({
      editionId: edition.id,
      edition: edition.id === DEFAULT_JOURNEY_ROUTES.solo ? 'New Journey' : edition.label,
      editionLabel: () =>
        edition.id === DEFAULT_JOURNEY_ROUTES.solo
          ? t('interface:newJourney')
          : contentText(edition, 'label'),
      catalog: view.catalog,
      details: (mission) => view.details(mission, difficulty()),
      tags: (mission) => view.tags(mission, 'standard'),
      card: (mission) => view.card(mission, difficulty()),
      launch: (_mission, context) => launchRemote(context),
      ...options,
    });
  const current = combineJourneyLibrarySources([
    {
      mode: 'solo',
      source: source(route, views.solo, {
        catalog: soloHost?.catalog || views.solo.catalog,
        profile,
        details: (mission) =>
          soloHost?.details?.(mission, difficulty()) ?? views.solo.details(mission, difficulty()),
        card: (mission) => (soloHost || views.solo).card(mission, difficulty()),
        launch: launchSolo,
      }),
    },
    { mode: 'versus', source: source(route, views.versus, { profile }) },
  ]);
  const archives = views.archives.map((edition) => {
    const options = {
      lifecycle: 'archive',
      edition: `Previous Journey · v${edition.route.id.split('v').at(-1)}`,
      editionLabel: () =>
        t('interface:missionLibrary.previousJourney', {
          version: edition.route.id.split('v').at(-1),
        }),
    };
    return Object.freeze({
      ...combineJourneyLibrarySources([
        { mode: 'solo', source: source(edition.route, edition.solo, options) },
        { mode: 'versus', source: source(edition.route, edition.versus, options) },
      ]),
      automaticContinuation: false,
    });
  });
  const team = source(views.team.route, views.team.view, {
    edition: 'Team Journey',
    editionLabel: () => t('interface:missionLibrary.team.journeyEdition'),
    tags: (mission) => views.team.view.tags(mission, difficulty()),
  });
  const supplemental = (views.supplemental ?? []).map((edition) => {
    const hunt = edition.route.id === 'humanoid-hunt-v1';
    const label = hunt
      ? () => huntText('lessons')
      : () => t(`interface:expeditions.${edition.mode === 'team' ? 'team' : 'duel'}`);
    return Object.freeze({
      ...source(edition.route, edition.view, {
        edition: hunt || edition.mode === 'team' ? label() : edition.route.label,
        editionLabel: label,
        // Team and Hunt follow the selected preset. Only Duel Expeditions
        // retain their authored standard tags independently of that preset.
        tags: (mission) =>
          edition.view.tags(mission, edition.mode === 'team' || hunt ? difficulty() : 'standard'),
      }),
      id: edition.sourceId,
      ...(edition.automaticContinuation === false ? { automaticContinuation: false } : {}),
    });
  });
  return Object.freeze([
    current,
    ...archives,
    ...supplemental.filter((_source, index) => views.supplemental[index].mode === 'team'),
    team,
    publishedTeamArenaSource(views.team.arenas, { launch: launchRemote }),
    ...supplemental.filter((_source, index) => views.supplemental[index].mode === 'versus'),
  ]);
}
