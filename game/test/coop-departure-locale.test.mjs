import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.mjs';
import { page } from './helpers/coop-host.mjs';

const departures = [
  ['coop-lobby', 'Discard and change setup', 'Відкинути й змінити налаштування'],
  ['coop-retry', 'Discard and retry', 'Відкинути й повторити'],
  ['coop-race', 'Discard and leave', 'Відкинути й вийти'],
  ['coop-home', 'Discard and leave', 'Відкинути й вийти'],
  ['coop-versus', 'Discard and go to Versus', 'Відкинути й перейти до суперництва'],
  ['coop-catalogue', 'Discard and switch journey', 'Відкинути й змінити подорож'],
];
const held = (f) => ({
  clock: f.$('coop-clock').textContent,
  progress: f.$('coop-progress').value,
  paint: f.lastPaint,
});

for (const [id, english, ukrainian] of departures)
  test(`${id}: a Ukrainian cold start and live locale changes keep the current departure label`, async (t) => {
    setLocale('uk', { persist: false });
    t.after(() => setLocale('en', { persist: false }));
    const f = await page(t, {
      nativeFocus: true,
      nativeVisibility: true,
      capturePaint: true,
    });
    f.$('coop-start').focus();
    f.tap('Enter');
    f.tick(2);
    f.tap('KeyD');
    f.tick(12);
    f.tap('Escape');
    assert.equal(f.$('coop-overlay').hidden, false);

    setLocale('en', { persist: false });
    f.$(id).focus();
    assert.equal(f.doc.activeElement.id, id);
    f.tap('Enter');
    assert.equal(f.$('coop-discard-dialog').open, true);
    assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
    assert.equal(f.$('coop-discard-confirm').textContent, english);
    assert.equal(f.$('coop-discard-title').textContent, 'Discard this Team attempt?');
    const englishCopy = f.$('coop-discard-copy').textContent;
    assert.ok(
      englishCopy.startsWith(
        'This unfinished attempt is not saved; discarding it loses its current territory, not previously recorded mission clears. Stay keeps both players paused. Resume together remains a separate action. ',
      ),
    );

    setLocale('uk', { persist: false });
    assert.equal(f.$('coop-discard-confirm').textContent, ukrainian);
    assert.equal(f.$('coop-discard-title').textContent, 'Скасувати цю командну спробу?');
    assert.ok(
      f
        .$('coop-discard-copy')
        .textContent.startsWith(
          'Ця незавершена спроба не збережена; її скасування видалить поточне захоплення території, але не попередні завершення місій. «Залишитися» зберігає обох гравців на паузі. Спільне продовження залишається окремою дією. ',
        ),
    );
    assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
    // Canvas labels translate on the regular paint frame; the core stays paused.
    f.tick();
    const paused = held(f);
    f.$('coop-resume').click();
    f.$(id === 'coop-retry' ? 'coop-lobby' : 'coop-retry').click();
    assert.equal(f.$('coop-discard-confirm').textContent, ukrainian);
    f.tick(30);
    assert.deepEqual(held(f), paused, 'Translation cannot replace or resume the owned attempt.');

    setLocale('en', { persist: false });
    assert.equal(f.$('coop-discard-confirm').textContent, english);
    assert.equal(f.$('coop-discard-copy').textContent, englishCopy);
    f.tick();
    assert.equal(f.$('coop-clock').textContent, paused.clock);
    assert.equal(f.$('coop-progress').value, paused.progress);
    f.tap('Escape');
    assert.equal(f.$('coop-discard-dialog').open, false);
    assert.equal(f.doc.activeElement.id, id, 'Native cancel restores the actual opener.');
    const cancelled = held(f);
    f.$('coop-discard-confirm').click();
    f.tick(30);
    assert.deepEqual(held(f), cancelled, 'A stale Confirm cannot discard or restart the attempt.');
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(f.$('coop-menu').hidden, true);
    assert.deepEqual(f.visits, []);
  });
