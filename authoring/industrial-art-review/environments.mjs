import {
  drawIndustrialMaterialSpecimen,
  INDUSTRIAL_ENVIRONMENT_REVISION,
} from '../../game/presentation/industrial-materials.mjs';

const words = {
  en: {
    title: 'Chapter environments',
    intro:
      'Fourteen existing chapters use accepted, source-bound materials: 24 Capture Solo/Versus missions, 36 Team missions, 12 Snake layouts and 12 flight courses. Six native pursuit courses share the flight kits. Select Military Field, then start a new attempt. Retry and Continue retain its accepted artwork.',
    loading: 'Loading chapter inventory…',
    failed: 'The chapter inventory is unavailable. Reload to retry.',
    count: 'missions',
    package: 'Studio collection',
    inventory: 'Full source and budget inventory',
    studio: 'Open Asset Studio',
    note: 'Import into a separate Studio workspace to compare with your saved artwork. These collections change appearance; terrain, enemy behavior, records and controls retain native rules.',
    sizes: 'Actual 16 / 24 / 32 px materials',
    download: 'download',
    decoded: 'decoded terrain pixels',
    modes: {
      solo: 'Solo',
      versus: 'Versus',
      team: 'Team',
      'self-level': 'Self-level',
      acro: 'Acro',
    },
  },
  uk: {
    title: 'Матеріали розділів',
    intro:
      'Чотирнадцять наявних розділів мають прийняті матеріали, прив’язані до джерела: 24 місії Capture Solo/Versus, 36 командних місій, 12 полів Snake і 12 льотних маршрутів. Шість нативних місій переслідування використовують льотні набори. Оберіть «Військове поле» й почніть нову спробу. Повтор і продовження зберігають її оформлення.',
    loading: 'Завантажуємо перелік розділів…',
    failed: 'Перелік розділів недоступний. Оновіть сторінку, щоб повторити.',
    count: 'місій',
    package: 'Набір для Студії',
    inventory: 'Повний перелік джерел і бюджетів',
    studio: 'Відкрити Студію ресурсів',
    note: 'Імпортуйте в окремий простір Студії для порівняння зі збереженим оформленням. Набори змінюють вигляд; місцевість, поведінка ворогів, рекорди й керування зберігають нативні правила.',
    sizes: 'Матеріали у справжніх 16 / 24 / 32 пікселях',
    download: 'завантаження',
    decoded: 'декодовані пікселі місцевості',
    modes: {
      solo: 'Соло',
      versus: 'Дуель',
      team: 'Команда',
      'self-level': 'Стабілізація',
      acro: 'Акро',
    },
  },
};
const text = (value, max = 256) =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
const id = (value) => text(value, 120) && /^[a-z0-9][a-z0-9-]*$/.test(value);
const requireValue = (ok) => {
  if (!ok) throw new TypeError('Invalid chapter review inventory.');
};
const localTitle = (value, locale) => (typeof value === 'string' ? value : value[locale]);
const titleValid = (value) => text(value) || (value && text(value.en) && text(value.uk));
const modes = new Set(['solo', 'versus', 'team', 'self-level', 'acro']);
const materials = new Set(['concrete', 'earth', 'metal', 'masonry', 'timber', 'damaged']);
function route(path) {
  requireValue(
    text(path, 2048) &&
      /^(?:game|authoring|optional-practice)\//.test(path) &&
      !/[\\%#]/.test(path),
  );
  const parsed = new URL(path, 'https://review.invalid/');
  requireValue(parsed.origin === 'https://review.invalid');
  const allowed = new Set([
    '/game/',
    '/game/couch/',
    '/game/couch/relay-rescue.html',
    '/game/snake/play.html',
    '/optional-practice/fpv-worlds/',
    '/authoring/asset-studio/',
  ]);
  requireValue(allowed.has(parsed.pathname) && !path.startsWith('/') && !path.includes('..'));
  return path;
}
function packagePath(path) {
  requireValue(
    text(path, 240) &&
      /^authoring\/industrial-art-review\/environments-v1\/[a-z0-9-]+\.rltheme$/.test(path),
  );
  return path;
}
export function validateEnvironmentReviewInventory(value) {
  requireValue(
    value?.format === 'revealline-industrial-environment-inventory.v1' &&
      value.materialRevision === INDUSTRIAL_ENVIRONMENT_REVISION,
  );
  requireValue(
    new TextEncoder().encode(JSON.stringify(value)).length <= 2 * 1024 * 1024 &&
      Array.isArray(value.chapters) &&
      value.chapters.length === 14,
  );
  const ids = new Set();
  for (const chapter of value.chapters) {
    requireValue(id(chapter.id) && !ids.has(chapter.id));
    ids.add(chapter.id);
    requireValue(['capture', 'snake', 'sim'].includes(chapter.engine) && titleValid(chapter.title));
    requireValue(
      Array.isArray(chapter.modes) &&
        chapter.modes.length > 0 &&
        chapter.modes.length <= 3 &&
        chapter.modes.every(
          (mode) =>
            modes.has(mode) &&
            (chapter.engine === 'sim'
              ? ['self-level', 'acro']
              : ['solo', 'versus', 'team']
            ).includes(mode),
        ),
    );
    requireValue(
      Number.isInteger(chapter.levelCount) && chapter.levelCount >= 1 && chapter.levelCount <= 24,
    );
    requireValue(
      Array.isArray(chapter.sourceIds) &&
        chapter.sourceIds.length === chapter.levelCount &&
        chapter.sourceIds.every(id) &&
        new Set(chapter.sourceIds).size === chapter.levelCount,
    );
    requireValue(
      chapter.arcade &&
        Object.keys(chapter.arcade).sort().join(',') === 'terrain.lethal,terrain.slow,terrain.wall',
    );
    for (const binding of Object.values(chapter.arcade))
      requireValue(
        binding &&
          materials.has(binding.material) &&
          Number.isInteger(binding.variant) &&
          binding.variant >= 0 &&
          binding.variant <= 3,
      );
    const pack = chapter.package;
    requireValue(
      pack &&
        Number.isSafeInteger(pack.bytes) &&
        pack.bytes > 0 &&
        pack.bytes <= 2 * 1024 * 1024 &&
        Number.isSafeInteger(pack.decodedBytes) &&
        pack.decodedBytes > 0 &&
        pack.decodedBytes <= 1024 * 1024 &&
        /^[a-f0-9]{64}$/.test(pack.sha256),
    );
    packagePath(pack.href);
    requireValue(
      Array.isArray(chapter.links) && chapter.links.length > 0 && chapter.links.length <= 72,
    );
    for (const link of chapter.links) {
      requireValue(chapter.modes.includes(link.mode));
      route(link.href);
    }
    requireValue(
      Array.isArray(chapter.missions) &&
        chapter.missions.length > 0 &&
        chapter.missions.length <= 144,
    );
    for (const mission of chapter.missions) {
      requireValue(
        chapter.sourceIds.includes(mission.id) &&
          titleValid(mission.title) &&
          chapter.modes.includes(mission.mode),
      );
      requireValue(mission.launch && mission.launch.missionId === mission.id);
      route(mission.launch.href);
      const path = new URL(mission.launch.href, 'https://review.invalid/');
      if (chapter.engine === 'snake')
        requireValue(
          path.pathname === '/game/snake/play.html' &&
            path.searchParams.get('level') === mission.id &&
            path.searchParams.get('mode') === mission.mode,
        );
      if (chapter.engine === 'sim')
        requireValue(
          path.pathname === '/optional-practice/fpv-worlds/' &&
            path.searchParams.get('snake-course') === mission.id,
        );
      if (chapter.engine === 'capture')
        requireValue(
          path.pathname ===
            { solo: '/game/', versus: '/game/couch/', team: '/game/couch/relay-rescue.html' }[
              mission.mode
            ] && path.searchParams.get('journey') === 'pursuit-campaigns-v1',
        );
    }
    requireValue(
      chapter.sourceIds.every((sourceId) =>
        chapter.missions.some((mission) => mission.id === sourceId),
      ),
    );
  }
  return value;
}
const element = (tag, value, className) => {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
};
const url = (path, locale, asset = false) => {
  const value = new URL(`../../${asset ? packagePath(path) : route(path)}`, import.meta.url);
  if (!asset) value.searchParams.set('lang', locale);
  return value.href;
};
export function mountEnvironmentReview(root, language) {
  let inventory = null,
    failed = false,
    disposed = false;
  const controller = new AbortController();
  function render() {
    if (disposed) return;
    const locale = language.value === 'uk' ? 'uk' : 'en',
      copy = words[locale];
    root.replaceChildren(element('h2', copy.title), element('p', copy.intro));
    if (!inventory) {
      root.append(element('p', failed ? copy.failed : copy.loading));
      return;
    }
    const details = element('details'),
      summary = element('summary', `${inventory.chapters.length} · ${copy.title}`),
      grid = element('div', undefined, 'environment-grid');
    details.append(summary, element('p', copy.note), grid);
    for (const chapter of inventory.chapters) {
      const card = element('article'),
        heading = element('h3', localTitle(chapter.title, locale));
      const label = element(
        'p',
        `${chapter.engine.toUpperCase()} · ${chapter.levelCount} ${copy.count}`,
      );
      const sample = element('canvas');
      sample.width = 216;
      sample.height = 48;
      sample.setAttribute('aria-label', copy.sizes);
      const ctx = sample.getContext('2d');
      if (ctx) {
        let x = 0;
        for (const binding of Object.values(chapter.arcade))
          for (const size of [16, 24, 32]) {
            drawIndustrialMaterialSpecimen(ctx, {
              material: binding.material,
              x,
              y: 0,
              size,
              width: size,
              height: size,
              revision: INDUSTRIAL_ENVIRONMENT_REVISION,
              variant: binding.variant,
            });
            x += size;
          }
      }
      card.append(heading, label, sample);
      const routes = element('nav');
      if (chapter.engine === 'capture')
        for (const route of chapter.links) {
          const link = element(
            'a',
            `${copy.modes[route.mode]} · ${locale === 'uk' ? 'відкрити добірку' : 'open collection'}`,
          );
          link.href = url(route.href, locale);
          routes.append(link);
        }
      if (chapter.engine === 'sim')
        card.append(
          element(
            'p',
            locale === 'uk'
              ? 'Оберіть стабілізацію або Акро на брифінгу.'
              : 'Choose Self-level or Acro in the briefing.',
          ),
        );
      const download = element('a', copy.package);
      download.href = url(chapter.package.href, locale, true);
      download.download = '';
      const budget = element(
        'p',
        `${(chapter.package.bytes / 1024).toFixed(0)} KiB ${copy.download} · ${(chapter.package.decodedBytes / 1024).toFixed(0)} KiB ${copy.decoded}`,
        'environment-budget',
      );
      const names = element('details'),
        nameSummary = element('summary', `${chapter.levelCount} ${copy.count}`),
        list = element('ul');
      for (const sourceId of chapter.sourceIds) {
        const missions = chapter.missions.filter((mission) => mission.id === sourceId),
          name = localTitle(missions[0].title, locale),
          item = element('li');
        if (chapter.engine === 'capture') item.textContent = name;
        else if (chapter.engine === 'sim') {
          const unique = new Map(missions.map((mission) => [mission.launch.href, mission]));
          for (const mission of unique.values()) {
            const link = element('a', `${locale === 'uk' ? 'Відкрити' : 'Open'} ${name}`);
            link.href = url(mission.launch.href, locale);
            item.append(link);
          }
        } else {
          item.append(element('span', name));
          const navigation = element('nav');
          for (const mission of new Map(
            missions.map((mission) => [mission.mode, mission]),
          ).values()) {
            const link = element('a', `${copy.modes[mission.mode]} · ${name}`);
            link.href = url(mission.launch.href, locale);
            navigation.append(link);
          }
          item.append(navigation);
        }
        list.append(item);
      }
      names.append(nameSummary, list);
      card.append(routes, download, budget, names);
      grid.append(card);
    }
    root.append(details);
    const resources = element('nav'),
      source = element('a', copy.inventory),
      studio = element('a', copy.studio);
    source.href = new URL('./environments-v1/inventory.json', import.meta.url).href;
    studio.href = url('authoring/asset-studio/', locale);
    resources.append(source, studio);
    root.append(resources);
  }
  render();
  language.addEventListener('change', render);
  const ready = fetch(new URL('./environments-v1/inventory.json', import.meta.url), {
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw Error('Inventory unavailable');
      return response.json();
    })
    .then((value) => {
      if (disposed) return;
      inventory = validateEnvironmentReviewInventory(value);
      render();
    })
    .catch((error) => {
      if (!disposed && error.name !== 'AbortError') {
        inventory = null;
        failed = true;
        render();
      }
    });
  const hide = (event) => {
    if (!event.persisted) dispose();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    language.removeEventListener('change', render);
    window.removeEventListener('pagehide', hide);
  };
  window.addEventListener('pagehide', hide);
  return Object.freeze({ ready, dispose });
}
