// Test-only qualification. Application mutations use the shared pad driver.
// Validators, source fetches and storage snapshots inspect actual results only.
import { canonicalJSON } from '../../data-json.mjs';
import {
  DRAFT_FORMAT,
  declaredJSONPaths,
  validateStudioDraft,
  validateStudioHistory,
} from '../../../authoring/company-studio/model.mjs';
import { readStudioJSON } from '../../../authoring/company-studio/source-reader.mjs';
import { companyPlaytestTask } from '../../company-campaigns/playtest-fixtures.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const snapshotStorage = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
async function fingerprint(blob) {
  const bytes = await blob.arrayBuffer();
  return {
    bytes: bytes.byteLength,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}

function controllerChecks(p) {
  const $ = (id) => p.doc.getElementById(id);
  const readings = [];
  const read = async (entryId, regionId) => {
    const region = $(regionId),
      before = region.scrollTop,
      maximum = Math.max(0, region.scrollHeight - region.clientHeight);
    await p.choose(`#${entryId}`);
    assert(
      region.getAttribute('data-controller-reading') === 'true',
      `Read did not enter the actual ${regionId} region.`,
    );
    await p.pulse(before < maximum ? 'down' : 'up');
    const after = region.scrollTop;
    assert(after >= 0 && after <= maximum + 1, 'Reading escaped its scroll bounds.');
    if (maximum > 1) assert(after !== before, 'An overflowing reading region did not scroll.');
    await p.pulse('back');
    assert(
      !region.hasAttribute('data-controller-reading') && p.doc.activeElement === $(entryId),
      'Back did not end reading at the exact opener.',
    );
    readings.push({ regionId, before, after, maximum, scrollingExercised: maximum > 1 });
  };
  // A disabled placeholder has no enabled index. The real select editor
  // starts at its first enabled option, not at an invented negative index.
  const select = async (css, value) => {
    const element = p.doc.querySelector(css),
      options = [...element.options].filter((option) => !option.disabled),
      start = Math.max(
        0,
        options.findIndex((option) => option.value === element.value),
      ),
      destination = options.findIndex((option) => option.value === value);
    assert(destination >= 0, `Missing actual choice ${css}: ${value}`);
    await p.choose(css);
    for (let index = 0; index < Math.abs(destination - start); index++)
      await p.pulse(destination > start ? 'down' : 'up');
    await p.pulse('confirm');
    assert(p.doc.querySelector(css).value === value, `Choice was not committed: ${css}`);
  };
  return { readings, read, select };
}

export const companyStudioCurrent = [
  'Current Company Studio: apply, validate, export, reopen and separate transfer practice',
  '/authoring/company-studio/',
  async (p) => {
    const win = p.doc.defaultView,
      $ = (id) => p.doc.getElementById(id),
      source = () => JSON.parse($('catalog-json').value);
    assert(
      win.location.port === '8993' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the dedicated Company Studio qualification origin on port 8993.',
    );
    await p.wait(
      () =>
        $('status').textContent.startsWith('Registered source loaded.') &&
        p.doc.querySelector('.authoring-input-rail'),
      30000,
    );
    assert(p.doc.documentElement.lang.startsWith('en'), 'This receipt uses English controls.');
    const originalLocal = snapshotStorage(win.localStorage),
      originalSession = snapshotStorage(win.sessionStorage),
      originalCatalog = source(),
      editionId = $('edition-select').value,
      originalEdition = originalCatalog.editions.find((edition) => edition.id === editionId),
      originalBrand = originalCatalog.brands.find((brand) => brand.id === originalEdition.brandId),
      firstDownload = p.downloads.length;
    assert($('reopen-export').disabled, 'A fresh Studio unexpectedly has a last exported draft.');
    const checkStorage = () => {
      assert(same(snapshotStorage(win.localStorage), originalLocal), 'Local storage changed.');
      assert(
        same(snapshotStorage(win.sessionStorage), originalSession),
        'Session storage changed.',
      );
    };
    const step = async (index, target) => {
      await p.choose(`[data-step="${index}"]`);
      await p.wait(() => !p.doc.querySelector(`[data-panel="${index}"]`).hidden);
      assert(p.doc.activeElement === $(target), `Step ${index + 1} did not focus ${target}.`);
    };
    const cancelSource = async (id) => {
      await p.choose(`#${id} + .authoring-source-open`);
      await p.wait(() => p.doc.querySelector('.authoring-source-dialog')?.open);
      await p.pulse('back');
      assert(
        !p.doc.querySelector('.authoring-source-dialog').open,
        'Source Cancel kept its dialog.',
      );
    };
    const setNumber = async (id, value, { cancel = false } = {}) => {
      await p.choose(`#${id}`);
      await p.choose('[data-editor-action="all"]');
      await p.choose('[data-editor-action="backspace"]');
      for (const key of String(value)) await p.choose(`[data-editor-action="${key}"]`);
      if (cancel) await p.pulse('back');
      else await p.choose('[data-editor-action="done"]');
    };
    const { readings, read, select } = controllerChecks(p);
    await cancelSource('import-draft');
    assert(same(source(), originalCatalog), 'Canceling import changed the applied catalog.');
    await p.choose('#edition-select');
    await p.pulse('down');
    await p.pulse('back');
    assert($('edition-select').value === editionId, 'Canceled edition selection changed identity.');
    await p.edit('#brand-name', ['end', 'q'], { cancel: true });
    assert(
      $('brand-name').value === originalBrand.name,
      'Canceled identity text changed the form.',
    );
    await setNumber('revision', originalEdition.revision + 1, { cancel: true });
    assert(Number($('revision').value) === originalEdition.revision, 'Canceled revision changed.');
    await p.edit('#brand-name', ['end', 'space', 'q', 'a']);
    await setNumber('revision', originalEdition.revision + 1);
    await p.choose('#identity-form button[type="submit"]');
    await p.wait(() => $('status').textContent === 'Identity applied to the source draft.');
    const expectedCatalog = structuredClone(originalCatalog);
    expectedCatalog.brands.find((brand) => brand.id === originalBrand.id).name += ' qa';
    expectedCatalog.editions.find((edition) => edition.id === editionId).revision++;
    assert(same(source(), expectedCatalog), 'Identity Apply changed unrelated catalog fields.');
    checkStorage();
    p.record(
      'Source, edition, text and numeric drafts canceled; exact identity changes applied in memory',
      '#status',
      {
        editionId,
        brandId: originalBrand.id,
        revision: originalEdition.revision + 1,
        boundary: 'Applied in this tab only; no local draft Save or publication.',
      },
    );

    await step(1, 'logo-asset');
    const logo = $('logo-asset').value;
    await p.choose('#logo-asset');
    await p.pulse('down');
    await p.pulse('back');
    assert($('logo-asset').value === logo, 'Canceled artwork role changed the selected asset.');
    assert(
      $('asset-grid').children.length > 0,
      'The selected edition has no reviewable asset cards.',
    );
    await read('company-read-artwork', 'asset-grid');
    await step(2, 'theme-json');
    const themeText = $('theme-json').value,
      themePath = $('theme-json').dataset.sourcePath;
    await p.edit('#theme-json', ['end', 'q'], { cancel: true });
    assert($('theme-json').value === themeText, 'Canceled source text changed the theme.');
    await p.edit('#theme-json', ['end', 'q']);
    const invalidText = $('theme-json').value;
    await p.choose('#apply-theme');
    await p.wait(() => $('status').dataset.error === 'true');
    assert($('theme-json').value === invalidText, 'Invalid source was silently replaced.');
    assert(same(source(), expectedCatalog), 'Invalid theme replaced the accepted catalog.');
    await p.choose('#export-draft');
    await p.wait(() => $('status').dataset.error === 'true');
    assert(
      $('status').textContent.includes('Apply your JSON editor changes') &&
        p.downloads.length === firstDownload,
      'Unapplied invalid JSON was exported or failed without explaining the pending editor.',
    );
    await p.edit('#theme-json', ['end', 'backspace']);
    assert($('theme-json').value === themeText, 'Repair did not restore the exact original theme.');
    await p.choose('#apply-theme');
    await p.wait(() => $('status').textContent.startsWith(`Applied and validated ${themePath}.`));
    await step(3, 'campaign-select');
    const campaign = $('campaign-select').value,
      campaignSource = $('campaign-json').value;
    await p.choose('#campaign-select');
    await p.pulse('down');
    await p.pulse('back');
    assert(
      $('campaign-select').value === campaign && $('campaign-json').value === campaignSource,
      'Canceled campaign selection changed the accepted document.',
    );
    assert(
      $('campaign-summary').textContent.includes('missions'),
      'Campaign review has no summary.',
    );
    await step(4, 'learning-campaign-select');
    const learningCampaign = originalCatalog.campaigns.find(
      (entry) => originalEdition.campaignIds.includes(entry.id) && entry.lessonPath,
    );
    assert(learningCampaign, 'The selected edition has no lesson-backed campaign to review.');
    await select('#learning-campaign-select', learningCampaign.id);
    await p.wait(() => $('learning-json').dataset.sourcePath === learningCampaign.lessonPath);
    assert(
      $('learning-json').value.length > 0,
      'The selected campaign lacks its actual lesson source.',
    );
    await step(5, 'import-report');
    await cancelSource('import-report');
    assert(
      $('open-preview').disabled &&
        $('preview-frame').hidden &&
        $('preview-new-tab').hidden &&
        $('mission-review').hidden,
      'Unverified source enabled a compiled preview or artwork observations.',
    );
    const sourceReference = new URL($('source-preview').href);
    assert(
      sourceReference.pathname === '/game/company.html' &&
        sourceReference.searchParams.get('edition') === editionId,
      'Source reference does not identify the registered edition.',
    );
    checkStorage();
    p.record(
      'Artwork/campaign drafts canceled; malformed theme retained and rejected; export blocked until repair; all review steps reached',
      '#preview-note',
      {
        themePath,
        campaign,
        compiledPreview: 'Not qualified: requires a real current CLI report and verified artifact.',
        sourceReference: sourceReference.pathname + sourceReference.search,
        sourceReferenceOpened: false,
      },
    );

    const exportSource = async () => {
      await step(6, 'export-draft-bottom');
      const count = p.downloads.length;
      await p.choose('#export-draft-bottom');
      await p.wait(
        () =>
          $('draft-state').textContent === 'Source download requested' &&
          p.downloads.length > count,
        60000,
      );
      assert(
        p.doc.activeElement === $('export-draft-bottom'),
        'Export lost its initiating control.',
      );
      assert(
        p.downloads.length === count + 1,
        'One source export created an unexpected number of blobs.',
      );
      const blob = p.downloads.at(-1).blob,
        text = await blob.text(),
        packet = JSON.parse(text),
        checked = validateStudioDraft(text),
        retained = await validateStudioHistory(checked.catalog, checked.files);
      assert(
        packet.format === DRAFT_FORMAT && blob.type === 'application/json',
        'Wrong source artifact format.',
      );
      assert(
        same(checked.catalog, expectedCatalog),
        'Exported catalog differs from the accepted identity.',
      );
      assert(
        text === `${JSON.stringify(packet, null, 2)}\n`,
        'Source export changed its readable JSON transport.',
      );
      return { blob, text, packet, checked, retained, receipt: await fingerprint(blob) };
    };
    await step(6, 'export-draft-bottom');
    await read('company-read-commands', 'compile-commands');
    const first = await exportSource();
    // Read original workspace JSON through its bounded production loader.
    // Retained presentations must preserve exact text, including whitespace.
    const retainedPaths = new Set(
      originalCatalog.editions.flatMap((edition) =>
        (edition.presentationHistory ?? []).map((record) => record.path),
      ),
    );
    for (const path of declaredJSONPaths(originalCatalog)) {
      const original = await readStudioJSON(new URL(`/${path}`, win.location.href), {
        originalText: retainedPaths.has(path),
      });
      assert(same(first.checked.files.get(path), original), `An unedited source changed: ${path}`);
    }
    assert(
      !$('reopen-export').disabled,
      'Successful source export did not enable memory-only reopen.',
    );
    await step(2, 'theme-json');
    await p.edit('#theme-json', ['end', 'q']);
    const dirtyTheme = $('theme-json').value;
    await step(0, 'brand-name');
    await p.edit('#brand-name', ['end', 'q']);
    const dirtyName = $('brand-name').value;
    await p.choose('#reopen-export');
    await p.wait(
      () => $('company-operation').open && p.visible($('company-operation-confirm')),
      30000,
    );
    assert(
      p.doc.activeElement === $('company-operation-cancel'),
      'Reopen did not default to Cancel.',
    );
    await p.pulse('back');
    assert(
      !$('company-operation').open &&
        $('theme-json').value === dirtyTheme &&
        $('brand-name').value === dirtyName &&
        same(source(), expectedCatalog),
      'Canceled reopen discarded applied source, raw JSON or unapplied form work.',
    );
    await p.choose('#reopen-export');
    await p.wait(
      () => $('company-operation').open && p.visible($('company-operation-confirm')),
      30000,
    );
    await p.choose('#company-operation-confirm');
    await p.wait(() => !$('company-operation').open && $('theme-json').value === themeText, 30000);
    assert(
      p.doc.activeElement === $('brand-name') &&
        same(source(), expectedCatalog) &&
        $('brand-name').value ===
          expectedCatalog.brands.find((brand) => brand.id === originalBrand.id).name,
      'Explicit reopen did not replace pending work with the exact validated export.',
    );
    const second = await exportSource();
    assert(first.text === second.text, 'Reopened source export is not byte-identical.');
    checkStorage();
    p.record(
      'Two source exports passed production draft/history validation; canceled reopen preserved pending work, explicit reopen restored exact exported bytes',
      '#status',
      {
        artifacts: [first.receipt, second.receipt].map((receipt) => ({
          name: `${editionId}-draft.json`,
          ...receipt,
        })),
        declaredSources: first.checked.files.size,
        retainedPresentations: first.retained.length,
        unchangedWorkspaceSources: declaredJSONPaths(originalCatalog).length,
        readings: [...readings],
        boundary:
          'Reopen uses the validated last export retained in this tab; not an OS import or durable Save. Actual OS files require separate validation.',
      },
    );

    await p.follow('a[href="playtest.html"]', '/authoring/company-studio/playtest.html');
    await qualifyCompanyPractice(p, { originalCatalog });
    assert(
      p.downloads.length === firstDownload + 3,
      'Unexpected downloads occurred during the bounded workflow.',
    );
    checkStorage();
  },
];

async function qualifyCompanyPractice(p, { originalCatalog }) {
  const win = p.doc.defaultView,
    $ = (id) => p.doc.getElementById(id),
    originalLocal = snapshotStorage(win.localStorage),
    originalSession = snapshotStorage(win.sessionStorage),
    firstDownload = p.downloads.length,
    { readings, read, select } = controllerChecks(p);
  const checkStorage = () => {
    assert(
      same(snapshotStorage(win.localStorage), originalLocal),
      'Practice changed local storage.',
    );
    assert(
      same(snapshotStorage(win.sessionStorage), originalSession),
      'Practice changed session storage.',
    );
  };
  await p.wait(() => p.doc.querySelector('.authoring-input-rail'));
  const taskId = 'playtest-foundations-requirement';
  await select('#practice-select', taskId);
  await p.choose('#open-practice');
  await p.wait(() => !$('practice-workbench').hidden);
  assert(
    p.doc.activeElement === $('company-read-practice'),
    'Open did not focus practice reading.',
  );
  await read('company-read-practice', 'company-read-practice-region');
  await p.choose('[data-control="commit"]');
  assert(
    !p.doc.querySelector('[data-control="commit"]').disabled &&
      p.doc.querySelector('[data-feedback]').textContent.includes('Inspect'),
    'Blank practice was accepted instead of returning missing-evidence feedback.',
  );
  assert(
    p.doc.activeElement === $('company-read-feedback'),
    'Commit did not focus its feedback reader.',
  );
  await read('company-read-feedback', 'company-read-feedback-region');
  for (const id of ['need', 'offer']) await p.choose(`[data-control="inspect-${id}"]`);
  for (const index of [0, 1])
    await read(`company-read-evidence-${index}`, `company-read-evidence-${index}-region`);
  const field = '[data-control="field-item"]';
  await p.choose(field);
  await p.pulse('down');
  await p.pulse('back');
  assert(p.doc.querySelector(field).value === '', 'Canceled practice choice was committed.');
  for (const [id, value] of [
    ['item', 'Electronics kit'],
    ['quantity', '12'],
    ['needBy', '8 November'],
  ])
    await select(`[data-control="field-${id}"]`, value);
  await p.choose('[data-control="commit"]');
  assert(
    !p.doc.querySelector('[data-control="commit"]').disabled &&
      $('status').textContent.includes('needs another look'),
    'Incorrect fictional practice answers were accepted.',
  );
  for (const [id, value] of [
    ['item', 'Reusable case'],
    ['quantity', '6'],
    ['needBy', '4 November'],
  ])
    await select(`[data-control="field-${id}"]`, value);
  await p.choose('[data-control="commit"]');
  await p.wait(() => $('status').textContent.startsWith('Local practice complete.'));
  assert(
    p.doc.querySelector('[data-control="commit"]').disabled,
    'Completed local practice remained editable.',
  );
  await read('company-read-feedback', 'company-read-feedback-region');
  await p.choose('#restart-practice');
  assert(
    [...p.doc.querySelectorAll('[data-control^="field-"]')].every(
      (element) => element.value === '',
    ) &&
      [...p.doc.querySelectorAll('[data-control^="inspect-"]')].every(
        (element) => element.getAttribute('aria-expanded') === 'false',
      ),
    'Restart retained answers or inspected-record state.',
  );
  const assertBlank = () => {
    assert(
      [...p.doc.querySelectorAll('[data-control^="field-"]')].every(
        (element) => element.value === '',
      ) &&
        [...p.doc.querySelectorAll('[data-control^="inspect-"]')].every(
          (element) => element.getAttribute('aria-expanded') === 'false',
        ),
      'Reopened practice retained answers or evidence state.',
    );
  };
  await p.choose('[data-control="close"]');
  assert(
    $('practice-workbench').hidden && p.doc.activeElement === $('practice-select'),
    'Close did not clear practice and restore selection.',
  );
  checkStorage();
  await p.follow('header a.wordmark', '/authoring/company-studio/');
  await p.wait(() => $('status').textContent.startsWith('Registered source loaded.'), 30000);
  assert(
    same(JSON.parse($('catalog-json').value), originalCatalog) && $('reopen-export').disabled,
    'Returning to a fresh Studio did not honor its tab-local draft boundary.',
  );
  await p.follow('a[href="playtest.html"]', '/authoring/company-studio/playtest.html');
  await p.wait(() => p.doc.querySelector('.authoring-input-rail'));
  await select('#practice-select', taskId);
  await p.choose('#open-practice');
  await p.wait(() => !$('practice-workbench').hidden);
  assert(p.doc.activeElement === $('company-read-practice'), 'Reopen lost its reading entry.');
  assertBlank();
  await p.choose('[data-control="close"]');
  assert(
    $('practice-workbench').hidden && p.doc.activeElement === $('practice-select'),
    'Second Close did not restore selection.',
  );
  checkStorage();
  assert(p.downloads.length === firstDownload, 'Practice downloaded before explicit Export.');
  // Export is the final input action. OS download focus must not be bypassed
  // or restored by the fixture to make subsequent application input succeed.
  const taskExports = p.downloads.length;
  await p.choose('#export-task');
  await p.wait(() => p.downloads.length === taskExports + 1);
  const taskBlob = p.downloads.at(-1).blob,
    task = JSON.parse(await taskBlob.text()),
    expectedTask = companyPlaytestTask(taskId);
  assert(
    same(task, expectedTask),
    'Task export differs from the authoritative answer-free task cards.',
  );
  assert(
    task.fields.every(
      (entry) =>
        !('expected' in entry) &&
        !('explanation' in entry) &&
        entry.options.every((option) => !('consequence' in option)),
    ) &&
      !('attempt' in task) &&
      !('feedback' in task) &&
      !('status' in task),
    'Task cards disclosed answers, coaching or participant results.',
  );
  assert(p.downloads.length === firstDownload + 1, 'Expected exactly one final task-card export.');
  checkStorage();
  p.record(
    'Separate practice rejected blank/wrong answers, read evidence/feedback, completed valid choices, restarted blank, closed and reopened through Studio before final answer-free export',
    '#status',
    {
      task: { name: `${taskId}-task.json`, ...(await fingerprint(taskBlob)) },
      preservedLocalKeys: originalLocal.length,
      preservedSessionKeys: originalSession.length,
      practiceReadings: readings,
      boundary:
        'The final real Export action is followed only by passive byte/storage validation. No focus is restored after downloading. No game progress, human playtest result, compiled preview, publication or durable draft persistence is inferred.',
    },
  );
}

export const companyPracticeCurrent = [
  'Current company transfer practice: read, invalid/valid choices, cancel, restart, reopen and task export',
  '/authoring/company-studio/playtest.html?task=playtest-foundations-requirement',
  async (p) => {
    const win = p.doc.defaultView;
    assert(
      win.location.port === '8993' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the dedicated Company Studio qualification origin on port 8993.',
    );
    assert(p.doc.documentElement.lang.startsWith('en'), 'This receipt uses English controls.');
    const originalCatalog = await readStudioJSON(
      new URL('/game/editions/catalog.json', win.location.href),
    );
    await qualifyCompanyPractice(p, { originalCatalog });
  },
];
