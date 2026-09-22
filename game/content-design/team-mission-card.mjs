import { paintMissionThumbnail } from './mission-card.mjs';

const presetName = (value) => value[0].toUpperCase() + value.slice(1);

/** Owned Journey decoration, injected by the selected Journey entry. Legacy
 * discovery does not import the content compiler or Solo simulation for cards.
 * Identity, not imported IDs, grants access to the owned initial-state diagram. */
export function createTeamMissionCardPresenter(journey, progress, { reviewCopy = true } = {}) {
  return ({ document, row, card }) => {
    const owned = row.journeyRow;
    if (!journey.owns(owned)) return false;
    const diagram = journey.card(owned.mission, owned.difficulty),
      profile = progress?.snapshot(),
      receipt = profile?.clears.team[owned.mission.id];
    const detail = document.createElement('p');
    detail.className = 'team-mission-difficulty';
    detail.textContent = `Challenge band ${diagram.band} · ${presetName(diagram.preset)}`;
    const completion = document.createElement('p');
    completion.className = 'team-mission-completion';
    if (receipt) {
      const edition = journey.row(owned.mission, receipt.difficulty);
      completion.textContent =
        `${receipt.gameplayId === edition?.simulationIdentity ? 'Cleared' : 'Earlier edition cleared'} on ${presetName(receipt.difficulty)}` +
        (receipt.difficulty === owned.difficulty && receipt.gameplayId === owned.simulationIdentity
          ? ' · selected edition'
          : ' · no clear recorded for this selected edition');
    } else
      completion.textContent = profile?.skipped.team.includes(owned.mission.id)
        ? 'Skipped · revisit whenever you like'
        : 'Not cleared';
    const route = document.createElement('p');
    route.className = 'team-mission-route';
    route.textContent = diagram.route;
    const mastery = document.createElement('p');
    mastery.className = 'team-mission-mastery';
    mastery.textContent = diagram.mastery;
    const optional = document.createElement('details'),
      summary = document.createElement('summary');
    optional.className = 'team-mission-optional';
    summary.textContent = 'Optional goal · not tracked';
    optional.append(summary, mastery);
    const figure = document.createElement('figure'),
      canvas = document.createElement('canvas'),
      caption = document.createElement('figcaption');
    figure.className = 'team-discovery-teaser team-mission-diagram';
    canvas.width = 288;
    canvas.height = Math.round((288 * diagram.height) / diagram.width);
    canvas.setAttribute('aria-hidden', 'true');
    caption.className = 'team-discovery-teaser-message';
    const artStatus = owned.background
      ? reviewCopy
        ? 'Original-art test; visual qualification pending.'
        : 'Win to reveal the original artwork.'
      : 'Original artwork pending.';
    caption.textContent = `Starting map · craft 1 + 2. Not a capture prediction. ${artStatus}`;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      paintMissionThumbnail(context, diagram, canvas.width);
    } catch {
      canvas.hidden = true;
      caption.textContent = `Starting-map diagram unavailable. Route details and Play remain available. ${artStatus}`;
    }
    figure.append(canvas, caption);
    card.append(detail, completion, figure, route, optional);
    return true;
  };
}
