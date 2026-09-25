import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';

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
