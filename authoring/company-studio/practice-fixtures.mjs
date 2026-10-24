import { freezeDesign } from '../../game/content-design/catalogs.mjs';
import { validateCompanyLesson } from '../../game/company-campaigns/learning.mjs';

/** Neutral authoring example, independent of any published community. */
export const PRACTICE_FIXTURES = freezeDesign([{
  id: 'practice-open-bridge',
  lesson: validateCompanyLesson({
    format: 'revealline-learning-lesson.v1',
    id: 'practice-open-bridge-lesson', revision: '1', fixtureRevision: '1',
    missionId: 'practice-open-bridge', campaignId: 'authoring-examples',
    title: 'Read the bridge notice', role: 'Route planner', kind: 'practice',
    brief: 'Choose an available crossing using the fictional notice below.',
    notice: 'An offline authoring example. No real journey, campaign progress or certification.',
    sourceReviewedAt: '2026-10-19',
    sources: [{ title: 'Fictional authoring example', url: 'https://example.test/bridge-notice' }],
    records: [{ id: 'bridge-notice', title: 'Bridge notice', lines: [
      'The north bridge is open to visitors today.',
      'The south bridge is closed for maintenance.',
    ] }],
    fields: [{ id: 'crossing', label: 'Available crossing', expected: 'north',
      explanation: 'The notice says the north bridge is open; the south bridge is closed.',
      options: [{ value: 'north', label: 'North bridge' }, { value: 'south', label: 'South bridge' }],
    }],
    success: 'The open crossing was selected from the notice.',
  }),
}]);

/** Participant exports omit the answer, feedback and completion copy. */
export function practiceTask(id) {
  const fixture = PRACTICE_FIXTURES.find(entry => entry.id === id);
  if (!fixture) throw new TypeError('Unknown authoring practice task.');
  const { title, role, brief, notice, records, fields, kind } = fixture.lesson;
  return freezeDesign({ id, title, role, brief, notice, records, kind,
    fields: fields.map(({ id, label, options }) => ({
      id, label, options: options.map(({ value, label }) => ({ value, label })),
    })),
  });
}
