import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { ordinaryPath } from '../../authoring/production/sources.mjs';
import { contentText } from '../i18n/content.mjs';
import { setLocale } from '../i18n/index.mjs';
import { dataIdentity } from '../data-json.mjs';
import { createMissionLibrary, libraryMissionId } from '../mission-library/library.mjs';

const scripts = await Promise.all(
  ['../vendor/i18next-26.4.2.min.js', '../i18n/catalogs.mjs', '../i18n/bootstrap.mjs'].map((file) =>
    fs.readFile(new URL(file, import.meta.url), 'utf8'),
  ),
);
const key = 'revealline.locale.v1';
function runtime({
  saved,
  languages,
  language,
  blocked = false,
  weakRef = WeakRef,
  document,
} = {}) {
  const values = new Map(saved === undefined ? [] : [[key, saved]]);
  const events = new Map();
  const context = vm.createContext({
    Intl,
    console,
    WeakRef: weakRef,
    navigator: { languages, language },
    document,
    localStorage: {
      getItem: (name) => {
        if (blocked) throw Error('Blocked');
        return values.get(name) ?? null;
      },
      setItem: (name, value) => {
        if (blocked) throw Error('Blocked');
        values.set(name, value);
      },
    },
    addEventListener: (name, callback) => events.set(name, callback),
  });
  for (const source of scripts) vm.runInContext(source, context);
  return { api: context.RevealLineI18n, values, events };
}

test('locale resolution respects saved choices, ordered preferences and regional tags', () => {
  for (const [options, expected] of [
    [{ languages: ['de-DE', 'uk-UA', 'en-GB'] }, 'uk'],
    [{ languages: ['en-GB', 'uk-UA'] }, 'en'],
    [{ languages: ['bad_tag', 'fr'], language: 'UK-ua' }, 'uk'],
    [{ languages: [], language: 'uk' }, 'uk'],
    [{ languages: ['ru', 'de'], language: 'zz' }, 'en'],
    [{ saved: 'uk', languages: ['en'] }, 'uk'],
    [{ saved: 'en', languages: ['uk'] }, 'en'],
    [{ saved: 'uk-UA', languages: ['en'] }, 'en'],
    [{ saved: '__proto__', languages: ['uk'] }, 'uk'],
    [{ saved: '', languages: [null, 42] }, 'en'],
  ])
    assert.equal(runtime(options).api.getLocale(), expected);
});

test('automatic detection is not persisted; explicit choice survives restart and storage failure', () => {
  const first = runtime({ languages: ['uk-UA'] });
  assert.equal(first.values.has(key), false);
  first.api.setLocale('en');
  assert.equal(first.values.get(key), 'en');
  assert.equal(runtime({ saved: first.values.get(key), languages: ['uk'] }).api.getLocale(), 'en');
  first.events.get('languagechange')();
  assert.equal(first.api.getLocale(), 'en');
  const blocked = runtime({ blocked: true });
  assert.equal(blocked.api.setLocale('uk').saved, false);
  assert.equal(blocked.api.t('common:language.label'), 'Мова');
  assert.throws(() => blocked.api.setLocale('ru'), /Unsupported/);
});

test('production source diagnostics follow the active locale without changing source names', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-i18n-production-'));
  try {
    await fs.mkdir(path.join(root, 'game'));
    await fs.writeFile(path.join(root, 'game/source.json'), '{}');
    await fs.symlink('source.json', path.join(root, 'game/linked.json'));
    setLocale('uk', { persist: false });
    await assert.rejects(
      ordinaryPath(root, 'game/linked.json'),
      /Джерело через символічне посилання відхилено: game\/linked\.json/,
    );
    setLocale('en', { persist: false });
    await assert.rejects(
      ordinaryPath(root, 'game/linked.json'),
      /Symlink source refused: game\/linked\.json/,
    );
  } finally {
    setLocale('en', { persist: false });
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('cross-tab changes update language only and ignore game-save storage events', () => {
  const { api, events, values } = runtime();
  let changes = 0;
  const unsubscribe = api.onLocaleChange(() => changes++);
  values.set(key, 'uk');
  events.get('storage')({ key });
  assert.equal(api.getLocale(), 'uk');
  events.get('storage')({ key: 'xonix-player-library.v1' });
  assert.equal(changes, 1);
  values.delete(key);
  events.get('storage')({ key });
  assert.equal(api.getLocale(), 'en');
  unsubscribe();
  api.setLocale('uk');
  assert.equal(changes, 2);
});

test('Ukrainian plural rules include zero, teens, compound counts and decimals', () => {
  const { api } = runtime({ saved: 'uk' });
  for (const [count, expected] of [
    [0, '0 рівнів'],
    [1, '1 рівень'],
    [2, '2 рівні'],
    [5, '5 рівнів'],
    [11, '11 рівнів'],
    [21, '21 рівень'],
    [22, '22 рівні'],
    [1.5, '1,5 рівня'],
  ])
    assert.equal(api.t('common:counts.levels', { count }), expected);
});

test('website release and mission selectors use complete English and Ukrainian messages', () => {
  const english = runtime({ saved: 'en' }).api;
  assert.equal(
    english.t('website:preservedBuildStatus', { count: 2, current: 'v0.131.0' }),
    '2 preserved builds · v0.131.0 remains the default.',
  );
  assert.equal(
    english.t('website:quickSelector.levelLocked', { number: '02', name: 'Crosswind' }),
    '02 · Crosswind · locked',
  );

  const ukrainian = runtime({ saved: 'uk' }).api;
  for (const [count, expected] of [
    [1, '1 збережена збірка · v0.131.0 залишається типовою.'],
    [2, '2 збережені збірки · v0.131.0 залишається типовою.'],
    [5, '5 збережених збірок · v0.131.0 залишається типовою.'],
    [1.5, '1,5 збереженої збірки · v0.131.0 залишається типовою.'],
  ])
    assert.equal(
      ukrainian.t('website:preservedBuildStatus', { count, current: 'v0.131.0' }),
      expected,
    );
  assert.equal(
    ukrainian.t('website:quickSelector.levelLocked', {
      number: '02',
      name: 'Бічний вітер',
    }),
    '02 · Бічний вітер · заблоковано',
  );
});

test('Asset Studio dynamic labels and diagnostics are bilingual', () => {
  for (const [saved, expected] of [
    [
      'en',
      [
        'Download field-kit.png',
        'Crop dimensions must be positive whole pixels.',
        'The crop must use whole pixels and fit completely inside the original image.',
        'Studio Interface control is unavailable: preview-size',
        'Team arena Relay Yard: Joint capture',
        '32 × 24 · cursor 4, 7 · selection 3 × 2',
        'Missing bytes for font.ui. Re-import the complete theme bundle.',
        'Preview fixture unavailable (503).',
        'Missing: 2 · source: 3 · produced: 4 · reviewed: 5. Readiness is evidence based.',
        'This slot accepts image, audio. Choose an appropriate file.',
        'Collection has no binding for player.scout.compact.',
      ],
    ],
    [
      'uk',
      [
        'Завантажити field-kit.png',
        'Розміри обрізання мають бути додатними цілими пікселями.',
        'Обрізання має використовувати цілі пікселі й повністю вміщуватися в оригінальне зображення.',
        'Елемент керування інтерфейсом Студії недоступний: preview-size',
        'Арена Team Relay Yard: Спільне захоплення',
        '32 × 24 · курсор 4, 7 · виділення 3 × 2',
        'Немає байтів для font.ui. Повторно імпортуйте повний пакет теми.',
        'Зразок попереднього перегляду недоступний (503).',
        'Відсутні: 2 · джерела: 3 · створені: 4 · перевірені: 5. Готовність визначається доказами.',
        'Цей слот приймає: image, audio. Виберіть відповідний файл.',
        'У колекції немає прив’язки для player.scout.compact.',
      ],
    ],
  ]) {
    const { api } = runtime({ saved });
    assert.deepEqual(
      [
        api.t('tools:studio.download.file', { filename: 'field-kit.png' }),
        api.t('tools:studio.crop.positiveWholePixels'),
        api.t('tools:studio.crop.insideOriginal'),
        api.t('tools:studio.interface.controlUnavailable', { control: 'preview-size' }),
        api.t('tools:studio.crossMode.teamArenaLabel', {
          arena: 'Relay Yard',
          scene: api.t('tools:jointCapture'),
        }),
        api.t('tools:studio.sprite.cursor', {
          width: 32,
          height: 24,
          cursor: '4, 7',
          selection: api.t('tools:studio.sprite.selection', { width: 3, height: 2 }),
          anchor: '',
        }),
        api.t('tools:studio.preview.missingBytes', { id: 'font.ui' }),
        api.t('tools:studio.scenePreview.fixtureUnavailable', { status: 503 }),
        api.t('tools:studio.inventory.coverage', {
          missing: 2,
          source: 3,
          produced: 4,
          reviewed: 5,
        }),
        api.t('tools:studio.upload.acceptedKinds', { kinds: 'image, audio' }),
        api.t('tools:studio.collection.missingBinding', {
          slotId: 'player.scout.compact',
        }),
      ],
      expected,
    );
  }
});

test('Playground encounter and control measurements cover every Ukrainian plural category', () => {
  const { api } = runtime({ saved: 'uk' });
  for (const [count, relay, box] of [
    [0, 'ретрансляторами', 'областей'],
    [1, 'ретранслятором', 'область'],
    [2, 'ретрансляторами', 'області'],
    [5, 'ретрансляторами', 'областей'],
    [11, 'ретрансляторами', 'областей'],
    [21, 'ретранслятором', 'область'],
    [22, 'ретрансляторами', 'області'],
    [1.5, 'ретрансляторами', 'області'],
  ]) {
    const encounter = api.t('tools:playground.sentinelEncounter', { count });
    const controls = api.t('tools:playground.measuredControlBoxes', {
      count,
      width: 44,
      height: 48,
      reachability: 'у межах вікна',
    });
    assert.match(encounter, new RegExp(`Вартовий із .* ${relay} щита`));
    assert.match(controls, new RegExp(`виміряно .* ${box} ·`));
    assert.doesNotMatch(`${encounter} ${controls}`, /\{\{|Sentinel|Controls/);
  }
});

test('Couch continuation cancellation interpolates its localized action', () => {
  for (const [saved, action, expected] of [
    [
      'en',
      'Next round',
      'Next round picture loading cancelled. Results are kept. Choose Next round when you are ready.',
    ],
    [
      'uk',
      'Наступний раунд',
      'Завантаження зображення для дії «Наступний раунд» скасовано. Результати збережено. Оберіть «Наступний раунд», коли будете готові.',
    ],
  ])
    assert.equal(
      runtime({ saved }).api.t('interface:couch.continuationPictureLoadingCancelled', { action }),
      expected,
    );
});

test('Couch preparation failures have complete English and Ukrainian messages', () => {
  for (const [saved, expected] of [
    [
      'en',
      [
        'This map picture or actor appearance could not load: unavailable',
        'This chapter could not load: unavailable',
        'The next round picture or actors could not be prepared. Both boards are kept. Choose Next round to retry.',
        'The prepared picture could not be confirmed. Retry or choose a new setup: unavailable',
      ],
    ],
    [
      'uk',
      [
        'Не вдалося завантажити зображення мапи або вигляд персонажа: unavailable',
        'Не вдалося завантажити розділ: unavailable',
        'Не вдалося підготувати зображення або персонажів для дії «наступний раунд». Обидва поля збережено. Оберіть «Наступний раунд», щоб повторити спробу.',
        'Не вдалося підтвердити підготовлене зображення. Повторіть спробу або виберіть нові налаштування: unavailable',
      ],
    ],
  ]) {
    const { api } = runtime({ saved });
    const retryAction = saved === 'uk' ? 'Наступний раунд' : 'Next round';
    assert.deepEqual(
      [
        api.t('interface:couch.mapPictureOrActorAppearanceCouldNotLoad', {
          error: 'unavailable',
        }),
        api.t('interface:couch.chapterCouldNotLoad', { error: 'unavailable' }),
        api.t('interface:couch.continuationPictureOrActorsCouldNotBePrepared', {
          actionLower: retryAction.toLocaleLowerCase(),
          retryAction,
        }),
        api.t('interface:couch.preparedPictureCouldNotBeConfirmed', {
          error: 'unavailable',
        }),
      ],
      expected,
    );
  }
});

test('text and attribute bindings update in place without changing editor values', () => {
  const { api } = runtime();
  const node = {
    textContent: '',
    value: 'Unsaved title',
    selectionStart: 3,
    scrollTop: 14,
    attributes: {},
    getAttribute(name) {
      return this.attributes[name];
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  api.localizedText(node, () => api.t('common:actions.pause'));
  api.localizedAttribute(node, 'aria-label', () => api.t('common:language.label'));
  api.setLocale('uk');
  assert.equal(node.textContent, 'Пауза');
  assert.equal(node.attributes['aria-label'], 'Мова');
  assert.equal(node.value, 'Unsaved title');
  assert.equal(node.selectionStart, 3);
  assert.equal(node.scrollTop, 14);
});

test('locale layout pins scroll without leaving authored scroll anchoring overridden', () => {
  for (const original of ['', 'auto']) {
    let anchor = original,
      priority = original ? 'important' : '';
    const label = { textContent: '', isConnected: true };
    const root = {
      scrollTop: 90,
      scrollLeft: 12,
      style: {
        getPropertyValue: () => anchor,
        getPropertyPriority: () => priority,
        setProperty(_key, value, nextPriority) {
          anchor = value;
          priority = nextPriority;
        },
        removeProperty() {
          anchor = '';
          priority = '';
        },
      },
      getBoundingClientRect() {
        assert.equal(
          anchor,
          'none',
          'Anchoring is disabled while translated geometry is committed.',
        );
        assert.equal(label.textContent, 'Пауза');
        this.scrollTop = 65;
        return {};
      },
    };
    const document = {
      documentElement: root,
      querySelectorAll: (selector) => (selector === '*' ? [root, label] : []),
    };
    const { api } = runtime({ document });
    api.localizedText(label, () => api.t('common:actions.pause'));
    api.setLocale('uk', { persist: false });
    assert.equal(root.scrollTop, 90);
    assert.equal(root.scrollLeft, 12);
    assert.equal(anchor, original);
    assert.equal(priority, original ? 'important' : '');
    api.onLocaleChange(() => {
      throw new Error('Broken presentation observer');
    });
    assert.throws(() => api.setLocale('en', { persist: false }), /Broken presentation observer/);
    assert.equal(anchor, original, 'A failing observer must also release its temporary style.');
    assert.equal(priority, original ? 'important' : '');
  }
});

test('content uses exact identity and field; edited imports retain authored text and hashes', async () => {
  const campaign = JSON.parse(
    await fs.readFile(new URL('../content/campaign.json', import.meta.url)),
  );
  const before = dataIdentity(campaign);
  setLocale('uk', { persist: false });
  try {
    assert.equal(contentText(campaign, 'title'), 'Перший сигнал');
    assert.equal(contentText(campaign.levels[1], 'name'), 'Сад ретрансляторів');
    const edited = structuredClone(campaign.levels[1]);
    edited.rules.lives += 1;
    assert.equal(contentText(edited, 'name'), 'Relay Orchard');
    edited.name = 'My own map';
    assert.equal(contentText(edited, 'name'), 'My own map');
    const shallow = Object.freeze(structuredClone(campaign.levels[1]));
    assert.equal(contentText(shallow, 'name'), 'Сад ретрансляторів');
    shallow.rules.lives += 1;
    assert.equal(
      contentText(shallow, 'name'),
      'Relay Orchard',
      'shallow freezing must not hide a nested custom edit',
    );
    assert.equal(dataIdentity(campaign), before);
  } finally {
    setLocale('en', { persist: false });
  }
});

test('mission library validation errors follow the active locale without changing source identity', () => {
  setLocale('en', { persist: false });
  try {
    assert.throws(() => libraryMissionId({}), /Mission library needs an owner\./);
    const authored = Object.freeze({
      id: 'authored-mission',
      campaignKey: 'authored-campaign',
      campaignTitle: 'My authored campaign',
      name: 'My authored mission',
      levelIndex: 0,
      modes: Object.freeze(['solo']),
    });
    const library = createMissionLibrary([
      {
        id: 'authored-source',
        editionId: 'authored-edition',
        edition: 'My authored edition',
        collection: 'Custom',
        entries: [authored],
        describe: (entry) => entry,
        availability: () => ({ state: 'ready' }),
        launch: () => true,
      },
    ]);
    const row = library.missions[0];
    setLocale('uk', { persist: false });
    assert.throws(() => libraryMissionId({}), /Для бібліотеки місій потрібне поле «власник»\./);
    assert.throws(() => library.forMode('online'), /Невідомий режим бібліотеки\./);
    library.remove('authored-source');
    assert.throws(() => library.availability(row), /Цей вибір місії застарів\./);
    assert.equal(authored.name, 'My authored mission');
  } finally {
    setLocale('en', { persist: false });
  }
});

test('caption bindings preserve appended controls and accept a direct Text node', () => {
  let collectRemovedText = false;
  const { api } = runtime({
    weakRef: class {
      constructor(value) {
        this.value = value;
      }
      deref() {
        return collectRemovedText && this.value.nodeType === 3 && !this.value.parentNode
          ? undefined
          : this.value;
      }
    },
  });
  const document = {
    createTextNode(value) {
      return { nodeType: 3, textContent: value, parentNode: null, ownerDocument: document };
    },
  };
  const label = {
    ownerDocument: document,
    childNodes: [],
    set textContent(value) {
      for (const child of this.childNodes) child.parentNode = null;
      this.childNodes = [];
      if (value) this.append(document.createTextNode(value));
    },
    get textContent() {
      return this.childNodes.map((node) => node.textContent || '').join('');
    },
    append(node) {
      node.parentNode = this;
      this.childNodes.push(node);
    },
  };
  api.localizedText(label, () => api.t('interface:standard'));
  const initialCaption = label.childNodes[0];
  api.localizedText(label, () => api.t('interface:display.textSize.standard'));
  assert.equal(label.childNodes[0], initialCaption, 'equal English retains the native text node');
  api.setLocale('uk');
  assert.equal(initialCaption.textContent, 'Стандартний', 'the newly accepted meaning wins');
  api.setLocale('en');
  api.localizedText(label, () => api.t('common:language.label'));
  const select = { value: 'unsaved', selectedIndex: 2, scrollTop: 30 };
  label.append(select);
  const text = document.createTextNode('');
  api.localizedText(text, () => api.t('common:actions.back'));
  api.setLocale('uk');
  assert.equal(label.childNodes[0].textContent, 'Мова');
  assert.equal(label.childNodes[1], select);
  assert.equal(select.value, 'unsaved');
  assert.equal(select.selectedIndex, 2);
  assert.equal(select.scrollTop, 30);
  assert.equal(text.textContent, 'Назад');
  // A presentation owner can replace a static caption with structured controls.
  // Once the old Text node is collected, a locale change must not resurrect it.
  label.textContent = '';
  label.append(select);
  collectRemovedText = true;
  api.setLocale('en');
  assert.deepEqual(label.childNodes, [select]);
});

test('locale changes do not call retired detached control producers', () => {
  const { api } = runtime();
  const node = { textContent: '', isConnected: true };
  let retired = false;
  api.localizedText(node, () => {
    assert.equal(retired, false, 'a retired library row cannot be read');
    return api.t('common:actions.play');
  });
  node.isConnected = false;
  retired = true;
  assert.doesNotThrow(() => api.setLocale('uk'));
});

test('an accepted host caption retires the original rich slots across locale changes and remounts', () => {
  const { api } = runtime();
  const doc = { createTextNode: (textContent) => ({ nodeType: 3, textContent, parentNode: null }) };
  const link = {
    nodeType: 1,
    textContent: 'Original mission details',
    parentNode: null,
    getAttribute: (name) => (name === 'data-i18n-slot' ? 'slot0' : null),
  };
  const node = {
    childNodes: [],
    ownerDocument: doc,
    isConnected: true,
    getAttribute: (name) => (name === 'data-i18n-rich' ? 'interface:legacyMissions' : null),
    get children() {
      return this.childNodes.filter((child) => child.nodeType === 1);
    },
    get textContent() {
      return this.childNodes.map((child) => child.textContent).join('');
    },
    set textContent(value) {
      this.replaceChildren(...(value ? [doc.createTextNode(value)] : []));
    },
    append(child) {
      child.parentNode = this;
      this.childNodes.push(child);
    },
    replaceChildren(...children) {
      for (const child of this.childNodes) child.parentNode = null;
      this.childNodes = [];
      children.forEach((child) => this.append(child));
    },
  };
  node.append(link);
  const root = { querySelectorAll: (selector) => (selector === '[data-i18n-rich]' ? [node] : []) };
  api.translateDOM(root);
  assert.match(node.textContent, /Legacy missions Original mission details/);
  api.setLocale('uk');
  assert.equal(link.parentNode, node);
  api.localizedText(node, () => api.t('interface:allMissions'));
  assert.equal(link.parentNode, null);
  api.setLocale('en');
  api.translateDOM(root);
  assert.equal(node.textContent, 'All missions');
  api.setLocale('uk');
  assert.equal(node.textContent, 'Усі місії');
  assert.doesNotMatch(node.textContent, /\[\[/);
});
