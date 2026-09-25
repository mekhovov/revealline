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
  $('map-name').textContent = 'Your first mission starts here';
  $('geometry').textContent = 'No mission selected. Create a mission to inspect its map and rules.';
  for (const id of [
    'lesson',
    'rules',
    'current-gameplay',
    'effective',
    'capture',
    'capture-summary',
  ])
    $(id).textContent = '';
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
  $('play').title = 'Create a mission before starting a preview.';
}
