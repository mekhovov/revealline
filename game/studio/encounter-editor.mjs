import { dataIdentity } from '../data-json.mjs';
import { editContentEncounter } from '../content-design/encounters.mjs';
import { missionEditContext } from './edit-context.mjs';

export function createEncounterEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`sentinel-${id}`);
  let key = null,
    armed = false,
    expectedMap = null,
    expectedMission = null;
  const context = () => missionEditContext(getSource(), getMission());
  const options = (node, rows) =>
    node.replaceChildren(
      ...rows.map(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
  function disarm() {
    armed = false;
    $('remove').textContent = 'Remove Sentinel encounter';
  }
  function sync() {
    const mission = getMission(),
      qualified = !!mission && !mission.modes.includes('team');
    $('tools').disabled = !qualified;
    $('qualification').textContent = qualified
      ? 'One fixed recipe: 2s warning, 0.7s attack, 3.3s shield rest; 1.5s transition; 4s core opening. Capture all shields, then close 8 new trail cells during CORE OPEN or isolate the core. Presets never shorten the warning.'
      : 'Sentinel encounters need Solo or Versus. Team behavior is not yet qualified.';
    if (key === context()) return;
    key = context();
    disarm();
    const map = getSource().maps.find(
      (entry) => entry.id === mission?.map.id && entry.revision === mission?.map.revision,
    );
    expectedMap = map ? dataIdentity(map) : null;
    expectedMission = mission ? dataIdentity(mission) : null;
    const encounter = mission?.encounter;
    const choices = (mission?.objectives ?? [])
      .filter((o) => o.required && !o.hidden)
      .map((o) => [o.id, o.id]);
    options($('core'), [['', 'Choose core objective'], ...choices]);
    $('core').value = encounter?.coreObjectiveId ?? '';
    for (let index = 0; index < 4; index++) {
      options($(`shield-${index}`), [
        ['', index ? 'No additional shield' : 'Choose first shield'],
        ...choices,
      ]);
      $(`shield-${index}`).value = encounter?.shieldObjectiveIds[index] ?? '';
    }
    $('enemy').value =
      encounter?.enemyId ??
      mission?.actors.find((actor) => actor.role === 'field-keeper')?.id ??
      'sentinel';
    $('enemy').disabled = !!encounter;
    $('submit').textContent = encounter
      ? 'Validate & replace shield links'
      : 'Create Sentinel encounter';
    $('remove').disabled = !encounter;
    $('result').textContent =
      'The Sentinel is placed on the chosen core cell. Create visible required objectives above first. Using an existing field-keeper ID explicitly replaces that keeper; no other actor is removed. Old geometry is retained and Undo is available.';
  }
  function commit(action) {
    try {
      if (key !== context())
        throw new Error('The draft context changed. Refresh the encounter selection.');
      const command = { action, expectedMap, expectedMission };
      if (action === 'set') {
        command.enemyId = $('enemy').value.trim();
        command.coreObjectiveId = $('core').value;
        command.shieldObjectiveIds = [0, 1, 2, 3]
          .map((index) => $(`shield-${index}`).value)
          .filter(Boolean);
      }
      const next = editContentEncounter(getSource(), getMission()?.id, command);
      if (apply(next) === false) return;
      key = null;
      sync();
      $('result').textContent =
        action === 'remove'
          ? 'Removed the Sentinel and encounter links from this draft. Objectives, gates and geometry remain; inspect empty-region fill and play before publishing. Undo restores the encounter.'
          : 'Applied the shared Sentinel recipe, actor and shield links atomically. All supported presets and modes compiled. Preview the capture order before publishing; Undo is available.';
    } catch (error) {
      $('result').textContent = `Not applied: ${error.message}`;
    }
  }
  $('form').oninput = disarm;
  $('form').onsubmit = (event) => {
    event.preventDefault();
    disarm();
    commit('set');
  };
  $('remove').onclick = () => {
    if (!getMission()?.encounter) return;
    if (!armed) {
      armed = true;
      $('remove').textContent = 'Confirm remove Sentinel';
      $('result').textContent =
        'Activate Remove again to remove the boss and encounter links. Objectives and map geometry remain. This may make a region auto-fill; preview again. Undo remains available.';
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
