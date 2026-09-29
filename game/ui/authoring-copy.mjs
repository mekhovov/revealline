import { getLocale, localizedText } from '../i18n/index.mjs';

const copy = {
  navigation: ['Editor navigation', 'Навігація редактора'],
  hint: [
    'D-pad: move · A: choose/edit · B: back · Menu: editor navigation',
    'Хрестовина: рух · A: вибір/редагування · B: назад · Menu: навігація редактора',
  ],
  sections: ['Sections', 'Розділи'],
  back: ['Back', 'Назад'],
  pageActions: ['Page actions', 'Дії сторінки'],
  readPage: ['Read and scroll', 'Читати й прокручувати'],
  readHelp: [
    'Arrows: scroll · Confirm/Back: finish reading',
    'Стрілки: прокручування · Вибір/Назад: завершити читання',
  ],
  returnLibrary: ['Return to Asset Studio', 'Повернутися до студії ресурсів'],
  returnCatalog: ['Return to catalog', 'Повернутися до каталогу'],
  returnPage: ['Return to previous page', 'Повернутися на попередню сторінку'],
  playMedia: ['Play', 'Відтворити'],
  pauseMedia: ['Pause', 'Пауза'],
  muteMedia: ['Mute', 'Вимкнути звук'],
  unmuteMedia: ['Unmute', 'Увімкнути звук'],
  mediaPosition: ['Playback position', 'Позиція відтворення'],
  mediaUnavailable: ['This preview could not be played.', 'Не вдалося відтворити цей перегляд.'],
  close: ['Close', 'Закрити'],
  enterPreview: ['Enter preview', 'Перейти до перегляду'],
  returnEditor: ['Return to editor', 'Повернутися до редактора'],
  chooseSource: ['Choose a source', 'Вибрати джерело'],
  samples: ['Bundled examples', 'Вбудовані приклади'],
  recent: ['Files opened in this editor', 'Файли, відкриті в цьому редакторі'],
  existing: ['Assets shown in this editor', 'Ресурси цього редактора'],
  disk: ['Choose a new file from this device', 'Вибрати новий файл із пристрою'],
  diskHelp: [
    'The device file chooser belongs to your browser or operating system. Its controller support depends on that system; examples and existing assets above stay inside the editor.',
    'Вікно вибору файлів належить браузеру або операційній системі. Підтримка контролера залежить від системи; приклади та наявні ресурси вище доступні в редакторі.',
  ],
  unavailable: [
    'This source could not be opened. Your current work is unchanged.',
    'Не вдалося відкрити джерело. Поточну роботу збережено.',
  ],
  loading: ['Opening source…', 'Відкриття джерела…'],
  samplePicture: ['Dawn Signal picture', 'Зображення «Світанковий сигнал»'],
  sampleVideo: ['Dawn Signal video', 'Відео «Світанковий сигнал»'],
  sampleMediaBundle: [
    'Dawn Signal picture backup',
    'Резервна копія зображення «Світанковий сигнал»',
  ],
  sampleStoryBundle: ['Dawn Signal story backup', 'Резервна копія історії «Світанковий сигнал»'],
  noSources: [
    'No matching assets are currently open. Choose a bundled example or open a file from this device.',
    'Наразі немає відкритих відповідних ресурсів. Виберіть вбудований приклад або файл із пристрою.',
  ],
};

export const authoringText = (key) => copy[key]?.[getLocale() === 'uk' ? 1 : 0] ?? key;
export const authoringLabel = (node, key) => localizedText(node, () => authoringText(key));
