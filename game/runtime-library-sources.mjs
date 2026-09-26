import { journeyLibrarySource } from './mission-library/journey-source.mjs';
import {
  journeyMissionDetails,
  authoredJourneyMissionTags,
} from './mission-library/journey-presentation.mjs';

/** The default distribution's extra library content. Isolated Solo builds
 * replace this data-provider module with an empty, explicit source inventory. */
export async function loadSupplementalJourneySources({
  route,
  originalThemes,
  libraryThemes,
  difficulty,
  launch,
  profile,
  editionLabel,
  edition = route.label,
}) {
  const [
    { createCandidateVersusHost },
    { createRemoteTeamLibrarySources },
    { createSpatialNextEditionSources },
  ] = await Promise.all([
    import('./content-design/versus-host.mjs'),
    import('./mission-library/remote-team.mjs'),
    import('./mission-library/spatial-next-editions.mjs'),
  ]);
  const host = createCandidateVersusHost(route.source, {
    themes: libraryThemes,
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  });
  const versus = journeyLibrarySource({
    editionId: route.id,
    edition,
    editionLabel,
    catalog: host.catalog,
    profile,
    details: (mission) => journeyMissionDetails(host.manifest(mission, difficulty())),
    tags: (mission) => authoredJourneyMissionTags(mission, host.manifest(mission)),
    card: (mission) => host.card(mission, difficulty()),
    launch: (_mission, context) => launch(context),
  });
  const teamSources = createRemoteTeamLibrarySources({ launch, difficulty });
  const spatial = await createSpatialNextEditionSources({
    activeRouteId: route.id,
    originalThemes,
    difficulty,
    launch,
  });
  return { versus, sources: [...spatial.sources, ...teamSources], dispose: spatial.dispose };
}
