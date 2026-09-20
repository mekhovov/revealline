import { dataIdentity } from '../data-json.mjs';
import { editContentGeometry } from '../content-design/geometry-edit.mjs';
import { missionEditContext } from './edit-context.mjs';

export function createGeometryEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`geometry-edit-${id}`);
  let key = null,
    expectedMap = null,
    rows = [],
    armed = false;
  const mapFor = () => {
    const mission = getMission();
    return getSource().maps.find(
      (map) => map.id === mission?.map.id && map.revision === mission?.map.revision,
    );
  };
  const context = () => missionEditContext(getSource(), getMission());
  function disarm() {
    armed = false;
    $('remove').textContent = 'Remove selected rectangle';
  }
  function select() {
    disarm();
    const row = rows.find((entry) => entry.value === $('select').value);
    for (const axis of ['x', 'y', 'w', 'h']) $(axis).value = row?.rectangle[axis] ?? '';
    $('kind-row').hidden = row?.surface !== 'terrain';
    $('kind').value = row?.rectangle.kind ?? 'slow';
    $('submit').disabled = $('remove').disabled = !row;
    $('result').textContent = row
      ? 'Changes affect only this mission through a new map revision. Spawn and enemy-domain checks still apply.'
      : 'No authored rectangles on this map. Add geometry above; the permanent outer border is not removable.';
  }
  function sync() {
    const map = mapFor();
    const nextKey = context();
    $('tools').disabled = !map;
    if (nextKey === key) return;
    key = nextKey;
    expectedMap = map ? dataIdentity(map) : null;
    rows = ['foundations', 'walls', 'terrain'].flatMap((surface) =>
      (map?.[surface] ?? []).map((rectangle, index) => ({
        surface,
        index,
        rectangle,
        value: `${surface}:${index}`,
      })),
    );
    $('select').replaceChildren(
      ...rows.map((row) => {
        const option = document.createElement('option');
        option.value = row.value;
        const { x, y, w, h } = row.rectangle;
        option.textContent = `${row.surface === 'terrain' ? row.rectangle.kind : row.surface} ${row.index + 1} · (${x}, ${y}) ${w}×${h}`;
        return option;
      }),
    );
    select();
  }
  function commit(action) {
    const row = rows.find((entry) => entry.value === $('select').value);
    if (!row) return;
    try {
      if (key !== context())
        throw new Error(
          'The map or mission changed. Refresh the rectangle selection before editing.',
        );
      const command = { action, surface: row.surface, index: row.index, expectedMap };
      if (action === 'replace') {
        command.rectangle = Object.fromEntries(
          ['x', 'y', 'w', 'h'].map((axis) => {
            if (!$(axis).value.trim()) throw new Error('Enter all four rectangle coordinates.');
            return [axis, Number($(axis).value)];
          }),
        );
        if (row.surface === 'terrain') command.rectangle.kind = $('kind').value;
      }
      const candidate = editContentGeometry(getSource(), getMission()?.id, command);
      if (apply(candidate) === false) return;
      key = null;
      sync();
      $('result').textContent =
        'Applied to a new local map revision. Other missions are unchanged. Undo is available; test the changed route.';
    } catch (error) {
      $('result').textContent = `Not applied: ${error.message}`;
    }
  }
  $('select').onchange = select;
  $('form').oninput = disarm;
  $('form').onsubmit = (event) => {
    event.preventDefault();
    disarm();
    commit('replace');
  };
  $('remove').onclick = () => {
    if (!armed) {
      armed = true;
      $('remove').textContent = 'Confirm remove rectangle';
      $('result').textContent =
        'Activate Remove again. The compiler will reject removal that invalidates a spawn or actor.';
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
