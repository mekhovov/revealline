import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { getLocale, setLocale, translateDOM, t } from '../i18n/index.mjs';

// This finite host fixture models element captions, not rich text nodes.
// Bind the actual plain-text/attribute markers used by the compact controls.
function captions(doc) {
  translateDOM({
    querySelectorAll: (selector) =>
      selector === '[data-i18n-rich]' ? [] : doc.querySelectorAll(selector),
  });
}

function languages(context) {
  const original = getLocale();
  context.after(() => setLocale(original, { persist: false }));
  setLocale('en', { persist: false });
}

test('compact Versus pause captions switch without changing either board or its accepted setup', async (context) => {
  languages(context);
  const f = await couchPage(context, { beforeImport: ({ document }) => captions(document) });
  const details = f.$('race-optional-setup');
  details.open = true;
  f.$('race-focus').focus();
  const original = f.checkpoint();
  setLocale('uk', { persist: false });
  assert.equal(details.open, true);
  assert.equal(f.doc.activeElement.id, 'race-focus');
  assert.equal(f.$('race-focus').textContent, 'Розширені налаштування');
  assert.equal(f.$('race-optional-setup-toggle').textContent, 'Параметри матчу');
  assert.equal(f.$('race-more-home').textContent, 'Головна');
  assert.equal(f.$('race-more-about').textContent, 'Про гру й авторів');
  assert.deepEqual(f.checkpoint(), original);
  f.$('race-start').click();
  f.frame();
  f.$('race-pause').click();
  f.frame(0);
  f.$('race-retry').focus();
  const paused = f.checkpoint();
  for (const locale of ['en', 'uk', 'en']) {
    setLocale(locale, { persist: false });
    f.frames(2, 0);
    assert.equal(f.doc.body.dataset.couchStatus, 'paused');
    assert.equal(f.doc.activeElement.id, 'race-retry');
    assert.equal(f.$('race-chapters').textContent, t('interface:missions'));
    assert.equal(f.$('race-retry').textContent, t('interface:couch.retryRace'));
    assert.equal(f.$('race-home').textContent, t('common:navigation.home'));
    assert.equal(details.hidden, true);
    assert.deepEqual(f.checkpoint(), paused);
  }
});

test('compact Team menus translate in place while the shared pause controls keep focus', async (context) => {
  languages(context);
  const f = await teamPage(context, {
    nativeFocus: true,
    beforeImport: ({ doc }) => captions(doc),
    presentation: {
      load: ({ snapshot }) => {
        snapshot.resolved.theme.revision = 79;
      },
    },
  });
  f.$('coop-optional-setup').open = true;
  f.$('coop-optional-setup-toggle').focus();
  setLocale('uk', { persist: false });
  assert.equal(f.$('coop-optional-setup').open, true);
  assert.equal(f.doc.activeElement.id, 'coop-optional-setup-toggle');
  assert.equal(f.$('coop-optional-setup-toggle').textContent, 'Параметри команди');
  assert.equal(f.$('coop-more-catalogue').textContent, t('interface:newJourney2'));
  assert.match(f.$('coop-preview-caption').textContent, /лише перегляд/);
  assert.doesNotMatch(f.$('coop-preview-caption').textContent, /teaser|geometry/);
  f.$('coop-start').click();
  f.tick(2);
  f.$('coop-pause').click();
  const clock = f.$('coop-clock').textContent;
  const core = f.$('coop-pause-core');
  const children = [...core.children];
  f.$('coop-home-paused').focus();
  for (const locale of ['en', 'uk', 'en']) {
    setLocale(locale, { persist: false });
    f.tick(2);
    assert.equal(f.doc.activeElement.id, 'coop-home-paused');
    assert.equal(core.hidden, false);
    assert.deepEqual([...core.children], children);
    assert.equal(f.$('coop-home-paused').textContent, t('common:navigation.home'));
    assert.equal(f.$('coop-clock').textContent, clock);
  }
});

test('compact Journey notices select Ukrainian plurals without English fallback', (context) => {
  languages(context);
  setLocale('uk', { persist: false });
  const forms = ['місій', 'місія', 'місії', 'місій', 'місій', 'місія', 'місії', 'місії'];
  const counts = [0, 1, 2, 5, 11, 21, 22, 1.5];
  for (const key of ['interface:couch.journeyNotice', 'interface:couch.teamJourneyNotice']) {
    counts.forEach((count, i) => {
      const text = t(key, { count });
      assert.ok(text.endsWith(forms[i]), text);
      assert.doesNotMatch(text, /[A-Za-z]|\{\{/u);
    });
  }
});
