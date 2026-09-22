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
    $('remove').textContent = 'Remove selected field';
  }
  function select() {
    disarm();
    const zone = mapFor()?.speedZones?.find((item) => item.id === $('select').value);
    $('id').value = zone?.id ?? '';
    $('id').disabled = !!zone;
    for (const axis of ['x', 'y', 'w', 'h']) $(axis).value = zone?.[axis] ?? '';
    $('direction').value = zone?.direction ?? 'right';
    $('remove').disabled = !zone;
    $('submit').textContent = zone ? 'Validate & replace field' : 'Validate & add field';
    $('result').textContent =
      'Only this mission receives the edited map. Preview the arrows and play both directions before publishing.';
  }
  function sync() {
    const mission = getMission(),
      map = mapFor(),
      qualified = !!mission && !mission.modes.includes('team'),
      enabled = ['MissionDesignV3', 'MissionDesignV4'].includes(mission?.format);
    $('enable').disabled = !qualified || enabled;
    $('tools').disabled = !qualified || !enabled;
    $('qualification').textContent = !qualified
      ? 'Directional editing needs a Solo or Versus mission. Team behavior is not yet qualified.'
      : enabled
        ? 'Arrow fields affect only moving craft on unclaimed cells: ×1.25 with, ×0.8 against, ×1 across. No drift or enemy effect. Capture removes the effect; erosion restores it.'
        : 'Enable an explicit directional edition for this mission. Existing relay links remain intact; other missions and historical maps do not change.';
    const next = context();
    if (key === next) return;
    key = next;
    expectedMap = map ? dataIdentity(map) : null;
    expectedMission = mission ? dataIdentity(mission) : null;
    const selected = $('select').value;
    $('select').replaceChildren(
      ...[
        ['', '+ New field'],
        ...(map?.speedZones ?? []).map((zone) => [zone.id, `${zone.id} · ${zone.direction}`]),
      ].map(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
      }),
    );
    if (map?.speedZones?.some((zone) => zone.id === selected)) $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context())
        throw new Error('The draft context changed. Refresh the directional selection.');
      const command = { action, expectedMap, expectedMission };
      if (action !== 'enable') command.id = $('id').value.trim();
      if (['add', 'replace'].includes(action)) {
        command.zone = Object.fromEntries(
          ['x', 'y', 'w', 'h'].map((axis) => {
            if (!$(axis).value.trim())
              throw new Error('Enter all four whole-cell rectangle coordinates.');
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
      $('result').textContent =
        'Applied to the local draft after shared preset/mode validation. Undo is available; publication and human qualification remain separate.';
    } catch (error) {
      $('result').textContent = `Not applied: ${error.message}`;
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
      $('remove').textContent = 'Confirm remove field';
      $('result').textContent =
        'Remove this field from the selected mission’s new map revision? Activate again to confirm.';
      return;
    }
    commit('remove');
  };
  return { sync };
}
