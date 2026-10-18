import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  HUNT_UPGRADE_IDS,
  createOverflightHuntBuild,
  legalOverflightHuntRefits,
  applyOverflightHuntRefit,
  overflightHuntParameters,
} from '../overflight/raid-upgrades.mjs';
import {
  createOverflightHuntUpgradeCard,
  overflightHuntPreviewModel,
  paintOverflightHuntPreview,
} from '../overflight/raid-upgrade-card.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { createOverflightHuntRun, chooseOverflightHuntUpgrade } from '../overflight/raid-core.mjs';

// Stage legal builds, then compare the presentation with native refit application.
// These are model states, not a claim of earning Marathon refits in browser play.
function refit(from, fromRank, to, toRank, charges) {
  const run = {
    build: createOverflightHuntBuild(),
    player: { shield: charges },
    compiled: { upgrades: { modules: HUNT_UPGRADE_IDS } },
  };
  Object.assign(run.build.hunt, { [from]: fromRank, [to]: toRank });
  const offer = legalOverflightHuntRefits(run).find(
    (item) => item.fromSystem === from && item.system === to,
  );
  assert.ok(offer, 'the staged refit must be admitted by the actual rules');
  return { run, offer };
}

function canvasRecorder() {
  const calls = [];
  const context = new Proxy(
    {},
    {
      get(target, key) {
        return key in target
          ? target[key]
          : (...args) => calls.push({ key, args, fill: target.fillStyle });
      },
    },
  );
  return { context, calls };
}

function cardDocument() {
  const document = new Document(),
    create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'canvas') element.getContext = () => canvasRecorder().context;
    return element;
  };
  return document;
}

test('shield refit charge and capacity projections agree with native legal exchanges without mutating the run', () => {
  const examples = [
    ['plating', 2, 'recovery-shield', 0, 0],
    ['boost-duration', 2, 'recovery-shield', 0, 0],
    ['boost-duration', 1, 'recovery-shield', 1, 0],
    ['boost-duration', 1, 'recovery-shield', 1, 1],
    ['recovery-shield', 2, 'boost-duration', 0, 2],
    ['recovery-shield', 2, 'boost-duration', 1, 2],
    ['recovery-shield', 2, 'boost-duration', 1, 1],
    ['recovery-shield', 1, 'boost-duration', 0, 1],
  ];
  for (const args of examples) {
    const { run, offer } = refit(...args),
      before = structuredClone(run);
    const model = overflightHuntPreviewModel(offer, { player: run.player, rulesVersion: 3 });
    assert.deepEqual(run, before, 'projection cannot consume a choice or alter protection');
    assert.deepEqual(model.shieldRefit.before, {
      capacity: overflightHuntParameters(run.build).shieldCapacity,
      available: run.player.shield,
    });
    assert.equal(applyOverflightHuntRefit(run, offer), true);
    assert.deepEqual(
      model.shieldRefit.after,
      {
        capacity: overflightHuntParameters(run.build).shieldCapacity,
        available: run.player.shield,
      },
      offer.id,
    );
    assert.equal(model.beforeSystem, offer.fromSystem);
    assert.equal(model.after.rank, offer.rank);
  }
});

test('empty refit previews show capacity slots without demonstrating available protection', () => {
  const { run, offer } = refit('plating', 2, 'recovery-shield', 0, 0);
  const model = overflightHuntPreviewModel(offer, { player: run.player, rulesVersion: 3 });
  for (const reducedEffects of [false, true])
    for (const time of [0, 1.8, 8]) {
      const { context, calls } = canvasRecorder();
      paintOverflightHuntPreview(context, model, { time, reducedEffects });
      const slots = calls.filter(
        ({ key, args }) => key === 'fillRect' && args[1] === 103 && args[2] === 11,
      );
      assert.equal(slots.length, 2);
      assert.ok(slots.every(({ fill }) => fill === '#253a30'));
      assert.ok(calls.some(({ key, args }) => key === 'fillText' && args[0] === '0/2 · ready'));
      assert.ok(!calls.some(({ key, args }) => key === 'fillRect' && args.join() === '60,49,3,43'));
    }
});

test('refit cards expose the same EN/UK consequence visibly and accessibly, with rules-correct recharge', () => {
  const { run, offer } = refit('plating', 2, 'recovery-shield', 0, 0);
  for (const rulesVersion of [1, 2, 3, 4])
    for (const locale of ['en', 'uk']) {
      const card = createOverflightHuntUpgradeCard({
        document: cardDocument(),
        offer,
        player: run.player,
        rulesVersion,
        locale,
      });
      const consequence = card.querySelector('.upgrade-consequence').textContent;
      assert.match(consequence, /0\/0 → 0\/2/);
      assert.ok(card.getAttribute('aria-label').includes(consequence));
      assert.ok(card.getAttribute('aria-label').includes(offer.next[locale]));
      if (locale === 'en') {
        assert.match(consequence, /Refitting does not recharge/);
        assert.match(consequence, rulesVersion >= 3 ? /restores one charge/ : /refills the shield/);
      } else {
        assert.match(consequence, /Перебудова не відновлює/);
        assert.match(
          consequence,
          rulesVersion >= 3 ? /відновлює один заряд/ : /повністю відновлює/,
        );
      }
    }
});

test('capacity-only preview never invents available charges, and removed shields do not promise recharge', () => {
  const { offer } = refit('plating', 2, 'recovery-shield', 0, 0);
  const model = overflightHuntPreviewModel({ ...offer, rulesVersion: 3 });
  assert.equal(model.shieldRefit.after.available, null);
  const card = createOverflightHuntUpgradeCard({
    document: cardDocument(),
    offer: { ...offer, rulesVersion: 3 },
  });
  assert.match(card.querySelector('.upgrade-consequence').textContent, /Shield capacity: 0 → 2/);
  assert.match(card.querySelector('.upgrade-consequence').textContent, /restores one charge/);
  assert.doesNotMatch(card.getAttribute('aria-label'), /0\/2|hits absorbed/);
  const { context, calls } = canvasRecorder();
  paintOverflightHuntPreview(context, model);
  assert.equal(calls.filter(({ key }) => key === 'strokeRect').length, 2);
  assert.ok(calls.some(({ key, args }) => key === 'fillText' && args[0] === '2 · capacity'));
  const removed = refit('recovery-shield', 2, 'boost-duration', 0, 2);
  const removedCard = createOverflightHuntUpgradeCard({
    document: cardDocument(),
    offer: removed.offer,
    player: removed.run.player,
    rulesVersion: 3,
  });
  const consequence = removedCard.querySelector('.upgrade-consequence').textContent;
  assert.match(consequence, /2\/2 → 0\/0/);
  assert.doesNotMatch(consequence, /objective/i);
});

test('partial charges remain visible and unrelated refits retain their existing presentation', () => {
  const partial = refit('boost-duration', 1, 'recovery-shield', 1, 1),
    model = overflightHuntPreviewModel(partial.offer, { player: partial.run.player });
  const { context, calls } = canvasRecorder();
  paintOverflightHuntPreview(context, model, { reducedEffects: true });
  const slots = calls.filter(
    ({ key, args }) => key === 'fillRect' && args[1] === 103 && args[2] === 11,
  );
  assert.deepEqual(
    slots.map(({ fill }) => fill),
    ['#9aebda', '#253a30'],
  );
  const unrelated = refit('boost-duration', 2, 'strike-width', 0, 0);
  assert.equal(overflightHuntPreviewModel(unrelated.offer).shieldRefit, undefined);
  const card = createOverflightHuntUpgradeCard({
    document: cardDocument(),
    offer: unrelated.offer,
    player: unrelated.run.player,
  });
  assert.equal(card.querySelector('.upgrade-consequence'), null);
  assert.equal(card.querySelector('.upgrade-description').textContent, unrelated.offer.next.en);
});

test('the actual card delegates one legal refit without refilling or changing choice admission', () => {
  const run = createOverflightHuntRun(
    compileOverflightHuntProject(createOverflightHuntProject({ rulesVersion: 3 })),
  );
  Object.assign(run.build.hunt, {
    plating: 2,
    'strike-width': 2,
    'boost-duration': 2,
    'chain-window': 2,
  });
  run.hunt.refitBudget = 8;
  const offer = legalOverflightHuntRefits(run).find(
    (item) => item.id === 'refit:plating:recovery-shield:2',
  );
  run.phase = 'upgrade';
  run.offers = [offer];
  run.hunt.pendingChoices = 1;
  const before = structuredClone(run),
    selected = [];
  const card = createOverflightHuntUpgradeCard({
    document: cardDocument(),
    offer,
    player: run.player,
    rulesVersion: run.rulesVersion,
    onChoose: (id) => selected.push(chooseOverflightHuntUpgrade(run, id)),
  });
  assert.deepEqual(run, before, 'showing the consequence cannot advance the run');
  card.click();
  assert.deepEqual(selected, [true]);
  assert.equal(run.player.shield, 0);
  assert.equal(overflightHuntParameters(run.build).shieldCapacity, 2);
  assert.equal(run.progression.choices, before.progression.choices + 1);
  assert.equal(run.time, before.time);
  assert.equal(run.tick, before.tick);
  card.click();
  assert.deepEqual(selected, [true, false]);
  assert.equal(run.progression.choices, before.progression.choices + 1);
});
