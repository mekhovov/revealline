import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
import { studioSurfaceName } from './preview-copy.mjs';
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
    localizedText($('remove'), localizedMessage('tools:studio.rectangle.remove'));
  }
  function select() {
    disarm();
    const row = rows.find((entry) => entry.value === $('select').value);
    for (const axis of ['x', 'y', 'w', 'h']) $(axis).value = row?.rectangle[axis] ?? '';
    $('kind-row').hidden = row?.surface !== 'terrain';
    $('kind').value = row?.rectangle.kind ?? 'slow';
    $('submit').disabled = $('remove').disabled = !row;
    localizedText(
      $('result'),
      row
        ? localizedMessage('tools:studio.rectangle.help')
        : localizedMessage('tools:studio.rectangle.empty'),
    );
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
        localizedText(option, () =>
          t('tools:studio.rectangle.option', {
            surface: studioSurfaceName(
              row.surface === 'terrain' ? row.rectangle.kind : row.surface,
            ),
            index: row.index + 1,
            x,
            y,
            width: w,
            height: h,
          }),
        );
        return option;
      }),
    );
    select();
  }
  function commit(action) {
    const row = rows.find((entry) => entry.value === $('select').value);
    if (!row) return;
    try {
      if (key !== context()) throw editorMessageError('errors:studio.rectangle.contextChanged');
      const command = { action, surface: row.surface, index: row.index, expectedMap };
      if (action === 'replace') {
        command.rectangle = Object.fromEntries(
          ['x', 'y', 'w', 'h'].map((axis) => {
            if (!$(axis).value.trim())
              throw editorMessageError('errors:studio.rectangleCoordinates');
            return [axis, Number($(axis).value)];
          }),
        );
        if (row.surface === 'terrain') command.rectangle.kind = $('kind').value;
      }
      const candidate = editContentGeometry(getSource(), getMission()?.id, command);
      if (apply(candidate) === false) return;
      key = null;
      sync();
      localizedText($('result'), localizedMessage('tools:studio.rectangle.applied'));
    } catch (error) {
      showEditorFailure($('result'), error);
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
      localizedText($('remove'), localizedMessage('tools:studio.rectangle.confirmRemove'));
      localizedText($('result'), localizedMessage('tools:studio.rectangle.removeAgain'));
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
