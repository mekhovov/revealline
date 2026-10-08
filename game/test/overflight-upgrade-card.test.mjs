import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { Document, Element } from './helpers/couch-dom.mjs';
import { createOverflightUpgradeCard } from '../overflight/upgrade-card.mjs';
import { createOverflightBuild, legalOverflightUpgrades } from '../overflight/upgrades.mjs';

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
