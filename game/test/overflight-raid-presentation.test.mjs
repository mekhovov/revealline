import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  HUNT_UPGRADE_IDS,
  createOverflightHuntBuild,
  legalOverflightHuntUpgrades,
  applyOverflightHuntUpgrade,
  overflightHuntUpgradeParameters,
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
