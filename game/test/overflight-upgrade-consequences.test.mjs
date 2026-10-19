import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { Document, Element } from './helpers/couch-dom.mjs';
import { createOverflightUpgradeCard } from '../overflight/upgrade-card.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightBuild,
  legalOverflightUpgrades,
  applyOverflightUpgrade,
} from '../overflight/upgrades.mjs';
import { createOverflightRun, chooseOverflightUpgrade } from '../overflight/core.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';

const modules = [
  'primary',
  'slow-field',
  'proximity-pulse',
  'side-burst',
  'scanner',
  'shield',
  'plating',
];
function compiledFor(allowed = modules, rulesVersion = 4) {
  const project = createOverflightProject({ rulesVersion });
  project.upgrades.modules = allowed.filter((id) => rulesVersion > 1 || id !== 'plating');
  return compileOverflightProject(project);
}
function cardDocument() {
  const document = new Document();
  class CardElement extends Element {
    set innerHTML(markup) {
      assert.equal(this.className, 'upgrade-preview');
      const convert = (source) => {
        if (source.nodeName === '#text') return document.createTextNode(source.value);
        const node = document.createElement(source.tagName);
        for (const { name, value } of source.attrs ?? []) node.setAttribute(name, value);
        node.append(...(source.childNodes ?? []).map(convert));
        return node;
      };
      this.replaceChildren(...parseFragment(markup).childNodes.map(convert));
    }
  }
  document.createElement = (tag) => new CardElement(document, tag);
  return document;
}
const legal = (build, compiled) =>
  legalOverflightUpgrades(build, compiled.upgrades.modules, compiled.rulesVersion);
function install(build, compiled, system, rank, branch) {
  const offer = legal(build, compiled).find(
    (value) =>
      value.system === system && value.rank === rank && (!branch || value.branch === branch),
  );
  assert.ok(offer, `native legal offer ${system}:${branch ?? ''}:${rank}`);
  assert.equal(
    applyOverflightUpgrade(build, offer, compiled.upgrades.modules, compiled.rulesVersion),
    true,
  );
  return offer;
}
function cardFor(build, compiled, system, rank, locale = 'en', options = {}) {
  const offer = legal(build, compiled).find(
    (value) => value.system === system && value.rank === rank,
  );
  assert.ok(offer);
  const card = createOverflightUpgradeCard({
    document: cardDocument(),
    offer,
    build,
    compiled,
    rulesVersion: compiled.rulesVersion,
    locale,
    reducedEffects: true,
    ...options,
  });
  return {
    card,
    offer,
    consequence: card.querySelector('.upgrade-consequence')?.textContent ?? '',
  };
}
function parity(card, consequence) {
  assert.ok(consequence, 'the consequence is visible');
  assert.ok(
    card.getAttribute('aria-label').includes(consequence),
    'the same consequence is accessible',
  );
}

test('primary path commitment is visible and accessible before native choice, without changing the build', () => {
  const compiled = compiledFor(),
    build = createOverflightBuild(),
    before = structuredClone(build);
  for (const locale of ['en', 'uk']) {
    const { card, consequence } = cardFor(build, compiled, 'primary', 2, locale);
    parity(card, consequence);
    assert.match(consequence, locale === 'en' ? /payload path.*sortie/ : /шлях.*заряду.*виліт/);
    assert.deepEqual(build, before);
  }
  install(build, compiled, 'primary', 2, 'wide');
  assert.equal(
    legal(build, compiled).some((offer) => offer.branch === 'double'),
    false,
  );
  assert.equal(cardFor(build, compiled, 'primary', 3).consequence, '');
});

test('combat slot consequences follow legal remaining capacity, including authored module restrictions', () => {
  for (const allowed of [modules, ['primary', 'slow-field']]) {
    const compiled = compiledFor(allowed),
      build = createOverflightBuild();
    const first = cardFor(build, compiled, 'slow-field', 1);
    parity(first.card, first.consequence);
    assert.match(first.consequence, allowed.length === 2 ? /1 of 1.*final available/i : /1 of 2/);
    install(build, compiled, 'slow-field', 1);
    assert.equal(cardFor(build, compiled, 'slow-field', 2).consequence, '');
    if (allowed.length === 2) continue;
    const second = cardFor(build, compiled, 'side-burst', 1);
    parity(second.card, second.consequence);
    assert.match(second.consequence, /2 of 2.*final available/i);
    install(build, compiled, 'side-burst', 1);
    assert.equal(
      legal(build, compiled).some((offer) => offer.system === 'proximity-pulse'),
      false,
    );
  }
});

test('support choice and true final ranks are described across all native rules without promising draft cards', () => {
  for (const rulesVersion of [1, 2, 3, 4]) {
    const compiled = compiledFor(modules, rulesVersion),
      build = createOverflightBuild();
    for (const locale of ['en', 'uk']) {
      const { card, consequence } = cardFor(build, compiled, 'shield', 1, locale);
      parity(card, consequence);
      assert.match(
        consequence,
        locale === 'en' ? /support family.*sortie/ : /родину підтримки.*виліт/,
      );
      assert.doesNotMatch(consequence, /guarantee|next draft|завжди/);
    }
    install(build, compiled, 'shield', 1);
    assert.equal(
      legal(build, compiled).some((offer) => offer.system === 'scanner'),
      false,
    );
    assert.equal(cardFor(build, compiled, 'shield', 2).consequence, '');
    install(build, compiled, 'shield', 2);
    const cap = cardFor(build, compiled, 'shield', 3);
    assert.match(cap.consequence, /Maximum module level/);
    install(build, compiled, 'shield', 3);
    assert.equal(
      legal(build, compiled).some((offer) => offer.system === 'shield'),
      false,
    );
  }
  const compiled = compiledFor(),
    build = createOverflightBuild();
  install(build, compiled, 'plating', 1);
  assert.match(cardFor(build, compiled, 'plating', 2, 'uk').consequence, /Найвищий рівень модуля/);
  install(build, compiled, 'side-burst', 1);
  install(build, compiled, 'side-burst', 2);
  assert.match(cardFor(build, compiled, 'side-burst', 3).consequence, /Maximum module level/);
});

test('Riy, missing policy context and unaccepted offers do not inherit Single Drone commitment claims', () => {
  const compiled = compiledFor(),
    build = createOverflightBuild();
  const riy = compileOverflightRiyProject(createOverflightRiyProject({ rulesVersion: 4 }));
  for (const context of [
    undefined,
    riy,
    { ...compiled, sourceFormat: 'OverflightHuntProjectV4' },
  ]) {
    const { consequence } = cardFor(build, compiled, 'primary', 2, 'en', { compiled: context });
    assert.equal(consequence, '');
  }
  const offer = { ...legal(build, compiled)[0], id: 'unaccepted' };
  assert.equal(cardFor(build, compiled, 'primary', 2, 'en', { offer }).consequence, '');
});

test('a native card delegates exactly one accepted choice and preserves the existing comparison', () => {
  const compiled = compiledFor(),
    run = createOverflightRun(compiled);
  run.phase = 'upgrade';
  run.offers = legal(run.build, compiled);
  const before = JSON.stringify(run),
    accepted = [];
  const { card, offer, consequence } = cardFor(run.build, compiled, 'primary', 2, 'en', {
    onChoose: (id) => accepted.push(chooseOverflightUpgrade(run, id)),
  });
  parity(card, consequence);
  assert.equal(JSON.stringify(run), before, 'card preparation cannot advance or save a sortie');
  assert.equal(card.querySelector('.upgrade-description').textContent, offer.next.en);
  assert.match(card.getAttribute('aria-label'), /Now:.*Next:.*Visual comparison/);
  card.click();
  card.click();
  assert.deepEqual(accepted, [true, false]);
  assert.equal(run.progression.choices, 1);
  assert.equal(run.progression.history.length, 1);
  assert.equal(run.time, 0);
  assert.equal(run.tick, 0);
});
