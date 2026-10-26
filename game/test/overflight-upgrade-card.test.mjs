import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { Document, Element } from './helpers/couch-dom.mjs';
import { createOverflightUpgradeCard } from '../overflight/upgrade-card.mjs';
import {
  createOverflightBuild,
  legalOverflightUpgrades,
  utilityOffers,
} from '../overflight/upgrades.mjs';
import {
  createOverflightRiyBuild,
  legalOverflightRiyUpgrades,
} from '../overflight/riy-upgrades.mjs';
import { overflightUpgradePreviewCaptions } from '../overflight/upgrade-preview.mjs';

function cardDocument() {
  const document = new Document();
  // Parse the actual code-owned SVG. Geometry/animation need the native browser;
  // keep the shared navigation fixture's ban on arbitrary HTML untouched.
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

for (const locale of ['en', 'uk'])
  test(`${locale}: expanded native cards expose the same facts and retain one offered action`, () => {
    const build = createOverflightBuild();
    build.escorts = createOverflightRiyBuild();
    const offers = [
      ...legalOverflightUpgrades(build, [
        'primary',
        'slow-field',
        'proximity-pulse',
        'side-burst',
        'scanner',
        'shield',
        'plating',
      ]),
      ...legalOverflightRiyUpgrades(build),
      ...utilityOffers(build),
    ];
    const before = structuredClone(build),
      player = { hull: 63, maxHull: 100, boostCooldown: 1.2 };
    for (const offer of offers) {
      const document = cardDocument(),
        chosen = [],
        options = { document, offer, build, player, locale, rulesVersion: 4 };
      const ordinary = createOverflightUpgradeCard(options);
      assert.equal(ordinary.querySelector('.upgrade-comparison'), null);
      const expanded = createOverflightUpgradeCard({
        ...options,
        expandedComparison: true,
        onChoose: (id) => chosen.push(id),
      });
      document.body.append(expanded);
      const rows = expanded.querySelectorAll('.upgrade-comparison-state');
      assert.equal(rows.length, 2, offer.id);
      for (const [index, facts] of overflightUpgradePreviewCaptions(offer, options).entries())
        assert.deepEqual(
          [...rows[index].children].map((node) => node.textContent),
          [facts.label, ...facts.lines, facts.diagramText].filter(Boolean),
          offer.id,
        );
      assert.equal(expanded.getAttribute('aria-label'), ordinary.getAttribute('aria-label'));
      assert.equal(expanded.querySelector('svg').getAttribute('viewBox'), '0 0 320 154');
      assert.deepEqual(chosen, [], 'Rendering must not select an offer.');
      expanded.focus();
      expanded.click();
      assert.deepEqual(chosen, [offer.id]);
      assert.ok(document.activeElement === expanded, 'The offered card retains focus.');
      assert.deepEqual(build, before);
      assert.deepEqual(player, { hull: 63, maxHull: 100, boostCooldown: 1.2 });
    }
  });

test('visual card retains an accessible comparison and chooses the exact offered upgrade', () => {
  const document = cardDocument();
  const build = createOverflightBuild();
  const offer = legalOverflightUpgrades(build, ['primary'])[0];
  const chosen = [];
  const card = createOverflightUpgradeCard({
    document,
    offer,
    build,
    onChoose: (id) => chosen.push(id),
  });
  document.body.append(card);
  assert.equal(card.querySelector('.upgrade-title').textContent, offer.title.en);
  assert.equal(card.querySelector('.upgrade-description').textContent, offer.next.en);
  assert.ok(card.getAttribute('aria-label').includes(`Now: ${offer.current.en}`));
  assert.ok(card.getAttribute('aria-label').includes(`Next: ${offer.next.en}`));
  assert.equal(card.querySelectorAll('.upgrade-preview').length, 1);
  assert.match(card.querySelector('svg').getAttribute('aria-label'), /Visual comparison/);
  assert.ok(
    card.getAttribute('aria-label').includes(card.querySelector('svg').getAttribute('aria-label')),
  );
  assert.equal(card.querySelectorAll('[data-filled="true"]').length, 1);
  assert.equal(card.querySelectorAll('[data-next="true"]').length, 1);
  card.click();
  assert.deepEqual(chosen, [offer.id]);
  assert.equal(build.primary.rank, 1, 'rendering and activating delegate; only the host applies');
});

test('Ukrainian review cards preserve readable content and cannot choose while disabled', () => {
  const document = cardDocument();
  const build = createOverflightBuild();
  const offer = legalOverflightUpgrades(build, ['shield'])[0];
  const card = createOverflightUpgradeCard({
    document,
    offer,
    build,
    locale: 'uk',
    reducedEffects: true,
    disabled: true,
    onChoose: () => assert.fail('review-only card activated'),
  });
  document.body.append(card);
  assert.equal(card.querySelector('.upgrade-title').textContent, offer.title.uk);
  assert.match(card.querySelector('.upgrade-kind').textContent, /Підтримка/);
  assert.ok(card.getAttribute('aria-label').includes(offer.next.uk));
  assert.match(card.querySelector('svg').getAttribute('aria-label'), /Візуальне порівняння/);
  assert.equal(card.querySelector('svg').querySelectorAll('style').length, 0);
  card.click();
});

test('Survivor and Riy cards consume the native sprite adapter while keeping the same accessible comparison', () => {
  const build = createOverflightBuild();
  const survivor = legalOverflightUpgrades(build, ['primary'])[0];
  const riy = {
    ...survivor,
    id: 'riy-sweeper:broad:2',
    system: 'riy-sweeper',
    role: 'sweeper',
    branch: 'broad',
    rank: 2,
    currentRank: 1,
  };
  for (const offer of [survivor, riy]) {
    const document = cardDocument(),
      create = document.createElement,
      calls = [],
      surfaces = [];
    document.createElement = (tag) => {
      const element = create(tag);
      if (tag === 'canvas') {
        element.getContext = () => ({});
        element.toDataURL = () => 'data:image/png;base64,bmF0aXZl';
        surfaces.push(element);
      }
      return element;
    };
    const card = createOverflightUpgradeCard({
      document,
      offer,
      build,
      rulesVersion: 4,
      paintSprite: (_context, kind) => calls.push(kind),
    });
    assert.deepEqual(calls, ['drone', 'drone', 'drone', 'drone', 'enemy']);
    assert.ok(card.querySelectorAll('image').length >= 4);
    assert.equal(card.querySelectorAll('canvas').length, 0);
    assert.ok(surfaces.every((surface) => surface.width === 0 && surface.height === 0));
    assert.match(card.getAttribute('aria-label'), /Visual comparison.*NOW:.*NEXT:/);
    assert.equal(card.querySelector('.upgrade-description').textContent, offer.next.en);
  }
});
