import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  HUNT_UPGRADE_IDS,
  createOverflightHuntBuild,
  legalOverflightHuntUpgrades,
  applyOverflightHuntUpgrade,
  overflightHuntUpgradeParameters,
  draftOverflightHuntRefits,
} from '../overflight/raid-upgrades.mjs';
import {
  createOverflightHuntUpgradeCard,
  overflightHuntPreviewModel,
  paintOverflightHuntPreview,
  overflightHuntPreviewCaption,
} from '../overflight/raid-upgrade-card.mjs';
import {
  overflightHuntEnemyLayers,
  overflightHuntStrikeLayers,
} from '../overflight/raid-render-cues.mjs';
import { OVERFLIGHT_HUNT_COPY } from '../overflight/raid-copy.mjs';

function examples() {
  return HUNT_UPGRADE_IDS.flatMap((id) => {
    const build = createOverflightHuntBuild(),
      cases = [];
    for (let rank = 1; rank <= 2; rank++) {
      const offer = legalOverflightHuntUpgrades(build).find((item) => item.system === id);
      cases.push({ offer, build: structuredClone(build) });
      assert.ok(applyOverflightHuntUpgrade(build, offer));
    }
    return cases;
  });
}
function paintContext() {
  const calls = [];
  const context = new Proxy(
    {},
    {
      get(target, key) {
        return key in target ? target[key] : (...args) => calls.push([key, ...args]);
      },
    },
  );
  return { context, calls };
}

test('every Raid upgrade compare live rank parameters without changing the build', () => {
  assert.equal(examples().length, HUNT_UPGRADE_IDS.length * 2);
  for (const { offer, build } of examples()) {
    const before = structuredClone(build),
      model = overflightHuntPreviewModel(offer);
    assert.deepEqual(model.before, overflightHuntUpgradeParameters(offer.system, offer.rank - 1));
    assert.deepEqual(model.after, overflightHuntUpgradeParameters(offer.system, offer.rank));
    assert.deepEqual(build, before);
    for (const locale of ['en', 'uk']) {
      const current = overflightHuntPreviewCaption(offer.system, model.before, locale);
      const next = overflightHuntPreviewCaption(offer.system, model.after, locale);
      assert.notEqual(current, next, `${offer.id} needs a visible before/after difference`);
      assert.doesNotMatch(current + next, /undefined|NaN|Infinity/);
    }
  }
});

test('native card previews draw selected atlas sprites and reduced motion freezes the entire demonstration', () => {
  for (const { offer } of examples()) {
    const model = overflightHuntPreviewModel(offer),
      snapshots = [];
    for (const time of [0, 10.3]) {
      const { context, calls } = paintContext();
      const sprites = [];
      paintOverflightHuntPreview(context, model, {
        time,
        reducedEffects: true,
        paintSprite: (_context, ...values) => sprites.push(values),
      });
      assert.ok(sprites.some(([kind]) => kind === 'drone'));
      assert.ok(calls.some(([kind]) => kind === 'fillText'));
      snapshots.push({ calls, sprites });
    }
    assert.deepEqual(snapshots[0], snapshots[1], offer.id);
    const a = paintContext(),
      b = paintContext();
    paintOverflightHuntPreview(a.context, model, {
      time: 0,
      paintSprite: (_ctx, ...args) => a.calls.push(['native', ...args]),
    });
    paintOverflightHuntPreview(b.context, model, {
      time: 1.5,
      paintSprite: (_ctx, ...args) => b.calls.push(['native', ...args]),
    });
    assert.notDeepEqual(a.calls, b.calls, `${offer.id} should demonstrate its timing or geometry`);
  }
});

test('native cards remain keyboard buttons, carry complete EN/UK comparisons and delegate exact legal choices', () => {
  for (const { offer } of examples()) {
    const document = new Document(),
      createElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const element = createElement(tag);
      if (tag === 'canvas') element.getContext = () => paintContext().context;
      return element;
    };
    for (const locale of ['en', 'uk']) {
      const selected = [];
      const card = createOverflightHuntUpgradeCard({
        document,
        offer,
        locale,
        onChoose: (id) => selected.push(id),
      });
      assert.equal(card.tagName, 'BUTTON');
      assert.equal(card.querySelector('.upgrade-title').textContent, offer.title[locale]);
      assert.ok(card.getAttribute('aria-label').includes(offer.current[locale]));
      assert.ok(card.getAttribute('aria-label').includes(offer.next[locale]));
      assert.equal(card.querySelector('canvas').getAttribute('aria-hidden'), 'true');
      card.click();
      assert.deepEqual(selected, [offer.id]);
      card.disabled = true;
      card.click();
      assert.equal(selected.length, 1);
    }
  }
});

test('contact cues distinguish facing guards, closed machinery and segmented openings without enclosing the drone', () => {
  const shield = overflightHuntEnemyLayers({
    behavior: 'shield',
    heading: Math.PI / 2,
    contactState: 'guarded',
  });
  assert.equal(shield.length, 3);
  assert.ok(shield[0].dy > 0 && Math.abs(shield[0].dx) < 1e-6, 'plate follows committed facing');
  const heavy = {
    behavior: 'vehicle',
    maxArmorSegments: 3,
    armorSegments: 2,
    objectiveId: 'tank',
    contactState: 'machinery-exposed',
  };
  const exposed = overflightHuntEnemyLayers(heavy, 54);
  const closed = overflightHuntEnemyLayers({ ...heavy, contactState: 'machinery-guarded' }, 54);
  assert.notDeepEqual(exposed, closed);
  assert.equal(exposed.filter((layer) => layer.frame === 'bar' && layer.width === 9).length, 3);
  assert.equal(exposed.filter((layer) => layer.tint === 0x4b564b).length, 1);
  assert.ok(exposed.some((layer) => layer.frame === 'arrow' && layer.tint === 0xf4c765));
  assert.ok(![...shield, ...exposed, ...closed].some((layer) => layer.frame === 'ring'));
  assert.deepEqual(overflightHuntEnemyLayers({ contactState: 'exposed', behavior: 'patrol' }), []);
});

test('Raid localization keys match and preview rejects impossible ranks or systems', () => {
  assert.deepEqual(
    Object.keys(OVERFLIGHT_HUNT_COPY.en).sort(),
    Object.keys(OVERFLIGHT_HUNT_COPY.uk).sort(),
  );
  assert.throws(() => overflightHuntPreviewModel({ system: 'pulse', rank: 1 }));
  assert.throws(() => overflightHuntPreviewModel({ system: 'strike-width', rank: 3 }));
  assert.throws(() =>
    overflightHuntPreviewModel({ system: 'strike-width', rank: 2, currentRank: 0 }),
  );
});

test('field cards without a held count retain original copy and all count options preserve preview commands', () => {
  const run = {
    build: createOverflightHuntBuild(),
    player: { hull: 100, maxHull: 100 },
    progression: { rerolls: 1 },
    compiled: { upgrades: { modules: HUNT_UPGRADE_IDS } },
  };
  const offer = draftOverflightHuntRefits(run, () => 0.5).find(
    (item) => item.id === 'field-reroll',
  );
  const before = JSON.stringify({ run, offer });
  for (const locale of ['en', 'uk']) {
    const previews = [];
    for (const rerolls of [undefined, 0, 1, 2]) {
      const document = new Document(),
        create = document.createElement.bind(document);
      const { context, calls } = paintContext();
      document.createElement = (tag) => {
        const element = create(tag);
        if (tag === 'canvas') element.getContext = () => context;
        return element;
      };
      const card = createOverflightHuntUpgradeCard({ document, offer, locale, rerolls });
      card.paintPreview(1.5);
      previews.push(calls);
      if (rerolls === undefined) {
        assert.equal(card.querySelector('.upgrade-description').textContent, offer.next[locale]);
        assert.ok(card.getAttribute('aria-label').includes(offer.current[locale]));
      }
      assert.equal(JSON.stringify({ run, offer }), before);
    }
    for (const preview of previews) assert.deepEqual(preview, previews[0]);
  }
});

test('boost streaks reflect offensive width only while striking and preserve body size', () => {
  const run = {
    player: { radius: 9, heading: 0, boostRemaining: 0 },
    hunt: { rushRemaining: 0 },
    build: createOverflightHuntBuild(),
  };
  assert.deepEqual(overflightHuntStrikeLayers(run), []);
  run.player.boostRemaining = 0.3;
  const base = overflightHuntStrikeLayers(run);
  run.build.hunt['strike-width'] = 2;
  const wider = overflightHuntStrikeLayers(run);
  assert.equal(Math.abs(base[0].dy), 9);
  assert.equal(Math.abs(wider[0].dy), 13.5);
  assert.equal(run.player.radius, 9);
  assert.ok(wider.every((cue) => cue.frame === 'bar'));
});

import { legalOverflightHuntRefits } from '../overflight/raid-upgrades.mjs';
import { overflightHuntText } from '../overflight/raid-copy.mjs';

function raidXLRecorder() {
  const calls = [],
    context = new Proxy(
      {},
      {
        get(target, key) {
          return key in target ? target[key] : (...args) => calls.push([key, ...args]);
        },
        set(target, key, value) {
          calls.push(['set', key, value]);
          target[key] = value;
          return true;
        },
      },
    );
  return { context, calls };
}
function raidXLDocument() {
  const document = new Document(),
    create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'canvas') element.getContext = () => raidXLRecorder().context;
    return element;
  };
  return document;
}
function raidXLCases() {
  const cases = examples().map(({ offer }) => ({ offer }));
  for (const [hull, rerolls] of [
    [87.5, 0],
    [100, 0],
    [100, 2],
  ]) {
    const run = {
      build: createOverflightHuntBuild(),
      player: { hull, maxHull: 100 },
      progression: { rerolls },
      compiled: { upgrades: { modules: HUNT_UPGRADE_IDS } },
    };
    const offer = draftOverflightHuntRefits(run, () => 0.5).find((item) => item.kind === 'field');
    assert.ok(offer);
    cases.push({ offer, rerolls });
  }
  for (const [from, fromRank, to, toRank, shield] of [
    ['plating', 2, 'recovery-shield', 0, 0],
    ['boost-duration', 1, 'recovery-shield', 1, 1],
    ['recovery-shield', 2, 'boost-duration', 0, 2],
  ]) {
    const run = {
      build: createOverflightHuntBuild(),
      player: { shield },
      compiled: { upgrades: { modules: HUNT_UPGRADE_IDS } },
    };
    Object.assign(run.build.hunt, { [from]: fromRank, [to]: toRank });
    const offer = legalOverflightHuntRefits(run).find(
      (item) => item.fromSystem === from && item.system === to,
    );
    assert.ok(offer);
    cases.push({ offer, player: run.player, rulesVersion: 3 });
  }
  return cases;
}

test('Raid XL removes only canvas text, preserving the complete default commands and sprites', () => {
  for (const options of raidXLCases())
    for (const locale of ['en', 'uk'])
      for (const time of [0, 1.8])
        for (const reducedEffects of [false, true]) {
          const before = structuredClone(options),
            model = overflightHuntPreviewModel(options.offer, options),
            streams = [];
          for (const expandedComparison of [undefined, false, true]) {
            const recorder = raidXLRecorder(),
              flags = {
                time,
                locale,
                reducedEffects,
                paintSprite: (_context, ...args) => recorder.calls.push(['sprite', ...args]),
              };
            if (expandedComparison !== undefined) flags.expandedComparison = expandedComparison;
            paintOverflightHuntPreview(recorder.context, model, flags);
            streams.push(recorder.calls);
          }
          assert.deepEqual(streams[0], streams[1]);
          assert.ok(streams[0].some(([name]) => name === 'fillText'));
          assert.deepEqual(
            streams[2],
            streams[0].filter(([name]) => name !== 'fillText'),
            options.offer.id,
          );
          assert.ok(streams[2].some(([name]) => name === 'sprite'));
          assert.deepEqual(options, before);
        }
});

test('Raid XL actual cards retain comparisons, shield consequences and exact legal choices in EN/UK', () => {
  for (const options of raidXLCases())
    for (const locale of ['en', 'uk']) {
      const before = structuredClone(options),
        chosen = [],
        common = { ...options, locale, document: raidXLDocument() };
      const standard = createOverflightHuntUpgradeCard(common);
      const explicit = createOverflightHuntUpgradeCard({ ...common, expandedComparison: false });
      assert.equal(explicit.getAttribute('aria-label'), standard.getAttribute('aria-label'));
      assert.equal(standard.querySelector('.raid-upgrade-comparison'), null);
      const card = createOverflightHuntUpgradeCard({
        ...common,
        expandedComparison: true,
        onChoose: (id) => chosen.push(id),
      });
      const rows = card.querySelectorAll('.upgrade-comparison-state');
      assert.equal(rows.length, 2);
      assert.equal(rows[0].children[0].textContent, overflightHuntText(locale, 'current'));
      assert.equal(rows[1].children[0].textContent, overflightHuntText(locale, 'next'));
      assert.ok(rows.every((row) => row.children[1].textContent.length > 0));
      assert.ok(card.getAttribute('aria-label').startsWith(standard.getAttribute('aria-label')));
      assert.equal(card.querySelector('canvas').getAttribute('aria-hidden'), 'true');
      assert.equal(card.tagName, 'BUTTON');
      assert.equal(card.dataset.upgradeId, options.offer.id);
      const consequence = standard.querySelector('.upgrade-consequence');
      if (consequence) {
        assert.equal(
          card.querySelector('.upgrade-consequence').textContent,
          consequence.textContent,
        );
        assert.ok(card.getAttribute('aria-label').includes(consequence.textContent));
      }
      card.click();
      card.disabled = true;
      card.click();
      assert.deepEqual(chosen, [options.offer.id]);
      assert.deepEqual(options, before);
    }
});

test('Raid XL field facts expose exact localized amounts visibly and in ARIA without repeating next prose', () => {
  const fields = raidXLCases().filter(({ offer }) => offer.kind === 'field');
  assert.deepEqual(
    fields.map(({ offer }) => offer.system),
    ['field-repair', 'field-reroll', 'field-score'],
  );
  for (const options of fields)
    for (const locale of ['en', 'uk']) {
      const card = createOverflightHuntUpgradeCard({
        ...options,
        document: raidXLDocument(),
        locale,
        expandedComparison: true,
      });
      const amount = card.querySelector('.raid-upgrade-preview-amount').textContent;
      assert.ok(amount.startsWith('+' + options.offer.amount.toLocaleString(locale) + ' '));
      assert.ok(card.getAttribute('aria-label').includes(amount));
      assert.equal(card.querySelectorAll('.raid-upgrade-preview-amount').length, 1);
      assert.equal(card.querySelector('.upgrade-description'), null);
      const rows = card.querySelectorAll('.upgrade-comparison-state');
      assert.equal(rows[1].children[1].textContent, options.offer.next[locale]);
      const original = createOverflightHuntUpgradeCard({
        ...options,
        document: raidXLDocument(),
        locale,
      });
      assert.ok(original.getAttribute('aria-label').includes(rows[0].children[1].textContent));
      assert.doesNotMatch(amount, /undefined|NaN|Infinity/);
    }
});

test('Raid XL plating uses the real localized hull-loss owner and localized numbers for both ranks', () => {
  for (const { offer } of examples().filter(({ offer }) => offer.system === 'plating'))
    for (const locale of ['en', 'uk']) {
      assert.equal(
        overflightHuntText(locale, 'damageTaken'),
        OVERFLIGHT_HUNT_COPY[locale].damageTaken,
      );
      assert.equal(typeof OVERFLIGHT_HUNT_COPY[locale].damageTaken, 'string');
      const model = overflightHuntPreviewModel(offer);
      const card = createOverflightHuntUpgradeCard({
        document: raidXLDocument(),
        offer,
        locale,
        expandedComparison: true,
      });
      const rows = card.querySelectorAll('.upgrade-comparison-state');
      for (const [index, parameters] of [model.before, model.after].entries()) {
        const fact =
          OVERFLIGHT_HUNT_COPY[locale].damageTaken +
          ': −' +
          (20 * (1 - parameters.armorReduction)).toLocaleString(locale);
        assert.equal(rows[index].children[2].textContent, fact);
        assert.ok(card.getAttribute('aria-label').includes(fact));
        assert.equal(
          rows[index].children[1].textContent,
          overflightHuntPreviewCaption('plating', parameters, locale),
        );
        assert.doesNotMatch(fact, /undefined|NaN|Infinity|000000000/);
      }
    }
});
