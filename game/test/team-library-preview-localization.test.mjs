import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTeamLibraryPreview } from '../couch/team-library-preview.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const element = () => ({
  hidden: false,
  disabled: false,
  textContent: '',
  dataset: {},
  onclick: null,
  setAttribute() {},
});

test('Team picture preview follows live locale changes and preserves the authored mission title', async () => {
  const listeners = new Map();
  const dialog = {
    open: true,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  const document = { hidden: false, activeElement: null, hasFocus: () => true };
  const panel = element();
  const canvas = { ...element(), width: 0, height: 0 };
  const title = element();
  const status = element();
  const retry = element();
  const button = element();
  const row = { title: 'Авторська місія' };
  const previousLocale = getLocale();

  setLocale('en', { persist: false });
  const preview = attachTeamLibraryPreview({
    document,
    dialog,
    panel,
    canvas,
    title,
    status,
    retry,
    button,
    selection: () => ({ row }),
    prepare: async () => ({ confirm: () => null, release() {} }),
  });
  preview.refresh();
  assert.equal(button.textContent, 'Preview Авторська місія');
  await button.onclick();
  assert.equal(title.textContent, 'Авторська місія · Picture preview');

  setLocale('uk', { persist: false });
  assert.equal(button.textContent, 'Переглянути «Авторська місія»');
  assert.equal(title.textContent, 'Авторська місія · Перегляд зображення');

  preview.dispose();
  setLocale(previousLocale, { persist: false });
});
