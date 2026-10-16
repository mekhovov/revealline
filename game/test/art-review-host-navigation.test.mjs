import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assetStudioHref, studioReturnLinks } from '../ui/asset-studio-return.mjs';
import { WORKSHOP_TOOLS, workshopToolHref, workshopReturnLinks } from '../ui/workshop-return.mjs';
import { mountOptionalPracticePanel } from '../ui/optional-practice-panel.mjs';
import { soloPage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const revision = 'industrial-roster-v3';
const assertReview = (href, path, base = 'http://localhost/') => {
  const url = new URL(href, base);
  assert.equal(url.pathname, new URL(path, base).pathname);
  assert.equal(url.searchParams.get('artReview'), revision);
  assert.equal(url.searchParams.getAll('artReview').length, 1);
  return url;
};

test('all fixed Workshop round trips retain an explicit review and bounded locale without importing a presentation runtime', async () => {
  for (const prefix of [
    'http://localhost/',
    'https://example.test/editions/sample/releases/v2/site/',
    'file:///app/site/',
    'capacitor://localhost/',
  ]) {
    const source = `${prefix}game/?journey=opening&lang=uk&artReview=${revision}&seed=99&return=https://untrusted.test`;
    for (const { id, path } of WORKSHOP_TOOLS) {
      const target = workshopToolHref(source, id);
      const url = assertReview(target, prefix + path, prefix);
      assert.equal(url.searchParams.get('lang'), 'uk');
      assert.equal(url.searchParams.get('journey'), 'opening');
      assert.equal(url.searchParams.has('seed'), false);
      assert.equal(url.searchParams.has('return'), false);
      for (const href of Object.values(workshopReturnLinks(target, id))) {
        const back = assertReview(href, prefix + 'game/', prefix);
        assert.equal(back.searchParams.get('lang'), 'uk');
        assert.equal(back.searchParams.get('journey'), 'opening');
      }
    }
    for (const query of ['artReview=unknown', `artReview=${revision}&artReview=${revision}`]) {
      const target = assetStudioHref(`${prefix}game/?${query}&lang=en`);
      assert.equal(new URL(target).searchParams.has('artReview'), false);
      assert.equal(new URL(studioReturnLinks(target).game).searchParams.get('lang'), 'en');
    }
  }
  const helper = await readFile(
    new URL('../ui/art-review-navigation.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    helper,
    /^\s*(?:import\s|export\s.*\sfrom\s)/m,
    'The early Studio return parser must stay independent of runtime and locale startup.',
  );
});

for (const kind of ['versus', 'team'])
  test(`actual Solo title ${kind} departure retains review only after its native accepted action`, async (t) => {
    const h = await soloPage(t, {
      titleScreen: true,
      search: `?journey=legacy&artReview=${revision}`,
      waitForPictures: false,
    });
    const before = authoritativeCheckpoint(h.rendered.run);
    const destination = kind === 'team' ? '/game/couch/relay-rescue.html' : '/game/couch/';
    assertReview(h.$(`shell-title-${kind}`).getAttribute('href'), destination);
    await activateHostAction(h.$(`shell-title-${kind}`));
    const target = assertReview(globalThis.location.href, destination);
    assert.equal(target.searchParams.get('journey'), 'legacy');
    assert.equal(target.searchParams.get('return'), 'solo');
    assert.equal(h.$('mode-leave-dialog').open, false);
    assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
    assert.deepEqual(h.errors, []);
  });

test('actual paused Versus leave rejects a foreign href and retains review on its fixed accepted destination', async (t) => {
  const f = await couchPage(t, {
    href: `http://localhost/game/couch/?journey=legacy&artReview=${revision}`,
  });
  f.$('race-start').click();
  f.frame();
  f.frames(3);
  f.$('race-pause').click();
  const before = f.checkpoint();
  f.$('race-coop').click();
  assert.equal(f.$('race-leave-panel').hidden, false);
  assertReview(f.$('race-leave').getAttribute('href'), '/game/couch/relay-rescue.html');
  f.$('race-leave').setAttribute('href', 'https://untrusted.invalid/');
  assert.equal(f.$('race-leave').emit('click').defaultPrevented, false);
  const target = assertReview(
    f.$('race-leave').getAttribute('href'),
    '/game/couch/relay-rescue.html',
  );
  assert.equal(target.searchParams.get('return'), 'versus');
  assert.deepEqual(f.checkpoint(), before);
});

test('actual paused Team confirmation retains review and cannot navigate after Stay', async (t) => {
  const f = await teamPage(t, {
    href: `http://localhost/game/couch/relay-rescue.html?journey=legacy&artReview=${revision}`,
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
  });
  await activateHostAction(f.$('coop-start'));
  f.tick(3);
  f.tap('Escape');
  f.$('coop-versus').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-stay').click();
  f.$('coop-discard-confirm').click();
  assert.deepEqual(f.visits, []);
  f.$('coop-versus').click();
  await activateHostAction(f.$('coop-discard-confirm'));
  assert.equal(f.visits.length, 1);
  const target = assertReview(f.visits[0], '/game/couch/');
  assert.equal(target.searchParams.get('journey'), 'legacy');
});

test('actual optional source fallback carries review only to owned local native SIM pages', (t) => {
  for (const packageId of ['fpv-worlds', 'civilian-fpv']) {
    const doc = new Document(),
      container = doc.createElement('nav');
    doc.body.append(container);
    const panel = mountOptionalPracticePanel({
      document: doc,
      container,
      href: `http://localhost/game/snake/play.html?artReview=${revision}`,
      packageId,
      pause() {},
    });
    t.after(() => panel.dispose());
    const link = doc.querySelector(`[data-practice-source-preview="${packageId}"]`);
    const target = assertReview(link.href, `/optional-practice/${packageId}/`);
    link.click();
    assert.equal(link.href, target.href);
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
  }
});

for (const [id, destination] of [
  ['coop-solo', '/game/'],
  ['coop-versus', '/game/couch/'],
  ['coop-catalogue', '/game/couch/relay-rescue.html'],
])
  test(`actual ready Team ${id} native-default click retains the accepted review`, async (t) => {
    const f = await teamPage(t, {
      href: `http://localhost/game/couch/relay-rescue.html?journey=legacy&artReview=${revision}`,
      nativeFocus: true,
      nativeVisibility: true,
    });
    if (id === 'coop-catalogue') {
      f.$('coop-settings-open').click();
      f.$('coop-settings-tab-extras').click();
      assert.equal(f.$('coop-options').open, true);
      assert.equal(f.$('coop-settings-panel-extras').hidden, false);
    }
    const link = f.$(id);
    assertReview(link.getAttribute('href'), destination);
    link.focus();
    assert.equal(f.doc.activeElement.id, id);
    f.tap('Enter');
    assert.equal(f.visits.length, 1, 'Only the permitted native anchor default navigates.');
    assertReview(f.visits[0], destination);
    assert.equal(f.$('coop-discard-dialog').open, false);
    assert.equal(f.$('coop-menu').hidden, false);
  });
