import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFragment } from 'parse5';
import {
  createOverflightBuild,
  legalOverflightUpgrades,
  applyOverflightUpgrade,
  draftOverflightUpgrades,
  overflightModuleParameters,
  overflightPayload,
} from '../overflight/upgrades.mjs';
import {
  overflightUpgradePreview,
  overflightUpgradePreviewModel,
} from '../overflight/upgrade-preview.mjs';

const modules = ['primary', 'slow-field', 'proximity-pulse', 'side-burst', 'scanner', 'shield'];
function examples() {
  const result = [];
  for (const branch of ['wide', 'double']) {
    const build = createOverflightBuild();
    for (let rank = 2; rank <= 4; rank++) {
      const offer = legalOverflightUpgrades(build, modules).find(
        (item) => item.id === `primary:${branch}:${rank}`,
      );
      result.push({ offer, build: structuredClone(build) });
      assert.ok(applyOverflightUpgrade(build, offer, modules));
    }
  }
  for (const system of modules.slice(1)) {
    const build = createOverflightBuild();
    for (let rank = 1; rank <= 3; rank++) {
      const offer = legalOverflightUpgrades(build, modules).find(
        (item) => item.id === `${system}:${rank}`,
      );
      result.push({ offer, build: structuredClone(build) });
      assert.ok(applyOverflightUpgrade(build, offer, modules));
    }
  }
  const build = createOverflightBuild();
  build.primary = { rank: 4, branch: 'wide', evolved: true };
  for (const offer of draftOverflightUpgrades(build, ['primary'], () => 0.5))
    result.push({ offer, build });
  return result;
}
const walk = (node) => [node, ...(node.childNodes ?? []).flatMap(walk)];
const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;

test('every legal branch, module rank and fallback utility has informative EN/UK SVG before/after views', () => {
  const cases = examples();
  assert.equal(cases.length, 24);
  for (const { offer, build } of cases) {
    for (const locale of ['en', 'uk']) {
      const markup = overflightUpgradePreview(offer, { locale, build });
      const nodes = walk(parseFragment(markup));
      const svg = nodes.find((node) => node.tagName === 'svg');
      assert.equal(attribute(svg, 'role'), 'img', offer.id);
      assert.ok(attribute(svg, 'aria-label').includes(locale === 'uk' ? 'ЗАРАЗ' : 'NOW'), offer.id);
      assert.ok(attribute(svg, 'aria-label').includes(locale === 'uk' ? 'ДАЛІ' : 'NEXT'), offer.id);
      assert.equal(nodes.filter((node) => node.tagName === 'title').length, 1);
      assert.ok(
        nodes.some((node) => node.tagName === 'path'),
        offer.id,
      );
      assert.ok(
        !nodes.some((node) =>
          ['script', 'image', 'foreignObject', 'animate'].includes(node.tagName),
        ),
        offer.id,
      );
      assert.doesNotMatch(markup, /NaN|undefined|Infinity|onload=/, offer.id);
    }
  }
});

test('comparison models preserve actual current build and share runtime weapon tuning', () => {
  for (const { offer, build } of examples()) {
    const snapshot = structuredClone(build);
    const model = overflightUpgradePreviewModel(offer, { build });
    if (offer.system === 'primary') {
      assert.deepEqual(model.before, {
        ...overflightPayload(build),
        rank: build.primary.rank,
        delay: 0.45,
      });
      const next = structuredClone(build);
      assert.ok(applyOverflightUpgrade(next, offer, modules));
      assert.deepEqual(model.after, { ...overflightPayload(next), rank: offer.rank, delay: 0.45 });
    } else if (offer.kind !== 'utility') {
      assert.deepEqual(model.before, {
        ...overflightModuleParameters(offer.system, offer.rank - 1),
        rank: offer.rank - 1,
      });
      assert.deepEqual(model.after, {
        ...overflightModuleParameters(offer.system, offer.rank),
        rank: offer.rank,
      });
    }
    assert.deepEqual(build, snapshot, 'preview must not upgrade the actual run');
  }
});

test('reduced effects keeps all comparison geometry without running CSS animations', () => {
  for (const { offer, build } of examples()) {
    const animated = overflightUpgradePreview(offer, { build });
    const reduced = overflightUpgradePreview(offer, { build, reducedEffects: true });
    assert.doesNotMatch(reduced, /@keyframes|animation:|<style>/, offer.id);
    const shapes = (markup) =>
      walk(parseFragment(markup)).filter((node) =>
        ['path', 'rect', 'circle'].includes(node.tagName),
      ).length;
    assert.equal(
      shapes(reduced),
      shapes(animated),
      `${offer.id}: motion preference cannot hide explanatory effects`,
    );
    if (animated.includes('@keyframes')) assert.match(animated, /prefers-reduced-motion:reduce/);
  }
});

test('pulse diagrams distinguish movement charge and use live cadence, radius and both return hits', () => {
  const { offer, build } = examples().find((entry) => entry.offer.id === 'proximity-pulse:3');
  const params = overflightModuleParameters('proximity-pulse', 3);
  const markup = overflightUpgradePreview(offer, { build });
  assert.match(markup, /Fly to charge/);
  assert.ok(
    markup.includes(
      `${params.damage}+${params.returnDamage} → ${params.chargedDamage}+${params.chargedReturnDamage}`,
    ),
  );
  assert.ok(markup.includes(`${params.chargedCooldown}s`));
  assert.ok(markup.includes(`r="${Number((params.chargedRadius * 0.29).toFixed(2))}"`));
  assert.match(markup, /hitreturn/);
});

test('utility previews use current hull, scanner collection and capped healing', () => {
  const build = createOverflightBuild();
  build.support = { id: 'scanner', rank: 3 };
  const player = { hull: 90, maxHull: 100, boostCooldown: 1.2 };
  const utility = (system) => overflightUpgradePreviewModel({ system, rank: 1 }, { build, player });
  assert.equal(utility('repair').after.hull, 100);
  assert.equal(utility('reinforce').after.hull, 102);
  assert.equal(utility('reinforce').after.maxHull, 112);
  assert.equal(
    utility('recovery').before.collectionRadius,
    overflightModuleParameters('scanner', 3).collectionRadius,
  );
  assert.equal(utility('recovery').after.collectionRadius, 260);
  assert.equal(utility('recovery').after.boostCooldown, 0);
});

test('preview rejects unknown systems, ranks and untrusted SVG scope input', () => {
  assert.throws(() => overflightUpgradePreview({ system: '<script>', rank: 1 }), /Unsupported/);
  assert.throws(
    () => overflightUpgradePreview({ system: 'primary', branch: '" onload="alert(1)', rank: 2 }),
    /valid primary/,
  );
  assert.throws(() => overflightUpgradePreview({ system: 'shield', rank: 4 }), /valid module/);
  assert.throws(
    () => overflightUpgradePreview({ system: 'repair', rank: Infinity }),
    /positive rank/,
  );
  assert.doesNotMatch(
    overflightUpgradePreview({ system: 'repair', rank: 1, branch: '" onload="alert(1)' }),
    /onload|alert/,
  );
});
