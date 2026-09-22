import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';

const href = 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox';
const cards = (f) => [...f.$('coop-discovery-list').querySelectorAll('article')];
const enter = (f, element) => {
  element.focus();
  f.tap('Enter');
};
function diagrams(f) {
  const create = f.doc.createElement.bind(f.doc),
    labels = [];
  f.doc.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'canvas') {
      const get = element.getContext?.bind(element);
      element.getContext = (...args) =>
        element.closest('.team-mission-diagram')
          ? get?.(...args)
          : new Proxy(
              {},
              {
                get:
                  (_, name) =>
                  (...values) => {
                    if (name === 'fillText') labels.push(values[0]);
                  },
              },
            );
    }
    return element;
  };
  return labels;
}

test('actual Team chooser displays all12 exact candidate maps and preserves legacy picture previews', async (t) => {
  const f = await page(t, {
      href,
      nativeFocus: true,
      nativeVisibility: true,
      retainInitialDifficulty: true,
    }),
    labels = diagrams(f);
  enter(f, f.$('coop-discovery-open'));
  const all = cards(f),
    candidates = all.filter((card) => card.querySelector('.team-mission-diagram'));
  assert.equal(all.length, 14);
  assert.equal(candidates.length, 12);
  assert.deepEqual(labels, Array.from({ length: 12 }, () => ['1', '2']).flat());
  for (const card of candidates) {
    assert.match(card.querySelector('figcaption').textContent, /^Starting map/);
    assert.match(card.querySelector('.team-mission-difficulty').textContent, /Standard$/);
    assert.equal(card.querySelector('.team-discovery-preview-button'), null);
    assert.equal(
      card.querySelectorAll('button').length,
      1,
      'One direct Play, no misleading picture preview',
    );
  }
  assert.equal(
    f.$('coop-discovery-list').querySelectorAll('.team-discovery-preview-button').length,
    2,
  );
  assert.equal(f.doc.activeElement.textContent, 'Play Twin landings');
  const target = candidates.find(
    (card) => card.querySelector('button').textContent === 'Play Shared lookout',
  );
  enter(f, target.querySelector('button'));
  await waitFor(() => !f.$('coop-discovery-dialog').open);
  assert.equal(f.$('coop-stage').textContent, 'SHARED LOOKOUT');
  assert.equal(f.$('coop-reserves').textContent, '2 reserves');
  assert.equal(f.$('coop-menu').hidden, true);
});

test('reopened Team chooser reports a genuine Skip without claiming a clear', async (t) => {
  const f = await page(t, { href, nativeFocus: true, nativeVisibility: true });
  enter(f, f.$('coop-start'));
  enter(f, f.$('coop-journey-skip'));
  enter(f, f.$('coop-journey-skip-confirm'));
  await waitFor(() => f.$('coop-overlay').hidden);
  enter(f, f.$('coop-pause'));
  enter(f, f.$('coop-discovery-paused'));
  const first = cards(f)[0];
  assert.equal(first.querySelector('button').textContent, 'Play Twin landings');
  assert.equal(
    first.querySelector('.team-mission-completion').textContent,
    'Skipped · revisit whenever you like',
  );
  assert.equal(first.querySelector('button').disabled, false);
  enter(f, f.$('coop-discovery-back'));
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
});

test('same-ID imported edition retains its independent artwork preview and cannot masquerade as an owned map card', async (t) => {
  const f = await page(t, { href, nativeFocus: true, nativeVisibility: true });
  await f.selectFile(
    JSON.stringify(createTeamTestPack(createTeamJourneyCandidates(), 'twin-landings', 'expert')),
  );
  enter(f, f.$('coop-discovery-open'));
  const local = cards(f).find((card) => card.textContent.includes('Local pack · this visit'));
  assert(local);
  assert.equal(local.querySelector('.team-mission-diagram'), null);
  assert.equal(local.querySelector('.team-mission-completion'), null);
  assert(local.querySelector('.team-discovery-preview-button'));
});
