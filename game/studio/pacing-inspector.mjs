import { localizedMessage, localizedText } from '../i18n/index.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';
import { studioItemCaption } from './structure-copy.mjs';
import {
  studioInspectionError,
  studioPacingSummary,
  studioPacingWarnings,
  studioPacingWarning,
  studioPacingRow,
} from './inspection-copy.mjs';

/** Explicit, read-only inspection of the applied draft, never unapplied JSON.
 * Any edit invalidates the displayed report; no background compile on typing. */
export function createPacingInspector({ document, getSource }) {
  const $ = (id) => document.getElementById(`pacing-${id}`);
  function clear(message) {
    localizedText($('summary'), message);
    $('warnings').replaceChildren();
    $('sequence').replaceChildren();
  }
  function sync() {
    const project = getSource();
    const selected = new Set([...$('exclude').selectedOptions].map((option) => option.value));
    $('exclude').replaceChildren(
      ...project.campaigns
        .filter((campaign) => !campaign.archived)
        .map((campaign) => {
          const option = document.createElement('option');
          option.value = campaign.id;
          localizedText(option, () => studioItemCaption(project, campaign));
          option.selected = selected.has(campaign.id);
          return option;
        }),
    );
    clear(localizedMessage('tools:studio.pacing.prompt'));
  }
  const invalidate = () => clear(localizedMessage('tools:studio.pacing.changed'));
  $('mode').onchange = invalidate;
  $('exclude').onchange = invalidate;
  $('inspect').onclick = () => {
    clear(localizedMessage('tools:studio.pacing.inspecting'));
    try {
      const project = getSource();
      const report = inspectContentPacing(project, {
        mode: $('mode').value,
        excludedCampaignIds: [...$('exclude').selectedOptions].map((option) => option.value),
      });
      localizedText($('summary'), () => studioPacingSummary(report));
      $('warnings').replaceChildren(
        ...studioPacingWarnings(report).map((entry) => {
          const li = document.createElement('li');
          localizedText(li, () => studioPacingWarning(entry, report));
          return li;
        }),
      );
      $('sequence').replaceChildren(
        ...report.rows.map((row) => {
          const li = document.createElement('li');
          localizedText(li, () => studioPacingRow(project, row));
          return li;
        }),
      );
      return report;
    } catch (error) {
      clear(() => studioInspectionError(error));
      return null;
    }
  };
  return { sync };
}
