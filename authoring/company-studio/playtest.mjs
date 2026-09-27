import {
  COMPANY_PLAYTEST_FIXTURES,
  companyPlaytestTask,
} from '../../game/company-campaigns/playtest-fixtures.mjs';
import { mountCompanyWorkbench } from '../../game/company-campaigns/workbench.mjs';

const $ = (id) => document.getElementById(id);
const select = $('practice-select');
const container = $('practice-workbench');
let workbench = null;
const fixture = () => COMPANY_PLAYTEST_FIXTURES.find((row) => row.id === select.value);
const status = (text) => {
  $('status').textContent = text;
};
function clearPractice({ focus = false } = {}) {
  workbench?.destroy();
  workbench = null;
  container.hidden = true;
  $('restart-practice').disabled = true;
  if (focus) select.focus();
}
function labelPracticeControls() {
  const close = container.querySelector('[data-control="close"]');
  if (close) close.textContent = 'Close practice and clear answers';
  const commit = container.querySelector('[data-control="commit"]');
  if (commit?.disabled && workbench?.getAttempt().status === 'complete')
    commit.textContent =
      fixture().lesson.kind === 'reflection'
        ? 'Reflection complete in this page'
        : 'Practice complete in this page';
}
function openPractice() {
  const selected = fixture();
  if (!selected) return;
  clearPractice();
  container.hidden = false;
  workbench = mountCompanyWorkbench(container, {
    lesson: selected.lesson,
    onChange(attempt) {
      labelPracticeControls();
      if (attempt.status === 'complete')
        status(
          'Local practice complete. Explain your reasoning to the facilitator. No result was stored and no campaign was changed.',
        );
      else if (attempt.actions.at(-1)?.type === 'commit')
        status(
          'The handoff needs another look. Review the workbench feedback and the evidence; your draft remains editable.',
        );
    },
    onClose() {
      clearPractice({ focus: true });
      status('Practice closed and answers cleared. Nothing was saved.');
    },
  });
  labelPracticeControls();
  $('restart-practice').disabled = false;
  status(
    'Practice opened with blank answers. Explain your first choice before committing; the facilitator records observations separately.',
  );
  const title = container.querySelector('h2');
  title.tabIndex = -1;
  title.focus();
}
for (const row of COMPANY_PLAYTEST_FIXTURES) {
  const option = document.createElement('option');
  option.value = row.id;
  option.textContent = `${row.lesson.role} · ${row.lesson.title}`;
  select.append(option);
}
function selectPractice() {
  clearPractice();
  const selected = fixture();
  $('open-practice').disabled = !selected;
  $('export-task').disabled = !selected;
  $('fixture-context').textContent = selected
    ? `After ${selected.baseMissionId} · transfer fixture ${selected.lesson.fixtureRevision}. Opening practice starts a fresh response.`
    : '';
  status(
    selected
      ? 'Task selected. Open practice when the facilitator is ready.'
      : 'Choose a task to begin.',
  );
}
select.addEventListener('change', selectPractice);
$('open-practice').addEventListener('click', openPractice);
$('restart-practice').addEventListener('click', openPractice);
$('export-task').addEventListener('click', () => {
  const selected = fixture();
  if (!selected) return;
  const data = companyPlaytestTask(selected.id);
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${selected.id}-task.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Exported task cards only. No answers, feedback or results are included.');
});
const requested = new URL(window.location.href).searchParams.get('task');
if (COMPANY_PLAYTEST_FIXTURES.some((row) => row.id === requested)) {
  select.value = requested;
  selectPractice();
}
window.addEventListener('pagehide', () => {
  clearPractice();
  status('Practice cleared when the page was left. Open the selected task for a fresh response.');
});
