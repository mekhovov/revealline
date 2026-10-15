import { dataIdentity } from '../data-json.mjs';
import { editTeamEnvironment } from '../content-design/team-environment-edit.mjs';
import { localizedMessage, localizedText } from '../i18n/index.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
import { missionEditContext } from './edit-context.mjs';

export function createTeamEnvironmentEditor({ document, getSource, getMission, apply }) {
  const $ = (id) => document.getElementById(`team-environment-${id}`);
  let key, expectedMission, expectedMap;
  const context = () => missionEditContext(getSource(), getMission());
  function sync() {
    const mission = getMission();
    const enabled = mission?.team?.format === 'TeamMissionV10' && mission.modes[0] === 'team';
    $('tools').disabled = !enabled;
    localizedText(
      $('qualification'),
      localizedMessage(
        enabled ? 'tools:studio.teamEnvironment.help' : 'tools:studio.teamEnvironment.unavailable',
      ),
    );
    if (key === context()) return;
    key = context();
    const map = getSource().maps.find(
      (row) => row.id === mission?.map.id && row.revision === mission.map.revision,
    );
    expectedMission = mission ? dataIdentity(mission) : null;
    expectedMap = map ? dataIdentity(map) : null;
    $('source').value = enabled ? JSON.stringify(mission.team.environment, null, 2) : '';
    $('result').textContent = '';
  }
  function commit() {
    try {
      if (key !== context()) throw editorMessageError('errors:studio.teamEnvironment.stale');
      const candidate = editTeamEnvironment(getSource(), getMission()?.id, {
        expectedMission,
        expectedMap,
        environment: JSON.parse($('source').value),
      });
      if (apply(candidate, commit) === false) return;
      key = null;
      sync();
      localizedText($('result'), localizedMessage('tools:studio.teamEnvironment.applied'));
    } catch (error) {
      showEditorFailure($('result'), error);
    }
  }
  $('apply').onclick = commit;
  return { sync };
}
