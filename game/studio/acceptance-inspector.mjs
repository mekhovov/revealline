import {
  inspectMissionAcceptance,
  readPlaytestLedger,
} from '../content-design/acceptance-evidence.mjs';

/** Read-only, session-local evidence review. Imported claims never edit the draft,
 * fetch artifacts, authenticate a tester or grant publication approval. */
export function createAcceptanceInspector({ document, getSource, getMission, getDifficulty }) {
  const $ = (id) => document.getElementById(`acceptance-${id}`);
  let ledger = readPlaytestLedger(),
    epoch = 0,
    loading = false;
  function clear(message) {
    $('summary').textContent = message;
    $('checks').replaceChildren();
    $('report').textContent = '';
  }
  function invalidate() {
    epoch++;
    loading = false;
    $('inspect').disabled = !getMission();
    $('ledger-status').textContent =
      `${ledger.records.length} declared records loaded for this visit only. Nothing is saved or authenticated.`;
    clear('Selection or draft changed. Inspect again; no previous report remains current.');
  }
  function sync() {
    const mission = getMission(),
      selected = $('mode').value;
    $('mode').replaceChildren(
      ...(mission?.modes ?? []).map((mode) => {
        const option = document.createElement('option');
        option.value = mode;
        option.textContent = { solo: 'Solo', versus: 'Versus', team: 'Team' }[mode];
        return option;
      }),
    );
    $('mode').value = mission?.modes.includes(selected) ? selected : (mission?.modes[0] ?? '');
    $('selection').textContent = mission
      ? `Applied mission: ${mission.name} · ${mission.id} · ${getDifficulty()}. Uses the mission and challenge selected above, not unapplied JSON.`
      : 'Choose an applied mission above.';
    invalidate();
  }
  $('mode').onchange = invalidate;
  $('commit').oninput = invalidate;
  $('clear').onclick = () => {
    ledger = readPlaytestLedger();
    $('file').value = '';
    invalidate();
  };
  $('file').onchange = async () => {
    const files = [...($('file').files ?? [])];
    $('file').value = '';
    // Replace, never merge or reuse a previous ledger after an unsuccessful read.
    ledger = readPlaytestLedger();
    invalidate();
    const request = epoch;
    if (!files?.length) return;
    try {
      if (
        files.length !== 1 ||
        !Number.isSafeInteger(files[0].size) ||
        files[0].size < 1 ||
        files[0].size > 8 * 1024 * 1024
      )
        throw new Error('Choose one nonempty JSON ledger no larger than 8 MiB.');
      loading = true;
      $('inspect').disabled = true;
      $('ledger-status').textContent = 'Reading local ledger; no upload or artifact fetch.';
      const text = await files[0].text();
      if (request !== epoch) return;
      ledger = readPlaytestLedger(text);
      invalidate();
      clear('Ledger loaded as unverified claims. Inspect the applied selection explicitly.');
    } catch (error) {
      if (request !== epoch) return;
      invalidate();
      $('ledger-status').textContent =
        `Ledger rejected: ${error.message} No records loaded. Choose the file again to retry.`;
    }
  };
  $('inspect').onclick = () => {
    if (loading) return null;
    clear('Inspecting declared evidence for the applied selection…');
    try {
      const report = inspectMissionAcceptance(getSource(), getMission()?.id, {
        mode: $('mode').value,
        difficulty: getDifficulty(),
        sourceCommit: $('commit').value.trim(),
        ledger,
      });
      const missing = report.checks.filter((check) => check.status === 'missing').length;
      const failed = report.checks.filter((check) => check.status === 'reported-fail').length;
      $('summary').textContent =
        `${report.currentEvidenceIds.length} current records · ${report.staleEvidenceIds.length} stale · ${report.supersededEvidenceIds.length} superseded · ${missing} missing checks · ${failed} reported failures. Declared observations only—not human authentication, artifact verification or release approval.`;
      $('checks').replaceChildren(
        ...report.checks.map((check) => {
          const li = document.createElement('li');
          li.textContent = `${check.label}: ${check.status}. Permitted evidence: ${check.permittedKinds.join(', ')}.${check.observations.map((item) => ` ${item.evidenceId} (${item.kind}): ${item.detail}`).join('')}`;
          return li;
        }),
      );
      $('report').textContent = JSON.stringify(report, null, 2);
      return report;
    } catch (error) {
      clear(`Cannot inspect this selection: ${error.message}`);
      return null;
    }
  };
  return { sync };
}
