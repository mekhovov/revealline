import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.mjs';
import { soundtrackErrorText } from '../ui/soundtrack-error-copy.mjs';

test('soundtrack validation and storage errors follow the active locale', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const storage = new Error('Close older game tabs to upgrade media storage.');
  const album = new Error('Album download hash differs from its catalog.');

  setLocale('en', { persist: false });
  assert.equal(soundtrackErrorText(storage), 'Close older game tabs to open soundtrack storage.');
  assert.equal(soundtrackErrorText(album), 'The album download differs from the catalogue hash.');

  setLocale('uk', { persist: false });
  assert.equal(
    soundtrackErrorText(storage),
    'Закрийте старі вкладки з грою, щоб відкрити сховище саундтреків.',
  );
  assert.equal(
    soundtrackErrorText(album),
    'Завантажений альбом не відповідає контрольній сумі з каталогу.',
  );
});

test('soundtrack error copy keeps unknown and authored details intact', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  setLocale('uk', { persist: false });
  assert.equal(soundtrackErrorText(new Error('Artist supplied detail')), 'Artist supplied detail');
  assert.equal(
    soundtrackErrorText(
      Object.assign(new Error('Artist supplied detail'), {
        localization: { key: 'errors:unknown.unownedKey' },
      }),
    ),
    'Artist supplied detail',
  );
  assert.equal(
    soundtrackErrorText(
      Object.assign(new Error('Fallback'), {
        localization: { key: 'errors:soundtrack.album.truncated' },
      }),
    ),
    'Завантаження альбому обірвалося.',
  );
});

test('managed media storage errors use the soundtrack translations', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const examples = [
    ['Managed media store is closed.', 'Сховище саундтреків закрито.'],
    ['Media storage could not open.', 'Не вдалося відкрити сховище саундтреків.'],
    [
      'Close older game tabs to upgrade media storage.',
      'Закрийте старі вкладки з грою, щоб відкрити сховище саундтреків.',
    ],
    ['Media transaction failed.', 'Не вдалося виконати операцію зі сховищем саундтреків.'],
  ];

  for (const [english, ukrainian] of examples) {
    setLocale('en', { persist: false });
    assert.equal(soundtrackErrorText(new Error(english)), exactEnglish(english));
    setLocale('uk', { persist: false });
    assert.equal(soundtrackErrorText(new Error(english)), ukrainian);
  }
});

function exactEnglish(message) {
  return {
    'Managed media store is closed.': 'Soundtrack storage is closed.',
    'Media storage could not open.': 'Soundtrack storage could not open.',
    'Close older game tabs to upgrade media storage.':
      'Close older game tabs to open soundtrack storage.',
    'Media transaction failed.': 'The soundtrack storage transaction failed.',
  }[message];
}

test('private soundtrack collection errors follow the active locale', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const examples = [
    [
      'Choose one or more MP3 files or a folder first.',
      'Спочатку виберіть один або кілька MP3-файлів чи папку.',
    ],
    [
      'Enter a collection name before reviewing these files.',
      'Перш ніж перевіряти ці файли, введіть назву колекції.',
    ],
    ['Choose a supported music style.', 'Виберіть підтримуваний музичний стиль.'],
    [
      'This collection would exceed the custom-track limit.',
      'Ця колекція перевищила б обмеження кількості власних композицій.',
    ],
    [
      'This collection would exceed the custom-playlist limit.',
      'Ця колекція перевищила б обмеження кількості власних списків відтворення.',
    ],
    [
      'This collection exceeds the managed audio budget.',
      'Ця колекція перевищує обмеження обсягу керованих аудіофайлів.',
    ],
  ];

  for (const [english, ukrainian] of examples) {
    setLocale('en', { persist: false });
    assert.equal(soundtrackErrorText(new Error(english)), english);
    setLocale('uk', { persist: false });
    assert.equal(soundtrackErrorText(new Error(english)), ukrainian);
  }
});
