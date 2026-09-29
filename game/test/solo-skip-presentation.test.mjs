import test from 'node:test';
import assert from 'node:assert/strict';
import { context, owner, createMissionLibrary } from './solo-skip-host.mjs';
import { getLocale, setLocale, localizedText, t } from '../i18n/index.mjs';

for (const [from, to] of [
  ['en', 'uk'],
  ['uk', 'en'],
]) {
  for (const invalidation of ['none', 'remove', 'replace', 'dispose']) {
    test(`Skip locale ${from} to ${to} after ${invalidation} is presentation-only`, () => {
      setLocale(from, { persist: false });
      const f = context(),
        { ctx, $ } = f;
      let prepares = 0,
        launches = 0,
        focus = 0;
      const source = owner('localized', [{ id: 'next', name: 'authored fallback' }], {
        prepare: () => {
          prepares++;
        },
        launch: () => {
          launches++;
        },
      });
      source.presentation = () => ({
        name: getLocale() === 'uk' ? 'Наступна місія' : 'Next mission',
      });
      const library = createMissionLibrary([source]),
        next = library.missions[0];
      const destination = { type: 'library', host: { library }, next };
      ctx.journeySkipDestination = destination;
      ctx.journeySkipArmed = ctx.runId;
      const original = {
        run: ctx.run,
        recorder: ctx.recorder,
        profile: ctx.library,
        text: JSON.stringify([ctx.run, ctx.library]),
      };
      $('journey-skip').focus = () => {
        focus++;
      };
      for (const [id, key] of [
        ['confirmation', 'interface:solo.universalSkipConfirm'],
        ['preparation', 'interface:solo.preparingNextMission'],
        ['failure', 'interface:solo.prepareNextFailed'],
      ]) {
        localizedText($(id), ctx.skipMissionMessage(destination, key));
      }
      localizedText($('unrelated'), () => t('interface:changeDifficulty'));
      if (invalidation === 'remove') library.remove(source.id);
      if (invalidation === 'replace')
        library.register({ ...source, entries: [{ id: 'next', name: 'replacement' }] });
      if (invalidation === 'dispose') library.dispose();
      assert.doesNotThrow(() => setLocale(to, { persist: false }));
      if (invalidation === 'none') {
        for (const id of ['confirmation', 'preparation', 'failure'])
          assert.match(
            $(id).textContent,
            new RegExp(to === 'uk' ? 'Наступна місія' : 'Next mission'),
          );
      } else {
        assert.throws(() => library.presentation(next), 'strict stale-row API is not weakened');
        for (const id of ['confirmation', 'preparation', 'failure'])
          assert.equal($(id).textContent, t('interface:solo.skipUnavailable'));
      }
      assert.equal($('unrelated').textContent, t('interface:changeDifficulty'));
      assert.equal(ctx.journeySkipDestination, destination);
      assert.equal(ctx.journeySkipArmed, ctx.runId);
      assert.equal(ctx.run, original.run);
      assert.equal(ctx.recorder, original.recorder);
      assert.equal(ctx.library, original.profile);
      assert.equal(JSON.stringify([ctx.run, ctx.library]), original.text);
      assert.equal(prepares, 0);
      assert.equal(launches, 0);
      assert.equal(focus, 0);
      for (const id of ['confirmation', 'preparation', 'failure', 'unrelated'])
        $(id).isConnected = false;
      library.dispose();
      setLocale('en', { persist: false });
    });
  }
}

test('Journey Skip resolves the exact mission presentation lazily without rearming', () => {
  const { ctx } = context(),
    mission = { id: 'next' };
  let current = mission,
    reads = 0;
  ctx.journeyCatalog = { find: () => current };
  ctx.contentText = (value, field) => {
    assert.equal(value, mission);
    assert.equal(field, 'name');
    reads++;
    return getLocale() === 'uk' ? 'Назва місії' : 'Mission name';
  };
  const text = ctx.skipMissionMessage(
    { type: 'journey', mission },
    'interface:solo.universalSkipConfirm',
  );
  setLocale('en', { persist: false });
  assert.match(text(), /Mission name/);
  setLocale('uk', { persist: false });
  assert.match(text(), /Назва місії/);
  current = { id: 'next' };
  assert.equal(text(), t('interface:solo.skipUnavailable'));
  assert.equal(reads, 2, 'same-ID replacement is not rebound');
  assert.equal(ctx.journeySkipArmed, null);
  setLocale('en', { persist: false });
});

for (const reentry of ['none', 'replacement', 'replacement cancelled'])
  test('busy settlement owns its exact button lease: ' + reentry, () => {
    const { ctx, $ } = context(),
      button = $('journey-skip'),
      first = {},
      second = {};
    ctx.preparationButtonBusy(button, true, first);
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    if (reentry === 'none') {
      ctx.preparationButtonBusy(button, true, second);
      assert.equal(ctx.preparationButtonBusy(button, false, first), false);
      assert.equal(button.getAttribute('aria-busy'), 'true');
      ctx.preparationButtonBusy(button, false, second);
    } else {
      const remove = button.removeAttribute;
      let replaced = false;
      button.removeAttribute = function (name) {
        remove.call(this, name);
        if (replaced) return;
        replaced = true;
        ctx.preparationButtonBusy(button, true, second);
        if (reentry === 'replacement cancelled') ctx.preparationButtonBusy(button, false, second);
      };
      assert.equal(ctx.preparationButtonBusy(button, false, first), false);
      assert.equal(button.getAttribute('aria-busy'), reentry === 'replacement' ? 'true' : null);
    }
    assert.equal(button.disabled, false);
  });
