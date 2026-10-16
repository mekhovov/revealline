import { localizedAttribute, localizedMessage, localizedText } from '../i18n/index.mjs';

/** Reset mission-owned UI when switching to a valid empty candidate project.
 * The source compiler remains the authority; this only controls the workbench. */
export function setBoardAvailability(document, available) {
  const $ = (id) => document.getElementById(id);
  for (const id of [
    'mission',
    'difficulty',
    'geometry-tools',
    'tuning-tools',
    'show-capture',
    'trail',
    'inspect',
    'clear-inspection',
  ])
    $(id).disabled = !available;
  $('board').hidden = !available;
  $('empty-board').hidden = available;
  $('board-legend').hidden = !available;
  if (available) return;
  $('board').getContext('2d').clearRect(0, 0, $('board').width, $('board').height);
  localizedText($('map-name'), localizedMessage('tools:studio.preview.emptyTitle'));
  localizedText($('geometry'), localizedMessage('tools:studio.preview.emptyGeometry'));
  for (const id of [
    'lesson',
    'rules',
    'current-gameplay',
    'effective',
    'capture',
    'capture-summary',
  ])
    localizedText($(id), '');
  $('diagnostics').replaceChildren();
  $('trail').value = '';
  $('target-coverage').value = '';
  $('countdown-seconds').value = '';
  for (const facet of [
    'band',
    'planning',
    'execution',
    'threatDensity',
    'timePressure',
    'mechanicLoad',
    'coordination',
  ])
    $(`rating-${facet}`).value = '';
  $('capture-legend').hidden = true;
  $('play').disabled = true;
  localizedAttribute($('play'), 'title', localizedMessage('tools:studio.preview.emptyPlay'));
}
