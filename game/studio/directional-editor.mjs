import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
import { studioDirectionName } from './preview-copy.mjs';
import { dataIdentity } from '../data-json.mjs';
import { editContentDirectional } from '../content-design/directional.mjs';
import { missionEditContext } from './edit-context.mjs';

export function createDirectionalEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`directional-${id}`);
  let key = null,
    armed = false,
    expectedMap = null,
    expectedMission = null;
  const context = () => missionEditContext(getSource(), getMission());
  const mapFor = () =>
    getSource().maps.find(
      (map) => map.id === getMission()?.map.id && map.revision === getMission()?.map.revision,
    );
  function disarm() {
    armed = false;
    localizedText($('remove'), localizedMessage('tools:studio.directional.remove'));
  }
  function select() {
    disarm();
    const zone = mapFor()?.speedZones?.find((item) => item.id === $('select').value);
    $('id').value = zone?.id ?? '';
    $('id').disabled = !!zone;
    for (const axis of ['x', 'y', 'w', 'h']) $(axis).value = zone?.[axis] ?? '';
    $('direction').value = zone?.direction ?? 'right';
    $('remove').disabled = !zone;
    localizedText(
      $('submit'),
      zone
        ? localizedMessage('tools:studio.directional.replace')
        : localizedMessage('tools:studio.directional.add'),
    );
    localizedText($('result'), localizedMessage('tools:studio.directional.help'));
  }
  function sync() {
    const mission = getMission(),
      map = mapFor(),
      qualified = !!mission && !mission.modes.includes('team'),
      enabled = ['MissionDesignV3', 'MissionDesignV4'].includes(mission?.format);
    $('enable').disabled = !qualified || enabled;
    $('tools').disabled = !qualified || !enabled;
    localizedText(
      $('qualification'),
      !qualified
        ? localizedMessage('tools:studio.directional.unavailable')
        : enabled
          ? localizedMessage('tools:studio.directional.enabled')
          : localizedMessage('tools:studio.directional.enableHelp'),
    );
    const next = context();
    if (key === next) return;
    key = next;
    expectedMap = map ? dataIdentity(map) : null;
    expectedMission = mission ? dataIdentity(mission) : null;
    const selected = $('select').value;
    $('select').replaceChildren(
      ...[
        ['', localizedMessage('tools:studio.directional.new')],
        ...(map?.speedZones ?? []).map((zone) => [
          zone.id,
          () =>
            t('tools:studio.editor.itemDetail', {
              id: zone.id,
              detail: studioDirectionName(zone.direction),
            }),
        ]),
      ].map(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        localizedText(option, text);
        return option;
      }),
    );
    if (map?.speedZones?.some((zone) => zone.id === selected)) $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context()) throw editorMessageError('errors:studio.directional.contextChanged');
      const command = { action, expectedMap, expectedMission };
      if (action !== 'enable') command.id = $('id').value.trim();
      if (['add', 'replace'].includes(action)) {
        command.zone = Object.fromEntries(
          ['x', 'y', 'w', 'h'].map((axis) => {
            if (!$(axis).value.trim())
              throw editorMessageError('errors:studio.wholeRectangleCoordinates');
            return [axis, Number($(axis).value)];
          }),
        );
        command.zone.direction = $('direction').value;
      }
      const candidate = editContentDirectional(getSource(), getMission()?.id, command);
      if (apply(candidate) === false) return;
      key = null;
      sync();
      $('select').value = ['enable', 'remove'].includes(action) ? '' : command.id;
      select();
      localizedText($('result'), localizedMessage('tools:studio.directional.applied'));
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
      localizedText($('remove'), localizedMessage('tools:studio.directional.confirmRemove'));
      localizedText($('result'), localizedMessage('tools:studio.directional.removeAgain'));
      return;
    }
    commit('remove');
  };
  return { sync };
}
