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
        option.textContent = text;
        return option;
      }),
    );
  }
  function disarm() {
    armed = false;
    $('remove').textContent = 'Remove selected gate';
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
    $('submit').textContent = gate ? 'Validate & replace gate' : 'Validate & add gate';
    $('result').textContent =
      'Gate geometry and its capture link apply together to this mission only. Old map revisions remain unchanged; Undo is available.';
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
    $('qualification').textContent = !qualified
      ? 'Relay editing needs a Solo or Versus mission. Team relay behavior is not yet qualified.'
      : enabled
        ? 'Relay edition: capture a linked objective to open permanent reclaimed ground. Create an objective above before adding a gate.'
        : 'Opt in explicitly to a new relay edition. This forks only the selected mission’s map; other missions and historical editions stay unchanged.';
    const next = context();
    if (key === next) return;
    key = next;
    expectedMap = map ? dataIdentity(map) : null;
    expectedMission = mission ? dataIdentity(mission) : null;
    const selected = $('select').value;
    options($('select'), [
      ['', '+ New gate'],
      ...(map?.gates ?? []).map((gate) => [gate.id, gate.id]),
    ]);
    options(
      $('objective'),
      (mission?.objectives ?? []).map((objective) => [
        objective.id,
        `${objective.id} · ${objective.required ? 'required' : 'optional'}`,
      ]),
    );
    if (map?.gates?.some((gate) => gate.id === selected)) $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context())
        throw new Error('The draft context changed. Refresh the relay selection.');
      const command = { action, expectedMap, expectedMission };
      if (action !== 'enable') command.id = $('id').value.trim();
      if (['add', 'replace'].includes(action)) {
        command.gate = Object.fromEntries(
          ['x', 'y', 'w', 'h'].map((axis) => {
            if (!$(axis).value.trim())
              throw new Error('Enter all four whole-cell rectangle coordinates.');
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
      $('result').textContent =
        'Applied to the local draft after shared preset/mode validation. Undo is available. Inspect capture outcomes and play the new route before publishing.';
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
      $('remove').textContent = 'Confirm remove gate';
      $('result').textContent =
        'Activate Remove again to remove this gate and its link, not the objective. Its cells become field in this new draft. Undo remains available.';
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
