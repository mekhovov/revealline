import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompanyWorkspaceFiles,
  companyDraftFiles,
  companySourceDraft,
} from '../../scripts/company-studio.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import {
  createStudioLessonSidecar,
  createStudioLessonDraft,
  stageStudioLesson,
  studioLessonPreviewAttempt,
} from '../../authoring/company-studio/lesson-authoring.mjs';
import { createLessonEditor } from '../../authoring/company-studio/lesson-editor.mjs';
import { createExplorationGuidedEditor } from '../studio/exploration-guided-editor.mjs';
import { createExplorationExample } from '../studio/exploration-example.mjs';
import {
  validateCompanyLesson,
  verifyLearningAttempt,
  createCompanyLearningStore,
} from '../company-campaigns/learning.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { Document } from './helpers/couch-dom.mjs';

function fixture() {
  const workspace = createCompanyWorkspaceFiles({ brandId: 'guided', name: 'Guided example' });
  const campaign = workspace.catalog.campaigns[0],
    project = JSON.parse(workspace.files.get(campaign.sourcePath));
  const lesson = createStudioLessonDraft(campaign.id, project.missions[0].id);
  Object.assign(lesson, {
    title: 'Compare the evidence',
    role: 'Exhibit curator',
    brief: 'Use the worked example to label a different fictional object.',
    notice: 'Fictional classroom records, not historical attribution.',
    success: 'The label distinguishes observation from inference.',
    sourceReviewedAt: '2026-09-28',
    sources: [{ title: 'Fixture source', url: 'https://example.org/source' }],
  });
  Object.assign(lesson.locales.uk, {
    title: 'Порівняйте свідчення',
    role: 'Куратор виставки',
    brief: 'Застосуйте пояснений приклад до іншого вигаданого предмета.',
    notice: 'Вигадані навчальні записи, а не історична атрибуція.',
    success: 'Підпис відокремлює спостереження від припущення.',
  });
  for (const [locale, record] of [
    ['en', lesson],
    ['uk', lesson.locales.uk],
  ]) {
    record.records[0].title = locale === 'en' ? 'Worked example' : 'Пояснений приклад';
    record.records[0].lines = [
      locale === 'en'
        ? 'A dated catalogue is evidence of the recorded date, not proof of an unknown maker.'
        : 'Дата в каталозі є свідченням записаної дати, а не доказом невідомого авторства.',
    ];
    record.records[1].title = locale === 'en' ? 'Different object' : 'Інший предмет';
    record.records[1].lines = [
      locale === 'en'
        ? 'This new object has a date record but no maker record.'
        : 'Для нового предмета є запис дати, але немає запису автора.',
    ];
    Object.assign(record.fields[0], {
      label:
        locale === 'en'
          ? 'Which label follows the evidence?'
          : 'Який підпис відповідає свідченням?',
      explanation:
        locale === 'en'
          ? 'An absent maker record does not justify an invented name.'
          : 'Відсутність запису автора не обґрунтовує вигаданого імені.',
    });
    record.fields[0].options[0].label =
      locale === 'en' ? 'Date recorded; maker unknown' : 'Дату записано; автор невідомий';
    record.fields[0].options[1].label = locale === 'en' ? 'Invent a maker' : 'Вигадати автора';
  }
  return { workspace, campaign, project, lesson: validateCompanyLesson(lesson) };
}
function surface() {
  const document = new Document(),
    container = document.createElement('div');
  document.body.append(container);
  return { document, container };
}

test('explicit sidecar creation and guided lesson roundtrip through source export, import, compiler and player provider', async () => {
  const { workspace, campaign, project, lesson } = fixture(),
    before = createRewardMissionBindings(project);
  assert.equal(campaign.lessonPath, undefined);
  const added = createStudioLessonSidecar(workspace.catalog, campaign.id);
  assert.equal(workspace.catalog.campaigns[0].lessonPath, undefined);
  assert.equal(added.catalog.editions[0].revision, workspace.catalog.editions[0].revision + 1);
  assert.throws(() => createStudioLessonSidecar(added.catalog, campaign.id), /already/);
  const lessons = stageStudioLesson([], lesson, project),
    files = new Map(workspace.files);
  files.set('game/editions/catalog.json', Buffer.from(JSON.stringify(added.catalog)));
  files.set(added.path, Buffer.from(JSON.stringify(lessons)));
  const restored = companyDraftFiles(companySourceDraft({ catalog: added.catalog, files }));
  const built = await compileEdition({
    catalog: restored.catalog,
    editionIds: [restored.catalog.defaultEditionId],
    files: restored.files,
  });
  assert.deepEqual(JSON.parse(built.files.get(added.path)), lessons);
  const provider = await loadRuntimeContentProvider({
    locationRef: {
      href: `http://localhost/game/index.html?edition=${added.catalog.defaultEditionId}`,
    },
    documentRef: { documentElement: { dataset: { editionId: added.catalog.defaultEditionId } } },
    fetcher: async (url) => {
      const value = built.files.get(new URL(url).pathname.slice(1));
      return value ? new Response(value) : new Response('', { status: 404 });
    },
  });
  assert.deepEqual(provider.lessons, lessons);
  assert.deepEqual(createRewardMissionBindings(project), before);
  assert.equal(provider.rewards.length, 0);
});

test('guided lesson stages bilingual evidence and requires explicit new revisions; wrong and correct previews verify without earning', () => {
  const { workspace, campaign, project, lesson } = fixture();
  const selected = createStudioLessonSidecar(workspace.catalog, campaign.id).catalog.campaigns[0];
  let lessons = [lesson],
    writes = 0;
  const { container } = surface();
  const editor = createLessonEditor({
    container,
    getCampaign: () => selected,
    getProject: () => project,
    getLessons: () => lessons,
    setLessons: (value) => {
      lessons = value;
      writes++;
    },
  });
  editor.sync();
  const field = (path) => container.querySelector(`[data-lesson-field="${path}"]`),
    action = (name) => container.querySelector(`[data-lesson-action="${name}"]`);
  field('brief').value = 'Apply the object-label distinction to a different gallery record.';
  action('stage').click();
  assert.equal(writes, 0);
  assert.match(container.textContent, /new lesson revision/);
  field('revision').value = '2';
  field('fixtureRevision').value = '2';
  field('locales.uk.brief').value = 'Застосуйте відмінність до запису іншої галереї.';
  action('stage').click();
  assert.equal(writes, 1);
  assert.equal(lessons[0].locales.uk.brief, field('locales.uk.brief').value);
  assert.deepEqual(lessons[0].sources, lesson.sources);
  action('wrong').click();
  assert.equal(container.querySelector('[data-control="commit"]').disabled, false);
  assert.match(container.querySelector('[data-feedback]').textContent, /absent maker record/);
  action('correct').click();
  assert.equal(container.querySelector('[data-control="commit"]').disabled, true);
  for (const mode of ['wrong', 'correct', 'partial']) {
    const attempt = studioLessonPreviewAttempt(lessons[0], mode);
    assert.equal(verifyLearningAttempt(lessons[0], attempt).valid, true);
    assert.equal(attempt.status, mode === 'correct' ? 'complete' : 'working');
    assert.equal(attempt.simulationIdentity, null);
    assert.equal(attempt.seed, null);
    assert.equal(verifyLearningAttempt(lesson, attempt).valid, false);
  }
  const store = createCompanyLearningStore({
    editionId: 'guided-public',
    lessons,
    storage: {
      getItem: () => null,
      setItem: () => assert.fail('Preview must never save player evidence.'),
    },
  });
  assert.equal(store.load(lesson.missionId), null);
  assert.equal(writes, 1, 'Previews cannot stage or persist lessons.');
  editor.dispose();
  assert.equal(container.children.length, 0);
});

test('partial preview resumes actual inspected evidence and decision, but edited source resets the unpinned attempt', () => {
  const { workspace, campaign, project, lesson } = fixture(),
    { container } = surface();
  const selected = createStudioLessonSidecar(workspace.catalog, campaign.id).catalog.campaigns[0];
  const editor = createLessonEditor({
    container,
    getCampaign: () => selected,
    getProject: () => project,
    getLessons: () => [lesson],
    setLessons: () => assert.fail('Preview is read-only'),
  });
  editor.sync();
  const action = (name) => container.querySelector(`[data-lesson-action="${name}"]`);
  action('partial').click();
  container.querySelector('[data-control="inspect-new-situation"]').click();
  const decision = container.querySelector('[data-control="field-decision"]');
  decision.value = 'supported';
  decision.emit('change');
  action('resume').click();
  assert.equal(
    container.querySelector('[data-control="inspect-new-situation"]').getAttribute('aria-expanded'),
    'true',
  );
  assert.equal(container.querySelector('[data-control="field-decision"]').value, 'supported');
  container.querySelector('[data-control="commit"]').click();
  assert.equal(container.querySelector('[data-control="commit"]').disabled, true);
  container.querySelector('[data-lesson-field="revision"]').value = '2';
  action('resume').click();
  assert.equal(container.querySelector('[data-control="field-decision"]').value, '');
  assert.equal(
    container.querySelector('[data-control="inspect-new-situation"]').getAttribute('aria-expanded'),
    'false',
  );
  editor.dispose();
});

test('guided source edits reject invalid references and other missions without changing an applied lesson', () => {
  const { project, lesson } = fixture();
  assert.throws(
    () => stageStudioLesson([], { ...lesson, missionId: 'outside' }, project),
    /omitted/,
  );
  assert.throws(
    () =>
      stageStudioLesson(
        [],
        { ...lesson, sources: [{ title: 'Unsafe', url: 'javascript:alert(1)' }] },
        project,
      ),
    /HTTPS/,
  );
  const invalid = structuredClone(lesson);
  delete invalid.locales.uk.fields[0].options[1];
  assert.throws(() => stageStudioLesson([], invalid, project));
  assert.equal(lesson.revision, '1');
});

test('guided reflection conversion requires translated consequences and never creates a correct personal value', () => {
  const { workspace, campaign, project, lesson } = fixture(),
    { container } = surface();
  const selected = createStudioLessonSidecar(workspace.catalog, campaign.id).catalog.campaigns[0];
  let lessons = [lesson],
    writes = 0;
  const editor = createLessonEditor({
    container,
    getCampaign: () => selected,
    getProject: () => project,
    getLessons: () => lessons,
    setLessons: (value) => {
      lessons = value;
      writes++;
    },
  });
  editor.sync();
  const field = (path) => container.querySelector(`[data-lesson-field="${path}"]`);
  field('revision').value = '2';
  field('fixtureRevision').value = '2';
  field('kind').value = 'reflection';
  container.querySelector('[data-lesson-action="stage"]').click();
  assert.equal(writes, 0);
  for (const prefix of ['', 'locales.uk.'])
    for (let i = 0; i < 2; i++)
      field(`${prefix}fields.0.options.${i}.consequence`).value = prefix
        ? 'Обговоріть, як цей вибір впливає на вигадану ситуацію.'
        : 'Discuss how this choice affects the fictional situation.';
  container.querySelector('[data-lesson-action="stage"]').click();
  assert.equal(writes, 1);
  assert.equal(lessons[0].fields[0].expected, null);
  for (const mode of ['correct', 'wrong']) {
    const attempt = studioLessonPreviewAttempt(lessons[0], mode);
    assert.equal(attempt.status, 'complete');
    assert.equal(attempt.outcome, 'reflected');
  }
  editor.dispose();
});

test('an atlas without predictions can author a bounded application question without replacing its cards', () => {
  let draft = structuredClone(createExplorationExample());
  draft.recipe.predictions = [];
  const cards = structuredClone(draft.recipe.cards),
    { container } = surface();
  let writes = 0;
  const editor = createExplorationGuidedEditor({
    container,
    getDraft: () => draft,
    setDraft: (value) => {
      draft = value;
      writes++;
    },
  });
  editor.sync();
  const action = (name) => container.querySelector(`[data-exploration-guided-action="${name}"]`);
  action('add').click();
  action('stage').click();
  assert.equal(writes, 0, 'Blank prompts and an unchosen answer cannot be published.');
  for (const locale of ['en', 'uk']) {
    for (const key of ['prompt', 'explanation'])
      container.querySelector(
        `[data-exploration-guided-field="recipe.predictions.0.locales.${locale}.${key}"]`,
      ).value = `${locale}: Explain a different fictional fixture.`;
    for (let i = 0; i < 2; i++)
      for (const key of ['label', 'feedback'])
        container.querySelector(
          `[data-exploration-guided-field="recipe.predictions.0.choices.${i}.locales.${locale}.${key}"]`,
        ).value = `${locale}: Role ${i + 1}.`;
  }
  container.querySelector(
    '[data-exploration-guided-field="recipe.predictions.0.expectedChoiceId"]',
  ).value = 'choice-b';
  action('stage').click();
  assert.equal(writes, 1);
  assert.deepEqual(draft.recipe.cards, cards);
  assert.equal(draft.recipe.predictions[0].expectedChoiceId, 'choice-b');
  editor.dispose();
});

test('guided atlas changes objective, source and application feedback while preserving exact artwork and diagram pins', () => {
  let draft = structuredClone(createExplorationExample());
  draft.recipe.id = 'inspect-image-atlas';
  draft.recipe.diagram = {
    asset: { assetId: 'frame', sha256: 'a'.repeat(64) },
    locales: {
      en: { alt: 'Original fictional frame', caption: 'Concept drawing' },
      uk: { alt: 'Оригінальна вигадана рама', caption: 'Умовний малюнок' },
    },
    hotspots: [{ cardId: draft.recipe.cards[0].id, x: 0.25, y: 0.5 }],
  };
  const original = structuredClone(draft),
    { container } = surface();
  let writes = 0;
  const editor = createExplorationGuidedEditor({
    container,
    getDraft: () => draft,
    setDraft: (value) => {
      draft = value;
      writes++;
    },
    getLocale: () => 'uk',
  });
  editor.sync();
  const field = (name) => container.querySelector(`[data-exploration-guided-field="${name}"]`),
    stage = () => container.querySelector('[data-exploration-guided-action="stage"]').click();
  field('locales.en.intro').value = 'Compare a role, then apply it to a new civilian fixture.';
  field('recipe.predictions.0.locales.uk.prompt').value =
    'Яка роль потрібна для іншого вигаданого прикладу?';
  field('recipe.predictions.0.choices.0.locales.uk.feedback').value =
    'Це повторює спостереження; передавання все ще потрібне.';
  stage();
  assert.equal(writes, 1);
  assert.deepEqual(draft.recipe.diagram, original.recipe.diagram);
  assert.deepEqual(
    draft.recipe.cards.map((card) => card.sourceIds),
    original.recipe.cards.map((card) => card.sourceIds),
  );
  assert.equal(
    draft.recipe.predictions[0].choices[0].locales.uk.feedback,
    field('recipe.predictions.0.choices.0.locales.uk.feedback').value,
  );
  field('recipe.sources.0.url').value = 'https://user:secret@example.org/';
  stage();
  assert.equal(writes, 1);
  assert.match(container.textContent, /safe HTTPS/);
  draft = { ...draft, id: 'new-advanced-draft' };
  stage();
  assert.equal(writes, 1, 'A stale guided form cannot overwrite a new JSON draft.');
  editor.dispose();
  assert.equal(container.children.length, 0);
});
