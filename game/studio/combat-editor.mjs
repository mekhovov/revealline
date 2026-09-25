import { localizedMessage, localizedText } from '../i18n/index.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
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
    localizedText(
      $('state'),
      team
        ? localizedMessage('tools:studio.combat.teamUnavailable')
        : prepared
          ? localizedMessage(
              mission.combat.enabled
                ? 'tools:studio.combat.enabled'
                : 'tools:studio.combat.disabled',
            )
          : localizedMessage('tools:studio.combat.notPrepared'),
    );
    localizedText($('result'), localizedMessage('tools:studio.combat.applyFirst'));
  }
  function commit(prepare) {
    try {
      if (revision !== context()) throw editorMessageError('errors:studio.combat.contextChanged');
      const mission = getMission();
      if (!mission || mission.modes.includes('team'))
        throw editorMessageError('errors:studio.combat.nonTeam');
      const next = prepare
        ? prepareCombatAuthoring(getSource(), mission.id)
        : setMissionCombatEnabled(getSource(), mission.id, $('enabled').checked);
      if (apply(next) === false) return;
      revision = null;
      sync();
      localizedText($('result'), localizedMessage('tools:studio.combat.applied'));
    } catch (error) {
      showEditorFailure($('result'), error);
    }
  }
  $('prepare').onclick = () => commit(true);
  $('apply').onclick = () => commit(false);
  $('enabled').onchange = () => {
    localizedText($('result'), localizedMessage('tools:studio.combat.unapplied'));
  };
  return { sync };
}
