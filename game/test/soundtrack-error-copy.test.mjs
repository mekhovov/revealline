import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.mjs';
import { soundtrackErrorText } from '../ui/soundtrack-error-copy.mjs';

test('soundtrack validation and storage errors follow the active locale', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const storage = new Error('Close older game tabs to open soundtrack storage.');
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
      Object.assign(new Error('Fallback'), {
        localization: { key: 'errors:soundtrack.album.truncated' },
      }),
    ),
    'Завантаження альбому обірвалося.',
  );
});

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
