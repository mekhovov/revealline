import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmCommunityRemoval } from '../community/removal-review.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

function fixture() {
  const doc = new Document(),
    win = doc.defaultView,
    opener = doc.createElement('button'),
    fallback = doc.createElement('select');
  doc.body.append(opener, fallback);
  let current = true;
  return {
    doc,
    win,
    opener,
    fallback,
    $: (id) => doc.getElementById(`community-removal-${id}`),
    change: () => {
      current = false;
    },
    request: (kind = 'offload', review = { detachableBytes: 100, localCopyRetained: true }) =>
      confirmCommunityRemoval({
        document: doc,
        window: win,
        kind,
        review,
        edition: { title: 'Local edition', version: 4 },
        opener,
        fallback: () => fallback,
        isCurrent: () => current,
      }),
  };
}

test('removal review defaults to Keep and distinguishes content, progress, recovery and retained copies in EN/UK', async () => {
  const prior = getLocale();
  try {
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      const h = fixture(),
        pending = h.request();
      assert.equal(h.doc.activeElement, h.$('keep'));
      assert.equal(h.$('dialog').open, true);
      assert.match(h.$('identity').textContent, /Local edition.*4/);
      assert.match(h.$('progress').textContent, locale === 'en' ? /does not reset/ : /не скидає/);
      assert.match(
        h.$('recovery').textContent,
        locale === 'en' ? /package is kept/ : /пакет відновлення залишається/,
      );
      assert.match(h.$('local-copy').textContent, /Creator/);
      assert.match(
        h.$('recovery').textContent,
        locale === 'en' ? /Reconnect to the catalog/ : /Підключіться до каталогу/,
      );
      assert.doesNotMatch(h.$('dialog').textContent, /interface:|community.removal\.|\{\{/);
      h.$('keep').click();
      const result = await pending;
      assert.equal(result.confirmed, false);
      result.restoreFocus();
      assert.equal(h.doc.activeElement, h.opener);
      assert.equal(h.$('dialog'), null);
    }
  } finally {
    setLocale(prior, { persist: false });
  }
});

test('recovery removal preserves installed content and only an explicit confirmation accepts it', async () => {
  const h = fixture(),
    pending = h.request('download', {});
  assert.match(h.$('content').textContent, /stay on this device/);
  assert.match(h.$('recovery').textContent, /Only the separate recovery package/);
  assert.equal(h.$('bytes'), null);
  h.$('confirm').click();
  const result = await pending;
  assert.equal(result.confirmed, true);
  h.opener.remove();
  result.restoreFocus();
  assert.equal(h.doc.activeElement, h.fallback);
});

for (const departure of ['cancel', 'close', 'pagehide', 'hidden', 'changed'])
  test(`${departure} cannot confirm removal`, async () => {
    const h = fixture(),
      pending = h.request();
    if (departure === 'cancel') h.$('dialog').emit('cancel');
    if (departure === 'close') h.$('dialog').close();
    if (departure === 'pagehide') h.win.emit('pagehide', { persisted: true });
    if (departure === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (departure === 'changed') {
      h.change();
      h.$('confirm').click();
    }
    const result = await pending;
    assert.equal(result.confirmed, false);
    assert.equal(h.$('dialog'), null);
    result.restoreFocus();
  });

test('a newer focus decision and a later persisted departure both retire the return ticket', async () => {
  const h = fixture(),
    pending = h.request();
  h.$('confirm').click();
  const result = await pending;
  h.fallback.focus();
  h.fallback.remove();
  h.doc.activeElement = h.doc.body;
  result.restoreFocus();
  assert.equal(h.doc.activeElement, h.doc.body, 'removed newer focus does not become permission');
  const next = h.request();
  h.$('confirm').click();
  const accepted = await next;
  h.win.emit('pagehide', { persisted: true });
  h.doc.activeElement = h.doc.body;
  accepted.restoreFocus();
  assert.equal(h.doc.activeElement, h.doc.body);
});

test('a replacement review cancels the old decision and cannot confirm it later', async () => {
  const h = fixture(),
    old = h.request(),
    stale = h.$('confirm'),
    next = h.request('download', {});
  assert.equal((await old).confirmed, false);
  stale.click();
  assert.equal(h.$('dialog').open, true);
  h.$('keep').click();
  const result = await next;
  assert.equal(result.confirmed, false);
  result.restoreFocus();
});
