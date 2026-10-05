import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';
import {
  pursuitPilotCases,
  verifyPursuitPilotRecording,
} from '../../scripts/qualify-pursuit-pilots.mjs';

// Fixed legal-input completion routes for the authored v3 pilots at seed 17.
// Discovered with a deterministic search using public turn/step operations;
// only these input strings are replayed here. No actor, objective, body, RNG,
// phase, pickup or score is injected. These are not human play qualifications.
// Each letter is the heading for one native movement transaction.
const DIRECTIONS = { U: 'up', R: 'right', D: 'down', L: 'left' };
const PILOTS = [
  {
    id: 'classic-living-cable-cutoff',
    identities: {
      slow: '9ac9b4fc11c9019a',
      normal: '98540ea87137165a',
      fast: '4af520f4d549f2ca',
    },
    goal: 12,
    solo: {
      routes: [
        'DDLLLDRRRDDDDDDRRRRRDRRRURUUUUURRRRRRDDDDDDDDLLLLLUUULLLLLLLLLLUUUUUULLULDDRRDRDDDDRRRRRRRRRRDDDRDLLULLUUURRUUUUUUULLUUURUR',
      ],
      contributions: [12],
      turns: 40,
    },
    team: {
      routes: [
        'DDLLLDRRRDDDDDDRRRDRRRRRRDDDRRRRDLLLUUUUULLLLLLLLLLUUUUUULLLLDRRRRUUURRRRRRRRRRRRRRDLLLLUUUUL',
        'ULLLUUUUUULLLLLLDDDRRRRRRDDDRRRRRDDDLUULDLUULLUULLLLLLLLULLULDDRURRRRRRRRRRDDDRDLLULLUUURRUUU',
      ],
      contributions: [7, 5],
      turns: 59,
    },
  },
  {
    id: 'classic-living-shield-window',
    identities: {
      slow: 'd85d9fe5948c871f',
      normal: 'eecbb3c52c29c67f',
      fast: 'c7a37efef2a89fbb',
    },
    goal: 8,
    solo: {
      routes: [
        'RRRRRRRRRRRRRDDDDDRRDRDDRDDRDLLUUUUUUUUUULLLLLLLLLLLLULLDRDRRRDDDRDDDDDDRRDRRUUULLUUUUUUULLLLLLULDDRRRRRDDDDDDDDDDDLUUUUUUUUUUUUUULLLLLLULL',
      ],
      contributions: [8],
      turns: 38,
    },
    team: {
      routes: [
        'RRRRRRRRRRRRRRRDDLULLLLLLLLLLLULDDRRRRDDDDDDDDDDDRDLLUUUUUUUUUUUULULDDRRDRDDDDDDLUUUUUUUUUULLLLLULL',
        'UUUUUUUURRDRDDDDLDLUUUUUUUUULLULDDLLDDDDDDDLDLDRRRRUUULLUUUUUUULLULDDRDDDDDDDDDDDLUUULLUULLLUUUUUUU',
      ],
      contributions: [4, 4],
      turns: 61,
    },
  },
];
const cases = pursuitPilotCases().filter((entry) => entry.family === 'snake');
const paces = { slow: 280, normal: 200, fast: 150 };

function inputStep(match, routes, step) {
  for (const [seat, route] of routes.entries()) {
    const board = match.options.mode === 'versus' ? seat : 0;
    const player = match.options.mode === 'team' ? seat : 0;
    const direction = DIRECTIONS[route[step]];
    assert.ok(direction, `Missing legal direction for seat ${seat}, step ${step}`);
    if (direction !== match.runs[board].snakes[player].direction)
      assert.equal(queueClassicSnakeMatchTurn(match, seat, direction), true);
  }
  advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match));
  for (const run of match.runs)
    assert.notEqual(run.status, 'lost', `Step ${step + 1}: ${run.failure?.cause}`);
}

for (const pilot of PILOTS)
  for (const mode of ['solo', 'versus', 'team'])
    for (const [pace, stepMs] of Object.entries(paces))
      test(`${pilot.id}: authored ${mode}/${pace}/seed17 has a legal verified completion route`, async () => {
        const entry = cases.find(
          (row) => row.pilot === pilot.id && row.mode === mode && row.pace === pace,
        );
        assert.ok(entry, 'The route must remain a declared pilot case.');
        const accepted = structuredClone(entry.level);
        assert.equal(accepted.version, 'classic-snake-level.v3');
        assert.equal(accepted.revision, '1');
        assert.equal(accepted.goal, pilot.goal);
        assert.equal(accepted.stepMs, stepMs);
        assert.equal(accepted.minStepMs, stepMs);
        assert.equal(entry.seed, 17);
        const fixture = mode === 'team' ? pilot.team : pilot.solo;
        const routes = mode === 'versus' ? [fixture.routes[0], fixture.routes[0]] : fixture.routes;
        const steps = routes[0].length;
        assert.ok(routes.every((route) => route.length === steps));
        let match = createClassicSnakeMatch(accepted, { mode, seed: entry.seed });
        assert.equal(match.runs[0].levelIdentity, pilot.identities[pace]);
        if (mode === 'versus') assert.deepEqual(match.runs[0], match.runs[1]);
        for (let step = 0; step < steps; step++) {
          assert.equal(match.status, 'running');
          inputStep(match, routes, step);
          if (step === Math.floor(steps / 2)) {
            // A real in-progress journal must reconstruct both bodies, target
            // headings/phases and the accepted seed before this route continues.
            const restored = restoreClassicSnakeMatch(exportClassicSnakeMatch(match), {
              level: accepted,
            });
            assert.deepEqual(restored, match);
            match = restored;
          }
        }
        assert.equal(match.status, 'finished');
        assert.equal(match.result, mode === 'versus' ? 'draw' : 'won');
        assert.equal(match.elapsedMs, steps * stepMs);
        assert.equal(match.turns.length, fixture.turns * (mode === 'versus' ? 2 : 1));
        for (const run of match.runs) {
          assert.equal(run.status, 'won');
          assert.equal(run.tick, steps);
          assert.equal(run.catches, pilot.goal);
          assert.equal(run.score, pilot.goal * 100);
          assert.equal(run.bonusCatches, 0);
          assert.equal(run.pickupsUsed, 0);
          assert.equal(run.failure, null);
          assert.equal(run.targets.length, 0);
          assert.deepEqual(
            run.snakes.map((snake) => snake.catches),
            fixture.contributions,
          );
          assert.ok(run.snakes.every((snake) => snake.catches > 0));
          assert.deepEqual(run.level, accepted);
        }
        if (mode === 'versus') assert.deepEqual(match.runs[0], match.runs[1]);
        assert.deepEqual(entry.level, accepted);
        const session = {
          format: 'revealline-classic-snake-session.v2',
          activity: 'campaign',
          levelId: pilot.id,
          mode,
          pace,
          targetRules: 'authored',
          preset: 'classic',
          duel: 'score',
          seed: entry.seed,
          style: 'cable',
          match: exportClassicSnakeMatch(match),
        };
        assert.deepEqual(restoreClassicSnakeMatch(session.match, { level: accepted }), match);
        const receipt = await verifyPursuitPilotRecording({
          pilot: pilot.id,
          mode,
          pace,
          recording: session,
        });
        assert.equal(receipt.verification, 'native-replay-completion');
        assert.deepEqual(receipt.outcome.completedBoards, mode === 'versus' ? [1, 2] : [1]);
        assert.equal(receipt.humanPlay, 'pending');
        assert.equal(receipt.deviceAndAccessibility, 'pending');
        assert.equal(receipt.publicRelease, 'not-qualified');
      });
