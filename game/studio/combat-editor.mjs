import {
  prepareCombatAuthoring,
  setMissionCombatEnabled,
} from '../content-design/combat-authoring.mjs';
import { missionEditContext } from './edit-context.mjs';

/** A draft edition setting, not a live player preference. All changes enter the
 * existing transactional apply/undo/autosave path only after explicit action. */
export function createCombatEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`combat-${id}`);
  const context = () => missionEditContext(getSource(), getMission());
  let revision = null;
  $('tools').disabled = true;
  function sync() {
    const mission = getMission();
    const team = mission?.modes.includes('team');
    $('tools').disabled = !mission || !!team;
    const key = context();
    if (key === revision) return;
    revision = key;
    const prepared = !!mission?.combat;
    $('prepare').disabled = prepared || !mission || !!team;
    $('enabled').disabled = !prepared || !!team;
    $('apply').disabled = !prepared || !!team;
    $('enabled').checked = mission?.combat?.enabled ?? false;
    $('state').textContent = team
      ? 'Optional combat is not qualified for Team, including disabled descriptors.'
      : prepared
        ? `Combat ${mission.combat.enabled ? 'enabled' : 'disabled'} in this draft edition. Actors are ${mission.combat.enabled ? 'active' : 'authored but inactive'}.`
        : 'Combat authoring is not prepared for this mission. Prepare a local catalogue-v8 edition first; no actors are inserted.';
    $('result').textContent =
      'Apply changes explicitly. Undo is available; nothing is published. Enabled gameplay preview awaits qualified actor/projectile presentation.';
  }
  function commit(prepare) {
    try {
      if (revision !== context())
        throw new Error('The draft context changed. Refresh before applying combat fields.');
      const mission = getMission();
      if (!mission || mission.modes.includes('team')) throw new Error('Choose a non-Team mission.');
      const next = prepare
        ? prepareCombatAuthoring(getSource(), mission.id)
        : setMissionCombatEnabled(getSource(), mission.id, $('enabled').checked);
      if (apply(next) === false) return;
      revision = null;
      sync();
      $('result').textContent =
        'Combat edition applied to the local draft. All supported modes and presets compiled. Undo is available; no publication.';
    } catch (error) {
      $('result').textContent = `Not applied: ${error.message}`;
    }
  }
  $('prepare').onclick = () => commit(true);
  $('apply').onclick = () => commit(false);
  $('enabled').onchange = () => {
    $('result').textContent = 'Unapplied combat selection. Apply to create a new draft edition.';
  };
  return { sync };
}
