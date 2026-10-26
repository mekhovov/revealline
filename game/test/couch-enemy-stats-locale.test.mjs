import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

test('Duel statistics follow live language changes without advancing the paused match', async (context) => {
  const initialLocale = getLocale();
  context.after(() => setLocale(initialLocale, { persist: false }));
  setLocale('en', { persist: false });
  const f = await couchPage(context);
  const views = [...f.doc.querySelectorAll('.enemy-stats')];
  assert.equal(views.length, 2, 'Both native HUD and result/pause views are exercised.');
  f.$('race-start').click();
  f.frame();
  f.$('race-pause').click();
  f.frame(0);
  const checkpoint = f.checkpoint();
  const disclosure = views
    .find((view) => view.dataset.variant === 'panel')
    .querySelector('details');
  disclosure.open = true;
  disclosure.emit('toggle');
  const summary = disclosure.querySelector('summary');
  summary.focus();
  const counts = views.map((view) =>
    [...view.querySelectorAll('strong')].map((node) => node.textContent),
  );
  for (const [locale, label, run, lifetime, details] of [
    ['uk', 'Переможені вороги', 'Ця спроба', 'За весь час', 'Види ворогів'],
    ['en', 'Enemies defeated', 'This run', 'Lifetime', 'Enemy details'],
    ['uk', 'Переможені вороги', 'Ця спроба', 'За весь час', 'Види ворогів'],
  ]) {
    setLocale(locale, { persist: false });
    for (const view of views) {
      assert.equal(view.getAttribute('aria-label'), label);
      assert.ok(view.textContent.includes(run));
      assert.ok(view.textContent.includes(lifetime));
    }
    assert.ok(summary.textContent.includes(details));
    assert.equal(disclosure.open, true);
    assert.equal(f.doc.activeElement, summary);
    assert.deepEqual(f.checkpoint(), checkpoint);
    assert.deepEqual(
      views.map((view) => [...view.querySelectorAll('strong')].map((node) => node.textContent)),
      counts,
    );
  }
  f.win.emit('pagehide', { persisted: true });
  setLocale('en', { persist: false });
  assert.equal(
    views[0].getAttribute('aria-label'),
    'Enemies defeated',
    'A retained page keeps its locale subscription.',
  );
  f.win.emit('pagehide', { persisted: false });
  const retiredCopy = views.map((view) => view.textContent);
  assert.doesNotThrow(() => setLocale('uk', { persist: false }));
  assert.deepEqual(
    views.map((view) => view.textContent),
    retiredCopy,
    'Retired statistics are not refreshed by later pages.',
  );
});
