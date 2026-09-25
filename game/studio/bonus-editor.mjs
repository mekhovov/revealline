import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { studioBonusName } from './preview-copy.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
import { BONUS_CHOICES, editContentBonus } from '../content-design/bonuses.mjs';
import { missionEditContext } from './edit-context.mjs';

export function createBonusEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`bonus-${id}`);
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
  options(
    $('kind'),
    BONUS_CHOICES.map(([kind]) => [kind, () => studioBonusName(kind)]),
  );
  function disarm() {
    armed = false;
    localizedText($('remove'), localizedMessage('tools:studio.bonus.remove'));
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
    localizedText(
      $('submit'),
      localizedMessage(bonus ? 'tools:studio.bonus.replace' : 'tools:studio.bonus.add'),
    );
    localizedText($('result'), localizedMessage('tools:studio.bonus.contactOnly'));
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission || mission.modes.includes('team');
    localizedText(
      $('qualification'),
      localizedMessage(
        mission?.modes.includes('team')
          ? 'tools:studio.bonus.teamQualification'
          : 'tools:studio.bonus.qualification',
      ),
    );
    const next = context();
    if (next === key) return;
    key = next;
    const selected = $('select').value;
    options($('select'), [
      ['', localizedMessage('tools:studio.bonus.new')],
      ...(mission?.bonuses ?? []).map((bonus) => [
        bonus.id,
        () =>
          t('tools:studio.item.option', {
            name: studioBonusName(bonus.kind),
            identity: ` · ${bonus.id}`,
          }),
      ]),
    ]);
    if (mission?.bonuses.some((bonus) => bonus.id === selected)) $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context()) throw editorMessageError('errors:studio.bonus.contextChanged');
      const id = $('id').value.trim(),
        command = { action, id };
      if (action !== 'remove') {
        if (!$('x').value.trim() || !$('y').value.trim())
          throw editorMessageError('errors:studio.bonus.coordinates');
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
      localizedText($('result'), localizedMessage('tools:studio.bonus.applied'));
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
      localizedText($('remove'), localizedMessage('tools:studio.bonus.confirmRemove'));
      localizedText($('result'), localizedMessage('tools:studio.editor.confirmRemove'));
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
