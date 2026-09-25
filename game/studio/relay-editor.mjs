import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
import { dataIdentity } from '../data-json.mjs';
import { editContentRelay } from '../content-design/relays.mjs';
import { missionEditContext } from './edit-context.mjs';

export function createRelayEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`relay-${id}`);
  let key = null,
    armed = false,
    expectedMap = null,
    expectedMission = null;
  const context = () => missionEditContext(getSource(), getMission());
  const mapFor = () =>
    getSource().maps.find(
      (map) => map.id === getMission()?.map.id && map.revision === getMission()?.map.revision,
    );
  function options(node, rows) {
    node.replaceChildren(
      ...rows.map(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        localizedText(option, text);
        return option;
      }),
    );
  }
  function disarm() {
    armed = false;
    localizedText($('remove'), localizedMessage('tools:studio.relay.remove'));
  }
  function select() {
    disarm();
    const gate = mapFor()?.gates?.find((item) => item.id === $('select').value);
    $('id').value = gate?.id ?? '';
    $('id').disabled = !!gate;
    for (const axis of ['x', 'y', 'w', 'h']) $(axis).value = gate?.[axis] ?? '';
    const link = getMission()?.relayLinks?.find((item) => item.gateId === gate?.id);
    $('objective').value = link?.objectiveId ?? getMission()?.objectives[0]?.id ?? '';
    $('remove').disabled = !gate;
    localizedText(
      $('submit'),
      gate
        ? localizedMessage('tools:studio.relay.replace')
        : localizedMessage('tools:studio.relay.add'),
    );
    localizedText($('result'), localizedMessage('tools:studio.relay.help'));
  }
  function sync() {
    const mission = getMission(),
      map = mapFor(),
      qualified = !!mission && !mission.modes.includes('team');
    const enabled = ['MissionDesignV2', 'MissionDesignV3', 'MissionDesignV4'].includes(
      mission?.format,
    );
    $('enable').disabled = !qualified || enabled;
    $('tools').disabled = !qualified || !enabled;
    $('submit').disabled = !mission?.objectives.length;
    localizedText(
      $('qualification'),
      !qualified
        ? localizedMessage('tools:studio.relay.unavailable')
        : enabled
          ? localizedMessage('tools:studio.relay.enabled')
          : localizedMessage('tools:studio.relay.enableHelp'),
    );
    const next = context();
    if (key === next) return;
    key = next;
    expectedMap = map ? dataIdentity(map) : null;
    expectedMission = mission ? dataIdentity(mission) : null;
    const selected = $('select').value;
    options($('select'), [
      ['', localizedMessage('tools:studio.relay.new')],
      ...(map?.gates ?? []).map((gate) => [gate.id, gate.id]),
    ]);
    options(
      $('objective'),
      (mission?.objectives ?? []).map((objective) => [
        objective.id,
        () =>
          t(
            objective.required
              ? 'tools:studio.relay.requiredOption'
              : 'tools:studio.relay.optionalOption',
            { id: objective.id },
          ),
      ]),
    );
    if (map?.gates?.some((gate) => gate.id === selected)) $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context()) throw editorMessageError('errors:studio.relay.contextChanged');
      const command = { action, expectedMap, expectedMission };
      if (action !== 'enable') command.id = $('id').value.trim();
      if (['add', 'replace'].includes(action)) {
        command.gate = Object.fromEntries(
          ['x', 'y', 'w', 'h'].map((axis) => {
            if (!$(axis).value.trim())
              throw editorMessageError('errors:studio.wholeRectangleCoordinates');
            return [axis, Number($(axis).value)];
          }),
        );
        command.gate.objectiveId = $('objective').value;
      }
      const candidate = editContentRelay(getSource(), getMission()?.id, command);
      if (apply(candidate) === false) return;
      key = null;
      sync();
      $('select').value = ['enable', 'remove'].includes(action) ? '' : command.id;
      select();
      localizedText($('result'), localizedMessage('tools:studio.relay.applied'));
    } catch (error) {
      showEditorFailure($('result'), error);
    }
  }
  $('enable').onclick = () => {
    disarm();
    commit('enable');
  };
  $('select').onchange = select;
  $('form').oninput = disarm;
  $('form').onsubmit = (event) => {
    event.preventDefault();
    disarm();
    commit($('select').value ? 'replace' : 'add');
  };
  $('remove').onclick = () => {
    if (!$('select').value) return;
    if (!armed) {
      armed = true;
      localizedText($('remove'), localizedMessage('tools:studio.relay.confirmRemove'));
      localizedText($('result'), localizedMessage('tools:studio.relay.removeAgain'));
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
