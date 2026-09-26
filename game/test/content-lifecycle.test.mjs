import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyContent,
  discoverableContent,
  TEAM_CONTENT_ROUTES,
} from '../content-design/content-lifecycle.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import {
  normalizedGameplay,
  geometrySignature,
  duplicateGroups,
  contentInventoryHTML,
} from '../../scripts/content-inventory.mjs';

test('archival changes discovery without changing historical project, execution or slots', async () => {
  const previous = createAuthoredJourneyRoute('opening');
  const resolved = resolveContentJourney(previous.source, { mode: 'solo' });
  const before = structuredClone(previous);
  assert.equal(classifyContent({ family: 'journey', id: 'opening' }), 'archived');
  assert.equal(discoverableContent('archived'), false);
  assert.equal(discoverableContent('archived', { archive: true }), true);
  const recovered = await loadAuthoredJourneyRoute('opening');
  assert.deepEqual(recovered, before);
  assert.deepEqual(recovered.source, createOpeningCandidates({ artwork: true }));
  assert.equal(recovered.sessionKey, 'revealline.suspended.journey-opening.v1');
  assert.deepEqual(resolveContentJourney(recovered.source, { mode: 'solo' }), resolved);
  assert.equal(classifyContent({ family: 'journey', id: 'whole-spatial-v11' }), 'current');
});

test('code-owned policy cannot classify imports by a familiar name or expose compatibility records', () => {
  assert.equal(classifyContent({ family: 'classic', id: 'fpv-arcade', source: 'imported' }), null);
  assert.equal(
    classifyContent({ family: 'classic', id: 'fpv-arcade', source: 'archive' }),
    'archived',
  );
  assert.equal(
    classifyContent({
      family: 'classic',
      id: 'original-fpv-pressure-external',
      source: 'external',
    }),
    'archived',
  );
  assert.equal(
    classifyContent({ family: 'classic', id: 'homeward-skies', source: 'bundled' }),
    'current',
  );
  assert.equal(
    classifyContent({ family: 'compatibility', source: 'saved-dependency' }),
    'compatibility-only',
  );
  assert.equal(discoverableContent('compatibility-only', { archive: true, tooling: true }), false);
  assert.equal(classifyContent({ family: 'journey', id: 'https://untrusted.invalid' }), null);
  assert.equal(
    TEAM_CONTENT_ROUTES.find(({ id }) => id === 'team-trail-impact-originals-1').classification,
    'current',
  );
});

const level = {
  id: 'first',
  revision: '1',
  name: 'First',
  width: 72,
  height: 36,
  spawn: { x: 1, y: 0 },
  walls: [],
  goal: { coverage: 0.5 },
  enemies: [{ id: 'keeper', type: 'bouncer', x: 20, y: 10, vx: 1, vy: 1 }],
  rules: { lives: 3, timeLimitSeconds: 0 },
  encounter: { targetId: 'keeper' },
};
test('comparison ignores reskin identities while retaining mechanics, timings and entity references', () => {
  const renamed = structuredClone(level);
  Object.assign(renamed, {
    id: 'second',
    revision: '2',
    name: 'New picture',
    themeId: 'new-theme',
  });
  renamed.enemies[0].id = 'renamed-keeper';
  renamed.encounter.targetId = 'renamed-keeper';
  assert.deepEqual(normalizedGameplay(level), normalizedGameplay(renamed));
  for (const change of [
    (value) => {
      value.rules.timeLimitSeconds = 30;
    },
    (value) => {
      value.enemies[0].vx = 2;
    },
    (value) => {
      value.goal.coverage = 0.7;
    },
    (value) => {
      value.encounter.targetId = 'different-target';
    },
  ]) {
    const altered = structuredClone(level);
    change(altered);
    assert.notDeepEqual(normalizedGameplay(level), normalizedGameplay(altered));
    assert.equal(
      geometrySignature(level),
      geometrySignature(altered),
      'Static geometry is only a suspected match.',
    );
  }
  assert.deepEqual(level.enemies[0].id, 'keeper', 'Comparison must not modify identities.');
});

test('image duplication separates mode owners from historical route reuse', () => {
  const owners = [
    { id: 'solo/current/a', route: 'current', art: 'same' },
    { id: 'versus/current/a', route: 'current', art: 'same' },
  ];
  assert.equal(duplicateGroups(owners, (row) => row.art).length, 1);
  assert.equal(
    duplicateGroups(owners, (row) => row.art, { distinct: (row) => row.route }).length,
    0,
  );
  assert.equal(
    duplicateGroups(
      [...owners, { id: 'solo/old/a', route: 'old', art: 'same' }],
      (row) => row.art,
      { distinct: (row) => row.route },
    ).length,
    1,
  );
});

test('report escapes source labels and marks findings as unapproved', () => {
  const report = {
    summary: { label: '<script>bad</script>' },
    artwork: [],
    missions: [],
    boards: [],
    classicPresentations: [],
    comparisons: {
      classicSharedOriginals: [],
      authoredRevisionReuse: [],
      currentSharedOriginals: [],
      currentIdenticalGameplay: [],
      currentSimilarGeometry: [],
    },
    method: { limitations: ['Pending review.'] },
  };
  const html = contentInventoryHTML(report);
  assert(!html.includes('<script>'));
  assert(html.includes('&lt;script&gt;'));
  assert(html.includes('not a uniqueness approval'));
});
