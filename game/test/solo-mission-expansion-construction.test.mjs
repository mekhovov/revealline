import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { TEAM_EXPANSION_ROUTE } from '../content-design/multiplayer-expansion.mjs';
import { teamJourneyLibraryOwner } from '../mission-library/team-source.mjs';
import { createRemoteTeamLibrarySources } from '../mission-library/remote-team.mjs';
import {
  duelExpeditionLibrarySources,
  teamExpeditionLibrarySource,
} from '../mission-library/multiplayer-expeditions.mjs';

const appSource = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const start = appSource.indexOf('const expansionSources = [');
const end = appSource.indexOf('\n        }\n        const classicProjectionCache', start);
assert.ok(start > 0 && end > start, 'Use the actual Solo expansion assembly.');
assert.equal(appSource.indexOf('const expansionSources = [', start + 1), -1);
const assemble = new Function(
  'journeySources',
  'duelExpeditionLibrarySources',
  'teamExpeditionLibrarySource',
  'teamJourneyLibraryOwner',
  'TEAM_EXPANSION_ROUTE',
  'originalThemes',
  'route',
  'departLibraryMission',
  'browsingJourneyPreferences',
  `${appSource.slice(start, end)}\nreturn journeySources;`,
);
const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
);

function construct(existing, launch, preferences) {
  const teamCalls = [],
    duelCalls = [];
  const sources = assemble(
    existing,
    (options) => {
      const sources = duelExpeditionLibrarySources(options);
      duelCalls.push({ options, sources });
      return sources;
    },
    (options) => {
      const source = teamExpeditionLibrarySource(options);
      teamCalls.push({ options, source });
      return source;
    },
    teamJourneyLibraryOwner,
    TEAM_EXPANSION_ROUTE,
    themes,
    { id: DEFAULT_JOURNEY_ROUTES.solo },
    launch,
    preferences,
  );
  return { sources, teamCalls, duelCalls };
}

test('actual Solo expansion assembly retains the existing Team owner without rebuilding it', () => {
  let difficulty = 'standard',
    received;
  const launch = (context) => (received = context);
  const preferences = { snapshot: () => ({ difficulty }) };
  const existing = createRemoteTeamLibrarySources({ launch, difficulty: () => difficulty });
  const ownerId = teamJourneyLibraryOwner(TEAM_EXPANSION_ROUTE);
  const retained = existing.find((source) => source.id === ownerId);
  assert.ok(retained, 'The actual remote Team constructor already supplies this owner.');
  const { sources, teamCalls, duelCalls } = construct(existing, launch, preferences);
  assert.equal(teamCalls.length, 0, 'Do not construct a validated owner only to discard it.');
  assert.equal(duelCalls.length, 1);
  const expected = [
    ...existing,
    ...duelCalls[0].sources.filter((source) => !existing.some((row) => row.id === source.id)),
  ];
  assert.equal(sources.length, expected.length);
  sources.forEach((source, index) => assert.equal(source === expected[index], true));
  const matching = sources.filter((source) => source.id === ownerId);
  assert.equal(matching.length, 1);
  assert.equal(matching[0] === retained, true);
  assert.equal(duelCalls[0].options.launch, launch);
  difficulty = 'expert';
  assert.equal(duelCalls[0].options.difficulty(), 'expert');
  const context = { mode: 'team', libraryMissionId: 'retained-owner-handoff' };
  retained.launch(retained.entries[0], context);
  assert.equal(received, context, 'The original owner still delegates the exact handoff.');
});

test('actual Solo expansion assembly constructs the Team fallback unless its exact owner exists', () => {
  let difficulty = 'standard',
    received;
  const launch = (context) => (received = context);
  const preferences = { snapshot: () => ({ difficulty }) };
  const first = construct([], launch, preferences);
  assert.equal(first.teamCalls.length, 1);
  assert.equal(first.duelCalls.length, 1);
  const built = first.teamCalls[0].source;
  assert.equal(built.id, teamJourneyLibraryOwner(TEAM_EXPANSION_ROUTE));
  assert.equal(first.sources.at(-1) === built, true, 'The fallback preserves source order.');
  assert.equal(first.teamCalls[0].options.launch, launch);
  difficulty = 'expert';
  assert.equal(first.teamCalls[0].options.difficulty(), 'expert');
  const context = { mode: 'team', libraryMissionId: 'fallback-owner-handoff' };
  built.launch(built.entries[0], context);
  assert.equal(received, context);

  const other = { ...built, id: 'another-team-owner' };
  const second = construct([other], launch, preferences);
  assert.equal(other.editionId, TEAM_EXPANSION_ROUTE);
  assert.equal(second.teamCalls.length, 1, 'An edition label alone is not the same owner.');
  assert.equal(second.sources[0] === other, true);
  assert.equal(second.sources.at(-1) === second.teamCalls[0].source, true);
  assert.equal(second.teamCalls[0].source.id, built.id);
});
