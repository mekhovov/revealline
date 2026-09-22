import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';

const href = 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox';
const cards = (f) => [...f.$('journey-cards').querySelectorAll('.journey-card')];
const enter = (f, element) => {
  element.focus();
  f.tap('Enter');
};
async function open(f, paused = false) {
  enter(f, f.$(paused ? 'coop-discovery-paused' : 'coop-discovery-open'));
  await waitFor(() => f.$('journey-chooser')?.open);
}

test('actual Team chooser displays all12 exact candidates with cheap route/preset details and explicit previews', async (t) => {
  const f = await page(t, {
    href,
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
  });
  await open(f);
  const all = cards(f),
    candidates = all.filter((card) =>
      card.querySelector('.journey-card-tags').textContent.includes('Journey'),
    );
  assert.equal(all.length, 14);
  assert.equal(candidates.length, 12);
  for (const card of candidates) {
    assert.match(
      card.querySelector('.journey-card-challenge').textContent,
      /Band \d+\/12 · Standard$/,
    );
    assert(card.querySelector('.journey-card-route').textContent);
    assert.equal(card.querySelector('.journey-card-action').textContent, 'Play');
    assert.equal(
      card.querySelector('canvas'),
      null,
      'No eager diagram without an intersection observer',
    );
  }
  assert.equal(f.doc.activeElement.id, 'journey-search');
  const target = candidates.find(
    (card) => card.querySelector('strong').textContent === 'Shared lookout',
  );
  enter(f, target);
  await waitFor(() => f.$('coop-stage').textContent === 'SHARED LOOKOUT');
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
  await open(f, true);
  const first = cards(f)[0];
  assert.equal(first.querySelector('strong').textContent, 'Twin landings');
  assert.equal(first.querySelector('.journey-card-progress').textContent, 'Skipped · try again');
  assert.equal(first.disabled, false);
  enter(f, f.$('journey-back'));
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
});

test('same-ID imported edition retains its independent artwork preview and cannot masquerade as an owned map card', async (t) => {
  const f = await page(t, { href, nativeFocus: true, nativeVisibility: true });
  await f.selectFile(
    JSON.stringify(createTeamTestPack(createTeamJourneyCandidates(), 'twin-landings', 'expert')),
  );
  await open(f);
  const local = cards(f).find(
    (card) => card.querySelector('.journey-card-tags').textContent === 'Custom',
  );
  assert(local);
  assert.equal(local.querySelector('canvas'), null);
  assert.equal(local.querySelector('.journey-card-progress').textContent, '');
  local.focus();
  local.emit('focus', { bubbles: false });
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(f.$('coop-library-preview').disabled, false);
});
