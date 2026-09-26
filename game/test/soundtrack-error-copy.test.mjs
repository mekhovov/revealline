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
