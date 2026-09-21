import { BONUS_CHOICES } from '../content-design/bonuses.mjs';
import { editTimedBonus } from '../content-design/timed-bonuses.mjs';
import { missionEditContext } from './edit-context.mjs';
import { FIXED_DT } from '../core/registry.mjs';

export function createTimedBonusEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`timed-bonus-${id}`);
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
        option.textContent = text;
        return option;
      }),
    );
  options($('kind'), BONUS_CHOICES);
  function disarm() {
    armed = false;
    $('remove').textContent = 'Remove selected schedule';
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
    $('submit').textContent = schedule ? 'Validate & replace schedule' : 'Validate & add schedule';
    $('result').textContent =
      'Optional only. Applying upgrades this mission’s timed schedules to a trail-aware v2 revision; earlier editions stay unchanged. Contact before expiry; missed pickups move to a different eligible anchor. Preview does not guarantee live availability.';
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission || mission.modes.includes('team');
    const next = context();
    if (next === key) return;
    key = next;
    const selected = $('select').value;
    options($('select'), [
      ['', '+ New timed schedule'],
      ...(mission?.timedBonuses?.schedules ?? []).map((s) => [s.id, `${s.kind} · ${s.id}`]),
    ]);
    if (mission?.timedBonuses?.schedules.some((s) => s.id === selected))
      $('select').value = selected;
    select();
    if (mission?.modes.includes('team'))
      $('result').textContent =
        'Timed bonuses are not yet qualified for Team. No schedules are silently converted.';
  }
  function commit(action) {
    try {
      if (key !== context())
        throw new Error('The draft changed. Refresh the timed schedule before applying.');
      const id = $('id').value.trim(),
        command = { action, id };
      if (action !== 'remove') {
        const anchors = $('anchors')
          .value.split(';')
          .map((pair) => {
            const parts = pair.trim().split(',');
            if (parts.length !== 2 || parts.some((p) => !p.trim()))
              throw new Error('Enter 2..16 X,Y pairs separated by semicolons.');
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
          if (!$(field).value.trim()) throw new Error('Enter every schedule duration.');
          const ticks = Number($(field).value) / FIXED_DT;
          if (!Number.isInteger(ticks))
            throw new Error('Schedule durations must resolve to whole simulation ticks.');
          command.schedule[property] = ticks;
        }
      }
      const next = editTimedBonus(getSource(), getMission()?.id, command);
      if (apply(next) === false) return;
      key = null;
      sync();
      $('select').value = action === 'remove' ? '' : id;
      select();
      $('result').textContent =
        'Applied to the local draft; all presets and modes validated. Undo is available. Test with every bonus missed before publishing.';
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
      $('remove').textContent = 'Confirm remove schedule';
      return;
    }
    disarm();
    commit('remove');
  };
  return { sync };
}
