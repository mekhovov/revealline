import { localizedText, localizedMessage } from '../i18n/index.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
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
        localizedText(option, label);
        return option;
      }),
    );
  function disarm() {
    armed = false;
    localizedText($('remove'), localizedMessage('tools:studio.encounter.remove'));
  }
  function sync() {
    const mission = getMission(),
      qualified = !!mission && !mission.modes.includes('team');
    $('tools').disabled = !qualified;
    localizedText(
      $('qualification'),
      qualified
        ? localizedMessage('tools:studio.encounter.qualification')
        : localizedMessage('tools:studio.encounter.unavailable'),
    );
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
    options($('core'), [['', localizedMessage('tools:studio.encounter.core')], ...choices]);
    $('core').value = encounter?.coreObjectiveId ?? '';
    for (let index = 0; index < 4; index++) {
      options($(`shield-${index}`), [
        [
          '',
          index
            ? localizedMessage('tools:studio.encounter.noShield')
            : localizedMessage('tools:studio.encounter.firstShield'),
        ],
        ...choices,
      ]);
      $(`shield-${index}`).value = encounter?.shieldObjectiveIds[index] ?? '';
    }
    $('enemy').value =
      encounter?.enemyId ??
      mission?.actors.find((actor) => actor.role === 'field-keeper')?.id ??
      'sentinel';
    $('enemy').disabled = !!encounter;
    localizedText(
      $('submit'),
      encounter
        ? localizedMessage('tools:studio.encounter.replace')
        : localizedMessage('tools:studio.encounter.create'),
    );
    $('remove').disabled = !encounter;
    localizedText($('result'), localizedMessage('tools:studio.encounter.help'));
  }
  function commit(action) {
    try {
      if (key !== context()) throw editorMessageError('errors:studio.encounter.contextChanged');
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
      localizedText(
        $('result'),
        action === 'remove'
          ? localizedMessage('tools:studio.encounter.removed')
          : localizedMessage('tools:studio.encounter.applied'),
      );
    } catch (error) {
      showEditorFailure($('result'), error);
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
      localizedText($('remove'), localizedMessage('tools:studio.encounter.confirmRemove'));
      localizedText($('result'), localizedMessage('tools:studio.encounter.removeAgain'));
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
