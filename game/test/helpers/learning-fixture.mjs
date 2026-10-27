import { validateCompanyLesson } from '../../company-campaigns/learning.mjs';

/** Synthetic engine fixture. No production community content is required. */
export function learningFixture(overrides = {}) {
  return validateCompanyLesson({
    format: 'revealline-learning-lesson.v1',
    id: 'sample-route-reflection',
    revision: '1',
    fixtureRevision: '1',
    missionId: 'sample-route',
    campaignId: 'sample-campaign',
    title: 'Read the route card',
    role: 'Reader',
    brief: 'Choose how to examine a fictional route card.',
    kind: 'reflection',
    notice: 'Synthetic test data; no production lesson or scored assessment.',
    sourceReviewedAt: '2026-10-19',
    sources: [{ title: 'Synthetic route card', url: 'https://example.test/route-card' }],
    records: [{ id: 'route-card', title: 'Route card', lines: ['Two routes reach the same marker.'] }],
    fields: [{
      id: 'approach', label: 'Reading approach', expected: null,
      explanation: 'Either reading order is accepted.',
      options: [
        { value: 'map', label: 'Start with the map', consequence: 'The map shows the two paths.' },
        { value: 'note', label: 'Start with the note', consequence: 'The note explains their shared destination.' },
      ],
    }],
    success: 'Reading approach recorded.',
    locales: { uk: {
      title: 'Прочитайте картку маршруту', role: 'Читач',
      brief: 'Виберіть спосіб перегляду вигаданої картки маршруту.',
      notice: 'Синтетичні тестові дані; вправа не оцінюється.',
      success: 'Спосіб читання збережено.',
      records: [{ id: 'route-card', title: 'Картка маршруту', lines: ['Два шляхи ведуть до одного маркера.'] }],
      fields: [{ id: 'approach', label: 'Спосіб читання', explanation: 'Обидва способи прийнятні.', options: [
        { value: 'map', label: 'Почніть із мапи', consequence: 'Мапа показує два шляхи.' },
        { value: 'note', label: 'Почніть із нотатки', consequence: 'Нотатка пояснює спільну ціль.' },
      ] }],
    } },
    ...overrides,
  });
}

/** A scored synthetic lesson for proof/replay tests. */
export function scoredLearningFixture(overrides = {}) {
  const base = structuredClone(learningFixture());
  delete base.locales;
  return validateCompanyLesson({
    ...base,
    kind: 'practice',
    notice: 'Synthetic route-card exercise; no real-world assessment.',
    fields: [{ id: 'crossing', label: 'Open crossing', expected: 'north',
      explanation: 'The fictional route card marks the north crossing open.',
      options: [{ value: 'north', label: 'North crossing' }, { value: 'south', label: 'South crossing' }],
    }],
    records: [{ id: 'route-card', title: 'Route card', lines: ['North crossing: open.', 'South crossing: closed.'] }],
    ...overrides,
  });
}
