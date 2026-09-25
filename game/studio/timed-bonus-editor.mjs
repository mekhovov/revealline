import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
import { studioBonusName } from './preview-copy.mjs';
import { attachFormFocus } from './form-focus.mjs';
import { BONUS_CHOICES } from '../content-design/bonuses.mjs';
import { editTimedBonus } from '../content-design/timed-bonuses.mjs';
import { missionEditContext } from './edit-context.mjs';
import { FIXED_DT } from '../core/registry.mjs';

export function createTimedBonusEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`timed-bonus-${id}`);
  const focusClearance = attachFormFocus({ form: $('form'), document });
  const timeFields = {
    delay: 'initialDelayTicks',
    announce: 'announcementTicks',
    available: 'availableTicks',
    cooldown: 'cooldownTicks',
  };
  const defaults = {
    initialDelayTicks: 600,
    announcementTicks: 120,
    availableTicks: 1200,
    cooldownTicks: 1440,
  };
  let key = null,
    armed = false;
  const context = () => missionEditContext(getSource(), getMission());
  const options = (node, rows) =>
    node.replaceChildren(
      ...rows.map(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        localizedText(option, text);
        return option;
      }),
    );
  options(
    $('kind'),
    BONUS_CHOICES.map(([kind]) => [kind, () => studioBonusName(kind)]),
  );
  function disarm() {
    armed = false;
    localizedText($('remove'), localizedMessage('tools:studio.timed.remove'));
  }
  function select() {
    disarm();
    const schedule = getMission()?.timedBonuses?.schedules.find(
      (entry) => entry.id === $('select').value,
    );
    $('id').value = schedule?.id ?? '';
    $('id').disabled = !!schedule;
    $('kind').value = schedule?.kind ?? 'enemy-slow';
    $('anchors').value = schedule?.anchors.map((a) => `${a.x}, ${a.y}`).join('; ') ?? '';
    for (const [field, property] of Object.entries(timeFields))
      $(field).value = (schedule?.[property] ?? defaults[property]) * FIXED_DT;
    $('appearances').value = schedule?.maxAppearances ?? 3;
    $('collections').value = schedule?.maxCollections ?? 1;
    $('remove').disabled = !schedule;
    localizedText(
      $('submit'),
      schedule
        ? localizedMessage('tools:studio.timed.replace')
        : localizedMessage('tools:studio.timed.add'),
    );
    localizedText(
      $('result'),
      getMission()?.modes.includes('team')
        ? localizedMessage('tools:studio.timed.teamHelp')
        : localizedMessage('tools:studio.timed.soloHelp'),
    );
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission;
    const next = context();
    if (next === key) return;
    key = next;
    const selected = $('select').value;
    options($('select'), [
      ['', localizedMessage('tools:studio.timed.new')],
      ...(mission?.timedBonuses?.schedules ?? []).map((s) => [
        s.id,
        () =>
          t('tools:studio.item.option', { name: studioBonusName(s.kind), identity: ` · ${s.id}` }),
      ]),
    ]);
    if (mission?.timedBonuses?.schedules.some((s) => s.id === selected))
      $('select').value = selected;
    select();
  }
  function commit(action) {
    try {
      if (key !== context()) throw editorMessageError('errors:studio.timed.contextChanged');
      const id = $('id').value.trim(),
        command = { action, id };
      if (action !== 'remove') {
        const anchors = $('anchors')
          .value.split(';')
          .map((pair) => {
            const parts = pair.trim().split(',');
            if (parts.length !== 2 || parts.some((p) => !p.trim()))
              throw editorMessageError('errors:studio.timed.anchors');
            return { x: Number(parts[0]), y: Number(parts[1]) };
          });
        command.schedule = {
          id,
          kind: $('kind').value,
          anchors,
          maxAppearances: Number($('appearances').value),
          maxCollections: Number($('collections').value),
        };
        for (const [field, property] of Object.entries(timeFields)) {
          if (!$(field).value.trim()) throw editorMessageError('errors:studio.timed.durations');
          const ticks = Number($(field).value) / FIXED_DT;
          if (!Number.isInteger(ticks)) throw editorMessageError('errors:studio.timed.wholeTicks');
          command.schedule[property] = ticks;
        }
      }
      const next = editTimedBonus(getSource(), getMission()?.id, command);
      if (apply(next) === false) return;
      key = null;
      sync();
      $('select').value = action === 'remove' ? '' : id;
      select();
      localizedText($('result'), localizedMessage('tools:studio.timed.applied'));
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
      localizedText($('remove'), localizedMessage('tools:studio.timed.confirmRemove'));
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync, destroy: () => focusClearance.destroy() };
}
