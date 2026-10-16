import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBenchmarkCatalog } from '../../authoring/playable-benchmark/catalog.mjs';
import { createBenchmarkSession } from '../../authoring/playable-benchmark/session.mjs';
import { createRun, stepRun, validateLevel, FIXED_DT } from '../core/index.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { flightInformationSnapshot } from '../ui/flight-information-source.mjs';
import { flightDetailsModel } from '../ui/flight-information-details.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';

const catalog = await loadBenchmarkCatalog();
const context = { mission: 'Threat details', goal: 'Reveal', steering: 'Immediate', actions: [] };
const ability =
  'trail contact sends visible fronts along your unfinished line; close before they reach you. Body contact and a hit at your live endpoint are immediate dangers.';
const phaseCopy = {
  patrol: 'patrolling hidden ground',
  warning: 'preparing a charge',
  committed: 'charging toward its marked target',
  cooldown: 'recovering from its last charge',
};
const fixtures = [
  {
    id: 'return-in-reserve',
    mode: 'trail-pursuit',
    role: 'Trail pursuer',
    route: [
      [100, 'right'],
      [100, 'down'],
      [67, 'left'],
    ],
    risky: [
      [100, 'right'],
      [215, 'down'],
    ],
  },
  {
    id: 'crossed-bands',
    mode: 'head-intercept',
    role: 'Heading interceptor',
    route: [
      [240, null],
      [100, 'up'],
      [20, 'right'],
      [53, 'down'],
    ],
    risky: [
      [240, null],
      [100, 'up'],
      [102, 'right'],
    ],
  },
];
const details = (snapshot) =>
  flightDetailsModel({ snapshot }, context).find((section) => section.id === 'threats').lines;
const observe = (run) => {
  const before = authoritativeCheckpoint(run);
  const snapshot = flightInformationSnapshot(run, { started: true, paused: true });
  const lines = details(snapshot);
  assert.deepEqual(authoritativeCheckpoint(run), before, 'Reading details cannot change play.');
  return { snapshot, lines };
};
function sessionFor(id, onStep) {
  return createBenchmarkSession(catalog.entries.find((entry) => entry.id === id).manifest, {
    onStep,
  });
}
function play(session, route) {
  session.start();
  for (const [ticks, direction] of route)
    for (let i = 0; i < ticks; i++) session.advance({ direction }, FIXED_DT);
}

for (const fixture of fixtures) {
  test(`${fixture.id}: current global-v1 impact missions retain their existing pressure details`, () => {
    const seen = new Set();
    const session = sessionFor(fixture.id, (_events, run) => {
      const phase = run.enemies.find((enemy) => enemy.id === 'carrier').classic.pressure.phase;
      if (seen.has(phase)) return;
      seen.add(phase);
      const { snapshot, lines } = observe(run);
      const enemy = snapshot.classic.enemies.find((actor) => actor.id === 'carrier');
      assert.equal(
        enemy.impactCarrier,
        undefined,
        'Global v1 impacts do not label individual carriers.',
      );
      assert.equal(enemy.pressure.mode, fixture.mode);
      const line = lines.find((value) => value.startsWith(fixture.role));
      assert.ok(line);
      assert.ok(line.startsWith(`${fixture.role}: ${phaseCopy[phase]}`));
      assert.ok(!line.includes('Trail-impact carrier'));
      assert.ok(!line.includes(ability));
      if (phase !== 'patrol')
        assert.ok(line.includes(`${enemy.pressure.seconds.toFixed(1)}s remaining.`));
      assert.doesNotMatch(line, /harmless|safe to|attack disabled/i);
    });
    try {
      assert.equal(session.setup.gameplayTuning, 'gameplay-pressure.v4');
      play(session, fixture.route);
      assert.deepEqual([...seen], ['patrol', 'warning', 'committed', 'cooldown']);
      session.pause();
      const paused = observe(session.run);
      session.advance({ direction: 'up' }, 0.25);
      assert.deepEqual(observe(session.run), paused, 'Paused details hold the same phase clock.');
    } finally {
      session.dispose();
    }
  });

  test(`${fixture.id}: charge recovery still exposes already travelling impact fronts`, () => {
    const session = sessionFor(fixture.id);
    try {
      play(session, fixture.risky);
      const { snapshot, lines } = observe(session.run);
      const enemy = snapshot.classic.enemies.find((actor) => actor.id === 'carrier');
      assert.equal(enemy.pressure.phase, 'cooldown');
      assert.ok(snapshot.classic.lineImpacts.length > 0);
      assert.ok(lines.some((line) => line.startsWith('Impact travelling toward your craft.')));
      assert.ok(lines.includes('Enemy freeze does not stop travelling line impacts.'));
      const line = lines.find((value) => value.startsWith(fixture.role));
      assert.ok(line.includes(phaseCopy.cooldown));
      assert.ok(!line.includes('Trail-impact carrier'));
    } finally {
      session.dispose();
    }
  });

  test(`${fixture.id}: valid explicit v2 carrier-plus-pressure import describes both abilities`, () => {
    // This is a separate imported-content fixture, not the current benchmark
    // edition. v2 explicitly assigns impact behavior to an existing bouncer.
    const source = structuredClone(
      catalog.entries.find((entry) => entry.id === fixture.id).manifest.level,
    );
    source.id = `${source.id}-combined-import`;
    source.revision = 'combined-v2-pressure-test';
    source.classic.lineImpact = {
      version: 'line-impact.v2',
      speed: source.classic.lineImpact.speed,
      actorIds: ['carrier'],
    };
    assert.equal(validateLevel(source).valid, true);
    const run = createRun(applyGameplayTuning(source, resolveGameplayTuning('standard')), {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    });
    const seen = new Set();
    for (const [ticks, direction] of fixture.route)
      for (let i = 0; i < ticks; i++) {
        stepRun(run, { direction }, FIXED_DT);
        const phase = run.enemies.find((enemy) => enemy.id === 'carrier').classic.pressure.phase;
        if (seen.has(phase)) continue;
        seen.add(phase);
        const { snapshot, lines } = observe(run);
        const enemy = snapshot.classic.enemies.find((actor) => actor.id === 'carrier');
        assert.equal(enemy.impactCarrier, true);
        assert.equal(enemy.pressure.mode, fixture.mode);
        const line = lines.find((value) => value.startsWith(fixture.role));
        assert.ok(line, `The pressure role survives the explicit carrier ability: ${lines}`);
        assert.ok(line.startsWith(`${fixture.role} · Trail-impact carrier: ${phaseCopy[phase]}`));
        assert.ok(line.endsWith(ability));
        if (phase !== 'patrol')
          assert.ok(line.includes(`${enemy.pressure.seconds.toFixed(1)}s remaining.`));
        assert.doesNotMatch(line, /harmless|safe to|attack disabled/i);
      }
    assert.deepEqual([...seen], ['patrol', 'warning', 'committed', 'cooldown']);
  });
}

function specimen(enemy) {
  return {
    status: 'running',
    paused: true,
    player: { cutting: true },
    objectives: { done: 0, total: 0 },
    classic: { enemies: [enemy], lineImpacts: [], erosion: [], effects: [], powerups: [] },
    laneBosses: [],
    encounter: null,
  };
}

test('carrier without pressure and pressure without carrier preserve their existing output', () => {
  assert.deepEqual(details(specimen({ type: 'bouncer', impactCarrier: true })), [
    `Trail-impact carrier: ${ability}`,
  ]);
  for (const { mode, role } of fixtures)
    for (const [phase, copy] of Object.entries(phaseCopy)) {
      const suffix = phase === 'patrol' ? '.' : ' · 1.5s remaining.';
      assert.deepEqual(
        details(specimen({ type: 'bouncer', pressure: { mode, phase, seconds: 1.5 } })),
        [`${role}: ${copy}${suffix}`],
      );
    }
});

test('combined roles and carrier ability use the existing English and Ukrainian translations', () => {
  const original = getLocale();
  try {
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      for (const { mode } of fixtures) {
        const key = mode === 'trail-pursuit' ? 'trailPursuer' : 'headingInterceptor';
        const line = details(
          specimen({
            type: 'bouncer',
            impactCarrier: true,
            pressure: { mode, phase: 'warning', seconds: 0.5 },
          }),
        )[0];
        assert.ok(
          line.startsWith(`${t(`interface:${key}`)} · ${t('interface:trailImpactCarrier')}:`),
        );
        assert.ok(
          line.includes(t('interface:trailContactSendsVisibleFrontsAlongYourUnfinishedLineClose')),
        );
      }
    }
  } finally {
    setLocale(original, { persist: false });
  }
});
