import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { parse as parseHTML, parseFragment } from 'parse5';
import { Document, Element } from './helpers/couch-dom.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import { createOverflightRun, rerollOverflightUpgrades } from '../overflight/core.mjs';
import { draftOverflightUpgrades } from '../overflight/upgrades.mjs';
import { createOverflightUpgradeCard } from '../overflight/upgrade-card.mjs';
import { overflightText } from '../overflight/copy.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import { draftOverflightHuntUpgrades } from '../overflight/raid-upgrades.mjs';
import { createOverflightRaidVariant } from '../overflight/raid-variants.mjs';

const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const sync = ast.body.find(
  (node) => node.type === 'FunctionDeclaration' && node.id.name === 'syncUpgrade',
);
function find(node, predicate, seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return null;
  seen.add(node);
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      const result = find(child, predicate, seen);
      if (result) return result;
    }
  }
  return null;
}
const handler = find(
  ast,
  (node) => node.type === 'ArrayExpression' && node.elements[0]?.value === 'reroll-upgrades',
).elements[2];
const entries = await Promise.all(
  ['play', 'raid'].map(async (name) => [
    name,
    parseHTML(await readFile(new URL(`../overflight/${name}.html`, import.meta.url), 'utf8')),
  ]),
);
const modes = {
  play: {
    createCard: createOverflightUpgradeCard,
    reroll: rerollOverflightUpgrades,
    text: overflightText,
  },
  raid: OVERFLIGHT_HUNT_MODE,
};
const copy = {
  en: 'Uses 1 reroll. Some or all cards may repeat.',
  uk: 'Витрачає 1 заміну. Деякі або всі картки можуть повторитися.',
};
function stagedRun(entry, rulesVersion = 4, limited = false) {
  let run;
  if (entry === 'raid') {
    const mode = modes.raid;
    run = mode.createRun(mode.compileProject(mode.createProject({ seed: 42, rulesVersion })));
    run.offers = draftOverflightHuntUpgrades(run.build, run.compiled.upgrades.modules, () => 0.5);
  } else {
    const project = createOverflightProject({ seed: 42, rulesVersion });
    if (limited) project.upgrades.modules = ['primary'];
    run = createOverflightRun(compileOverflightProject(project));
    run.offers = draftOverflightUpgrades(
      run.build,
      run.compiled.upgrades.modules,
      () => 0.5,
      [],
      run.rulesVersion,
    );
  }
  // Explicit native draft staging qualifies rendering/operation boundaries,
  // not a player earning this upgrade in a completed flight.
  run.phase = 'upgrade';
  return run;
}
function host(entry, run, { mode = modes[entry], choose = () => {} } = {}) {
  const document = new Document();
  const convert = (node) => {
    if (node.nodeName === '#text') return document.createTextNode(node.value);
    const element = document.createElement(node.tagName);
    for (const { name, value } of node.attrs ?? []) element.setAttribute(name, value);
    element.append(
      ...(node.childNodes ?? []).filter((child) => child.nodeName !== '#comment').map(convert),
    );
    return element;
  };
  class CardElement extends Element {
    set innerHTML(markup) {
      assert.equal(this.className, 'upgrade-preview');
      this.replaceChildren(...parseFragment(markup).childNodes.map(convert));
    }
  }
  document.createElement = (tag) => new CardElement(document, tag);
  const markup = entries.find(([name]) => name === entry)[1];
  document.body.append(
    convert(
      find(markup, (node) =>
        node.attrs?.some(({ name, value }) => name === 'id' && value === 'upgrade-dialog'),
      ),
    ),
  );
  const $ = (id) => document.getElementById(id);
  let locale = 'en',
    reviewing = false;
  const context = {
    run,
    compiled: run.compiled,
    mode,
    doc: document,
    $,
    offerKey: '',
    getLocale: () => locale,
    text: (key) => mode.text(locale, key),
    review: { active: () => reviewing },
    display: { snapshot: () => ({ effectiveReducedEffects: true }) },
    moduleIcon: () => document.createElement('span'),
    renderer: null,
    choose,
    releaseInput: () => {},
    sound: { pause: () => {} },
    commentator: null,
    updateShell: () => {},
    audio: { update: () => {} },
  };
  const owner = runInNewContext(
    `${source.slice(sync.start, sync.end)}; ({syncUpgrade, click: ${source.slice(handler.start, handler.end)}})`,
    context,
  );
  $('reroll-upgrades').addEventListener('click', owner.click);
  return {
    document,
    $,
    click: owner.click,
    render(language = locale, review = false) {
      locale = language;
      reviewing = review;
      owner.syncUpgrade(true);
    },
  };
}

for (const entry of ['play', 'raid']) {
  test(`${entry}: actual upgrade owner exposes localized reroll cost/repetition without changing the paused draft`, () => {
    const run = stagedRun(entry),
      before = JSON.stringify(run),
      h = host(entry, run);
    for (const locale of ['en', 'uk', 'en']) {
      h.render(locale);
      assert.equal(h.$('reroll-hint')?.textContent, copy[locale]);
      assert.equal(
        h.$('reroll-upgrades').getAttribute('aria-describedby'),
        'reroll-hint rerolls-left',
      );
      assert.equal(h.$('reroll-upgrades').textContent, modes[entry].text(locale, 'reroll'));
      assert.equal(h.$('rerolls-left').textContent, `2 ${modes[entry].text(locale, 'rerolls')}`);
      assert.equal(h.$('reroll-upgrades').disabled, false);
      assert.equal(JSON.stringify(run), before);
      const first = h.$('upgrade-cards').children[0];
      first.focus();
      h.render(locale);
      assert.equal(h.document.activeElement.dataset.upgradeId, first.dataset.upgradeId);
    }
    h.render('uk', true);
    assert.equal(h.$('reroll-upgrades').disabled, true);
    h.$('reroll-upgrades').click();
    assert.equal(JSON.stringify(run), before);
  });

  test(`${entry}: actual reroll handler spends one native token and otherwise matches the exact native operation`, () => {
    const run = stagedRun(entry),
      direct = structuredClone(run),
      h = host(entry, run);
    h.render('uk');
    assert.equal(modes[entry].reroll(direct), true);
    h.$('reroll-upgrades').click();
    assert.equal(JSON.stringify(run), JSON.stringify(direct));
    assert.equal(run.progression.rerolls, 1);
    assert.equal(run.stats.rerollsUsed, 1);
    assert.equal(run.progression.choices, 0);
    assert.equal(run.phase, 'upgrade');
    assert.equal(run.time, 0);
    assert.equal(run.tick, 0);
    assert.equal(h.document.activeElement, h.$('upgrade-cards').children[0]);
    assert.equal(h.$('reroll-hint')?.textContent, copy.uk);
    assert.equal(modes[entry].reroll(direct), true);
    h.$('reroll-upgrades').click();
    assert.equal(JSON.stringify(run), JSON.stringify(direct));
    assert.equal(run.progression.rerolls, 0);
    assert.equal(h.$('reroll-upgrades').disabled, true);
    const exhausted = JSON.stringify(run);
    h.$('reroll-upgrades').click();
    assert.equal(JSON.stringify(run), exhausted);
  });
}

test('authored primary-only Survival retains a valid all-repeat reroll across legacy and current native rules', () => {
  for (const rulesVersion of [1, 2, 3, 4]) {
    const run = stagedRun('play', rulesVersion, true),
      direct = structuredClone(run),
      h = host('play', run);
    const previous = run.offers.map((offer) => offer.id),
      encounterRandom = run._randomState;
    h.render();
    assert.equal(rerollOverflightUpgrades(direct), true);
    h.$('reroll-upgrades').click();
    assert.deepEqual(
      run.offers.map((offer) => offer.id),
      previous,
    );
    assert.equal(run.progression.rerolls, 1);
    assert.equal(run.stats.rerollsUsed, 1);
    assert.equal(run._randomState, encounterRandom);
    assert.equal(JSON.stringify(run), JSON.stringify(direct));
  }
});

function marathonRefit(count) {
  const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: 'marathon' });
  const run = mode.createRun(
    mode.compileProject(mode.createProject({ seed: 42, rulesVersion: 3 })),
  );
  Object.assign(run.build.hunt, {
    'strike-width': 2,
    'boost-duration': 2,
    'boost-cooldown': 2,
    'chain-window': 2,
  });
  run.progression.rerolls = count;
  run.hunt.pendingChoices = 1;
  assert.ok(count < run.compiled.combat.supplies.rerollCap);
  mode.start(run);
  mode.step(run, {});
  assert.equal(run.phase, 'upgrade');
  assert.ok(run.offers.some((offer) => offer.id === 'field-reroll'));
  return { mode, run };
}

// Stage a legal native Marathon refit, not a claim of earning it in a browser.
test('native Recalibrate comparison uses current legal EN/UK counts and preserves locale-rebuild facts and focus', () => {
  for (const [count, en, uk] of [
    [0, '0 rerolls', '0 перевиборів'],
    [1, '1 reroll', '1 перевибір'],
    [2, '2 rerolls', '2 перевибори'],
  ]) {
    const { mode, run } = marathonRefit(count),
      before = JSON.stringify(run),
      h = host('raid', run, { mode });
    h.render('en');
    const initial = [...h.$('upgrade-cards').children].find(
      (card) => card.dataset.upgradeId === 'field-reroll',
    );
    initial.focus();
    for (const locale of ['en', 'uk', 'en']) {
      h.render(locale);
      const field = [...h.$('upgrade-cards').children].find(
        (card) => card.dataset.upgradeId === 'field-reroll',
      );
      const current = locale === 'uk' ? uk : en;
      const next = run.offers.find((offer) => offer.id === 'field-reroll').next[locale];
      assert.equal(field.querySelector('.upgrade-description').textContent, `${current} → ${next}`);
      assert.ok(field.getAttribute('aria-label').includes(`${current} → ${next}`));
      if (count === 1)
        assert.doesNotMatch(field.getAttribute('aria-label'), /1 rerolls|1 перевиборів/);
      assert.equal(h.document.activeElement.dataset.upgradeId, 'field-reroll');
      assert.equal(
        JSON.stringify(run),
        before,
        'Rendering cannot change even serialized offer copy',
      );
    }
  }
});

test('Recalibrate presentation still delegates exactly one native choice and rerolls match direct core transactions', () => {
  for (const count of [0, 1, 2]) {
    const { mode, run } = marathonRefit(count),
      direct = structuredClone(run),
      h = host('raid', run, { mode, choose: (id) => mode.choose(run, id) });
    h.render('uk');
    const field = [...h.$('upgrade-cards').children].find(
      (card) => card.dataset.upgradeId === 'field-reroll',
    );
    assert.equal(mode.choose(direct, 'field-reroll'), true);
    field.click();
    assert.equal(JSON.stringify(run), JSON.stringify(direct));
    assert.equal(run.progression.rerolls, count + 1);
    assert.equal(run.progression.choices, 1);
    assert.equal(mode.choose(run, 'field-reroll'), false);
    assert.equal(JSON.stringify(run), JSON.stringify(direct));

    const staged = marathonRefit(count),
      rerolled = structuredClone(staged.run),
      owner = host('raid', staged.run, { mode: staged.mode });
    owner.render('uk');
    const accepted = staged.mode.reroll(rerolled);
    owner.$('reroll-upgrades').click();
    assert.equal(accepted, count > 0);
    assert.equal(JSON.stringify(staged.run), JSON.stringify(rerolled));
    assert.equal(staged.run.progression.choices, 0);
    assert.equal(staged.run.progression.rerolls, Math.max(0, count - 1));
    for (const locale of ['en', 'uk']) {
      owner.render(locale);
      const field = [...owner.$('upgrade-cards').children].find(
        (card) => card.dataset.upgradeId === 'field-reroll',
      );
      const remaining = Math.max(0, count - 1);
      const current =
        locale === 'uk'
          ? remaining === 1
            ? '1 перевибір'
            : '0 перевиборів'
          : remaining === 1
            ? '1 reroll'
            : '0 rerolls';
      assert.ok(
        field.querySelector('.upgrade-description').textContent.startsWith(`${current} → `),
      );
      assert.equal(JSON.stringify(staged.run), JSON.stringify(rerolled));
    }
  }
});
