import { canonicalJSON, dataIdentity, required } from '../../game/data-json.mjs';
import { validateEditionRuntimeCatalog } from '../../game/editions/model.mjs';
import { validateEditionLessonBundle } from '../../game/editions/project.mjs';
import {
  createLearningAttempt,
  reduceLearningAttempt,
  validateCompanyLesson,
  validateCompanyLessons,
} from '../../game/company-campaigns/learning.mjs';
import { declaredJSONPaths } from './model.mjs';

/** Explicit source addition; callers publish catalog and empty file together. */
export function createStudioLessonSidecar(input, campaignId) {
  const catalog = structuredClone(validateEditionRuntimeCatalog(input));
  const campaign = catalog.campaigns.find((item) => item.id === campaignId);
  required(campaign, 'Choose an existing campaign.');
  required(!campaign.lessonPath, 'This campaign already has a lesson sidecar.');
  const path = campaign.sourcePath.replace(/\.json$/, '.lessons.json');
  required(!declaredJSONPaths(catalog).includes(path), 'This lesson path is already declared.');
  campaign.lessonPath = path;
  for (const edition of catalog.editions.filter((item) => item.campaignIds.includes(campaignId)))
    edition.revision++;
  return { catalog: validateEditionRuntimeCatalog(catalog), path, lessons: [] };
}

/** Empty source fields intentionally require an author's real reference before validation. */
export function createStudioLessonDraft(campaignId, missionId) {
  return {
    format: 'revealline-learning-lesson.v1',
    id: `${missionId.slice(0, 50)}-application-${dataIdentity({ campaignId, missionId }).slice(0, 12)}`,
    campaignId,
    missionId,
    revision: '1',
    fixtureRevision: '1',
    kind: 'practice',
    title: '',
    role: '',
    brief: '',
    notice: '',
    success: '',
    sourceReviewedAt: '',
    sources: [{ title: '', url: '' }],
    records: [
      { id: 'example', title: '', lines: [''] },
      { id: 'new-situation', title: '', lines: [''] },
    ],
    fields: [
      {
        id: 'decision',
        label: '',
        expected: 'supported',
        explanation: '',
        options: [
          { value: 'supported', label: '' },
          { value: 'alternative', label: '' },
        ],
      },
    ],
    locales: {
      uk: {
        title: '',
        role: '',
        brief: '',
        notice: '',
        success: '',
        records: [
          { id: 'example', title: '', lines: [''] },
          { id: 'new-situation', title: '', lines: [''] },
        ],
        fields: [
          {
            id: 'decision',
            label: '',
            explanation: '',
            options: [
              { value: 'supported', label: '' },
              { value: 'alternative', label: '' },
            ],
          },
        ],
      },
    },
  };
}

export function validateStudioLessonRevisions(previous, next) {
  for (const lesson of next) {
    const before = previous.find((item) => item.id === lesson.id);
    if (before && canonicalJSON(before) !== canonicalJSON(lesson)) {
      required(
        before.revision !== lesson.revision && before.fixtureRevision !== lesson.fixtureRevision,
        'Changed teaching content needs a new lesson revision and fixture revision. Existing attempts remain tied to their original fixture.',
      );
    }
  }
}

export function stageStudioLesson(previous, draft, project) {
  const lessons = validateCompanyLessons(previous),
    lesson = validateCompanyLesson(draft);
  const before = lessons.find((item) => item.missionId === lesson.missionId);
  required(
    !before || before.id === lesson.id,
    'Keep an existing lesson identity when editing its mission.',
  );
  const next = validateCompanyLessons([
    ...lessons.filter((item) => item.missionId !== lesson.missionId),
    lesson,
  ]);
  validateEditionLessonBundle(next, project);
  validateStudioLessonRevisions(lessons, next);
  return next;
}

/** Store-free, unpinned attempts exercise the real verifier. Never accepted Journey evidence. */
export function studioLessonPreviewAttempt(input, mode = 'partial') {
  const lesson = validateCompanyLesson(input);
  required(['partial', 'correct', 'wrong'].includes(mode), 'Unknown lesson preview.');
  let attempt = createLearningAttempt(lesson, {
    attemptId: `${lesson.id.slice(0, 60)}-studio-preview`,
  });
  for (const record of mode === 'partial' ? lesson.records.slice(0, 1) : lesson.records)
    attempt = reduceLearningAttempt(lesson, attempt, { type: 'inspect', recordId: record.id });
  if (mode === 'partial') return attempt;
  for (const field of lesson.fields) {
    const option =
      lesson.kind === 'reflection'
        ? field.options[mode === 'wrong' ? 1 : 0]
        : field.options.find((item) =>
            mode === 'wrong' ? item.value !== field.expected : item.value === field.expected,
          );
    attempt = reduceLearningAttempt(lesson, attempt, {
      type: 'configure',
      fieldId: field.id,
      value: option.value,
    });
  }
  return reduceLearningAttempt(lesson, attempt, { type: 'commit' });
}
