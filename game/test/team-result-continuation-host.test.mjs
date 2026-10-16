import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { playCurrentTeamRoute } from './helpers/current-team-route.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const source = createTeamJourneyCandidates();
const href = 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox';

test('Team accepted results name the next campaign, then the next mission, with one keyboard action and no autoplay', async (t) => {
  const f = await page(t, { href, nativeFocus: true, nativeVisibility: true });
  f.$('coop-start').focus();
  f.tap('Enter');
  playCurrentTeamRoute(f, source, 'twin-landings');
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.equal(f.$('coop-next').textContent, 'Next campaign: Shared returns');
  const locale = getLocale();
  try {
    setLocale('uk');
    assert.match(f.$('coop-next').textContent, /^Наступна кампанія: /);
  } finally {
    setLocale(locale);
  }
  const result = f.$('coop-overlay-copy').textContent;
  f.tick(20);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.equal(f.$('coop-overlay-copy').textContent, result);
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  playCurrentTeamRoute(f, source, 'stepping-exchange');
  assert.equal(f.$('coop-next').textContent, 'Next: Divided workshop');
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.deepEqual(f.visits, []);
  t.diagnostic(
    'Real core and host keyboard commands; DOM/Canvas are modeled, not human or device evidence.',
  );
});

test('Team final imported results retain the one-action Browse path and restore the owned result on Back', async (t) => {
  const f = await page(t, { href, nativeFocus: true, nativeVisibility: true });
  await f.selectFile(JSON.stringify(createTeamTestPack(source, 'twin-landings', 'standard')));
  f.$('coop-start').focus();
  f.tap('Enter');
  playCurrentTeamRoute(f, source, 'twin-landings');
  assert.equal(f.$('coop-next').hidden, true, 'No unowned successor is invented for an import.');
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  const result = f.$('coop-overlay-copy').textContent;
  const reads = f.artwork.calls.reads.length;
  f.tap('Enter');
  await waitFor(() => f.$('journey-chooser')?.open);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  f.tap('Escape');
  await waitFor(() => !f.$('journey-chooser').open);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  assert.equal(f.$('coop-overlay-copy').textContent, result);
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.deepEqual(f.visits, []);
});

test('Team keeps its completed result when a stalled frame reaches the auto-next deadline', async (t) => {
  const f = await page(t, { href, nativeFocus: true, nativeVisibility: true });
  f.$('coop-start').focus();
  f.tap('Enter');
  playCurrentTeamRoute(f, source, 'twin-landings');
  f.tap('Enter');
  await waitFor(() => f.$('coop-overlay').hidden);
  playCurrentTeamRoute(f, source, 'stepping-exchange');
  const flow = f.doc.querySelector('[data-continuous-play]');
  for (let i = 0; i < 60 && !flow.textContent.includes('Next level in 1s'); i++) f.tick(1, 200);
  assert.match(flow.textContent, /Next level in 1s/);
  f.tick(4, 200);
  const result = f.$('coop-overlay-copy').textContent,
    reads = f.artwork.calls.reads.length;
  f.tick(1, 1200);
  f.tick(4);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(f.$('coop-level').value, 'stepping-exchange');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-copy').textContent, result);
  assert.equal(
    f.artwork.calls.reads.length,
    reads,
    'The stalled timer must not start destination loading.',
  );
  assert.equal(flow.hidden, true, 'The cancelled countdown cannot silently rearm.');
  assert.equal(f.$('coop-next').disabled, false, 'Manual Next remains available.');
});
