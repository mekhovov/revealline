import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRICULUM_LESSONS } from '../company-campaigns/curriculum-lessons.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import {
  validateCompanyLesson,
  createLearningAttempt,
  reduceLearningAttempt,
  verifyLearningAttempt,
} from '../company-campaigns/learning.mjs';
import {
  localizeCompanyLesson,
  localizeLearningFeedback,
} from '../company-campaigns/lesson-localization.mjs';
import { mountCompanyWorkbench } from '../company-campaigns/workbench.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';
const lesson = CURRICULUM_LESSONS.find((entry) => entry.id === 'fpv-meet-aircraft-06-lesson');

test('lesson translations preserve option identities and cannot carry different answers or evidence', () => {
  assert.deepEqual(validateCompanyLesson(lesson), lesson);
  for (const mutate of [
    (copy) => {
      copy.fields[0].expected = 'video';
    },
    (copy) => {
      copy.fields[0].options[0].value = 'video';
    },
    (copy) => {
      copy.fields.pop();
    },
    (copy) => {
      copy.records[0].id = 'foreign';
    },
    (copy) => {
      copy.sources = [{ title: 'Other', url: 'https://example.org' }];
    },
  ]) {
    const altered = structuredClone(lesson);
    mutate(altered.locales.uk);
    assert.throws(() => validateCompanyLesson(altered));
  }
  const legacy = COMPANY_LESSONS[0];
  assert.equal(localizeCompanyLesson(legacy, 'uk'), legacy);
});

test('language switching retains pending decisions, focus and a single canonical transcript', (context) => {
  const original = getLocale();
  context.after(() => setLocale(original, { persist: false }));
  setLocale('en', { persist: false });
  const document = new Document(),
    container = document.createElement('div');
  document.body.append(container);
  let changes = 0;
  const view = mountCompanyWorkbench(container, { lesson, onChange: () => changes++ });
  const control = (id) => container.querySelector(`[data-control="${id}"]`);
  for (const record of lesson.records) control(`inspect-${record.id}`).click();
  const select = control('field-control');
  select.value = 'video';
  select.emit('change');
  control('field-control').focus();
  const before = JSON.stringify(view.getAttempt());
  setLocale('uk', { persist: false });
  assert(container.textContent.includes(lesson.locales.uk.title));
  assert.equal(control('field-control').value, 'video');
  assert.equal(document.activeElement, control('field-control'));
  assert.equal(JSON.stringify(view.getAttempt()), before);
  assert.equal(changes, 3);
  control('commit').click();
  assert(container.textContent.includes(lesson.locales.uk.fields[0].explanation));
  assert.equal(view.getAttempt().status, 'working');
  const rejected = JSON.stringify(view.getAttempt());
  setLocale('en', { persist: false });
  assert.equal(document.activeElement, container.querySelector('[data-feedback]'));
  assert.equal(JSON.stringify(view.getAttempt()), rejected);
  for (const field of lesson.fields) {
    const choice = control(`field-${field.id}`);
    choice.value = field.expected;
    choice.emit('change');
  }
  control('commit').click();
  const done = view.getAttempt();
  assert.equal(done.status, 'complete');
  assert.equal(verifyLearningAttempt(lesson, done).valid, true);
  setLocale('uk', { persist: false });
  assert(container.textContent.includes(lesson.locales.uk.success));
  assert.equal(view.getAttempt(), done);
  view.destroy();
  setLocale('en', { persist: false });
  assert.equal(container.children.length, 0);
});

test('translated feedback is a display projection and a forged complete flag fails replay verification', () => {
  let attempt = createLearningAttempt(lesson);
  attempt = reduceLearningAttempt(lesson, attempt, { type: 'commit' });
  const before = JSON.stringify(attempt);
  const uk = localizeLearningFeedback(lesson, attempt, 'uk', (key, values) =>
    t('interface:learningWorkbench.' + key, { ...values, lng: 'uk' }),
  );
  assert.equal(uk.length, lesson.records.length + lesson.fields.length);
  assert(uk[0].includes(lesson.locales.uk.records[0].title));
  assert.equal(JSON.stringify(attempt), before);
  assert.equal(verifyLearningAttempt(lesson, { ...attempt, status: 'complete' }).valid, false);
});
