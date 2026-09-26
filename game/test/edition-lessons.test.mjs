import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountEditionLessons } from '../ui/edition-lessons.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { createCompanyProject } from '../company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput } from '../replay.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';

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
  releaseFirst();
  await waitFor(2);
  assert.deepEqual(
    saved()
      .map((proof) => proof.attempt.missionId)
      .sort(),
    lessons.map((lesson) => lesson.missionId).sort(),
  );
});
