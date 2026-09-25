import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { editorMessageError, editorErrorText } from './editor-copy.mjs';
import {
  studioModeName,
  studioAcceptanceSelection,
  studioAcceptanceSummary,
  studioAcceptanceCheck,
  studioInspectionError,
} from './inspection-copy.mjs';
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
    localizedText($('summary'), message);
    $('checks').replaceChildren();
    $('report').textContent = '';
  }
  function invalidate() {
    epoch++;
    loading = false;
    $('inspect').disabled = !getMission();
    localizedText(
      $('ledger-status'),
      localizedMessage('tools:studio.acceptance.ledger', { count: ledger.records.length }),
    );
    clear(localizedMessage('tools:studio.acceptance.changed'));
  }
  function sync() {
    const mission = getMission(),
      project = getSource(),
      difficulty = getDifficulty(),
      selected = $('mode').value;
    $('mode').replaceChildren(
      ...(mission?.modes ?? []).map((mode) => {
        const option = document.createElement('option');
        option.value = mode;
        localizedText(option, () => studioModeName(mode));
        return option;
      }),
    );
    $('mode').value = mission?.modes.includes(selected) ? selected : (mission?.modes[0] ?? '');
    localizedText($('selection'), () => studioAcceptanceSelection(project, mission, difficulty));
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
        throw editorMessageError('errors:studio.acceptance.file');
      loading = true;
      $('inspect').disabled = true;
      localizedText($('ledger-status'), localizedMessage('tools:studio.acceptance.reading'));
      const text = await files[0].text();
      if (request !== epoch) return;
      ledger = readPlaytestLedger(text);
      invalidate();
      clear(localizedMessage('tools:studio.acceptance.loaded'));
    } catch (error) {
      if (request !== epoch) return;
      invalidate();
      localizedText($('ledger-status'), () =>
        t('tools:studio.acceptance.rejected', { message: editorErrorText(error) }),
      );
    }
  };
  $('inspect').onclick = () => {
    if (loading) return null;
    clear(localizedMessage('tools:studio.acceptance.inspecting'));
    try {
      const report = inspectMissionAcceptance(getSource(), getMission()?.id, {
        mode: $('mode').value,
        difficulty: getDifficulty(),
        sourceCommit: $('commit').value.trim(),
        ledger,
      });
      localizedText($('summary'), () => studioAcceptanceSummary(report));
      $('checks').replaceChildren(
        ...report.checks.map((check) => {
          const li = document.createElement('li');
          localizedText(li, () => studioAcceptanceCheck(check));
          return li;
        }),
      );
      $('report').textContent = JSON.stringify(report, null, 2);
      return report;
    } catch (error) {
      clear(() => studioInspectionError(error));
      return null;
    }
  };
  return { sync };
}
