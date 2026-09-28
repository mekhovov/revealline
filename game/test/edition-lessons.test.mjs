import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountEditionLessons } from '../ui/edition-lessons.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { createCompanyProject } from '../company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint, createRecorder, recordInput } from '../replay.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

async function learningDialogFixture(
  t,
  {
    storage = memoryStorage(),
    writer = { writable: true },
    source = null,
    lessons = null,
    getRun = () => null,
    getRecorder = () => null,
  } = {},
) {
  const f = await editionProviderFixture(),
    doc = new Document(),
    reports = [];
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'dialog') {
      node.showModal = () => {
        node.open = true;
      };
      node.close = () => {
        node.open = false;
        node.emit('close');
      };
    }
    return node;
  };
  const settings = doc.createElement('dialog');
  settings.id = 'settings-dialog';
  const panel = doc.createElement('section');
  panel.id = 'settings-panel-data';
  settings.append(panel);
  const picture = doc.createElement('button');
  picture.id = 'view-picture';
  doc.body.append(picture, settings);
  const lesson = { ...structuredClone(COMPANY_LESSONS[0]), missionId: f.source.missions[0].id };
  const view = await mountEditionLessons({
    provider: {
      editionId: 'sample-public',
      route: { source: source ?? f.source },
      lessons: lessons ?? [lesson],
    },
    document: doc,
    window: { localStorage: storage, setTimeout },
    writer,
    getRun,
    getRecorder,
    getPictureVisible: () => true,
    report: (message) => reports.push(message),
  });
  t.after(() => view.dispose());
  settings.showModal();
  const upload = panel.querySelector('input'),
    status = doc.getElementById('edition-learning-status');
  const emptyBackup = JSON.stringify({
    format: 'revealline-edition-learning-backup.v1',
    editionId: 'sample-public',
    proofs: [],
    recovery: {
      format: 'revealline-learning-proof-recovery.v1',
      editionId: 'sample-public',
      sources: [],
    },
  });
  const file = (text) => ({ size: text.length, text: async () => text });
  return { doc, view, settings, upload, status, storage, reports, emptyBackup, file, lesson };
}

test('optional learning controls and completed imports switch locale without remounting', async (t) => {
  const previousLocale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(previousLocale, { persist: false }));
  const h = await learningDialogFixture(t),
    panel = h.doc.getElementById('settings-panel-data'),
    heading = panel.querySelector('h3'),
    download = panel.querySelector('button'),
    label = panel.querySelector('label'),
    opener = h.doc.getElementById('edition-lesson-open');
  assert.equal(heading.textContent, 'Optional learning records');
  assert.equal(download.textContent, 'Export optional learning');
  assert.equal(label.textContent, 'Import matching learning records');
  assert.equal(opener.textContent, 'Optional bonus · explore this connection');

  setLocale('uk', { persist: false });
  assert.equal(heading.textContent, 'Записи необов’язкового навчання');
  assert.equal(download.textContent, 'Експортувати необов’язкове навчання');
  assert.equal(label.textContent, 'Імпортувати відповідні навчальні записи');
  assert.equal(opener.textContent, 'Необов’язковий бонус · дослідити цей зв’язок');
  assert.ok(label.contains(h.upload), 'The localized label retains its file input.');

  h.upload.files = [h.file(h.emptyBackup)];
  await h.upload.onchange();
  assert.equal(h.status.textContent, 'Записи необов’язкового навчання імпортовано.');
  setLocale('en', { persist: false });
  assert.equal(h.status.textContent, 'Optional learning records imported.');

  const revisit = h.view.pictureReady({
    editionId: 'sample-public',
    missionId: h.lesson.missionId,
  });
  h.doc.body.append(revisit);
  assert.equal(revisit.textContent, 'Optional bonus · revisit this connection');
  setLocale('uk', { persist: false });
  assert.equal(revisit.textContent, 'Необов’язковий бонус · повернутися до цього зв’язку');

  h.upload.files = [
    h.file(
      JSON.stringify({ format: 'revealline-edition-learning-backup.v1', editionId: 'foreign' }),
    ),
  ];
  await h.upload.onchange();
  assert.equal(h.status.textContent, 'Ця резервна копія навчання належить іншому виданню.');
  setLocale('en', { persist: false });
  assert.equal(h.status.textContent, 'This learning backup belongs to another edition.');
});

test('bonus backup labels and pending status change language without replacing focused input or importing twice', async (t) => {
  const original = getLocale();
  t.after(() => setLocale(original, { persist: false }));
  setLocale('en', { persist: false });
  const h = await learningDialogFixture(t);
  const heading = h.doc.querySelector('.edition-learning-data').querySelector('h3');
  h.upload.focus();
  let finish;
  h.upload.files = [
    {
      size: 20,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ];
  const importing = h.upload.onchange();
  assert.equal(h.status.textContent, 'Checking learning records…');
  setLocale('uk', { persist: false });
  assert.equal(h.doc.activeElement, h.upload);
  assert.equal(h.doc.querySelector('.edition-learning-data').querySelector('input'), h.upload);
  assert.equal(heading.textContent, 'Записи необов’язкового навчання');
  assert.equal(h.status.textContent, 'Перевірка навчальних записів…');
  assert.deepEqual(h.storage.writes, []);
  finish(JSON.stringify({ format: 'revealline-edition-learning-backup.v1', editionId: 'foreign' }));
  await importing;
  assert.equal(h.status.textContent, 'Ця резервна копія навчання належить іншому виданню.');
  const reports = [...h.reports];
  setLocale('en', { persist: false });
  assert.equal(h.status.textContent, 'This learning backup belongs to another edition.');
  assert.equal(h.doc.activeElement, h.upload);
  assert.deepEqual(h.reports, reports, 'Language changes do not replay host announcements.');
  assert.deepEqual(h.storage.writes, []);
  h.view.dispose();
  const detachedStatus = h.status.textContent;
  setLocale('uk', { persist: false });
  assert.equal(h.status.textContent, detachedStatus, 'Disposed host has no locale subscription.');
});

test('bonus and Collection captions translate while workbench choices and focus retain their owner', async (t) => {
  const original = getLocale();
  t.after(() => setLocale(original, { persist: false }));
  setLocale('en', { persist: false });
  const h = await learningDialogFixture(t);
  h.settings.close();
  const revisit = h.view.pictureReady({
    editionId: 'sample-public',
    missionId: h.lesson.missionId,
  });
  h.doc.body.append(revisit);
  revisit.click();
  const field = h.lesson.fields[0],
    control = () => h.doc.querySelector(`[data-control="field-${field.id}"]`);
  control().value = field.options[0].value;
  control().emit('change');
  control().focus();
  const before = h.view.rewardEvidence();
  setLocale('uk', { persist: false });
  assert.equal(
    h.doc.getElementById('edition-lesson-open').textContent,
    'Необов’язковий бонус · дослідити цей зв’язок',
  );
  assert.equal(revisit.textContent, 'Необов’язковий бонус · повернутися до цього зв’язку');
  assert.equal(control().value, field.options[0].value);
  assert.equal(h.doc.activeElement, control());
  assert.deepEqual(h.view.rewardEvidence(), before);
  assert.deepEqual(h.storage.writes, []);
  h.doc.getElementById('edition-lesson-dialog').close();
  assert.equal(h.doc.activeElement, revisit);
  setLocale('en', { persist: false });
  assert.equal(revisit.textContent, 'Optional bonus · revisit this connection');
  assert.equal(h.doc.activeElement, revisit);
});

test('learning import failures stay in the open Settings live region and leave stored records intact', async (t) => {
  const h = await learningDialogFixture(t, {
    writer: { writable: false, reason: 'Another tab owns saving.' },
  });
  assert.equal(h.status.getAttribute('role'), 'status');
  assert.equal(h.status.getAttribute('aria-live'), 'polite');
  assert.equal(h.status.getAttribute('aria-atomic'), 'true');
  assert.ok(
    h.settings.contains(h.status),
    'The announcement belongs to the non-inert modal subtree.',
  );
  const before = new Map(h.storage.map);
  for (const [text, expected] of [
    ['{', /JSON/],
    [
      JSON.stringify({ format: 'revealline-edition-learning-backup.v1', editionId: 'foreign' }),
      /another edition/,
    ],
    [h.emptyBackup, /Another tab owns saving/],
  ]) {
    h.upload.files = [h.file(text)];
    await h.upload.onchange();
    assert.match(h.status.textContent, expected);
    assert.equal(h.status.textContent, h.reports.at(-1), 'Existing host feedback is preserved.');
    assert.equal(h.settings.open, true);
    assert.deepEqual(h.storage.map, before);
    assert.deepEqual(h.storage.writes, []);
  }
});

test('superseded and disposed learning imports cannot announce or adopt a late file read', async (t) => {
  const h = await learningDialogFixture(t);
  let finish;
  h.upload.files = [
    {
      size: h.emptyBackup.length,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ];
  const old = h.upload.onchange();
  h.upload.files = [
    h.file(
      JSON.stringify({ format: 'revealline-edition-learning-backup.v1', editionId: 'foreign' }),
    ),
  ];
  await h.upload.onchange();
  const message = h.status.textContent,
    reports = [...h.reports];
  finish(h.emptyBackup);
  await old;
  assert.equal(h.status.textContent, message);
  assert.deepEqual(h.reports, reports);
  assert.deepEqual(h.storage.writes, []);
  h.upload.files = [
    {
      size: h.emptyBackup.length,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ];
  const pending = h.upload.onchange(),
    detachedMessage = h.status.textContent;
  h.view.dispose();
  finish(h.emptyBackup);
  await pending;
  assert.equal(h.status.textContent, detachedMessage, 'Disposed UI receives no late mutation.');
  assert.deepEqual(h.reports, reports);
  assert.deepEqual(h.storage.writes, []);
});

test('verified bonus save failures stay in the owning modal or named host recovery without changing the won run', async (t) => {
  const lesson = COMPANY_LESSONS.find((entry) => entry.campaignId === 'coupa-source-to-pay'),
    source = createCompanyProject({ brandId: 'coupa', campaignId: lesson.campaignId }),
    compiled = compileContentProject(source),
    row = JSON.parse(
      readFileSync(new URL('fixtures/company-campaign-routes.json', import.meta.url)),
    ).rows.find(
      (entry) =>
        entry.id === lesson.missionId &&
        entry.difficulty === 'standard' &&
        entry.turnPolicy === 'immediate',
    ),
    level = applyGameplayTuning(resolveMission(compiled, row.id).level, row.gameplayTuning),
    options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const segment of row.segments)
    for (let tick = 0; tick < segment.ticks; tick++) {
      const input = { direction: segment.direction };
      stepRun(run, input, FIXED_DT);
      recordInput(recorder, input);
    }
  assert.equal(run.status, 'won');
  const checkpoint = authoritativeCheckpoint(run);
  for (const failure of ['read-only', 'quota', 'closed-read-only'])
    await t.test(failure, async (t) => {
      const storage = memoryStorage();
      if (failure === 'quota')
        storage.setItem = () => {
          throw new DOMException('Storage is full', 'QuotaExceededError');
        };
      const h = await learningDialogFixture(t, {
        source,
        lessons: [lesson],
        storage,
        writer: { writable: failure === 'quota' },
        getRun: () => run,
        getRecorder: () => recorder,
      });
      h.settings.close();
      h.view.refresh();
      let rewardUpdates = 0;
      const stopRewards = h.view.onRewardEvidenceChange(() => rewardUpdates++);
      h.doc.getElementById('edition-lesson-open').click();
      const dialog = h.doc.getElementById('edition-lesson-dialog'),
        status = h.doc.getElementById('edition-lesson-status'),
        control = (id) => h.doc.querySelector(`[data-control="${id}"]`);
      for (const record of lesson.records) control(`inspect-${record.id}`).click();
      for (const field of lesson.fields) {
        const select = control(`field-${field.id}`);
        select.value = field.expected;
        select.emit('change');
      }
      control('commit').click();
      if (failure === 'closed-read-only') dialog.close();
      for (let tries = 0; tries < 1000 && !/Export learning/.test(h.reports.at(-1)); tries++)
        await new Promise((resolve) => setTimeout(resolve, 5));
      assert.match(h.reports.at(-1), /complete in this tab.*Export learning/);
      assert.equal(rewardUpdates, 1);
      assert.equal(h.view.rewardEvidence().learning.length, 1);
      assert.deepEqual(h.view.rewardEvidence().durableLearning, []);
      stopRewards();
      assert.equal(status.getAttribute('role'), 'status');
      if (failure === 'closed-read-only') {
        assert.equal(dialog.open, false);
        assert.ok(h.reports.at(-1).startsWith(`${lesson.title}: `));
        assert.equal(status.textContent, 'Checking this completed bonus before saving…');
      } else {
        assert.match(status.textContent, /complete in this tab.*Export learning/);
        assert.ok(dialog.open && dialog.contains(status));
        assert.equal(h.reports.at(-1), status.textContent);
      }
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.deepEqual(storage.writes, []);
      assert.equal(
        h.status.textContent,
        '',
        'Lesson feedback does not announce in a different dialog.',
      );
    });
});

test('optional bonus waits for won picture, cannot change progression, and reopens from matching Collection picture', async () => {
  const f = await editionProviderFixture(),
    doc = new Document(),
    storage = memoryStorage();
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'dialog') {
      node.showModal = () => {
        node.open = true;
      };
      node.close = () => {
        node.open = false;
        node.emit('close');
      };
    }
    return node;
  };
  for (const id of ['view-picture', 'settings-panel-data']) {
    const node = doc.createElement('div');
    node.id = id;
    doc.body.append(node);
  }
  const lesson = { ...structuredClone(COMPANY_LESSONS[0]), missionId: f.source.missions[0].id };
  let run = { status: 'running', levelId: lesson.missionId },
    pictureVisible = false;
  const provider = { editionId: 'sample-public', route: { source: f.source }, lessons: [lesson] };
  const view = await mountEditionLessons({
    provider,
    document: doc,
    window: { localStorage: storage, setTimeout },
    writer: { writable: false },
    getRun: () => run,
    getRecorder: () => null,
    getPictureVisible: () => pictureVisible,
    report: () => {},
  });
  const button = doc.getElementById('edition-lesson-open');
  view.refresh();
  assert.equal(button.hidden, true);
  button.click();
  assert.equal(doc.getElementById('edition-lesson-dialog').open, false);
  run = { ...run, status: 'won' };
  view.refresh();
  assert.equal(button.hidden, true);
  pictureVisible = true;
  view.refresh();
  assert.equal(button.hidden, false);
  // A Collection callback has already verified and displayed its earned image.
  assert.equal(view.pictureReady({ editionId: 'foreign', missionId: lesson.missionId }), null);
  const revisit = view.pictureReady({ editionId: provider.editionId, missionId: lesson.missionId });
  doc.body.append(revisit);
  const before = structuredClone(run);
  revisit.click();
  assert.equal(doc.getElementById('edition-lesson-dialog').open, true);
  const inspect = doc
    .querySelectorAll('[data-control]')
    .filter((node) => node.dataset.control.startsWith('inspect-'));
  assert.equal(inspect.length, lesson.records.length);
  assert.ok(inspect.every((node) => !node.disabled));
  assert.deepEqual(run, before);
  assert.deepEqual(storage.writes, []);
  doc.getElementById('edition-lesson-dialog').close();
  run = { status: 'running', levelId: lesson.missionId };
  view.refresh();
  assert.equal(button.hidden, true);
  view.dispose();
  assert.equal(doc.getElementById('edition-lesson-dialog'), null);
});

test('independent completed bonuses both persist when replay proofs finish out of order', async (t) => {
  const lessons = COMPANY_LESSONS.filter(
      (entry) => entry.campaignId === 'coupa-source-to-pay',
    ).slice(0, 2),
    source = createCompanyProject({ brandId: 'coupa', campaignId: lessons[0].campaignId }),
    compiled = compileContentProject(source),
    rows = JSON.parse(
      readFileSync(new URL('fixtures/company-campaign-routes.json', import.meta.url)),
    ).rows;
  const runs = lessons.map((lesson) => {
    const row = rows.find(
        (entry) =>
          entry.id === lesson.missionId &&
          entry.difficulty === 'standard' &&
          entry.turnPolicy === 'immediate',
      ),
      level = applyGameplayTuning(resolveMission(compiled, row.id).level, row.gameplayTuning),
      options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy },
      run = createRun(level, options),
      recorder = createRecorder(level, options);
    for (const segment of row.segments)
      for (let tick = 0; tick < segment.ticks; tick++) {
        const input = { direction: segment.direction };
        stepRun(run, input, FIXED_DT);
        recordInput(recorder, input);
      }
    assert.equal(run.status, 'won');
    return { run, recorder };
  });
  const doc = new Document(),
    storage = memoryStorage(),
    reports = [];
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'dialog') {
      node.showModal = () => {
        node.open = true;
      };
      node.close = () => {
        node.open = false;
        node.emit('close');
      };
    }
    return node;
  };
  for (const id of ['view-picture', 'settings-panel-data']) {
    const node = doc.createElement('div');
    node.id = id;
    doc.body.append(node);
  }
  let current = runs[0];
  const view = await mountEditionLessons({
    provider: { editionId: 'coupa-foundations', route: { source }, lessons },
    document: doc,
    window: { localStorage: storage, setTimeout },
    writer: { writable: true },
    getRun: () => current.run,
    getRecorder: () => current.recorder,
    getPictureVisible: () => true,
    report: (message) => reports.push(message),
  });
  t.after(() => view.dispose());
  // Delay only the first real proof digest; the second completion and all
  // actual replay verification remain unmodified production code.
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  let first = true,
    releaseFirst;
  t.mock.method(crypto.subtle, 'digest', (...args) => {
    if (!first) return digest(...args);
    first = false;
    return new Promise((resolve, reject) => {
      releaseFirst = () => digest(...args).then(resolve, reject);
    });
  });
  function complete(lesson, entry) {
    current = entry;
    view.refresh();
    doc.getElementById('edition-lesson-open').click();
    const control = (id) => doc.querySelector(`[data-control="${id}"]`);
    for (const record of lesson.records) control(`inspect-${record.id}`).click();
    for (const field of lesson.fields) {
      const select = control(`field-${field.id}`);
      select.value = field.expected;
      select.emit('change');
    }
    control('commit').click();
    assert.equal(control('commit').disabled, true);
    doc.getElementById('edition-lesson-dialog').close();
  }
  const saved = () =>
    JSON.parse(
      storage.getItem('revealline.company-learning-proofs.coupa-foundations.v1') || '{"proofs":[]}',
    ).proofs;
  async function waitFor(count) {
    for (let tries = 0; tries < 1000 && saved().length !== count; tries++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(reports, []);
    assert.equal(saved().length, count);
  }
  complete(lessons[0], runs[0]);
  assert.equal(typeof releaseFirst, 'function');
  complete(lessons[1], runs[1]);
  await waitFor(1);
  assert.equal(saved()[0].attempt.missionId, lessons[1].missionId);
  const revisit = view.pictureReady({
    editionId: 'coupa-foundations',
    missionId: lessons[1].missionId,
  });
  doc.body.append(revisit);
  revisit.click();
  const status = doc.getElementById('edition-lesson-status');
  assert.equal(status.textContent, '');
  releaseFirst();
  await waitFor(2);
  assert.equal(
    status.textContent,
    '',
    'A completed older proof does not announce in a different lesson visit.',
  );
  assert.deepEqual(
    saved()
      .map((proof) => proof.attempt.missionId)
      .sort(),
    lessons.map((lesson) => lesson.missionId).sort(),
  );
});
