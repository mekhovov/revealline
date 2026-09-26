import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { getLocale, setLocale, attachLanguageControls } from '../i18n/index.mjs';

test('Team setup switches all static and dynamic copy without changing its selection', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const f = await page(context, {
    beforeImport: ({ doc }) => {
      doc.createTextNode = (text) => {
        const node = doc.createElement('span');
        node.textContent = text;
        return node;
      };
    },
  });
  const selectedText = (id) => {
    const select = f.$(id);
    return select.options.find((option) => option.value === select.value)?.textContent;
  };
  const level = f.$('coop-level').value;
  const difficulty = f.$('coop-difficulty').value;
  const startDisabled = f.$('coop-start').disabled;

  assert.equal(f.$('coop-title').textContent.trim(), 'Find your common ground.');
  assert.equal(f.$('coop-start').textContent, 'Start together →');
  assert.equal(f.$('coop-optional-setup-toggle').textContent, 'Arena & team options');
  setLocale('uk', { persist: false });
  assert.equal(f.$('coop-title').textContent.trim(), 'Знайдіть спільну територію.');
  assert.equal(selectedText('coop-level'), 'Перше з’єднання · випробування території');
  assert.equal(f.$('coop-menu-goal').textContent, 'Відкрийте 65% разом');
  assert.equal(f.$('coop-start').textContent, 'Почати разом →');
  assert.equal(f.$('coop-optional-setup-toggle').textContent, 'Арена й параметри команди');
  assert.equal(selectedText('coop-experiment'), 'Повна взаємодія');
  assert.equal(f.$('coop-level').value, level);
  assert.equal(f.$('coop-difficulty').value, difficulty);
  assert.equal(f.$('coop-start').disabled, startDisabled);

  setLocale('en', { persist: false });
  assert.equal(f.$('coop-title').textContent.trim(), 'Find your common ground.');
  assert.equal(selectedText('coop-level'), 'First Connection · territory challenge');
  assert.equal(f.$('coop-menu-goal').textContent, 'Reveal 65% together');
});

test('Team controller can change language in the lobby and Settings without starting an attempt', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  let guardNow = 0;
  const f = await page(context, {
    beforeImport: ({ install }) => {
      install('performance', { value: { now: () => guardNow } });
    },
    presentation: {
      load: ({ snapshot }) => {
        snapshot.resolved.theme.revision = 79;
      },
    },
  });
  attachLanguageControls(f.doc);
  const lobby = f.$('coop-language-select');
  const settings = f.$('coop-settings-language-select');
  assert.ok(f.$('coop-menu').contains(lobby));
  assert.ok(f.$('coop-settings-panel-display').contains(settings));
  const pad = {
    index: 0,
    id: 'Test controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    f.tick();
  };
  f.tick(2);
  pulse(0);
  lobby.focus();
  pulse(0);
  assert.equal(lobby.getAttribute('data-controller-editing'), 'true');
  pulse(13);
  pulse(0);
  assert.equal(getLocale(), 'uk');
  assert.equal(f.doc.activeElement, lobby);
  assert.equal(settings.value, 'uk');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-overlay').hidden, true);
  guardNow = 2000;
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-display').click();
  f.tick();
  settings.focus();
  pulse(0);
  assert.equal(settings.getAttribute('data-controller-editing'), 'true');
  pulse(12);
  pulse(0);
  assert.equal(getLocale(), 'en');
  assert.equal(f.doc.activeElement, settings);
  assert.equal(lobby.value, 'en');
  assert.equal(f.$('coop-menu').hidden, false);
});
