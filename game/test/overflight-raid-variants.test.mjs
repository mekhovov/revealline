import test from 'node:test';
import assert from 'node:assert/strict';
import { legalOverflightHuntUpgrades } from '../overflight/raid-upgrades.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { createOverflightHuntReviewPilot } from '../overflight/raid-review-pilot.mjs';
import {
  overflightHuntRecordContext,
  OVERFLIGHT_HUNT_RECORDS_FORMAT,
} from '../overflight/raid-records.mjs';
import {
  createOverflightRaidVariant,
  overflightTimeAttackResult,
  overflightRaidMedalTime,
  overflightMarathonProject,
  overflightRaidVariantRecord,
} from '../overflight/raid-variants.mjs';
const compiled = () => compileOverflightHuntProject(createOverflightHuntProject({ seed: 42 }));
const variant = (id = 'marathon') =>
  createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: id });
const victory = (run, { score = 1000, time = 30 } = {}) => {
  run.phase = 'won';
  run.hunt.score = score;
  run.time = time;
};

test('native Raid uses current rules at every difficulty without changing legacy authoring defaults', () => {
  assert.equal(compileOverflightHuntProject(createOverflightHuntProject()).rulesVersion, 2);
  assert.equal(
    OVERFLIGHT_HUNT_MODE.compileProject(OVERFLIGHT_HUNT_MODE.defaultProject).rulesVersion,
    4,
  );
  for (const difficulty of ['relaxed', 'standard', 'veteran']) {
    const project = OVERFLIGHT_HUNT_MODE.createProject({ difficulty });
    assert.equal(project.difficulty, difficulty);
    assert.equal(OVERFLIGHT_HUNT_MODE.compileProject(project).rulesVersion, 4);
  }
});

test('pre-run variant record lookup uses the same revision as its completed run', () => {
  for (const variantId of ['time-attack', 'marathon'])
    for (const rulesVersion of [2, 3, 4]) {
      const mode = variant(variantId);
      const definition = compileOverflightHuntProject(
        createOverflightHuntProject({ rulesVersion }),
      );
      const run = mode.createRun(definition);
      victory(run);
      if (variantId === 'marathon') mode.bankContract(run);
      const saved = overflightRaidVariantRecord(run);
      const beforeRun = mode.recordQuery({ compiled: definition });
      assert.equal(beforeRun.compiled.projectIdentity, saved.compiled.projectIdentity);
    }
});

test('Time Attack and Marathon reject experimental terrain rather than silently changing routes', () => {
  const definition = { ...compiled(), terrain: { obstacles: [] } };
  for (const id of ['time-attack', 'marathon']) {
    const mode = variant(id);
    assert.throws(() => mode.createRun(definition), /Experimental terrain/);
    const acceptingBase = { ...OVERFLIGHT_HUNT_MODE, compileProject: () => definition };
    assert.throws(
      () => createOverflightRaidVariant(acceptingBase, { variant: id }).compileProject({}),
      /Experimental terrain/,
    );
  }
});

test('Time Attack awards adjusted-time medals, keeps raw time and penalizes failed clears', () => {
  const mode = variant('time-attack'),
    run = mode.createRun(compiled());
  victory(run, { time: 85 });
  run.stats.damageTaken = 20;
  assert.deepEqual(overflightTimeAttackResult(run), {
    rawTime: 85,
    penalty: 5,
    adjustedTime: 90,
    medal: 'gold',
    clean: false,
  });
  run.stats.damageTaken = 21;
  assert.equal(overflightTimeAttackResult(run).medal, 'silver');
  run.time = 200;
  assert.equal(overflightTimeAttackResult(run).medal, 'bronze');
  run.time = 300;
  assert.equal(overflightTimeAttackResult(run).medal, 'unranked');
  run.phase = 'lost';
  assert.equal(overflightTimeAttackResult(run).medal, 'failed');
  run.phase = 'won';
  run.stats.damageTaken = 0;
  assert.equal(overflightTimeAttackResult(run).clean, true);
});

test('bank/continue transactions settle once and preserve resources without free repairs', () => {
  const mode = variant(),
    run = mode.createRun(compiled(), { airframes: 3, slowResume: false });
  assert.equal(mode.continueContract(run), false);
  assert.equal(mode.bankContract(run), false);
  run.player.hull = 37;
  run.player.shield = 1;
  run.airframesRemaining = 2;
  run.progression.rerolls = 1;
  run.build.hunt['boost-duration'] = 2;
  victory(run);
  assert.equal(overflightRaidVariantRecord(run), null);
  assert.equal(mode.continueContract(run), true);
  assert.equal(run.phase, 'ready');
  assert.equal(run.raidVariant.contract, 2);
  assert.equal(run.raidVariant.escrow, 1000);
  assert.equal(run.player.hull, 37);
  assert.equal(run.player.shield, 1);
  assert.equal(run.airframesRemaining, 2);
  assert.equal(run.progression.rerolls, 1);
  assert.equal(run.build.hunt['boost-duration'], 2);
  assert.equal(mode.continueContract(run), false);
  victory(run, { score: 2000, time: 40 });
  assert.equal(mode.bankContract(run), true);
  assert.equal(mode.bankContract(run), false);
  assert.equal(run.raidVariant.escrow, 3500);
  assert.equal(run.raidVariant.totalTime, 70);
  assert.equal(mode.continueContract(run), false);
  const record = overflightRaidVariantRecord(run);
  assert.equal(record.hunt.score, 3500);
  assert.equal(record.time, 70);
});

test('losing the last airframe forfeits the entire unbanked chain, retry restarts it', () => {
  const mode = variant(),
    project = compiled(),
    run = mode.createRun(project);
  victory(run);
  mode.continueContract(run);
  run.hunt.score = 400;
  run.phase = 'lost';
  run.time = 12;
  const result = overflightRaidVariantRecord(run);
  assert.equal(run.raidVariant.forfeited, 1500);
  assert.equal(run.raidVariant.escrow, 0);
  assert.equal(result.hunt.score, 0);
  assert.equal(result.phase, 'lost');
  assert.equal(mode.bankContract(run), false);
  assert.equal(mode.continueContract(run), false);
  const retry = mode.createRun(project);
  assert.equal(retry.seed, 42);
  assert.equal(retry.raidVariant.contract, 1);
  assert.equal(retry.raidVariant.escrow, 0);
  assert.equal(retry.player.hull, 100);
});

test('five contracts are bounded and auto-bank; generated escalation keeps project safety floors', () => {
  const mode = variant(),
    run = mode.createRun(compiled());
  for (let contract = 1; contract <= 5; contract++) {
    victory(run);
    const record = overflightRaidVariantRecord(run);
    assert.equal(run.raidVariant.contract, contract);
    if (contract < 5) {
      assert.equal(record, null);
      assert.equal(mode.continueContract(run), true);
    } else {
      assert.equal(run.raidVariant.status, 'banked');
      assert.equal(record.hunt.score, 7500);
      assert.equal(mode.continueContract(run), false);
    }
  }
  for (const difficulty of ['standard', 'veteran'])
    for (const encounterSet of ['patrol', 'crossing', 'mixed'])
      for (let c = 1; c <= 5; c++) {
        const original = createOverflightHuntProject({
          difficulty,
          encounterSet,
        });
        const before = JSON.stringify(original);
        const next = overflightMarathonProject(original, c, 100 + c);
        assert.equal(JSON.stringify(original), before);
        compileOverflightHuntProject(next);
        assert.equal(next.combat.attacks.warningSeconds, original.combat.attacks.warningSeconds);
        assert.equal(
          next.combat.machinery.exposureSeconds,
          original.combat.machinery.exposureSeconds,
        );
        assert.ok(next.encounters.every((e) => e.packs.every((p) => p.speed <= 140)));
        assert.deepEqual(
          next.encounters.map((e) => e.packs.map((p) => p.count)),
          original.encounters.map((e) => e.packs.map((p) => p.count)),
        );
      }
  assert.throws(() => overflightMarathonProject(createOverflightHuntProject(), 6, 42), /contract/);
});

test('variant records have independent contexts and shared durable/session storage semantics', async () => {
  const project = compiled(),
    timeMode = variant('time-attack'),
    marathonMode = variant();
  const ordinary = OVERFLIGHT_HUNT_MODE.createRun(project),
    timed = timeMode.createRun(project),
    marathon = marathonMode.createRun(project);
  victory(ordinary);
  victory(timed);
  victory(marathon);
  timed.stats.damageTaken = 20;
  marathonMode.bankContract(marathon);
  assert.deepEqual(
    overflightHuntRecordContext(timeMode.recordQuery(timed)),
    overflightHuntRecordContext(overflightRaidVariantRecord(timed)),
  );
  assert.deepEqual(
    overflightHuntRecordContext(marathonMode.recordQuery(marathon)),
    overflightHuntRecordContext(overflightRaidVariantRecord(marathon)),
  );
  const contexts = [
    ordinary,
    overflightRaidVariantRecord(timed),
    overflightRaidVariantRecord(marathon),
  ].map(overflightHuntRecordContext);
  assert.equal(new Set(contexts.map((c) => c.project)).size, 3);
  let state = { format: OVERFLIGHT_HUNT_RECORDS_FORMAT, entries: {} };
  const records = timeMode.createRecords({
    backend: {
      read: async () => state,
      update: async (fn) => (state = fn(state)),
      close() {},
    },
  });
  const saved = await records.record(overflightRaidVariantRecord(timed));
  assert.equal(saved.durable, true);
  assert.equal(saved.fastestClear.time, 35);
  assert.equal((await records.read(ordinary)).fastestClear, null);
  records.dispose();
  const broken = timeMode.createRecords({
    backend: {
      read: async () => {
        throw Error('offline');
      },
      update: async () => {
        throw Error('offline');
      },
      close() {},
    },
  });
  const session = await broken.record(overflightRaidVariantRecord(timed));
  assert.equal(session.durable, false);
  assert.equal(session.fastestClear.time, 35);
  broken.dispose();
});

test('pause freezes variant clocks, and exhausted carried builds never offer an illegal draft', () => {
  const mode = variant(),
    run = mode.createRun(compiled());
  mode.start(run);
  mode.step(run, { x: 0, y: 0, boost: false });
  mode.pause(run);
  const state = structuredClone(run.raidVariant),
    time = run.time;
  for (let i = 0; i < 60; i++) mode.step(run, { x: 1, y: 1, boost: true });
  assert.equal(run.time, time);
  assert.deepEqual(run.raidVariant, state);
  mode.resume(run);
  for (const key of Object.keys(run.build.hunt)) run.build.hunt[key] = 2;
  run.hunt.pendingChoices = 1;
  assert.doesNotThrow(() => mode.step(run, { x: 0, y: 0, boost: false }));
  assert.equal(run.phase, 'playing');
  assert.equal(run.progression.maxChoices, run.progression.choices);
});

test('an ordinary-input pilot can complete all five escalated contracts with carried upgrades', () => {
  const mode = variant(),
    run = mode.createRun(compiled(), { airframes: 3 });
  for (let contract = 1; contract <= 5; contract++) {
    const pilot = createOverflightHuntReviewPilot({
      route: 'objectives',
      build: 'pursuer',
    });
    mode.start(run);
    while (['playing', 'upgrade'].includes(run.phase) && run.time < 180) {
      if (run.phase === 'upgrade') {
        assert.equal(mode.choose(run, pilot.choose(run).id), true);
        continue;
      }
      mode.step(run, pilot.input(run));
    }
    assert.equal(run.phase, 'won', `contract ${contract}, hull ${run.player.hull}`);
    if (contract < 5) assert.equal(mode.continueContract(run), true);
  }
  assert.equal(run.raidVariant.status, 'banked');
  assert.ok(run.raidVariant.escrow > 0);
});

function resultUI() {
  const nodes = new Map();
  const element = () => ({
    children: [],
    textContent: '',
    hidden: false,
    className: 'button',
    listeners: new Map(),
    append(...items) {
      this.children.push(...items);
      for (const item of items) item.parentElement = this;
    },
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    },
    removeEventListener(type) {
      this.listeners.delete(type);
    },
    remove() {
      this.removed = true;
    },
    click() {
      this.listeners.get('click')?.();
    },
  });
  const document = {
    documentElement: { lang: 'en' },
    createElement: element,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
  };
  const footer = element();
  footer.append(document.getElementById('raid-same-seed'));
  const base = {
    ...OVERFLIGHT_HUNT_MODE,
    installActions() {},
    renderResults({ document, formatTime, run }) {
      document.getElementById('result-title').textContent = 'Raid complete';
      document.getElementById('result-stats').children = [];
      document.getElementById('raid-records').textContent = formatTime(run.time);
    },
    resetPresentation() {},
  };
  return { document, footer, base };
}

test('Marathon buttons bank once, refresh results and continue only with the host guard', async () => {
  const { document, footer, base } = resultUI(),
    mode = createOverflightRaidVariant(base, { variant: 'marathon' });
  let run = mode.createRun(compiled()),
    continued = 0,
    refreshed = 0,
    writes = 0,
    allowed = false;
  const context = {
    run,
    document,
    formatTime: (t) => String(t),
    text: (key) => key,
    records: {
      record: async () => {
        writes++;
        return { durable: true, bestScore: { score: 1250 } };
      },
    },
  };
  const render = () => mode.renderResults({ ...context, run });
  const dispose = mode.installActions({
    document,
    getRun: () => run,
    canContinueContract: () => allowed,
    onContinueContract: () => {
      continued++;
    },
    onVariantResultRefresh: () => {
      refreshed++;
      render();
    },
  });
  const [, bank, next] = footer.children;
  victory(run);
  render();
  assert.equal(bank.hidden, false);
  assert.equal(next.hidden, false);
  assert.equal(document.getElementById('result-title').textContent, 'Contract complete');
  assert.equal(writes, 0);
  next.click();
  assert.equal(continued, 0);
  allowed = true;
  next.click();
  assert.equal(continued, 1);
  assert.equal(run.phase, 'ready');
  assert.equal(writes, 0);
  victory(run);
  render();
  bank.click();
  assert.equal(refreshed, 1);
  assert.equal(writes, 1);
  assert.equal(bank.hidden, true);
  assert.equal(next.hidden, true);
  render();
  assert.equal(writes, 1);
  const retry = mode.createRun(compiled());
  run = retry;
  victory(run);
  render();
  assert.equal(writes, 1);
  bank.click();
  assert.equal(writes, 2);
  dispose();
  assert.equal(bank.removed, true);
  assert.equal(next.removed, true);
  await Promise.resolve();
});

test('Time Attack renders hundredths and an old async result cannot overwrite a new attempt', async () => {
  const { document, base } = resultUI(),
    mode = createOverflightRaidVariant(base, { variant: 'time-attack' }),
    resolvers = [];
  const records = {
    record: () => new Promise((resolve) => resolvers.push(resolve)),
  };
  const show = (run) =>
    mode.renderResults({
      run,
      document,
      formatTime: () => 'floored',
      text: (key) => key,
      records,
    });
  const first = mode.createRun(compiled());
  victory(first, { time: 65.375 });
  show(first);
  const second = mode.createRun(compiled());
  victory(second, { time: 62.125 });
  show(second);
  const stats = document.getElementById('result-stats').children;
  assert.equal(stats[0].children[1].textContent, '1:02.13');
  resolvers[0]({
    durable: true,
    fastestClear: { time: 65.375 },
    bestScore: { score: 1 },
  });
  await Promise.resolve();
  assert.equal(document.getElementById('raid-records').textContent, '1:02.13');
  resolvers[1]({
    durable: true,
    fastestClear: { time: 62.125 },
    bestScore: { score: 2 },
  });
  await Promise.resolve();
  assert.match(document.getElementById('raid-records').textContent, /1:02.13/);
  assert.doesNotMatch(document.getElementById('raid-records').textContent, /1:05/);
});

test('medal formatting carries rounded hundredths across minute boundaries', () => {
  assert.equal(overflightRaidMedalTime(59.999), '1:00.00');
  assert.equal(overflightRaidMedalTime(0), '0:00.00');
  assert.equal(overflightRaidMedalTime(62.125), '1:02.13');
});

test('the last legal three-card choice cannot immediately open an exhausted queued draft', () => {
  const mode = variant(),
    run = mode.createRun(compiled());
  for (const key of Object.keys(run.build.hunt)) run.build.hunt[key] = 2;
  for (const key of ['strike-width', 'slow-wake', 'rush-charge']) run.build.hunt[key] = 1;
  run.offers = legalOverflightHuntUpgrades(run.build, run.compiled.upgrades.modules);
  assert.equal(run.offers.length, 3);
  run.phase = 'upgrade';
  run.hunt.pendingChoices = 2;
  assert.equal(mode.choose(run, run.offers[0].id), true);
  assert.equal(run.phase, 'playing');
  assert.equal(run.progression.maxChoices, run.progression.choices);
  assert.equal(legalOverflightHuntUpgrades(run.build).length, 2);
});
