import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { page } from './helpers/coop-host.mjs';

const selfCross = (fixture) => {
  for (const [first, second, ticks] of [
    ['KeyD', 'ArrowLeft', 30],
    ['KeyW', 'ArrowUp', 15],
    ['KeyD', 'ArrowLeft', 15],
    ['KeyS', 'ArrowDown', 15],
    ['KeyA', 'ArrowRight', 15],
  ]) {
    fixture.tap(first);
    fixture.tap(second);
    fixture.tick(ticks);
  }
};

function english(context) {
  setLocale('en', { persist: false });
  context.after(() => setLocale('en', { persist: false }));
}

test('the live Team host keeps arena rules and translates active cut and Support teaching', async (context) => {
  english(context);
  const fixture = await page(context, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox',
    nativeFocus: true,
    nativeVisibility: true,
  });
  fixture.$('coop-start').click();
  const clock = fixture.$('coop-clock').textContent;
  assert.match(fixture.$('coop-message').textContent, /Keep cuts short near patrolling Drifters/);
  assert.match(fixture.$('coop-message').textContent, /FIRST CUT/);
  assert.equal(fixture.$('coop-message').dataset.coach, 'cut');

  setLocale('uk', { persist: false });
  assert.match(fixture.$('coop-message').textContent, /ПЕРШИЙ КОНТУР/);
  assert.doesNotMatch(fixture.$('coop-message').textContent, /FIRST CUT/);
  assert.equal(fixture.$('coop-clock').textContent, clock, 'translation never advances play');
  assert.equal(fixture.$('coop-message').dataset.coach, 'cut');

  setLocale('en', { persist: false });
  fixture.tick(2);
  fixture.tap('KeyD');
  fixture.tap('ArrowLeft');
  fixture.tick(220);
  assert.match(fixture.$('coop-message').textContent, /SUPPORT READY/);
  assert.equal(fixture.$('coop-message').dataset.coach, 'support');

  setLocale('uk', { persist: false });
  assert.match(fixture.$('coop-message').textContent, /ПІДТРИМКА ГОТОВА/);
  assert.doesNotMatch(fixture.$('coop-message').textContent, /SUPPORT READY/);
  assert.equal(fixture.$('coop-message').dataset.coach, 'support');
});

test('the live Team host translates rescue, clears coach styling at terminal state and suppresses it on Retry', async (context) => {
  english(context);
  const fixture = await page(context, { nativeFocus: true, nativeVisibility: true });
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'contextual-teaching-rescue';
  pack.levels[0].id = 'contextual-teaching-rescue-coverage';
  pack.levels[0].enemies = [];
  await fixture.selectFile(JSON.stringify(pack));
  await fixture.choose('coop-difficulty', 'expert');
  fixture.$('coop-start').click();

  selfCross(fixture);
  assert.match(fixture.$('coop-message').textContent, /RESCUE/);
  assert.equal(fixture.$('coop-message').dataset.coach, 'rescue');
  setLocale('uk', { persist: false });
  assert.match(fixture.$('coop-message').textContent, /ПОРЯТУНОК/);
  assert.doesNotMatch(fixture.$('coop-message').textContent, /RESCUE/);
  assert.equal(fixture.$('coop-message').dataset.coach, 'rescue');

  setLocale('en', { persist: false });
  fixture.tick(240);
  selfCross(fixture);
  assert.equal(
    fixture.$('coop-message').textContent,
    'Team attempt ended. Choose Retry or Change setup.',
  );
  assert.equal(fixture.$('coop-message').dataset.coach, undefined);

  fixture.$('coop-retry').click();
  assert.doesNotMatch(fixture.$('coop-message').textContent, /FIRST CUT|RESCUE/);
  assert.equal(fixture.$('coop-message').dataset.coach, undefined);
});
