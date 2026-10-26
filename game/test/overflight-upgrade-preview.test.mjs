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
  createOverflightUpgradePreviewSprites,
  overflightUpgradePreviewCaptions,
} from '../overflight/upgrade-preview.mjs';

import {
  createOverflightRiyBuild,
  legalOverflightRiyUpgrades,
  applyOverflightRiyUpgrade,
} from '../overflight/riy-upgrades.mjs';

const modules = [
  'primary',
  'slow-field',
  'proximity-pulse',
  'side-burst',
  'scanner',
  'shield',
  'plating',
];
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
    for (let rank = 1; rank <= (system === 'plating' ? 2 : 3); rank++) {
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

test('expanded current/next text retains every existing SVG caption and plating diagram value', () => {
  const escorts = [];
  const initial = createOverflightBuild();
  initial.escorts = createOverflightRiyBuild();
  for (const first of legalOverflightRiyUpgrades(initial)) {
    const build = structuredClone(initial);
    escorts.push({ offer: first, build: structuredClone(build) });
    assert.ok(applyOverflightRiyUpgrade(build, first, modules));
    for (const offer of legalOverflightRiyUpgrades(build).filter(
      (item) => item.role === first.role,
    ))
      escorts.push({ offer, build: structuredClone(build) });
  }
  assert.equal(escorts.length, 8, 'Both roles, both branches and both legal ranks.');
  for (const { offer, build } of [...examples(), ...escorts])
    for (const locale of ['en', 'uk']) {
      const before = structuredClone(build);
      const captions = overflightUpgradePreviewCaptions(offer, { build, locale });
      const svg = parseFragment(overflightUpgradePreview(offer, { build, locale })).childNodes.find(
        (node) => node.tagName === 'svg',
      );
      const panels = svg.childNodes.filter((node) => node.tagName === 'g');
      assert.equal(panels.length, 2);
      const text = (node) =>
        node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
      for (const [index, panel] of panels.entries()) {
        const existing = walk(panel)
          .filter((node) => node.tagName === 'text')
          .map(text);
        const current = captions[index];
        assert.deepEqual(
          [current.label, ...current.lines, current.diagramText].filter(Boolean).sort(),
          existing.sort(),
          `${locale}: ${offer.id} state ${index}`,
        );
      }
      assert.deepEqual(build, before, 'A text projection cannot apply an upgrade.');
    }
});

test('every legal branch, module rank and fallback utility has informative EN/UK SVG before/after views', () => {
  const cases = examples();
  assert.equal(cases.length, 26);
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
      assert.deepEqual(model.after, {
        ...overflightPayload(next),
        rank: offer.rank,
        delay: 0.45,
      });
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
    const reduced = overflightUpgradePreview(offer, {
      build,
      reducedEffects: true,
    });
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
    () =>
      overflightUpgradePreview({
        system: 'primary',
        branch: '" onload="alert(1)',
        rank: 2,
      }),
    /valid primary/,
  );
  assert.throws(() => overflightUpgradePreview({ system: 'shield', rank: 4 }), /valid module/);
  assert.throws(
    () => overflightUpgradePreview({ system: 'repair', rank: Infinity }),
    /positive rank/,
  );
  assert.doesNotMatch(
    overflightUpgradePreview({
      system: 'repair',
      rank: 1,
      branch: '" onload="alert(1)',
    }),
    /onload|alert/,
  );
});

test('V3 Echo demonstrates a rear trail while legacy previews retain concentric geometry', () => {
  const offer = { system: 'primary', branch: 'double', rank: 4 };
  const modern = overflightUpgradePreviewModel(offer, { rulesVersion: 3 });
  const legacy = overflightUpgradePreviewModel(offer);
  assert.deepEqual(modern.after.rearOffsets, [56, 108, 160]);
  assert.deepEqual(modern.after.echoRadii, [44, 52, 60]);
  assert.equal(legacy.after.rearOffsets, undefined);
  const markup = overflightUpgradePreview(offer, { rulesVersion: 3 });
  assert.match(markup, /Rear trail/);
  assert.doesNotMatch(markup, /NaN|undefined|Infinity/);
  const nodes = walk(parseFragment(markup));
  const impacts = nodes.filter(
    (node) => node.tagName === 'circle' && attribute(node, 'stroke-dasharray') === '2 3',
  );
  for (const impact of impacts) {
    const offset = (72 - Number(attribute(impact, 'cx'))) / 0.2;
    assert.ok([108, 160].includes(Math.round(offset)), 'echoes stay behind the release point');
  }
  assert.match(markup, /translate\(72 66\)/, 'the drone starts at the common release origin');
});

test('salvage diagrams collect only reachable pickups and retain current-to-upgraded radius differences', () => {
  const counts = (markup) => {
    const styles = walk(parseFragment(markup)).find((node) => node.tagName === 'style');
    const css = styles.childNodes.map((node) => node.value ?? '').join('');
    return [0, 1].map(
      (panel) => (css.match(new RegExp(`@keyframes [^{]+-${panel}-salvage-`, 'g')) ?? []).length,
    );
  };
  assert.deepEqual(counts(overflightUpgradePreview({ system: 'scanner', rank: 1 })), [1, 2]);
  assert.deepEqual(counts(overflightUpgradePreview({ system: 'scanner', rank: 3 })), [2, 3]);
  assert.deepEqual(counts(overflightUpgradePreview({ system: 'recovery', rank: 1 })), [0, 4]);
});

test('native card strips reuse prepared sprites once, release staging canvases and retain reduced-motion fallback', () => {
  const canvases = [],
    paints = [];
  const document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = {
        getContext: () => ({}),
        toDataURL: () => 'data:image/png;base64,cHJldmlldw==',
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  const paintSprite = (_context, ...args) => paints.push(args);
  const sprites = createOverflightUpgradePreviewSprites(document, paintSprite);
  assert.deepEqual(
    paints.map((args) => args[0]),
    ['drone', 'drone', 'drone', 'drone', 'enemy'],
  );
  assert.deepEqual(
    paints.slice(0, 4).map((args) => args[4]),
    [0, 1 / 30, 2 / 30, 3 / 30],
  );
  assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
  const offer = { system: 'primary', branch: 'double', rank: 4 };
  const markup = overflightUpgradePreview(offer, { rulesVersion: 4, sprites });
  assert.match(markup, /<image href="data:image\/png;base64,/);
  assert.match(markup, /steps\(4,end\)/);
  assert.match(markup, /Rear trail/);
  assert.match(markup, /prefers-reduced-motion:reduce/);
  const still = createOverflightUpgradePreviewSprites(document, paintSprite, true);
  assert.equal(still.drone.frames, 1);
  assert.doesNotMatch(
    overflightUpgradePreview(offer, { sprites: still, reducedEffects: true }),
    /@keyframes|animation:|<style>/,
  );
  assert.equal(createOverflightUpgradePreviewSprites(document), null);
  assert.equal(
    createOverflightUpgradePreviewSprites(
      { createElement: () => ({ getContext: () => null }) },
      paintSprite,
    ),
    null,
  );
});

test('Riy previews preserve authored escort geometry and independently show all four branches', async () => {
  const { OVERFLIGHT_RIY_DEFAULTS_V2 } = await import('../overflight/riy-project.mjs');
  const { overflightRiyEscortParameters } = await import('../overflight/riy-upgrades.mjs');
  const settings = structuredClone(OVERFLIGHT_RIY_DEFAULTS_V2);
  settings.escorts[0].damage = 19;
  for (const [role, branches] of [
    ['sweeper', ['broad', 'trail']],
    ['breaker', ['burst', 'chain']],
  ]) {
    for (const branch of branches) {
      const offer = {
        system: `riy-${role}`,
        role,
        branch,
        rank: 2,
        currentRank: 1,
      };
      const model = overflightUpgradePreviewModel(offer, {
        riySettings: settings,
      });
      const config = settings.escorts.find((entry) => entry.role === role);
      assert.deepEqual(
        model.before,
        overflightRiyEscortParameters(config, { rank: 1, branch: null }),
      );
      assert.deepEqual(model.after, overflightRiyEscortParameters(config, { rank: 2, branch }));
      for (const locale of ['en', 'uk']) {
        const markup = overflightUpgradePreview(offer, {
          riySettings: settings,
          locale,
          reducedEffects: true,
        });
        assert.doesNotMatch(markup, /NaN|undefined|Infinity|@keyframes/);
        assert.match(markup, /<path/);
      }
    }
  }
  assert.throws(
    () =>
      overflightUpgradePreview({
        system: 'riy-sweeper',
        branch: '" onload="alert(1)',
        rank: 2,
      }),
    /valid escort/,
  );
});
