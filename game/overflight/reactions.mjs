/** Stable shared Voice Studio entries. Missing recordings use the existing
 * caption path; these entries never synthesize speech or claim a recorded voice. */
export const OVERFLIGHT_REACTION_FAMILIES = Object.freeze({
  'overflight.upgraded': 'overflight-upgrade',
  'overflight.evolved': 'overflight-evolution',
  'overflight.cleared': 'overflight-clear',
  'overflight.replaced': 'overflight-handoff',
});
export const OVERFLIGHT_REACTION_LINES = Object.freeze(
  [
    [
      'upgrade',
      'overflight-upgrade',
      'New pattern. Try it on your next pass.',
      'Нова схема удару. Спробуй її на наступному прольоті.',
    ],
    [
      'evolution',
      'overflight-evolution',
      'The pattern has evolved. Make room for a wider pass.',
      'Схема удару змінилася. Знайди місце для ширшого прольоту.',
    ],
    [
      'clear',
      'overflight-clear',
      'A group cleared. Salvage is on the ground.',
      'Групу знищено. На землі залишилися трофеї.',
    ],
    [
      'handoff',
      'overflight-handoff',
      'Replacement airborne. Your modules are still with you.',
      'Новий борт у повітрі. Твої модулі збережено.',
    ],
    [
      'lost',
      'result',
      'No airframes remain. The sortie is over.',
      'Бортів більше немає. Виліт завершено.',
    ],
  ].map(([id, family, en, uk]) =>
    Object.freeze({
      id: `overflight-reaction.v1/${id}`,
      speaker: 'engineer',
      family,
      text: Object.freeze({ en, uk }),
    }),
  ),
);
