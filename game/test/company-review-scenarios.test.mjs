import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  reviewScenario,
  reviewSessionSummary,
} from '../../docs/verification/company-review-model.mjs';

test('company review scenarios are bounded and present in the passive review UI', async () => {
  assert.equal(reviewScenario('advanced-encounter'), 'advanced-encounter');
  assert.throws(() => reviewScenario('approved'));
  const html = await readFile(
    new URL('../../docs/verification/company-review.html', import.meta.url),
    'utf8',
  );
  for (const value of ['opening-play', 'advanced-encounter', 'picture-reveal', 'edition-switch'])
    assert.match(html, new RegExp(`<option value="${value}">`));
  assert.match(html, /id="summary">Record session summary/);
});

test('company review summaries count only ready target transitions and completed samples', () => {
  assert.deepEqual(
    reviewSessionSummary([
      {
        action: 'Load to company menu',
        ms: 100,
        target: 'http://localhost/game/index.html?edition=coupa-all',
      },
      {
        action: 'Frame intervals',
        scenario: 'advanced-encounter',
        frames: 100,
      },
      {
        action: 'Load to company menu',
        target: 'http://localhost/game/index.html?edition=timed-out',
        outcome: 'Timed out; no readiness timing observation',
      },
      {
        action: 'Load to company menu',
        ms: 120,
        target: 'http://localhost/game/index.html?edition=droneaid-nl-community',
      },
    ]),
    {
      readyLoads: 2,
      distinctTargets: 2,
      targetTransitions: 1,
      frameSamples: 1,
      frameSamplesByScenario: {
        'opening-play': 0,
        'advanced-encounter': 1,
        'picture-reveal': 0,
        'edition-switch': 0,
      },
    },
  );
  assert.throws(() => reviewSessionSummary(Array.from({ length: 101 }, () => ({}))));
});
