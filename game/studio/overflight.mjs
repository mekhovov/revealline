import {
  createOverflightProject,
  validateOverflightProject,
  compileOverflightProject,
  OVERFLIGHT_MODULES,
} from '../overflight/project.mjs';
import {
  createOverflightPackage,
  createOverflightLibrary,
  importOverflightPackage,
  exportOverflightPackage,
} from '../overflight/community.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { boundedJSON, exactKeys } from '../data-json.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { nativeArtReviewURL, overflightLaunchURL } from '../fpv-entry.mjs';
import {
  overflightFamilyOptions,
  overflightModuleLabel,
  toggleOverflightFamily,
} from './overflight-labels.mjs';

const params = new URL(location.href).searchParams;
if (['en', 'uk'].includes(params.get('lang'))) setLocale(params.get('lang'), { persist: false });
const locale = getLocale() === 'uk' ? 'uk' : 'en';
document.documentElement.lang = locale;
const words = (en, uk) => (locale === 'uk' ? uk : en);
const root = document.querySelector('#overflight-studio');
const element = (tag, text = '', attributes = {}) => {
  const node = document.createElement(tag);
  node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};
const link = (path, en, uk) => {
  const target = new URL(path, location.href);
  target.searchParams.set('lang', locale);
  return element('a', words(en, uk), {
    href: nativeArtReviewURL(target.href, location.href),
  });
};
const nav = element('nav');
nav.append(
  link('../', 'Main game', 'Головна гра'),
  link('./', 'Content Studio', 'Майстерня контенту'),
  link('../community/store.html', 'Community packages', 'Пакети спільноти'),
  link('../../authoring/asset-studio/', 'Asset Studio', 'Майстерня ресурсів'),
  link('../../authoring/motion-lab/#overflight-motion-study', 'Motion Lab', 'Лабораторія руху'),
  link('../overflight/play.html', 'Play Overflight', 'Грати в Проліт'),
);
const status = element('p', '', { id: 'of-status', role: 'status' });
const report = (message, error = false) => {
  status.textContent = message;
  status.dataset.error = String(error);
};
const guard = (fn) => async () => {
  try {
    await fn();
  } catch (error) {
    report(error.message, true);
  }
};
const button = (text, fn) => {
  const node = element('button', text, { type: 'button' });
  node.addEventListener('click', guard(fn));
  return node;
};
const field = (parent, title, input) => {
  const label = element('label', title);
  label.append(input);
  parent.append(label);
  return input;
};
let draft = createOverflightProject(),
  revision = 0,
  importGeneration = 0,
  previewRequest = 0,
  previewIdentity = null,
  disposed = false,
  previewReady = false;
const library = createOverflightLibrary();
const drafts = createProfileRecordBackend({
  key: 'overflight-studio-draft.v1',
  empty: () => ({ project: null }),
  validate(source) {
    const value = boundedJSON(source, {
      maxBytes: 140 * 1024,
      maxNodes: 14000,
      maxDepth: 12,
      maxArray: 128,
    });
    exactKeys(value, ['project'], 'Overflight draft');
    if (value.project !== null) value.project = validateOverflightProject(value.project);
    return value;
  },
});
const editor = element('div');
editor.addEventListener('input', () => {
  revision++;
});
const preview = element('iframe', '', {
  id: 'of-preview',
  title: words('Native Overflight preview', 'Ігровий перегляд Прольоту'),
  allow: 'gamepad; fullscreen',
  src: nativeArtReviewURL(
    new URL(`../overflight/play.html?studio=overflight&lang=${locale}`, location.href).href,
    location.href,
  ),
});
const source = element('textarea', '', {
  id: 'of-source',
  spellcheck: 'false',
  'aria-label': words('Project source', 'Джерело проєкту'),
});
const refreshSource = () => {
  source.value = JSON.stringify(draft, null, 2);
  revision++;
};
source.addEventListener('input', () => {
  revision++;
});
function check() {
  const compiled = compileOverflightProject(draft);
  report(
    words(
      `Validated · ${compiled.encounters.length} encounters · ${compiled.projectIdentity}`,
      `Перевірено · ${compiled.encounters.length} хвиль · ${compiled.projectIdentity}`,
    ),
  );
  return compiled;
}
function sendPreview() {
  const compiled = check();
  if (!previewReady) {
    report(
      words(
        'The native preview is preparing its artwork. Try Preview when it is ready.',
        'Ігровий перегляд готує оформлення. Натисніть «Перегляд», коли він буде готовий.',
      ),
    );
    return;
  }
  previewIdentity = compiled.projectIdentity;
  preview.contentWindow.postMessage(
    {
      type: 'overflight:preview',
      version: 1,
      requestId: ++previewRequest,
      project: structuredClone(draft),
      seed: draft.seed,
    },
    location.origin,
  );
}
const onMessage = (event) => {
  if (
    event.source !== preview.contentWindow ||
    event.origin !== location.origin ||
    event.data?.version !== 1
  )
    return;
  if (event.data.type === 'overflight:ready') {
    previewReady = true;
    try {
      sendPreview();
    } catch (error) {
      report(error.message, true);
    }
  }
  if (
    event.data.type === 'overflight:accepted' &&
    event.data.requestId === previewRequest &&
    event.data.projectIdentity === previewIdentity
  )
    report(
      words(
        'Native preview prepared. Press Start below.',
        'Ігровий перегляд готовий. Натисніть «Почати» внизу.',
      ),
    );
  if (event.data.type === 'overflight:error' && event.data.requestId === previewRequest)
    report(String(event.data.message ?? 'Preview failed'), true);
};
window.addEventListener('message', onMessage);
function numeric(parent, label, owner, key, min, max, step = 1) {
  const input = field(parent, label, element('input', '', { type: 'number', min, max, step }));
  input.value = owner[key];
  input.addEventListener('input', () => {
    owner[key] = Number(input.value);
    refreshSource();
  });
  return input;
}
function renderEditor() {
  editor.replaceChildren();
  const general = element('fieldset'),
    generalFields = element('div', '', { class: 'of-fields' });
  general.append(element('legend', words('Sortie', 'Виліт')), generalFields);
  for (const language of ['en', 'uk']) {
    const title = field(
      generalFields,
      language === 'en' ? 'Title · EN' : 'Назва · UK',
      element('input', '', { maxlength: 120 }),
    );
    title.value = draft.title[language];
    title.addEventListener('input', () => {
      draft.title[language] = title.value;
      refreshSource();
    });
  }
  numeric(generalFields, words('Seed', 'Зерно'), draft, 'seed', 1, 4294967295);
  numeric(generalFields, words('Duration (s)', 'Тривалість (с)'), draft, 'duration', 60, 360);
  numeric(generalFields, words('World width', 'Ширина світу'), draft.arena, 'width', 960, 5760);
  numeric(generalFields, words('World height', 'Висота світу'), draft.arena, 'height', 540, 2160);
  numeric(
    generalFields,
    words('Enemy capacity', 'Місткість ворогів'),
    draft.population,
    'capacity',
    1500,
    2500,
  );
  const encounters = element('fieldset');
  encounters.append(
    element('legend', words('Encounter schedule · seconds', 'Розклад хвиль · секунди')),
  );
  draft.encounters.forEach((encounter, index) => {
    const row = element('div', '', { class: 'of-fields of-encounter' });
    row.append(element('strong', `${index + 1}`));
    numeric(row, words('From', 'Від'), encounter, 'start', 0, 360);
    numeric(row, words('To', 'До'), encounter, 'end', 1, 360);
    numeric(row, words('Arrivals/s', 'Появ/с'), encounter, 'spawnPerSecond', 0, 40, 0.5);
    numeric(row, words('Speed', 'Швидкість'), encounter, 'speed', 10, 140);
    numeric(row, words('Hull', 'Міцність'), encounter, 'hp', 1, 300);
    const pattern = field(row, words('Pattern', 'Рух'), element('select'));
    for (const [id, en, uk] of [
      ['pursuit', 'Pursuit', 'Переслідування'],
      ['crossing', 'Crossing', 'Перетин'],
      ['surge', 'Surge', 'Натиск'],
      ['relief', 'Relief', 'Перепочинок'],
    ])
      pattern.append(element('option', words(en, uk), { value: id }));
    pattern.value = encounter.pattern;
    pattern.addEventListener('change', () => {
      encounter.pattern = pattern.value;
      refreshSource();
    });
    const families = element('details', '', { class: 'of-family-picker' });
    const summary = element('summary');
    const options = overflightFamilyOptions(locale);
    const updateSummary = () => {
      summary.textContent = `${words('Enemies', 'Вороги')} · ${encounter.families.map((id) => options.find((option) => option.id === id)?.name ?? id).join(', ') || words('Choose families', 'Виберіть родини')}`;
    };
    const choices = element('div', '', {
      class: 'of-family-options',
      role: 'group',
      'aria-label': words('Enemy families', 'Родини ворогів'),
    });
    for (const option of options) {
      const input = field(choices, option.name, element('input', '', { type: 'checkbox' }));
      input.checked = encounter.families.includes(option.id);
      input.addEventListener('change', () => {
        encounter.families = toggleOverflightFamily(encounter.families, option.id, input.checked);
        updateSummary();
        refreshSource();
      });
    }
    updateSummary();
    families.append(summary, choices);
    row.append(families);
    row.append(
      button(words('Remove', 'Вилучити'), () => {
        draft.encounters.splice(index, 1);
        renderEditor();
      }),
    );
    encounters.append(row);
  });
  encounters.append(
    button(words('Add encounter', 'Додати хвилю'), () => {
      const end = draft.encounters.at(-1)?.end ?? 0;
      if (end >= draft.duration || draft.encounters.length >= 48) {
        report(
          words(
            'Shorten or remove the last encounter before adding another.',
            'Скоротіть або вилучіть останню хвилю, перш ніж додавати нову.',
          ),
          true,
        );
        return;
      }
      draft.encounters.push({
        id: `custom-${Date.now()}`,
        start: end,
        end: Math.min(draft.duration, end + 35),
        spawnPerSecond: 3,
        speed: 35,
        hp: 30,
        families: ['patroller'],
        pattern: 'pursuit',
      });
      renderEditor();
    }),
  );
  const progression = element('fieldset'),
    progressFields = element('div', '', { class: 'of-fields' });
  progression.append(
    element('legend', words('Upgrades and goals', 'Вдосконалення й цілі')),
    progressFields,
  );
  const thresholds = field(
    progressFields,
    words('Cumulative salvage thresholds', 'Пороги накопиченого брухту'),
    element('input', '', { size: 52 }),
  );
  thresholds.value = draft.upgrades.thresholds.join(', ');
  thresholds.addEventListener('input', () => {
    draft.upgrades.thresholds = thresholds.value.split(',').map(Number);
    draft.upgrades.choices = draft.upgrades.thresholds.length;
    refreshSource();
  });
  numeric(progressFields, words('Rerolls', 'Заміни карток'), draft.upgrades, 'rerolls', 0, 2);
  numeric(progressFields, words('Elite arrival', 'Поява еліти'), draft.goals, 'eliteAt', 10, 340);
  numeric(
    progressFields,
    words('Final arrival', 'Поява фінального танка'),
    draft.goals,
    'finalAt',
    20,
    360,
  );
  numeric(
    progressFields,
    words('Final hull', 'Міцність танка'),
    draft.goals,
    'finalHp',
    300,
    10000,
  );
  for (const id of OVERFLIGHT_MODULES) {
    const input = field(
      progressFields,
      overflightModuleLabel(id, locale),
      element('input', '', { type: 'checkbox' }),
    );
    input.checked = draft.upgrades.modules.includes(id);
    input.disabled = id === 'primary';
    input.addEventListener('change', () => {
      draft.upgrades.modules = OVERFLIGHT_MODULES.filter((module) =>
        module === id ? input.checked : draft.upgrades.modules.includes(module),
      );
      refreshSource();
    });
  }
  const placement = element('fieldset');
  placement.append(
    element(
      'legend',
      words('Low supply cases · decorative, open flight', 'Низькі ящики · вільний політ'),
    ),
  );
  draft.props.forEach((prop, index) => {
    const row = element('div', '', { class: 'of-fields' });
    row.append(element('span', prop.id));
    numeric(row, 'X', prop, 'x', 0, draft.arena.width);
    numeric(row, 'Y', prop, 'y', 0, draft.arena.height);
    row.append(
      button(words('Remove', 'Вилучити'), () => {
        draft.props.splice(index, 1);
        renderEditor();
      }),
    );
    placement.append(row);
  });
  placement.append(
    button(words('Add case', 'Додати ящик'), () => {
      draft.props.push({
        id: `case-${Date.now()}`,
        kind: 'supply-case',
        x: draft.arena.width / 2,
        y: draft.arena.height / 2,
      });
      renderEditor();
    }),
  );
  editor.append(general, encounters, progression, placement);
  refreshSource();
}
const packageText = element('textarea', '', {
  id: 'of-package-export',
  readonly: '',
  'aria-label': words('Exported package JSON', 'JSON експортованого пакета'),
});
const packageExport = element('details', '', { hidden: '' });
packageExport.append(
  element(
    'summary',
    words('Exported package · copy or save', 'Експортований пакет · скопіювати або зберегти'),
  ),
  packageText,
);
const actions = element('div', '', { class: 'of-actions' });
const preset = element('select', '', { 'aria-label': words('Encounter set', 'Набір хвиль') });
for (const [id, en, uk] of [
  ['front', 'Breakthrough', 'Прорив'],
  ['crossing', 'Crosswinds', 'Бічний вітер'],
  ['mixed', 'Convergence', 'Сходження'],
])
  preset.append(element('option', words(en, uk), { value: id }));
const file = element('input', '', {
  type: 'file',
  accept: '.json,application/json',
  'aria-label': words('Import package', 'Імпорт пакета'),
});
file.addEventListener(
  'change',
  guard(async () => {
    if (!file.files[0]) return;
    const generation = ++importGeneration,
      startedAt = revision;
    const imported = await importOverflightPackage(file.files[0]);
    if (disposed || generation !== importGeneration || startedAt !== revision) return;
    draft = structuredClone(imported.project);
    renderEditor();
    check();
  }),
);
actions.append(
  preset,
  button(words('Use encounter set', 'Застосувати набір хвиль'), () => {
    draft = createOverflightProject({ encounterSet: preset.value });
    renderEditor();
    check();
  }),
  button(words('Validate', 'Перевірити'), check),
  button(words('Save draft', 'Зберегти чернетку'), async () => {
    check();
    const accepted = structuredClone(validateOverflightProject(draft));
    await drafts.update(() => ({ project: accepted }));
    if (disposed) return;
    report(
      words(
        'Draft saved in your shared game profile.',
        'Чернетку збережено у вашому ігровому профілі.',
      ),
    );
  }),
  button(words('Preview', 'Перегляд'), sendPreview),
  button(words('Install and play', 'Встановити й грати'), async () => {
    check();
    const startedAt = revision;
    const identity = await library.install(createOverflightPackage(draft));
    if (disposed || startedAt !== revision) return;
    const url = new URL(overflightLaunchURL(location.href, locale));
    url.searchParams.set('community', identity);
    location.href = url.href;
  }),
  button(words('Export package', 'Експорт пакета'), async () => {
    const blob = exportOverflightPackage(createOverflightPackage(draft)),
      url = URL.createObjectURL(blob),
      download = element('a', '', { href: url, download: `${draft.id}.overflight.json` });
    packageText.value = await blob.text();
    packageExport.hidden = false;
    packageExport.open = true;
    download.click();
    report(
      words(
        'Package ready. Save the download or copy the exported JSON below.',
        'Пакет готовий. Збережіть файл або скопіюйте JSON нижче.',
      ),
    );
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }),
  file,
);
const details = element('details');
details.append(
  element(
    'summary',
    words(
      'Project source and exact resource references',
      'Джерело проєкту й точні посилання на ресурси',
    ),
  ),
  source,
  button(words('Apply source', 'Застосувати джерело'), () => {
    draft = structuredClone(validateOverflightProject(source.value));
    renderEditor();
    check();
  }),
);
const previewPanel = element('section', '', { class: 'of-preview-panel' });
previewPanel.append(element('h2', words('Native preview', 'Ігровий перегляд')), preview);
const editingPanel = element('section');
editingPanel.append(editor, details, packageExport);
const workspace = element('div', '', { class: 'of-workspace' });
workspace.append(editingPanel, previewPanel);
root.replaceChildren(
  nav,
  element('h1', words('Overflight Studio', 'Майстерня Прольоту')),
  element(
    'p',
    words(
      'Author a dense six-minute sortie. The preview plays the same compiled project as the native game.',
      'Створіть насичений шестихвилинний виліт. Перегляд використовує той самий скомпільований проєкт, що й гра.',
    ),
  ),
  status,
  actions,
  workspace,
);
renderEditor();
const loadingRevision = revision;
try {
  const saved = await drafts.read();
  if (!disposed && saved.project && revision === loadingRevision) {
    draft = structuredClone(saved.project);
    renderEditor();
    if (previewReady) sendPreview();
  }
} catch (error) {
  report(
    `${words('Draft storage unavailable; export remains available.', 'Сховище чернеток недоступне; експорт працює.')} ${error.message}`,
    true,
  );
}
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  disposed = true;
  window.removeEventListener('message', onMessage);
  drafts.close();
  library.dispose();
});
