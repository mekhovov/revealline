import { getLocale } from '../../../../../game/i18n/index.mjs';
const copy = {
  title: ['Field Kit · Prepared reveal review', 'Field Kit · Огляд підготовлених зображень'],
  heading: ['New places to reveal', 'Нові місця для відкриття'],
  studio: ['Asset Studio', 'Студія ресурсів'],
  disclosure: [
    'PRODUCED DERIVATIVES · GAMEPLAY REVIEW REMAINS SEPARATE',
    'ПІДГОТОВЛЕНІ ПОХІДНІ ЗОБРАЖЕННЯ · ОГЛЯД У ГРІ ПРОВОДИТЬСЯ ОКРЕМО',
  ],
  intro: [
    'Each scene began with its own built-in image-generation request. Originals and full effective prompts are retained. These exact game frames use separately documented crop, nearest sampling, a shared 36-color palette and integer pixel clusters. This preparation is not described as hand-authored native pixel drawing.',
    'Кожна сцена створена за окремим запитом до вбудованого генератора зображень. Оригінали й повні запити збережено. Ці кадри використовують окремо задокументоване кадрування, вибір найближчого пікселя, спільну палітру з 36 кольорів і цілі піксельні блоки. Цю підготовку не названо ручним малюванням піксельної графіки.',
  ],
  help: [
    'Each card keeps its real 240-pixel-wide specimen. Native pixels shows the exported frame at 1:1. Use a reader to inspect without scaling. Homeward has separate 4:3 and 2:1 crops; Pressure has two exact 2:1 sizes. This historical review never changes saves, picture pins or quality approval. Published previews use compiled release assets. Originals remain local source-checkout material.',
    'Кожна картка містить зразок завширшки рівно 240 пікселів. «Власні пікселі» показує експортований кадр у масштабі 1:1. Режим читання дозволяє оглядати його без масштабування. Homeward має окремі кадри 4:3 і 2:1; Pressure — два розміри 2:1. Цей історичний огляд не змінює збереження, закріплені зображення чи схвалення якості. Опубліковані зразки використовують скомпільовані ресурси випуску. Оригінали доступні лише в локальній копії джерел.',
  ],
  contract: ['Preparation contract', 'Умови підготовки'],
  manifest: ['Prepared manifest and exact owner mapping', 'Маніфест підготовки й точні прив’язки'],
  loading: [
    'Loading and verifying the produced inventory…',
    'Завантаження й перевірка підготовленого каталогу…',
  ],
  cancelled: [
    'Loading canceled. Retry when ready; the previous complete inventory is retained.',
    'Завантаження скасовано. Повторіть спробу, коли будете готові; попередній повний каталог збережено.',
  ],
  error: [
    'The matching prepared inventory could not be verified. Retry to restore this historical review.',
    'Не вдалося перевірити відповідний підготовлений каталог. Повторіть спробу, щоб відновити цей історичний огляд.',
  ],
  ready: [
    '38 / 38 compositions · 44 / 44 exports · 56 / 56 exact owners · 2,083,975 PNG bytes. All planned sources and exports are produced; context review remains separate.',
    '38 / 38 композицій · 44 / 44 експорти · 56 / 56 точних прив’язок · 2 083 975 байтів PNG. Усі заплановані джерела й експорти підготовлено; перевірка в контексті гри проводиться окремо.',
  ],
  specimen: ['Specimen · 240 CSS pixels · {{id}}', 'Зразок · 240 CSS-пікселів · {{id}}'],
  native: ['Native pixels · 1:1 scrollable frame', 'Власні пікселі · кадр 1:1 із прокручуванням'],
  provenance: ['Crop, ownership and complete prompt', 'Кадрування, прив’язки й повний запит'],
  original: ['Inspect unchanged generated original', 'Оглянути незмінений створений оригінал'],
  originalTitle: [
    'Unchanged generated original · {{id}}',
    'Незмінений створений оригінал · {{id}}',
  ],
  originalNote: [
    'Original retained in the source repository. See its exact path, dimensions and hash in the provenance record.',
    'Оригінал збережено в репозиторії джерел. Точний шлях, розміри й контрольну суму наведено в записі походження.',
  ],
  dimensions: [
    '{{width}} × {{height}} · {{bytes}} bytes · {{owners}} exact owners',
    '{{width}} × {{height}} · {{bytes}} байтів · {{owners}} точних прив’язок',
  ],
  preparation: [
    '{{width}} × {{height}} sampled grid · {{scale}}× integer clusters · {{colors}} colors',
    'Сітка вибірки {{width}} × {{height}} · цілі блоки {{scale}}× · {{colors}} кольорів',
  ],
};
export function reviewText(key, values = {}) {
  const text = copy[key]?.[getLocale() === 'uk' ? 1 : 0] ?? key;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
}
