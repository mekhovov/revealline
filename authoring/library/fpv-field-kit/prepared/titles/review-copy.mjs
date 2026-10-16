import { getLocale } from '../../../../../game/i18n/index.mjs';

// Source-review chrome only. Historical image and manifest bytes stay intact.
const copy = {
  pageTitle: [
    'Field Kit title — v1 / v2 source comparison',
    'Титульний екран Field Kit — порівняння джерел v1 / v2',
  ],
  revealLink: ['Reveal family comparison', 'Порівняння ілюстрацій відкриття'],
  title: ['One workshop, two preparations', 'Одна майстерня, дві обробки'],
  status: [
    'Source-checkout comparison. Both candidates are produced; actual-menu review and release adoption are separate. This page does not change the game.',
    'Порівняння у вихідному репозиторії. Обидва варіанти підготовлено; перевірка в меню гри та включення до релізу виконуються окремо. Ця сторінка не змінює гру.',
  ],
  intro: [
    "V1 preserves finer generated texture. V2 uses the reveal family's fixed 36 colors and a 320×180 or 180×320 grid enlarged 3×. Both retain their original composition and dark menu space. Original source files and all v1 files stay unchanged.",
    'V1 зберігає дрібнішу згенеровану текстуру. V2 використовує спільну палітру з 36 кольорів і сітку 320×180 або 180×320, збільшену втричі. Обидві версії зберігають початкову композицію та темну область меню. Оригінали й усі файли v1 залишаються незмінними.',
  ],
  inspect: ['Inspect image', 'Переглянути зображення'],
  'landscape-v1': ['Landscape v1 · 960×540', 'Альбомний формат v1 · 960×540'],
  'landscape-v2': ['Landscape v2 · 960×540', 'Альбомний формат v2 · 960×540'],
  'portrait-v1': ['Portrait v1 · 540×960', 'Портретний формат v1 · 540×960'],
  'portrait-v2': ['Portrait v2 · 540×960', 'Портретний формат v2 · 540×960'],
  'landscape-v1-alt': [
    'Earlier landscape workshop with finer hardware and orchard texture',
    'Попередня альбомна ілюстрація майстерні з дрібнішими деталями обладнання та саду',
  ],
  'landscape-v2-alt': [
    'New landscape workshop using the shared palette and larger integer pixel clusters',
    'Нова альбомна ілюстрація майстерні зі спільною палітрою та більшими цілими блоками пікселів',
  ],
  'portrait-v1-alt': [
    'Earlier portrait workshop with a dark upper menu region',
    'Попередня портретна ілюстрація майстерні з темною верхньою областю меню',
  ],
  'portrait-v2-alt': [
    'New portrait workshop with clearer large pixel clusters and the same quiet menu region',
    'Нова портретна ілюстрація майстерні з чіткішими великими блоками пікселів і тією самою спокійною областю меню',
  ],
  'landscape-v1-note': [
    'Historical nearest-sampled source preparation.',
    'Історична обробка джерела методом найближчого пікселя.',
  ],
  'landscape-v2-note': [
    '320×180 sampled grid, 3× clusters, 25,969 bytes.',
    'Сітка 320×180, блоки пікселів 3×, 25 969 байтів.',
  ],
  'portrait-v1-note': [
    'Independently composed portrait original.',
    'Оригінал з окремою портретною композицією.',
  ],
  'portrait-v2-note': [
    '180×320 sampled grid, 3× clusters, 23,827 bytes.',
    'Сітка 180×320, блоки пікселів 3×, 23 827 байтів.',
  ],
  manifest: [
    'V2 exact hashes, crops and previous output pins',
    'V2: точні хеші, обрізання та зафіксовані попередні результати',
  ],
  contract: [
    'Runtime compilation selects the approved revision independently; this page is a local authoring comparison.',
    'Збирання гри окремо обирає затверджену версію; ця сторінка призначена для локального авторського порівняння.',
  ],
};

export function titleReviewText(key) {
  return copy[key]?.[getLocale() === 'uk' ? 1 : 0] ?? key;
}
