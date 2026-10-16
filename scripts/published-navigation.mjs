import { createHash } from 'node:crypto';
import { canonicalJSON, dataIdentity } from '../game/data-json.mjs';
import { createContentExecutionCatalog } from '../game/content-design/execution.mjs';
import { createMissionCard } from '../game/content-design/mission-card.mjs';
import { createJourneyCatalog } from '../game/journey/catalog.mjs';
import { authoredJourneyMissionTags } from '../game/mission-library/journey-presentation.mjs';
import contentRegistry from '../game/i18n/content-registry.mjs';

export const projectHash = (source) =>
  createHash('sha256').update(canonicalJSON(source)).digest('hex');
export const routeMetadata = (route) =>
  Object.fromEntries(Object.entries(route).filter(([key]) => key !== 'source'));
const runs = (values) => {
  const result = [];
  for (const value of values) {
    if (result.length && result.at(-2) === value) result[result.length - 1]++;
    else result.push(value, 1);
  }
  return result;
};

/** Static browsing projections are not executable levels or save authority. */
export function buildJourneyView(source, mode, cards, original = source) {
  const executions = createContentExecutionCatalog(source, { mode });
  const campaigns = executions.journey().campaigns.map(({ packId, runtime, manifests }) => ({
    source: 'candidate',
    packId,
    id: runtime.id,
    title: runtime.title ?? runtime.name,
    modes: [mode],
    levels: runtime.levels.map((level, index) => ({
      id: level.id,
      name: level.name,
      hook: manifests[index].design.routeDecision,
    })),
  }));
  const catalog = createJourneyCatalog(campaigns);
  const presentations = {},
    executionMetadata = [];
  for (const entry of executions.entries) {
    executionMetadata.push({
      key: entry.executionKey,
      difficulty: entry.difficulty,
      packId: entry.sourcePackId,
      campaignId: entry.campaignId,
      campaign: {
        id: entry.campaign.id,
        title: entry.campaign.title ?? entry.campaign.name,
        levels: entry.campaign.levels.map(({ id, name }) => ({ id, name })),
      },
    });
    entry.manifests.forEach((manifest) => {
      const mission = catalog.missions.find(
        (item) =>
          item.packId === entry.sourcePackId &&
          item.campaignId === entry.campaignId &&
          item.levelId === manifest.missionId,
      );
      const card = createMissionCard(manifest);
      const compact = { ...card, cells: runs(card.cells), terrain: runs(card.terrain) };
      const cardId = dataIdentity(compact);
      cards[cardId] ||= compact;
      const registered = contentRegistry[dataIdentity(manifest)]?.fields || {};
      (presentations[mission.id] ||= {})[entry.difficulty] = {
        band: manifest.design.difficulty.band,
        route: manifest.design.routeDecision,
        mastery: manifest.design.mastery,
        tags: authoredJourneyMissionTags(mission, manifest),
        card: cardId,
        translations: Object.fromEntries(
          ['routeDecision', 'mastery'].flatMap((field) => {
            const registeredField = registered[`design.${field}`];
            return registeredField ? [[field, registeredField]] : [];
          }),
        ),
      };
    });
  }
  const ordinals = Object.fromEntries(
    catalog.missions.map((mission) => [
      mission.id,
      original.campaigns
        .find((item) => item.id === mission.campaignId)
        ?.missionIds.indexOf(mission.levelId) ?? mission.levelIndex,
    ]),
  );
  return { campaigns, presentations, executionMetadata, ordinals };
}
