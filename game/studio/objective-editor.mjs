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
        option.textContent = text;
        return option;
      }),
    );
  }
  function disarm() {
    armed = false;
    $('remove').textContent = 'Remove selected objective';
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
    $('submit').textContent = objective
      ? 'Validate & replace objective'
      : 'Validate & add objective';
    $('result').textContent =
      'Capturing the marker cell earns the objective. Required markers and territory quota both gate completion; avoid low-risk cleanup.';
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission || mission.modes.includes('team');
    $('qualification').textContent = mission?.modes.includes('team')
      ? 'Authored Team objective behavior is not yet qualified. These controls remain unavailable.'
      : 'Capture objectives use the shared engine. Preview retained chambers and required markers before testing a route.';
    const next = context();
    if (next === key) return;
    key = next;
    const selected = $('select').value;
    options($('select'), [
      ['', '+ New objective'],
      ...(mission?.objectives ?? []).map((objective) => [
        objective.id,
        `${objective.required ? 'Required' : 'Optional'} · ${objective.id}`,
      ]),
    ]);
    if (mission?.objectives.some((objective) => objective.id === selected))
      $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context())
        throw new Error('The draft context changed. Refresh the objective selection.');
      const id = $('id').value.trim(),
        command = { action, id };
      if (action !== 'remove') {
        if (!$('x').value.trim() || !$('y').value.trim())
          throw new Error('Enter both cell-centre coordinates.');
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
      $('result').textContent =
        'Applied to the local draft. All supported presets and modes compiled. Undo is available; test completion and quota cleanup.';
    } catch (error) {
      $('result').textContent = `Not applied: ${error.message}`;
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
      $('remove').textContent = 'Confirm remove objective';
      $('result').textContent = 'Activate Remove again. Undo remains available.';
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
