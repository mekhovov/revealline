import { BONUS_CHOICES, editContentBonus } from '../content-design/bonuses.mjs';

export function createBonusEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`bonus-${id}`);
  let key = null,
    armed = false;
  const context = () => JSON.stringify([getSource().id, getSource().revision, getMission()]);
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
  options($('kind'), BONUS_CHOICES);
  function disarm() {
    armed = false;
    $('remove').textContent = 'Remove selected bonus';
  }
  function select() {
    disarm();
    const bonus = getMission()?.bonuses.find((entry) => entry.id === $('select').value);
    $('id').value = bonus?.id ?? '';
    $('id').disabled = !!bonus;
    $('kind').value = bonus?.kind ?? 'extra-life';
    $('x').value = bonus?.x ?? '';
    $('y').value = bonus?.y ?? '';
    $('remove').disabled = !bonus;
    $('submit').textContent = bonus ? 'Validate & replace bonus' : 'Validate & add bonus';
    $('result').textContent =
      'Contact collection only; enclosing a pickup does not collect it. Keep required routes completable without bonuses.';
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission || mission.modes.includes('team');
    $('qualification').textContent = mission?.modes.includes('team')
      ? 'Authored Team bonus behavior is not yet qualified. These controls remain unavailable.'
      : 'Optional contact bonuses use shared engine effects and expiry. Speed should be an intentional detour, not forced before precision turns.';
    const next = context();
    if (next === key) return;
    key = next;
    const selected = $('select').value;
    options($('select'), [
      ['', '+ New bonus'],
      ...(mission?.bonuses ?? []).map((bonus) => [
        bonus.id,
        `${BONUS_CHOICES.find(([kind]) => kind === bonus.kind)?.[1] ?? bonus.kind} · ${bonus.id}`,
      ]),
    ]);
    if (mission?.bonuses.some((bonus) => bonus.id === selected)) $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context())
        throw new Error('The draft context changed. Refresh the bonus selection.');
      const id = $('id').value.trim(),
        command = { action, id };
      if (action !== 'remove') {
        if (!$('x').value.trim() || !$('y').value.trim())
          throw new Error('Enter both cell-centre coordinates.');
        command.bonus = {
          id,
          kind: $('kind').value,
          x: Number($('x').value),
          y: Number($('y').value),
        };
      }
      const candidate = editContentBonus(getSource(), getMission()?.id, command);
      if (apply(candidate) === false) return;
      key = null;
      sync();
      $('select').value = action === 'remove' ? '' : id;
      select();
      $('result').textContent =
        'Applied to the local draft. All supported presets and modes compiled. Undo is available; test the optional detour.';
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
      $('remove').textContent = 'Confirm remove bonus';
      $('result').textContent = 'Activate Remove again. Undo remains available.';
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
