import { canonicalJSON } from '../../game/data-json.mjs';
import {
  validateCompanyLesson,
  validateCompanyLessons,
} from '../../game/company-campaigns/learning.mjs';
import { mountCompanyWorkbench } from '../../game/company-campaigns/workbench.mjs';
import { guidedFields } from '../../game/studio/guided-fields.mjs';
import {
  createStudioLessonDraft,
  stageStudioLesson,
  studioLessonPreviewAttempt,
} from './lesson-authoring.mjs';

const COPY = {
  en: {
    title: 'Guided learning fixture',
    mission: 'Mission',
    empty: 'Add the lesson sidecar to begin.',
    help: 'Explain an objective, provide evidence and a different application situation, then author a decision and its feedback in both languages. Nothing here earns progress. Stage updates the advanced JSON draft; Apply publishes the source edit.',
    new: 'New lesson for this mission',
    stage: 'Stage lesson draft',
    partial: 'Preview incomplete work',
    wrong: 'Preview a wrong / alternative choice',
    correct: 'Preview supported / reflective completion',
    resume: 'Resume current preview',
    titleField: 'Title',
    role: 'Player role',
    brief: 'Objective and later application',
    notice: 'Fictional fixture / safety / limits',
    success: 'Completion feedback',
    evidence: 'Evidence / worked example / different situation',
    lines: 'Evidence lines (one per line)',
    label: 'Decision',
    explanation: 'Corrective explanation',
    choice: 'Choice',
    consequence: 'Reflection consequence',
    expected: 'Supported choice',
    revision: 'Lesson revision',
    fixtureRevision: 'Fixture revision',
    date: 'Source review date (YYYY-MM-DD)',
    sourceTitle: 'Source title',
    url: 'Source URL',
    kind: 'Interaction',
    practice: 'Evidence-based practice',
    reflection: 'Unscored reflection',
    staged: 'Validated lesson staged. Apply the lesson JSON to include it in export.',
    preview:
      'Local preview only. Inspect, configure and commit using the player workbench. Resume keeps this preview attempt; reload, selection or source edits discard it.',
    stale: 'The selected source changed. Reload it before staging guided fields.',
  },
  uk: {
    title: 'Керований навчальний приклад',
    mission: 'Місія',
    empty: 'Спочатку додайте файл уроків.',
    help: 'Поясніть мету, наведіть свідчення й іншу ситуацію застосування, потім сформулюйте рішення та відгук обома мовами. Тут немає ігрового прогресу. Підготовка змінює чернетку JSON; застосування зберігає зміни джерела.',
    new: 'Новий урок для цієї місії',
    stage: 'Підготувати чернетку уроку',
    partial: 'Переглянути незавершену роботу',
    wrong: 'Переглянути хибний / інший вибір',
    correct: 'Переглянути обґрунтоване завершення / рефлексію',
    resume: 'Продовжити поточний перегляд',
    titleField: 'Назва',
    role: 'Роль гравця',
    brief: 'Мета й подальше застосування',
    notice: 'Вигаданий приклад / безпека / межі',
    success: 'Відгук після завершення',
    evidence: 'Свідчення / пояснений приклад / інша ситуація',
    lines: 'Рядки свідчень (один на рядок)',
    label: 'Рішення',
    explanation: 'Коригувальне пояснення',
    choice: 'Варіант',
    consequence: 'Наслідок для рефлексії',
    expected: 'Обґрунтований варіант',
    revision: 'Редакція уроку',
    fixtureRevision: 'Редакція прикладу',
    date: 'Дата перевірки джерела (РРРР-ММ-ДД)',
    sourceTitle: 'Назва джерела',
    url: 'URL джерела',
    kind: 'Взаємодія',
    practice: 'Практика на основі свідчень',
    reflection: 'Рефлексія без оцінювання',
    staged:
      'Перевірений урок додано до чернетки. Застосуйте JSON уроків, щоб включити його в експорт.',
    preview:
      'Лише локальний перегляд. Досліджуйте, обирайте та підтверджуйте в ігровій майстерні. Продовження зберігає цю спробу; перезавантаження, інша місія або зміни джерела скидають її.',
    stale: 'Вибране джерело змінилося. Завантажте його знову перед підготовкою полів.',
  },
};

export function createLessonEditor({
  container,
  getCampaign,
  getProject,
  getLessons,
  setLessons,
  getLocale = () => 'en',
}) {
  const root = container.ownerDocument.createElement('fieldset');
  root.setAttribute('data-lesson-editor', 'true');
  container.append(root);
  let active = true,
    missionId = '',
    viewer = null,
    attempt = null,
    previewIdentity = null;
  const stop = () => {
    viewer?.destroy();
    viewer = null;
  };
  function sync() {
    if (!active) return;
    stop();
    attempt = null;
    previewIdentity = null;
    root.replaceChildren();
    const copy = COPY[getLocale()] ?? COPY.en,
      form = guidedFields(root, 'lesson');
    root.append(form.node('legend', copy.title), form.node('p', copy.help));
    const campaign = getCampaign(),
      project = getProject();
    if (!campaign?.lessonPath || !project) {
      root.append(form.node('p', copy.empty));
      return;
    }
    let lessons;
    try {
      lessons = validateCompanyLessons(getLessons());
    } catch (error) {
      root.append(form.node('p', error.message));
      return;
    }
    if (!project.missions.some((mission) => mission.id === missionId))
      missionId = project.missions[0]?.id ?? '';
    const selectLabel = form.node('label', copy.mission),
      select = form.node('select');
    select.setAttribute('data-lesson-mission', 'true');
    for (const mission of project.missions) {
      const option = form.node('option', mission.name);
      option.value = mission.id;
      select.append(option);
    }
    select.value = missionId;
    select.onchange = () => {
      missionId = select.value;
      sync();
    };
    selectLabel.append(select);
    root.append(selectLabel);
    let base = canonicalJSON(lessons),
      draft = structuredClone(
        lessons.find((item) => item.missionId === missionId) ??
          createStudioLessonDraft(campaign.id, missionId),
      );
    const status = form.node('p'),
      preview = form.node('div');
    status.setAttribute('role', 'status');
    const buttons = [];
    function button(action, handler) {
      const value = form.node('button', copy[action]);
      value.type = 'button';
      value.setAttribute('data-lesson-action', action);
      value.onclick = () => {
        if (!active) return;
        try {
          handler();
        } catch (error) {
          status.textContent = error.message;
        }
      };
      buttons.push(value);
      return value;
    }
    for (const key of ['revision', 'fixtureRevision'])
      form.field(root, copy[key], [key], draft[key]);
    form.field(root, copy.date, ['sourceReviewedAt'], draft.sourceReviewedAt);
    const kind = form.field(root, copy.kind, ['kind'], draft.kind, {
      options: ['practice', 'reflection'].map((value) => ({ value, label: copy[value] })),
    });
    // Changing interaction type needs rebuilding its bounded choices, not silently
    // assigning a correct value to a reflection. Stage performs this conversion.
    if (!draft.locales?.uk)
      draft.locales = {
        uk: {
          title: '',
          role: '',
          brief: '',
          notice: '',
          success: '',
          records: draft.records.map((record) => ({ id: record.id, title: '', lines: [''] })),
          fields: draft.fields.map((field) => ({
            id: field.id,
            label: '',
            explanation: '',
            options: field.options.map((option) => ({
              value: option.value,
              label: '',
              ...(draft.kind === 'reflection' ? { consequence: '' } : {}),
            })),
          })),
        },
      };
    for (const locale of ['en', 'uk']) {
      const prefix = locale === 'en' ? [] : ['locales', 'uk'],
        localized = locale === 'en' ? draft : draft.locales.uk;
      const group = form.node('fieldset');
      group.append(form.node('legend', locale.toUpperCase()));
      for (const key of ['title', 'role', 'brief', 'notice', 'success'])
        form.field(
          group,
          copy[key === 'title' ? 'titleField' : key],
          [...prefix, key],
          localized[key],
          { lines: ['brief', 'notice', 'success'].includes(key) },
        );
      for (const [i, record] of localized.records.entries()) {
        const section = form.node('fieldset');
        section.append(form.node('legend', `${copy.evidence} · ${record.id}`));
        form.field(section, copy.titleField, [...prefix, 'records', i, 'title'], record.title);
        form.field(section, copy.lines, [...prefix, 'records', i, 'lines'], record.lines, {
          lines: true,
        });
        group.append(section);
      }
      for (const [i, field] of localized.fields.entries()) {
        const section = form.node('fieldset');
        section.append(form.node('legend', field.id));
        form.field(section, copy.label, [...prefix, 'fields', i, 'label'], field.label);
        form.field(
          section,
          copy.explanation,
          [...prefix, 'fields', i, 'explanation'],
          field.explanation,
          { lines: true },
        );
        for (const [j, option] of field.options.entries()) {
          form.field(
            section,
            `${copy.choice} · ${option.value}`,
            [...prefix, 'fields', i, 'options', j, 'label'],
            option.label,
          );
          form.field(
            section,
            `${copy.consequence} · ${option.value}`,
            [...prefix, 'fields', i, 'options', j, 'consequence'],
            option.consequence ?? '',
            { lines: true },
          );
        }
        group.append(section);
      }
      root.append(group);
    }
    for (const [i, field] of draft.fields.entries())
      form.field(
        root,
        `${field.id} · ${copy.expected}`,
        ['fields', i, 'expected'],
        field.expected ?? field.options[0].value,
        { options: field.options.map((option) => ({ value: option.value, label: option.value })) },
      );
    for (const [i, source] of draft.sources.entries()) {
      form.field(root, copy.sourceTitle, ['sources', i, 'title'], source.title);
      form.field(root, copy.url, ['sources', i, 'url'], source.url);
    }
    const read = () => {
      const next = form.read(structuredClone(draft));
      for (const language of [next, next.locales.uk])
        for (const field of language.fields) {
          if (language === next && kind.value === 'reflection') field.expected = null;
          if (kind.value === 'practice')
            for (const option of field.options) delete option.consequence;
        }
      return validateCompanyLesson(next);
    };
    button('stage', () => {
      if (
        getCampaign() !== campaign ||
        getProject() !== project ||
        canonicalJSON(getLessons()) !== base
      )
        throw new Error(copy.stale);
      const next = stageStudioLesson(lessons, read(), project);
      setLessons(next);
      lessons = next;
      base = canonicalJSON(next);
      draft = structuredClone(next.find((item) => item.missionId === missionId));
      stop();
      attempt = null;
      preview.replaceChildren();
      status.textContent = copy.staged;
    });
    for (const mode of ['partial', 'wrong', 'correct', 'resume'])
      button(mode, () => {
        const lesson = read(),
          identity = canonicalJSON(lesson);
        if (mode !== 'resume' || previewIdentity !== identity || !attempt)
          attempt = studioLessonPreviewAttempt(lesson, mode === 'resume' ? 'partial' : mode);
        stop();
        previewIdentity = identity;
        viewer = mountCompanyWorkbench(preview, {
          lesson,
          attempt,
          onChange(value) {
            attempt = value;
          },
          onClose() {
            stop();
            preview.replaceChildren();
          },
        });
        status.textContent = copy.preview;
      });
    root.append(...buttons, status, preview);
  }
  return {
    sync,
    suspend: stop,
    dispose() {
      active = false;
      stop();
      root.remove();
    },
  };
}
