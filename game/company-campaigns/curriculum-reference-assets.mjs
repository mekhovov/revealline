import { required } from '../data-json.mjs';

// Cleared reference photographs are discoveries with their own attribution, never
// undocumented wallpaper replacements or a recommendation for a real build.
export const CURRICULUM_REFERENCE_ASSETS = [
  {
    id: 'reference-ukraine-met-shirt-fragment',
    sha256: 'edb86aaaa16ec601d1816765940cdfa37d761e3e557b9e5c2ba37d642fbc216f',
    missionId: 'ukraine-threads-01',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/157573',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      'The Metropolitan Museum of Art, Fragment of a shirt, 2009.300.2715. Brooklyn Museum Costume Collection; gift of the Brooklyn Museum, 2009; earlier Harkness gift, 1931. Public Domain / CC0. Exact source photograph, unchanged.',
    locales: {
      en: {
        title: 'A documented Ukrainian shirt fragment',
        alt: 'A long pale textile fragment on black, with coloured floral embroidery, a row of small motifs along the lower border, and a vertical fold near the right edge.',
        caption:
          'The Met identifies this fragment as Ukrainian, dates it to the final quarter of the eighteenth century, and records linen, silk and metal. That is a record of one object. The photograph alone does not name its maker, establish a precise region, or explain a universal meaning for its flowers. Compare the museum record with what you can actually observe.',
      },
      uk: {
        title: 'Документований фрагмент української сорочки',
        alt: 'Довгий світлий фрагмент тканини на чорному тлі: кольорова квіткова вишивка, ряд дрібних мотивів уздовж нижнього краю та вертикальна складка праворуч.',
        caption:
          'Музей Метрополітен визначає цей фрагмент як український, датує останньою чвертю XVIII століття й зазначає льон, шовк та метал. Це запис про один предмет. Сама фотографія не називає майстра, не визначає точного регіону й не пояснює універсального значення квітів. Порівняйте музейний запис із тим, що справді можна побачити.',
      },
    },
  },
  {
    id: 'reference-ukraine-state-flag',
    sha256: '2331ad1bb17e2f072b42dbc3fb145917a3963a45efdf0b6cff307d2ee8f7e514',
    missionId: 'ukraine-cities-symbols-time-05',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Flag_of_Ukraine.svg',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Flag_of_Ukraine.svg#Licensing',
    attribution:
      'State flag of Ukraine — Government of Ukraine; Wikimedia Commons SVG contributors. Public-domain state-symbol record. Unchanged 960×640 source-rendered PNG, blue above yellow, no generative editing.',
    locales: {
      en: {
        title: 'The state flag, clearly identified',
        alt: 'The rectangular flag of Ukraine: a blue upper half and a yellow lower half, shown flat in a three-to-two width-to-height ratio.',
        caption:
          'This is the separately identified state flag reference. Its two equal horizontal bands match the arrangement described in Article 20 of Ukraine’s Constitution. The nearby generated exhibition uses the same colours illustratively and is not the technical reference.',
      },
      uk: {
        title: 'Державний прапор із чітким підписом',
        alt: 'Прямокутний прапор України: верхня половина синя, нижня жовта; пласке зображення зі співвідношенням ширини до висоти три до двох.',
        caption:
          'Це окремо позначене зображення державного прапора. Дві рівновеликі горизонтальні смуги відповідають розташуванню, описаному в статті 20 Конституції України. Згенерована виставка поруч використовує ці кольори образно й не є технічним зразком.',
      },
    },
  },
  {
    id: 'reference-ukraine-state-emblem',
    sha256: '43e0b61f5fa66df1674160b9d7cbc1d189a1fce2d9be6362e82bc2b3127dc7cf',
    missionId: 'ukraine-cities-symbols-time-04',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Coat_of_Arms_of_Ukraine.svg',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Coat_of_Arms_of_Ukraine.svg#Licensing',
    attribution:
      'State symbol of Ukraine. SVG rendering by Andrew Pertsev, 2022; design attributed by the source to Vasyl Krychevsky. Wikimedia Commons public-domain state-symbol record. Source-rendered 500px PNG kept upright and unchanged.',
    locales: {
      en: {
        title: 'The small State Coat of Arms',
        alt: 'An upright golden trident on a blue shield with a golden border.',
        caption:
          'A source-rendered reference to Ukraine’s small State Coat of Arms, shown upright and unchanged. Compare this documented state symbol with the fictional exhibition scene. The mission’s official resolution link provides the historical and civic context.',
      },
      uk: {
        title: 'Малий Державний Герб',
        alt: 'Вертикальний золотий тризуб на синьому щиті із золотим обрамленням.',
        caption:
          'Зображення Малого Державного Герба України з джерела, показане вертикально й без змін. Порівняйте документований державний символ із вигаданою виставковою сценою. Офіційна постанова за посиланням у місії надає історичний і громадянський контекст.',
      },
    },
  },
  {
    id: 'reference-fpv-ar-drone-prototype',
    sha256: '9b990e53725e07fdf08f93f99aaeeb2eae0746db4bc696c3146ea570fb13abdf',
    locales: {
      en: {
        title: 'A historical AR.Drone prototype',
        alt: 'A photographed Parrot AR.Drone prototype with four visible rotor assemblies and a central body.',
        caption:
          'Nicolas Halftermeyer’s historical photograph of a Parrot AR.Drone prototype. Use it to identify the four-rotor structure; the photograph does not establish its present capabilities, settings or operating permission.',
      },
      uk: {
        title: 'Історичний прототип AR.Drone',
        alt: 'Фотографія прототипу Parrot AR.Drone з чотирма видимими роторними вузлами й центральним корпусом.',
        caption:
          'Історичне фото прототипу Parrot AR.Drone авторства Nicolas Halftermeyer. Воно допомагає розпізнати чотирироторну конструкцію, але не доводить нинішні можливості, налаштування чи дозвіл на використання.',
      },
    },
    attribution:
      'Nicolas Halftermeyer — Ardrone-img5-front.jpg — CC BY 3.0 (https://creativecommons.org/licenses/by/3.0). Unchanged source bytes; renamed for the edition asset registry.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ardrone-img5-front.jpg',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
    missionId: 'fpv-drone-families-01',
  },
  {
    id: 'reference-fpv-solder-iron',
    sha256: '4c657713640d71b4b43cadd125c3420304d3a8458609cee4f833b20c28efdf49',
    locales: {
      en: {
        title: 'Recognize a soldering tool',
        alt: 'A Pinecil USB-C soldering iron with a green grip, metal tip and illuminated display on a blue surface.',
        caption:
          '4300streetcar’s photograph identifies a soldering tool and its separate handle and tip. The pictured iron has a modified screw and an illuminated temperature display. This is an object reference, not a safe resting arrangement or a recommended temperature; use a proper stand and the workshop’s fume controls.',
      },
      uk: {
        title: 'Розпізнайте інструмент для паяння',
        alt: 'Паяльник Pinecil USB-C із зеленим руків’ям, металевим жалом і ввімкненим дисплеєм на синій поверхні.',
        caption:
          'Фото 4300streetcar показує паяльник, його руків’я та жало. У зображеному інструменті змінено гвинт і світиться температурний дисплей. Це приклад предмета, а не безпечного положення чи рекомендованої температури; потрібні належна підставка й контроль випарів.',
      },
    },
    attribution:
      '4300streetcar — Pinecil USB C soldering iron.jpg — CC BY 4.0 (https://creativecommons.org/licenses/by/4.0). Proportional resize to maximum dimension 1280px and JPEG quality 78 using macOS sips 316; no crop, recolour or generative changes.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pinecil_USB_C_soldering_iron.jpg',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    missionId: 'fpv-soldering-workshop-01',
  },
  {
    id: 'reference-fpv-pixhawk-controller',
    sha256: 'bfd4dc1a46b9c8dd0680590ea277c5ada26caaed34ab436635d22c55a4c10bf6',
    locales: {
      en: {
        title: 'One flight-controller design',
        alt: 'A Pixhawk flight controller in a black case, with labelled ports, an orientation arrow and connector pins.',
        caption:
          'A specific Pixhawk controller design credited to the Pixhawk project authors. Its enclosure and port labels are examples, not a universal FPV wiring map. Follow the exact model and revision documentation for real hardware.',
      },
      uk: {
        title: 'Один із варіантів польотного контролера',
        alt: 'Польотний контролер Pixhawk у чорному корпусі з підписаними портами, стрілкою орієнтації та контактами.',
        caption:
          'Конкретний контролер Pixhawk, зображення авторів проєкту Pixhawk. Корпус і написи портів — приклад, а не універсальна схема FPV-проводки. Реальне обладнання потребує документації точної моделі й ревізії.',
      },
    },
    attribution:
      'Pixhawk project authors — Pixhawk.png — CC BY 4.0 (https://creativecommons.org/licenses/by/4.0). Unchanged source bytes; renamed for the edition asset registry.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pixhawk.png',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    missionId: 'fpv-meet-aircraft-04',
  },
  {
    id: 'reference-fpv-brushless-motor',
    sha256: 'c1ada93c62901ed4e724e0c0f3ba7207b3da1d44bb079813c457c71d11d23a94',
    locales: {
      en: {
        title: 'A brushless motor, close up',
        alt: 'Close-up photograph of a Quadshot brushless motor showing copper windings inside its metal housing.',
        caption:
          'Ed Schipul’s close-up shows a motor housing and visible copper windings. The motor is different from the propeller it can drive. This historical component photograph is for recognizing parts, not copying its mount or electrical connections.',
      },
      uk: {
        title: 'Безколекторний двигун зблизька',
        alt: 'Фото безколекторного двигуна Quadshot зблизька: мідні обмотки всередині металевого корпусу.',
        caption:
          'На фото Ed Schipul видно корпус двигуна й мідні обмотки. Двигун відрізняється від пропелера, який може обертати. Історичне фото допомагає розпізнавати деталі, а не копіювати кріплення чи електричні з’єднання.',
      },
    },
    attribution:
      'Ed Schipul — Quadshot drone brushless motors (8107827099).jpg — CC BY 2.0 (https://creativecommons.org/licenses/by/2.0). Proportional resize to maximum dimension 1280px and JPEG quality 78 using macOS sips 316; no crop, recolour or generative changes.',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Quadshot_drone_brushless_motors_(8107827099).jpg',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    missionId: 'fpv-meet-aircraft-02',
  },
  {
    id: 'reference-fpv-solder-spool-label',
    sha256: '5245e5a65b8bd0d7f735c7dca8adab46b32d31d549709afbedf93cbbafa45095',
    locales: {
      en: {
        title: 'Read beyond “lead free”',
        alt: 'A real solder spool labelled “lead free” and “acid core”, with hazard symbols and a length of wire.',
        caption:
          'Wikideas1’s CC0 photograph contains more information than its generic “lead-free solder” description: the product label also says acid core. Use it only for reading and questioning material labels. It is not an electronics-practice material recommendation; the instructor’s exact material specification still matters.',
      },
      uk: {
        title: 'Читайте далі за «без свинцю»',
        alt: 'Реальна котушка припою з написами «lead free» і «acid core», знаками небезпеки та відрізком дроту.',
        caption:
          'CC0-фото Wikideas1 містить більше відомостей, ніж загальний опис «безсвинцевий припій»: на виробі також написано acid core. Використовуйте лише для читання й перевірки позначень. Це не рекомендація матеріалу для навчальної електроніки; потрібна точна специфікація наставника.',
      },
    },
    attribution:
      'Wikideas1 (original upload credited as Kcida10) — Solder on spool.jpeg — CC0 (https://creativecommons.org/publicdomain/zero/1.0/deed.en). Proportional resize to maximum dimension 1280px and JPEG quality 78 using macOS sips 316; no crop, recolour or generative changes.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Solder_on_spool.jpeg',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    missionId: 'fpv-soldering-workshop-02',
  },
  {
    id: 'reference-fpv-solder-joint',
    sha256: 'b0971f7e55c5c93308415698bc7af50038bb583672323adace25eb8f485dde0c',
    locales: {
      en: {
        title: 'Describe what the photograph shows',
        alt: 'A red insulated wire is soldered to a component lead on the rear of a green printed circuit board.',
        caption:
          'MJN123’s photograph, cropped by Soerfm, shows a wire joined to a component lead on a circuit board. Describe visible surfaces and uncertainty. A single photograph does not certify the joint’s electrical reliability or make it an ideal example to reproduce.',
      },
      uk: {
        title: 'Опишіть видиме на фотографії',
        alt: 'Червоний ізольований дріт припаяний до виводу компонента на звороті зеленої друкованої плати.',
        caption:
          'Фото MJN123, кадрування Soerfm, показує дріт, з’єднаний із виводом на платі. Опишіть видимі поверхні й невизначеність. Один знімок не підтверджує електричну надійність і не робить з’єднання ідеальним зразком для повторення.',
      },
    },
    attribution:
      'MJN123; source crop by Soerfm — Solderedjoint.jpg — CC BY 3.0 (https://creativecommons.org/licenses/by/3.0). Proportional resize to maximum dimension 1280px and JPEG quality 78 using macOS sips 316; no crop, recolour or generative changes.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Solderedjoint.jpg',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
    missionId: 'fpv-soldering-workshop-05',
  },
];

export const curriculumReferenceAssetIds = (campaignId) =>
  CURRICULUM_REFERENCE_ASSETS.filter((item) => item.missionId.startsWith(campaignId + '-')).map(
    (item) => item.id,
  );

export function curriculumReferencePayloads(missionId, assets) {
  return CURRICULUM_REFERENCE_ASSETS.filter((item) => item.missionId === missionId).flatMap(
    (item) => {
      const asset = assets.find((entry) => entry.id === item.id);
      required(
        asset?.approved && asset.sha256 === item.sha256,
        'Reference photograph requires its exact admitted bytes: ' + item.id,
      );
      return [
        {
          id: item.id + '-image',
          type: 'image',
          asset: { assetId: item.id, sha256: item.sha256 },
          locales: Object.fromEntries(
            ['en', 'uk'].map((locale) => [
              locale,
              { title: item.locales[locale].title, alt: item.locales[locale].alt },
            ]),
          ),
        },
        {
          id: item.id + '-credit',
          type: 'knowledge',
          locales: Object.fromEntries(
            ['en', 'uk'].map((locale) => [
              locale,
              {
                title: item.locales[locale].title,
                paragraphs: [item.locales[locale].caption, item.attribution],
                sources: [
                  { title: item.locales[locale].title, url: item.sourceUrl },
                  {
                    title:
                      locale === 'uk' ? 'Ліцензія та умови поширення' : 'License and sharing terms',
                    url: item.licenseUrl,
                  },
                ],
              },
            ]),
          ),
        },
      ];
    },
  );
}
