import { required } from '../data-json.mjs';
import { validateExplorationPayload } from '../rewards/exploration.mjs';

export const CURRICULUM_TEXTILE_LIGHTING_FILES = Object.freeze(
  [
    {
      id: 'textile-light-diffuse-v1',
      path: 'game/editions/assets/discovery/textile-light-diffuse-v1.png',
      sha256: 'eabcef992854e71c481a7e4fdb17fcaf86894375e2950644b940886a7ea1c7e1',
      bytes: 3333938,
    },
    {
      id: 'textile-light-left-v1',
      path: 'game/editions/assets/discovery/textile-light-left-v1.png',
      sha256: '09ff0b2d7811b9ae6076db4ab2708688250ac66d4f683c0fba6e2de92dea4607',
      bytes: 3145957,
    },
    {
      id: 'textile-light-right-v1',
      path: 'game/editions/assets/discovery/textile-light-right-v1.png',
      sha256: '53fe2601e7dfff5ea54f63fea9481c29c1cf7acdea3025f6967bacfdcc88259d',
      bytes: 3114152,
    },
  ].map(Object.freeze),
);
export const CURRICULUM_TEXTILE_LIGHTING_ASSET_IDS = Object.freeze(
  CURRICULUM_TEXTILE_LIGHTING_FILES.map((row) => row.id),
);
const bilingual = (en, uk) => ({ en, uk });

/** Three matching original illustrations, not a measured relighting sequence.
 * This reuses transient card comparison and adds no completion requirement. */
export function createCurriculumTextileLighting(missionId, assets) {
  if (missionId !== 'ukraine-threads-03') return [];
  for (const expected of CURRICULUM_TEXTILE_LIGHTING_FILES) {
    const actual = assets.find((row) => row.id === expected.id);
    required(
      actual?.approved === true &&
        actual.publication === 'public' &&
        actual.sha256 === expected.sha256 &&
        actual.bytes === expected.bytes &&
        actual.path === expected.path,
      'White on White needs its exact reviewed illustration assets.',
    );
  }
  const picture = (id) => {
    const row = CURRICULUM_TEXTILE_LIGHTING_FILES.find((file) => file.id === id);
    return { assetId: row.id, sha256: row.sha256 };
  };
  return [
    validateExplorationPayload({
      id: 'ukraine-threads-03-lighting-comparison',
      type: 'exploration',
      locales: bilingual(
        {
          title: 'Pale threads, changing emphasis',
          intro:
            'Choose any two lighting studies. Compare the raised border, central diamond and small openings. These matching original illustrations vary slightly in their stitches; they explore an idea, not a controlled photographic experiment on one historical textile.',
        },
        {
          title: 'Світлі нитки, різні акценти',
          intro:
            'Виберіть будь-які два етюди освітлення. Порівняйте рельєфну облямівку, центральний ромб і дрібні отвори. Ці узгоджені оригінальні ілюстрації трохи відрізняються стібками: вони досліджують ідею, а не відтворюють контрольований фотоексперимент над одним історичним текстилем.',
        },
      ),
      recipe: {
        id: 'inspect-compare-atlas',
        revision: 1,
        cards: [
          {
            id: 'diffuse',
            asset: picture('textile-light-diffuse-v1'),
            sourceIds: ['regional-white', 'white-technique'],
            locales: bilingual(
              {
                title: 'Soft light · find the structure',
                body: 'Start with the pale border and the filled diamond in the centre. Both stand above the illustrated woven ground, even though their colours are similar. The regional white-on-white embroidery tradition provides context for noticing relief and open areas; this invented sample is not a documented maker’s pattern.',
                sourceNote:
                  'The regional administration describes Reshetylivka’s tradition. Regional Centre Sofia discusses its techniques and light-and-dark relief. Neither source supplies or authenticates this original illustration.',
                alt: 'Original fictional study in soft diffuse light: a pale square textile on charcoal, with a raised cord-like border, one filled central diamond and four smaller open diamonds.',
              },
              {
                title: 'М’яке світло · знайдіть структуру',
                body: 'Почніть зі світлої облямівки та заповненого ромба в центрі. Обидва виступають над зображеним тканим тлом, хоча їхні кольори подібні. Регіональна традиція вишивки білим по білому дає контекст для спостереження за рельєфом і відкритими ділянками; цей вигаданий зразок не є задокументованим узором майстра.',
                sourceNote:
                  'Районна адміністрація описує традицію Решетилівки. Регіональний центр у Софії розглядає її техніки та світлотіньовий рельєф. Жодне джерело не є автором цієї оригінальної ілюстрації та не засвідчує її автентичність.',
                alt: 'Оригінальний вигаданий етюд у м’якому розсіяному світлі: світлий квадратний текстиль на темно-сірому тлі, рельєфна шнуроподібна облямівка, один заповнений центральний ромб і чотири менші відкриті ромби.',
              },
            ),
          },
          {
            id: 'left',
            asset: picture('textile-light-left-v1'),
            sourceIds: ['raking-light', 'white-technique'],
            locales: bilingual(
              {
                title: 'Light from the left · follow an edge',
                body: 'Follow one edge of the central diamond and look for a bright ridge beside a darker patch. Side illumination can make surface relief easier to notice. A shadow beside a pale thread is different from a thread dyed dark; the colour of a single screen pixel does not establish the material.',
                sourceNote:
                  'The National Gallery explains oblique illumination and shadows for raised paint. Applying that general visual idea to this fictional textile is an illustration, not a conservation measurement. Regional Centre Sofia also describes a light-and-dark effect in white embroidery.',
                alt: 'Original fictional white-thread study lit from the left, with a raised diamond and border showing brighter left-facing ridges and darker adjacent edges on a pale woven ground.',
              },
              {
                title: 'Світло зліва · простежте за краєм',
                body: 'Простежте за одним краєм центрального ромба й знайдіть світлий виступ поруч із темнішою ділянкою. Бічне освітлення може допомогти помітити рельєф поверхні. Тінь біля світлої нитки відрізняється від нитки, пофарбованої в темне; колір одного пікселя на екрані не визначає матеріалу.',
                sourceNote:
                  'Національна галерея пояснює косе освітлення й тіні на рельєфній фарбі. Застосування цієї загальної візуальної ідеї до вигаданого текстилю є ілюстрацією, а не реставраційним вимірюванням. Регіональний центр у Софії також описує світлотіньовий ефект білої вишивки.',
                alt: 'Оригінальний вигаданий етюд білих ниток зі світлом зліва: рельєфний ромб і облямівка мають світліші виступи з лівого боку та темніші суміжні краї на світлому тканому тлі.',
              },
            ),
          },
          {
            id: 'right',
            asset: picture('textile-light-right-v1'),
            sourceIds: ['raking-light'],
            locales: bilingual(
              {
                title: 'Light from the right · compare carefully',
                body: 'Compare the emphasis around the border and diamond with the left-lit study. Which edge catches your attention now? Small stitch details also differ between these separate illustrations. Use them to ask what lighting might reveal, not to measure thread depth or claim that only the light changed.',
                sourceNote:
                  'The National Gallery’s source explains why illumination direction matters to visible relief. These three game studies were generated separately; a controlled object comparison would need the same specimen and recorded conditions.',
                alt: 'Original fictional white-thread study lit from the right, with stronger illumination along right-facing raised threads around a filled diamond and square border. Some small stitch details differ from the other studies.',
              },
              {
                title: 'Світло справа · порівнюйте уважно',
                body: 'Порівняйте акценти навколо облямівки й ромба з етюдом, освітленим зліва. Який край тепер привертає увагу? Дрібні деталі стібків у цих окремих ілюстраціях також різняться. Вони допомагають запитати, що може виявити світло, але не виміряти висоту нитки чи стверджувати, що змінилося лише освітлення.',
                sourceNote:
                  'Джерело Національної галереї пояснює вплив напрямку світла на видимий рельєф. Три ігрові етюди згенеровано окремо; контрольоване порівняння потребувало б того самого предмета й зафіксованих умов.',
                alt: 'Оригінальний вигаданий етюд білих ниток зі світлом справа: сильніше освітлено праві поверхні рельєфних ниток навколо заповненого ромба та квадратної облямівки. Деякі дрібні стібки відрізняються від інших етюдів.',
              },
            ),
          },
        ],
        predictions: [
          {
            id: 'shadow-or-dye',
            cardIds: ['left', 'right'],
            expectedChoiceId: 'compare-light',
            locales: bilingual(
              {
                prompt:
                  'On an unchanged real sample, a dark patch lies beside a raised pale thread. What would help you test whether it is a shadow before calling the thread dark-dyed?',
                explanation:
                  'Compare the same thread under another documented light direction. A shadow can move or change while the material remains the same. One photograph—or our separate illustrations—does not by itself establish dye or fibre.',
              },
              {
                prompt:
                  'На незміненому реальному зразку поруч із рельєфною світлою ниткою є темна ділянка. Що допоможе перевірити, чи це тінь, перш ніж називати нитку темнофарбованою?',
                explanation:
                  'Порівняйте ту саму нитку за іншого зафіксованого напрямку світла. Тінь може зміститися чи змінитися, хоча матеріал лишається тим самим. Одна фотографія або наші окремі ілюстрації самі по собі не визначають барвника чи волокна.',
              },
            ),
            choices: [
              {
                id: 'compare-light',
                locales: bilingual(
                  {
                    label: 'Compare the same thread under another light',
                    feedback:
                      'Yes. Keep the specimen fixed and investigate whether the dark area follows the illumination.',
                  },
                  {
                    label: 'Порівняти ту саму нитку за іншого світла',
                    feedback:
                      'Так. Збережіть той самий зразок і перевірте, чи темна ділянка змінюється разом з освітленням.',
                  },
                ),
              },
              {
                id: 'assume-dye',
                locales: bilingual(
                  {
                    label: 'Treat every dark patch as dyed thread',
                    feedback:
                      'A dark patch can be a shadow. Check another view before deciding what the material is.',
                  },
                  {
                    label: 'Вважати кожну темну ділянку фарбованою ниткою',
                    feedback:
                      'Темна ділянка може бути тінню. Перевірте інший вид, перш ніж робити висновок про матеріал.',
                  },
                ),
              },
            ],
          },
        ],
        sources: [
          {
            id: 'regional-white',
            title: 'Kremenchuk district administration — Reshetylivka white-on-white embroidery',
            url: 'https://kremenchukrda.gov.ua/news/holova-poltavskoyi-oda-prosuvayemo-vyshyvku-bilym-po-bilomu-do-nematerialnoyi-spadshchyny-yunesko',
          },
          {
            id: 'white-technique',
            title: 'Regional Centre Sofia — White on White Technique of Embroidery of Reshetylivka',
            url: 'https://www.unesco-centerbg.org/en/2021/11/22/white-on-white-technique-of-embroidery-of-reshetylivka/',
          },
          {
            id: 'raking-light',
            title: 'National Gallery — Raking light',
            url: 'https://www.nationalgallery.org.uk/paintings/glossary/raking-light',
          },
        ],
      },
    }),
  ];
}
