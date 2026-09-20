import { inspectContentPacing } from '../content-design/pacing.mjs';

/** Explicit, read-only inspection of the applied draft, never unapplied JSON.
 * Any edit invalidates the displayed report; no background compile on typing. */
export function createPacingInspector({ document, getSource }) {
  const $ = (id) => document.getElementById(`pacing-${id}`);
  function clear(message) {
    $('summary').textContent = message;
    $('warnings').replaceChildren();
    $('sequence').replaceChildren();
  }
  function sync() {
    const selected = new Set([...$('exclude').selectedOptions].map((option) => option.value));
    $('exclude').replaceChildren(
      ...getSource()
        .campaigns.filter((campaign) => !campaign.archived)
        .map((campaign) => {
          const option = document.createElement('option');
          option.value = campaign.id;
          option.textContent = `${campaign.name} · ${campaign.id}`;
          option.selected = selected.has(campaign.id);
          return option;
        }),
    );
    clear(
      'Inspect the applied draft to review sequence and challenge ratings. No content is changed.',
    );
  }
  const invalidate = () =>
    clear('Selection changed. Inspect again; the previous report is no longer current.');
  $('mode').onchange = invalidate;
  $('exclude').onchange = invalidate;
  $('inspect').onclick = () => {
    clear('Inspecting the applied draft…');
    try {
      const report = inspectContentPacing(getSource(), {
        mode: $('mode').value,
        excludedCampaignIds: [...$('exclude').selectedOptions].map((option) => option.value),
      });
      $('summary').textContent =
        `${report.rows.length} selected mission occurrences · ${report.timedMissionOccurrences} timed (${(report.timedFraction * 100).toFixed(1)}%). Authored ratings only—not measured difficulty or human validation. Gentle countdowns do not fail. ${report.diagnostics.length} advisory findings.`;
      $('warnings').replaceChildren(
        ...report.diagnostics.map((item) => {
          const li = document.createElement('li');
          li.textContent = `${item.missionId ? `${item.packId} / ${item.campaignId} / ${item.missionId}: ` : ''}${item.message}`;
          return li;
        }),
      );
      $('sequence').replaceChildren(
        ...report.rows.map((row) => {
          const li = document.createElement('li');
          li.textContent = `${row.name} · ${row.packId} / ${row.campaignId} · band ${row.rating.band} · planning ${row.rating.planning}, execution ${row.rating.execution}, threat ${row.rating.threatDensity}, time ${row.rating.timePressure}, mechanics ${row.rating.mechanicLoad}, coordination ${row.rating.coordination} · ${row.authoredDurationSeconds.join('–')} s authored estimate · ${row.countdownSeconds ? `${row.countdownSeconds} s countdown` : 'no countdown'} · introduces ${row.introduces.join(', ') || 'no new rule'}.`;
          return li;
        }),
      );
      return report;
    } catch (error) {
      clear(`Cannot inspect this selection: ${error.message}`);
      return null;
    }
  };
  return { sync };
}
