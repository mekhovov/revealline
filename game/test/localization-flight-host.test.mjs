import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';

test('a session-only Solo tab translates its writer notice without reclaiming storage or changing the flight', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const calls = [];
  const page = await soloPage(context, {
    lockManager: {
      request(name, options, callback) {
        calls.push(name);
        return Promise.resolve((callback ?? options)(options?.ifAvailable ? null : { name }));
      },
    },
  });
  const notice = page.$('save-warning');
  assert.match(notice.textContent, /Another game tab owns saving/);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const saved = page.storage.getItem('revealline.library.dev.v1');
  const locks = calls.length;
  page.$('text-size').focus();
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    assert.match(
      notice.textContent,
      language === 'uk' ? /Збереженням керує інша вкладка гри/ : /Another game tab owns saving/,
    );
    assert.equal(page.$('save-warning'), notice);
    assert.equal(notice.hidden, false);
    assert.equal(page.doc.activeElement, page.$('text-size'));
    assert.equal(page.storage.getItem('revealline.library.dev.v1'), saved);
    assert.equal(calls.length, locks);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  }
  assert.deepEqual(page.errors, []);
});

test('practice display notice keeps the active locale and accepted preference without saving progress', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const scenario = await readFile(
    new URL('../content/scenarios/line-impact-demo.json', import.meta.url),
    'utf8',
  );
  const page = await soloPage(context, {
    search: '?practice=1',
    previewStorage: memoryStorage({ 'revealline.playground.current': scenario }),
  });
  const control = page.$('text-size');
  control.value = 'large';
  control.emit('change');
  control.focus();
  assert.match(page.$('display-preferences-status').textContent, /only to this session/);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const saved = page.storage.getItem('revealline.library.dev.v1');
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    assert.match(
      page.$('display-preferences-status').textContent,
      locale === 'uk' ? /лише в цьому сеансі/ : /only to this session/,
    );
    assert.equal(control.value, 'large');
    assert.equal(page.doc.body.dataset.textSize, 'large');
    assert.equal(page.doc.activeElement, control);
    assert.equal(page.storage.getItem('revealline.library.dev.v1'), saved);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  }
  assert.deepEqual(page.errors, []);
});

test('switching a paused flight updates accepted notices without advancing the run or rewriting saves', async (context) => {
  const originalLocale = getLocale();
  setLocale('en');
  const page = await soloPage(context);
  try {
    const readyMessage = page.$('run-message').textContent;
    setLocale('uk');
    assert.notEqual(page.$('run-message').textContent, readyMessage);
    setLocale('en');
    assert.equal(page.$('run-message').textContent, readyMessage);
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    for (let i = 0; i < 20; i++) page.frame();
    page.$('pause-button').click();
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    const owner = readFlightInformation(page.$('run-message')).owner;
    const saved = page.storage.getItem('revealline.suspended.dev.v1');
    page.$('text-size').focus();
    const focused = page.doc.activeElement;
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale);
      assert.match(
        page.$('controller-help').textContent,
        locale === 'uk' ? /Під’єднай контролер/ : /Connect a controller/,
      );
      if (locale === 'uk') {
        assert.match(page.$('controller-help').textContent, /Лівий стік/);
        assert.doesNotMatch(
          page.$('controller-help').textContent,
          /Shoulders|North:|Up |Stick \/|Lift the stick/,
        );
        assert.doesNotMatch(
          page.$('controller-navigation-help').textContent,
          /Confirm a select|Shoulders/,
        );
      }
      for (let i = 0; i < 5; i++) page.frame();
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
      assert.equal(readFlightInformation(page.$('run-message')).snapshot.paused, true);
      assert.deepEqual(readFlightInformation(page.$('run-message')).owner, owner);
      assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), saved);
      assert.equal(page.doc.activeElement, focused);
    }
    assert.deepEqual(page.errors, []);
  } finally {
    setLocale(originalLocale);
  }
});
