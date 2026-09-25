import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
import { editContentObjective } from '../content-design/objectives.mjs';
import { missionEditContext } from './edit-context.mjs';

export function createObjectiveEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`objective-${id}`);
  let key = null,
    armed = false;
  const context = () => missionEditContext(getSource(), getMission());
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
    localizedText($('remove'), localizedMessage('tools:studio.objective.remove'));
  }
  function select() {
    disarm();
    const objective = getMission()?.objectives.find((entry) => entry.id === $('select').value);
    $('id').value = objective?.id ?? '';
    $('id').disabled = !!objective;
    $('required').checked = objective?.required ?? false;
    $('hidden').checked = objective?.hidden ?? false;
    $('x').value = objective?.x ?? '';
    $('y').value = objective?.y ?? '';
    $('remove').disabled = !objective;
    localizedText(
      $('submit'),
      objective
        ? localizedMessage('tools:studio.objective.replace')
        : localizedMessage('tools:studio.objective.add'),
    );
    localizedText($('result'), localizedMessage('tools:studio.objective.help'));
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission || mission.modes.includes('team');
    localizedText(
      $('qualification'),
      mission?.modes.includes('team')
        ? localizedMessage('tools:studio.objective.teamUnavailable')
        : localizedMessage('tools:studio.objective.qualification'),
    );
    const next = context();
    if (next === key) return;
    key = next;
    const selected = $('select').value;
    options($('select'), [
      ['', localizedMessage('tools:studio.objective.new')],
      ...(mission?.objectives ?? []).map((objective) => [
        objective.id,
        () =>
          t(
            objective.required
              ? 'tools:studio.objective.requiredOption'
              : 'tools:studio.objective.optionalOption',
            { id: objective.id },
          ),
      ]),
    ]);
    if (mission?.objectives.some((objective) => objective.id === selected))
      $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context()) throw editorMessageError('errors:studio.objective.contextChanged');
      const id = $('id').value.trim(),
        command = { action, id };
      if (action !== 'remove') {
        if (!$('x').value.trim() || !$('y').value.trim())
          throw editorMessageError('errors:studio.cellCentreCoordinates');
        command.objective = {
          id,
          required: $('required').checked,
          hidden: $('hidden').checked,
          x: Number($('x').value),
          y: Number($('y').value),
        };
      }
      const candidate = editContentObjective(getSource(), getMission()?.id, command);
      if (apply(candidate) === false) return;
      key = null;
      sync();
      $('select').value = action === 'remove' ? '' : id;
      select();
      localizedText($('result'), localizedMessage('tools:studio.objective.applied'));
    } catch (error) {
      showEditorFailure($('result'), error);
    }
  }
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
      localizedText($('remove'), localizedMessage('tools:studio.objective.confirmRemove'));
      localizedText($('result'), localizedMessage('tools:studio.editor.confirmRemove'));
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
