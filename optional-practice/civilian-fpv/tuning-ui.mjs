import {
  mountWorkbenchChrome,
  mountWorkbenchPhysics,
  drawWorkbenchCurve,
  workbenchCurvePosition,
  paintCameraFraming,
} from './setup-workbench.mjs';
import { createSetupDraft } from './setup-draft.mjs';
import { createControllerTunePanel } from './controller-tune-panel.mjs';
import { mountResponseBenchPanel } from './response-bench-panel.mjs';
import { DEFAULT_RESPONSE, responseCurve } from './radio-profile.mjs';
import { createTunedResponse, TUNED_RESPONSE_FORMAT } from './flight-response.mjs';
import {
  createRateProfile,
  createRateEvaluator,
  RATE_ALGORITHMS,
  RATE_PARAMETER_LIMITS,
  rateProfileIdentity,
} from './rates.mjs';
import { profileUsers, TUNING_LIBRARY_BYTES } from './tuning-library.mjs';
import {
  listAircraftPresets,
  getAircraftPreset,
  createPresetConfiguration,
  createPresetComponents,
  applyAircraftComponents,
} from './aircraft-presets.mjs';
import { aircraftPerformance } from './aircraft-physics.mjs';
import { createAircraftPreview } from './aircraft-preview.mjs';
import { exportJSONFile, exportTextFile } from '../../game/platform.mjs';
import { canonicalJSON } from '../../game/data-json.mjs';
import {
  previewBetaflightImport,
  previewNativeRateImport,
  betaflightDefaultRateProfile,
  exportBetaflightRates,
  exportNativeRateProfile,
  resolveBetaflightPresetBundle,
} from './betaflight-import.mjs';

const axes = ['roll', 'pitch', 'yaw'],
  colors = ['#f07863', '#55c8a4', '#75aaff'];
const clone = (value) => structuredClone(value);
const title = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const id = () =>
  `tuning-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

/** A draft never changes the library or an armed flight until the player chooses an action. */
export function mountFlightTuning({
  document: doc,
  window: win,
  store,
  locale = () => 'en',
  onOpen = () => {},
  onClose = () => {},
  onApply = () => {},
  onTest = () => {},
  onSaved = () => {},
  getDiagnostics = () => ({}),
  onAdvanced,
  onCalibration,
  canCalibrate = () => true,
  getFlightConfiguration = () => null,
  getPracticeConditions = () => null,
  responseBenchWorkerURL,
  platformOptions = {},
} = {}) {
  const translations = new Map(),
    textBindings = new Map(),
    attributeBindings = [];
  const t = (en, uk) => {
    translations.set(en, [en, uk]);
    translations.set(uk, [en, uk]);
    return locale() === 'uk' ? uk : en;
  };
  const axisName = (axis) =>
    t(title(axis), { roll: 'Крен', pitch: 'Тангаж', yaw: 'Рискання' }[axis]);
  const translatedAttribute = (node, name, value) => {
    node.setAttribute(name, value);
    const pair = translations.get(value);
    if (pair) attributeBindings.push({ node, name, pair });
  };
  const root = doc.createElement('dialog');
  root.className = 'fpv-tuning';
  translatedAttribute(root, 'aria-label', t('Setup workbench', 'Майстерня налаштувань'));
  const removers = [],
    buttons = [],
    drafts = new Map(),
    setupDrafts = new Map();
  let controllerTunes,
    responseBench,
    benchSignature = '',
    inputReviewSignature = null;
  let workbench,
    physics,
    completeDraft,
    editedSetup,
    editedSetupId,
    library,
    selected,
    draft,
    camera,
    componentInventory = null,
    editRevision,
    algorithmDrafts = {},
    numericDrafts = {},
    axisInputs = {},
    evaluator,
    savedEvaluator,
    rateCurve,
    imported = null,
    importComparison = null,
    importReviewPanel = null,
    importTechnical = null,
    hashingImport = null,
    draftProvenance = null,
    frame = null,
    disposed = false,
    opener = null,
    testing = false,
    draftFlightActive = false,
    busy = false,
    fileExporting = false,
    openEpoch = 0,
    numericCommits = [],
    numericFailure = null;
  const el = (tag, text, parent = root, translate = true) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (translate && translations.has(text)) textBindings.set(node, translations.get(text));
    parent?.append(node);
    return node;
  };
  const listen = (node, event, fn) => {
    const guarded = (value) => {
      if (disposed || (busy && (event === 'input' || event === 'change'))) return;
      return fn(value);
    };
    node.addEventListener(event, guarded);
    const remove = () => node.removeEventListener(event, guarded);
    remove.node = node;
    removers.push(remove);
  };
  const releaseChildren = (parent) => {
    for (let index = removers.length - 1; index >= 0; index--)
      if (
        removers[index].node !== win &&
        removers[index].node !== parent &&
        parent.contains(removers[index].node)
      ) {
        removers[index]();
        removers.splice(index, 1);
      }
    for (const node of textBindings.keys())
      if (node !== parent && parent.contains(node)) textBindings.delete(node);
    for (let index = attributeBindings.length - 1; index >= 0; index--)
      if (
        attributeBindings[index].node !== parent &&
        parent.contains(attributeBindings[index].node)
      )
        attributeBindings.splice(index, 1);
  };
  const action = (label, fn, parent = root) => {
    const node = el('button', label, parent);
    node.type = 'button';
    listen(node, 'click', () => {
      if (disposed || busy) return;
      void Promise.resolve().then(fn).catch(report);
    });
    return node;
  };
  const field = (label, type = 'text', parent = root) => {
    const wrap = el('label', label, parent),
      input = el('input', undefined, wrap);
    input.type = type;
    if (type === 'checkbox') wrap.className = 'tuning-checkbox';
    translatedAttribute(input, 'aria-label', label);
    input.dataset.search = (translations.get(label) ?? [label]).join(' ');
    return input;
  };
  const select = (label, choices, parent = root) => {
    const wrap = el('label', label, parent),
      input = el('select', undefined, wrap);
    translatedAttribute(input, 'aria-label', label);
    input.dataset.search = (translations.get(label) ?? [label]).join(' ');
    for (const [value, text] of choices) {
      const option = el('option', text, input);
      option.value = value;
    }
    return input;
  };
  const heading = el('h2', t('Setup workbench', 'Майстерня налаштувань'));
  heading.tabIndex = -1;
  const introduction = el(
    'p',
    t(
      'Profiles on this device. Rates control requested rotation; the aircraft determines how quickly it follows.',
      'Профілі на цьому пристрої. Рейти визначають задане обертання, а модель дрона — його реакцію.',
    ),
  );
  const status = el('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  function currentSetup() {
    return editedSetup ?? library?.setups.find((item) => item.id === editedSetupId);
  }
  function physicalBaseline(setup) {
    if (setup.preset && listAircraftPresets().some((item) => item.id === setup.preset.id)) {
      const { aircraft, controller } = createPresetConfiguration(setup.preset.id);
      return { aircraft, controller };
    }
    // Saved numerical configurations remain usable after their catalog entry retires.
    return setup.advanced ?? null;
  }
  function report(failure) {
    status.textContent = `${t('Could not apply: ', 'Не вдалося застосувати: ')}${failure.message}`;
    const invalid = root.querySelector('[aria-invalid="true"]');
    if (invalid && workbench) {
      const panel = invalid.closest('[data-section]');
      if (panel) workbench.show(panel.dataset.section, false);
      workbench.reveal(invalid);
      invalid.focus();
    }
  }
  function clearImportPreview() {
    imported = null;
    importComparison = null;
    if (importReviewPanel) {
      releaseChildren(importReviewPanel);
      importReviewPanel.replaceChildren();
      importReviewPanel.hidden = true;
      importTechnical.hidden = true;
    }
    if (hashingImport !== null) {
      hashingImport = null;
      status.textContent = t(
        'Import changed. Preview again.',
        'Імпорт змінено. Перегляньте знову.',
      );
    }
  }
  const aircraftPanel = el('section');
  aircraftPanel.className = 'tuning-aircraft';
  el('h3', t('Built-in aircraft', 'Вбудовані дрони'), aircraftPanel);
  el(
    'p',
    t(
      'Choose an aircraft for practice in every environment. Each preset includes its battery, independent SIM controller, camera and editable starter rates. Your saved setups keep their changes.',
      'Виберіть дрон для практики в будь-якому середовищі. Кожен пресет містить батарею, незалежний контролер SIM, камеру й редаговані початкові рейти. Збережені налаштування зберігають ваші зміни.',
    ),
    aircraftPanel,
  );
  const aircraftSearch = field(t('Search aircraft', 'Пошук дрона'), 'search', aircraftPanel);
  const aircraftSelect = select(
    t('Aircraft preset', 'Пресет дрона'),
    listAircraftPresets().map((p) => [p.id, `${p.name} · ${p.variant}`]),
    aircraftPanel,
  );
  aircraftSelect.value = listAircraftPresets()[0].id;
  listen(aircraftSearch, 'input', () => {
    const query = aircraftSearch.value.toLocaleLowerCase();
    for (const option of aircraftSelect.options)
      option.hidden = !option.textContent.toLocaleLowerCase().includes(query);
  });
  el(
    'p',
    t(
      'Built-in references are read-only. Use in draft creates your own editable setup.',
      'Вбудовані еталони незмінні. «Використати в чернетці» створює ваші власні редаговані налаштування.',
    ),
    aircraftPanel,
  );
  const rateChoice = select(
    t('Rates when selecting an aircraft', 'Рейти під час вибору дрона'),
    [
      ['defaults', t('Use aircraft defaults', 'Використати типові рейти дрона')],
      ['keep', t('Keep my current rates', 'Залишити мої поточні рейти')],
    ],
    aircraftPanel,
  );
  rateChoice.value = 'defaults';
  const aircraftSummary = el('p', undefined, aircraftPanel);
  const aircraftNotice = el('p', undefined, aircraftPanel);
  aircraftNotice.dataset.aircraftNotice = 'true';
  const aircraftPreview = el('div', undefined, aircraftPanel);
  const aircraftEvidence = el('details', undefined, aircraftPanel);
  el(
    'summary',
    t('Specifications and model evidence', 'Характеристики й дані моделі'),
    aircraftEvidence,
  );
  const aircraftDetails = el('div', undefined, aircraftEvidence);
  function paintAircraft() {
    const preset = getAircraftPreset(aircraftSelect.value);
    const configuration = createPresetConfiguration(preset.id);
    aircraftSummary.textContent = `${preset.flyingMassGrams} ${t('g flying weight', 'г польотної маси')} · ${preset.propellerDiameterMm} ${t('mm propellers', 'мм пропелери')} · ${preset.wheelbaseMm} ${t('mm wheelbase', 'мм база')} · ${preset.battery.name}`;
    aircraftNotice.textContent = preset.notice ? t(preset.notice.en, preset.notice.uk) : '';
    aircraftNotice.hidden = !preset.notice;
    aircraftPreview.replaceChildren(
      createAircraftPreview({
        document: doc,
        aircraft: configuration.aircraft,
        name: preset.name,
        wheelbaseMm: preset.wheelbaseMm,
        locale: locale(),
      }),
    );
    releaseChildren(aircraftDetails);
    aircraftDetails.replaceChildren();
    el(
      'p',
      t(
        'Specification-based estimate. Not flight-validated.',
        'Оцінка за характеристиками. Не перевірено реальними польотами.',
      ),
      aircraftDetails,
    );
    el('p', `${preset.motor} · ${preset.propeller}`, aircraftDetails, false);
    const hardwareLabels = {
      frame: t('Frame', 'Рама'),
      flightController: t('Flight controller', 'Польотний контролер'),
      esc: t('Motor controllers', 'Регулятори двигунів'),
      receiver: t('Receiver', 'Приймач'),
      camera: t('Installed FPV camera', 'Установлена FPV-камера'),
      videoTransmitter: t('Video transmitter', 'Відеопередавач'),
      battery: t('Reference battery', 'Еталонна батарея'),
      revision: t('Component revision', 'Ревізія компонентів'),
    };
    for (const [field, value] of Object.entries(preset.hardware ?? {}))
      el('p', `${hardwareLabels[field] ?? field}: ${value}`, aircraftDetails, false);
    const performance = aircraftPerformance(configuration.aircraft);
    el(
      'p',
      `${t('Simulated fresh-pack performance', 'Розрахункові показники зі свіжою батареєю')}: ${t('hover throttle', 'газ зависання')} ${performance.hoverThrottle === null ? '—' : `${(performance.hoverThrottle * 100).toFixed(1)}%`} · ${t('thrust / weight', 'тяга / вага')} ${performance.thrustToWeight.toFixed(2)} · ${performance.fullThrottleVoltage.toFixed(1)} V ${t('under full load', 'під повним навантаженням')}`,
      aircraftDetails,
      false,
    );
    el(
      'p',
      `${t('Installed mass', 'Маса встановлених компонентів')}: ${preset.components.map((component) => `${component.massGrams} g`).join(' + ')} = ${preset.flyingMassGrams} g`,
      aircraftDetails,
      false,
    );
    el(
      'p',
      t(
        'Motors, props and installed equipment are already included in the assembled mass. The selected battery is added once.',
        'Двигуни, пропелери й установлене обладнання вже входять до маси зібраного дрона. Вибрана батарея додається один раз.',
      ),
      aircraftDetails,
    );
    el(
      'p',
      `${t('SIM starter rates', 'Початкові рейти SIM')}: Actual · 100°/s ${t('center', 'у центрі')} · ${preset.starterMaximumRate}°/s ${t('maximum', 'максимум')} · 25% expo`,
      aircraftDetails,
      false,
    );
    const kinds = {
      manufacturer: t('Manufacturer specification', 'Характеристика виробника'),
      'reviewer-reported': t(
        'Published reviewer measurement',
        'Вимірювання з опублікованого огляду',
      ),
      inferred: t('Inferred from sources', 'Припущення за джерелами'),
      calculated: t('Calculated', 'Розраховано'),
      estimated: t('Estimated', 'Оцінка'),
    };
    const fields = {
      assembledMass: t('Assembled mass', 'Маса зібраного дрона'),
      batteryMass: t('Battery mass', 'Маса батареї'),
      flyingMass: t('Flying mass', 'Польотна маса'),
      batteryCapacity: t('Battery capacity', 'Ємність батареї'),
      nominalVoltage: t('Nominal battery voltage', 'Номінальна напруга батареї'),
      fullVoltage: t('Fully charged battery voltage', 'Напруга повністю зарядженої батареї'),
      propeller: t('Propeller dimensions', 'Розміри пропелера'),
      inertia: t('Inertia', 'Інерція'),
      propulsion: t('Propulsion', 'Тяга й двигуни'),
      drag: t('Aerodynamic drag', 'Аеродинамічний опір'),
      batteryElectrical: t('Electrical response', 'Електрична характеристика'),
      controller: t('Controller behavior', 'Поведінка контролера'),
    };
    for (const [field, label] of Object.entries(fields)) {
      const evidence = preset.evidence[field];
      if (!evidence) continue;
      el('p', `${label}: ${kinds[evidence.kind]}`, aircraftDetails, false);
      // Important source limitations stay inert original-language text, beside
      // the specific evidence label rather than implying all values are measured.
      if (evidence.note && (preset.notice || field === 'propeller'))
        el(
          'p',
          `${t('Source note (original language)', 'Примітка джерела (мовою оригіналу)')}: ${evidence.note}`,
          aircraftDetails,
          false,
        );
    }
    if (preset.evidence.batteryMass.kind === 'estimated')
      el(
        'p',
        t(
          'Reference battery mass is estimated; the source specifies capacity without a particular pack.',
          'Маса еталонної батареї оцінена: джерело вказує ємність без конкретної моделі.',
        ),
        aircraftDetails,
      );
    for (const item of preset.sources) {
      const link = el('a', item.title, aircraftDetails, false);
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    el(
      'p',
      t(
        'The controller and aerodynamic coefficients are SIM estimates. Built-in presets start with battery depletion off; battery mass, power limits and voltage sag still affect flight.',
        'Контролер і аеродинамічні коефіцієнти є оцінками SIM. У вбудованих пресетах розряджання батареї спочатку вимкнено; її маса, обмеження потужності й просідання напруги впливають на політ.',
      ),
      aircraftDetails,
    );
  }
  listen(aircraftSelect, 'change', paintAircraft);
  function useAircraft({ reset = false } = {}) {
    if (rateChoice.value === 'keep') commitNumericInputs();
    remember();
    const source = currentSetup();
    if (reset && !source.preset)
      throw new Error(
        t(
          'This setup has no built-in preset to restore.',
          'Ці налаштування не мають вбудованого пресету для відновлення.',
        ),
      );
    const preset = getAircraftPreset(reset ? source.preset.id : aircraftSelect.value);
    const config = createPresetConfiguration(preset.id);
    const next = {
      id: reset ? source.id : id(),
      name: reset ? source.name : preset.name,
      profileId: selected,
      camera: config.camera,
      advanced: { aircraft: config.aircraft, controller: config.controller },
      preset: config.preset,
      components: config.components,
    };
    if (rateChoice.value !== 'keep') {
      draft = clone(config.response);
      draftProvenance = null;
      profileName.value = `${preset.name} · ${t('SIM starter rates', 'Початкові рейти SIM')}`;
      algorithmDrafts = {};
      numericDrafts = {};
    }
    editedSetup = next;
    editedSetupId = next.id;
    setupDrafts.delete(next.id);
    remember();
    // The new setup remains detached until Save; populate its defaults now.
    setupDrafts.set(next.id, {
      name: next.name,
      profileId: selected,
      cameraText: next.camera,
      advanced: clone(next.advanced),
      components: clone(next.components),
      baseRevision: editRevision,
    });
    load(selected);
    status.textContent = t(
      'Aircraft added to draft. Test or save when ready.',
      'Дрон додано до чернетки. Перевірте або збережіть, коли готові.',
    );
  }
  action(t('Use in draft', 'Використати в чернетці'), () => useAircraft(), aircraftPanel);
  action(
    t('Reset draft to aircraft defaults', 'Скинути чернетку до типових значень дрона'),
    () => useAircraft({ reset: true }),
    aircraftPanel,
  );
  paintAircraft();
  const toolbar = el('div');
  toolbar.className = 'tuning-toolbar';
  const setupSelect = select(t('Drone setup', 'Налаштування дрона'), [], toolbar);
  const profileSelect = select(t('Rate profile', 'Профіль рейтів'), [], toolbar);
  const profileName = field(t('Profile name', 'Назва профілю'), 'text', toolbar);
  profileName.maxLength = 120;
  const libraryPreviews = el('div');
  libraryPreviews.className = 'tuning-fields';
  const profilePreview = el('section', undefined, libraryPreviews);
  translatedAttribute(
    profilePreview,
    'aria-label',
    t('Rate profile preview', 'Перегляд профілю рейтів'),
  );
  el('h3', t('Rate profile preview', 'Перегляд профілю рейтів'), profilePreview);
  const profilePreviewSummary = el('p', undefined, profilePreview);
  const profilePreviewSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  profilePreviewSvg.setAttribute('role', 'img');
  translatedAttribute(
    profilePreviewSvg,
    'aria-label',
    t('Selected profile rate curves', 'Криві рейтів вибраного профілю'),
  );
  profilePreview.append(profilePreviewSvg);
  const profilePreviewReadouts = el('pre', undefined, profilePreview);
  const setupPreview = el('section', undefined, libraryPreviews);
  translatedAttribute(
    setupPreview,
    'aria-label',
    t('Saved setup preview', 'Перегляд збережених налаштувань'),
  );
  el('h3', t('Saved setup preview', 'Перегляд збережених налаштувань'), setupPreview);
  const setupPreviewSummary = el('p', undefined, setupPreview);
  const setupPreviewReadouts = el('pre', undefined, setupPreview);
  el(
    'p',
    t(
      'Browsing does not change your draft. Choose Use in draft to apply your selection.',
      'Перегляд не змінює чернетку. Виберіть «Використати в чернетці», щоб застосувати вибране.',
    ),
    libraryPreviews,
  );
  const affected = el('p');
  const management = el('div');
  management.className = 'tuning-actions';
  action(
    t('New Actual profile', 'Новий профіль Actual'),
    async () => {
      remember();
      const nextId = id();
      await mutate(() =>
        store.createProfile(
          { id: nextId, name: t('New profile', 'Новий профіль') },
          library.revision,
        ),
      );
      load(nextId);
    },
    management,
  );
  action(
    t('Duplicate', 'Дублювати'),
    async () => {
      commitNumericInputs();
      remember();
      const nextId = id();
      await mutate(() =>
        store.createProfile(
          {
            id: nextId,
            name: `${profileName.value} ${t('copy', 'копія')}`,
            response: draft,
            ...(currentReceipt() ? { provenance: currentReceipt() } : {}),
          },
          library.revision,
        ),
      );
      load(nextId);
    },
    management,
  );
  action(
    t('Make player default', 'Зробити типовим для гравця'),
    async () => {
      await mutate(() => store.setDefault(selected, library.revision));
      paintAssignment();
    },
    management,
  );
  const replacement = select(
    t('Replacement when deleting', 'Заміна під час видалення'),
    [],
    management,
  );
  action(
    t('Delete & reassign', 'Видалити й перепризначити'),
    async () => {
      remember();
      const old = selected,
        next = replacement.value;
      await mutate(() => store.removeProfile(old, next, library.revision));
      drafts.delete(old);
      for (const pending of setupDrafts.values())
        if (pending.profileId === old) pending.profileId = next;
      load(next);
    },
    management,
  );
  const history = select(t('Saved revisions', 'Збережені версії'), [], management);
  action(
    t('Restore revision to draft', 'Відновити версію як чернетку'),
    () => {
      const previous = library.profiles
        .find((p) => p.id === selected)
        .history.find((p) => p.revision === Number(history.value));
      if (!previous) throw new Error(t('Choose a saved revision', 'Виберіть збережену версію'));
      // Restoring history replaces import intent even when its rates equal the
      // current draft. An earlier digest or receipt must not supersede it.
      clearImportPreview();
      draft = clone(previous.response);
      draftProvenance = clone(previous.provenance ?? null);
      profileName.value = previous.name;
      algorithmDrafts = {};
      numericDrafts = {};
      paintFields();
    },
    management,
  );

  const receiptDetails = el('details', undefined, management);
  el('summary', t('Import receipt', 'Квитанція імпорту'), receiptDetails);
  const receiptView = el('pre', undefined, receiptDetails);
  function currentReceipt() {
    return draft?.rates && draftProvenance?.rateIdentity === rateProfileIdentity(draft.rates)
      ? draftProvenance
      : null;
  }
  function paintReceipt() {
    receiptView.textContent = currentReceipt()
      ? JSON.stringify(currentReceipt(), null, 2)
      : t(
          'No import receipt for these draft rates. Earlier receipts remain in saved revisions. Receipts describe rate/throttle transfer only.',
          'Для цих рейтів чернетки немає квитанції імпорту. Попередні квитанції збережені у версіях. Квитанції описують лише перенесення рейтів і газу.',
        );
  }

  const editor = el('section');
  const algorithm = select(
    t('Rate algorithm', 'Алгоритм рейтів'),
    [
      ['legacy', t('Legacy feel', 'Класична реакція')],
      ...RATE_ALGORITHMS.map((value) => [value, title(value)]),
    ],
    editor,
  );
  const link = field(
    t('Link roll and pitch edits', 'Пов’язати зміни крену й тангажу'),
    'checkbox',
    editor,
  );
  el(
    'p',
    t(
      'Center sensitivity changes small-stick response. Maximum rate changes full-stick rotation. More expo softens the centre while retaining the endpoint. These controls request rotation; PID and the aircraft determine the achieved response.',
      'Чутливість центру змінює реакцію на малий хід стіка. Максимальний рейт визначає обертання за повного ходу. Більше expo пом’якшує центр, зберігаючи крайнє значення. Ці налаштування задають обертання; PID і дрон визначають фактичну реакцію.',
    ),
    editor,
  );
  const values = el('div', undefined, editor);
  values.className = 'tuning-fields';
  const preview = el('section');
  el('h3', t('Saved and draft comparison', 'Порівняння збереженого й чернетки'), preview);
  el(
    'p',
    t(
      'Solid: draft · dashed: saved. Degrees per second versus stick travel. Self-level roll/pitch use angle assistance.',
      'Суцільна: чернетка · пунктир: збережене. Градуси за секунду від положення стіка. У самовирівнюванні крен і тангаж мають допомогу за кутом.',
    ),
    preview,
  );
  const axisLegend = el('div', undefined, preview);
  axisLegend.className = 'workbench-axis-legend';
  const visibility = Object.fromEntries(
    axes.map((axis) => {
      const box = field(axisName(axis), 'checkbox', axisLegend);
      box.parentNode.style.borderLeft = `3px solid ${colors[axes.indexOf(axis)]}`;
      box.checked = true;
      listen(box, 'change', paintPreview);
      return [axis, box];
    }),
  );
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 600 210');
  svg.setAttribute('role', 'img');
  translatedAttribute(
    svg,
    'aria-label',
    t('Rate curves: zero to full stick', 'Криві рейтів від нуля до повного стіка'),
  );
  preview.append(svg);
  const inspected = el('p', '', preview);
  translatedAttribute(inspected, 'aria-label', t('Inspected rate', 'Рейт у вибраній точці'));
  svg.style.cursor = 'crosshair';
  svg.style.touchAction = 'pan-y';
  el(
    'p',
    t(
      'Point or drag across the curve to compare saved and draft rates. Use the exact stick position below for keyboard adjustment.',
      'Наведіть вказівник або проведіть по кривій, щоб порівняти збережені рейти й чернетку. Для клавіатури використовуйте точне положення стіка нижче.',
    ),
    preview,
  );
  const readouts = el('pre', undefined, preview);
  const demonstration = el('div', undefined, preview);
  demonstration.className = 'tuning-demonstration';
  const quad = el('div', '', demonstration);
  quad.className = 'tuning-quad';
  quad.setAttribute('aria-hidden', 'true');
  const previewAxis = select(
    t('Rotation preview axis', 'Вісь попереднього перегляду'),
    axes.map((axis) => [axis, axisName(axis)]),
    preview,
  );
  const previewStick = field(
    t('Preview stick position (%)', 'Положення стіка для перегляду (%)'),
    'range',
    preview,
  );
  Object.assign(previewStick, { min: '-100', max: '100', step: '1', value: '25' });
  const capturePreview = field(
    t('Capture live sticks for preview', 'Перехопити стіки для перегляду'),
    'checkbox',
    preview,
  );
  const captureStatus = el('p', '', preview, false);
  function paintCaptureStatus() {
    captureStatus.textContent = capturePreview.checked
      ? t(
          'Preview owns sticks; menu navigation is paused. Press and release controller B to return.',
          'Стіки керують переглядом; навігацію меню призупинено. Натисніть і відпустіть B контролера для повернення.',
        )
      : t(
          'Sticks navigate menus. Enable capture to drive the rotation preview.',
          'Стіки керують меню. Увімкніть перехоплення для перегляду обертання.',
        );
  }
  listen(capturePreview, 'change', paintCaptureStatus);
  paintCaptureStatus();
  const previewExact = field(
    t('Preview stick position · exact (%)', 'Положення стіка · точно (%)'),
    'number',
    preview,
  );
  Object.assign(previewExact, { min: '-100', max: '100', step: '1', value: '25' });
  listen(previewExact, 'input', () => {
    if (
      previewExact.value.trim() &&
      Number.isFinite(Number(previewExact.value)) &&
      Math.abs(Number(previewExact.value)) <= 100
    ) {
      previewStick.value = previewExact.value;
      paintInspected();
    }
  });
  listen(previewStick, 'input', () => {
    previewExact.value = previewStick.value;
  });
  let curvePointer = null;
  function releaseCurvePointer() {
    const pointer = curvePointer;
    curvePointer = null;
    if (pointer !== null && svg.hasPointerCapture?.(pointer)) svg.releasePointerCapture(pointer);
  }
  function canInspectCurve() {
    return (
      !busy &&
      root.open &&
      !doc.hidden &&
      workbench?.current() === 'rates' &&
      previewDisclosure.open
    );
  }
  function inspectCurve(event) {
    const position = workbenchCurvePosition(svg, event.clientX);
    if (position === null) return;
    previewStick.value = previewExact.value = String(Math.round(position * 100));
    paintInspected();
  }
  listen(svg, 'pointerdown', (event) => {
    if (
      !canInspectCurve() ||
      curvePointer !== null ||
      event.isPrimary === false ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    curvePointer = event.pointerId;
    svg.setPointerCapture?.(curvePointer);
    inspectCurve(event);
  });
  listen(svg, 'pointermove', (event) => {
    if (!canInspectCurve() || event.isPrimary === false) return;
    if (
      curvePointer !== null
        ? event.pointerId !== curvePointer
        : event.pointerType === 'touch' || event.buttons !== 0
    )
      return;
    event.stopPropagation();
    inspectCurve(event);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture'])
    listen(svg, eventName, (event) => {
      if (event.pointerId !== curvePointer) return;
      event.stopPropagation();
      releaseCurvePointer();
    });
  listen(svg, 'click', (event) => event.stopPropagation());
  const motion = field(t('Animate rotation preview', 'Анімувати обертання'), 'checkbox', preview);
  const diagnostics = el('pre', undefined, preview);
  translatedAttribute(diagnostics, 'aria-label', t('Input diagnostics', 'Діагностика введення'));

  const setupPanel = el('section');
  el('h3', t('Drone setup and camera', 'Налаштування дрона й камери'), setupPanel);
  const setupName = field(t('Drone name', 'Назва дрона'), 'text', setupPanel);
  setupName.maxLength = 120;
  const assignment = select(t('Rates used by this drone', 'Рейти для цього дрона'), [], setupPanel);
  const componentPanel = el('fieldset', undefined, setupPanel);
  el('legend', t('Battery & physical camera', 'Акумулятор і фізична камера'), componentPanel);
  const batteryChoice = select(
    t('Battery', 'Акумулятор'),
    [
      ['reference', t('Reference battery', 'Еталонний акумулятор')],
      [
        'custom',
        t(
          'Custom battery · same cells and chemistry',
          'Власний акумулятор · ті самі елементи й хімія',
        ),
      ],
    ],
    componentPanel,
  );
  const batteryCapacity = field(
    t('Battery capacity (mAh)', 'Ємність акумулятора (мА·год)'),
    'number',
    componentPanel,
  );
  const batteryMass = field(
    t('Battery mass (g)', 'Маса акумулятора (г)'),
    'number',
    componentPanel,
  );
  const payloadChoice = select(
    t('Physical camera payload', 'Фізичне навантаження камери'),
    [
      ['none', t('No additional camera', 'Без додаткової камери')],
      ['custom', t('Additional central camera payload', 'Додаткова камера по центру')],
    ],
    componentPanel,
  );
  const payloadMass = field(
    t('Additional camera mass (g)', 'Маса додаткової камери (г)'),
    'number',
    componentPanel,
  );
  const componentSummary = el('p', undefined, componentPanel);
  let capacityOwnershipNote = null,
    capacityOwnershipAction = null;
  el(
    'p',
    t(
      'Any video system supplied with the reference aircraft is already counted; this adds a separate payload. Custom components use estimated positions and dimensions inside the central body. Check real pack fit separately. Capacity affects endurance only when battery depletion is enabled; mass always affects handling. Existing motor, electrical, drag and controller adjustments are retained.',
      'Відеосистема еталонної комплектації, якщо вона є, уже врахована; тут додається окреме навантаження. Для власних компонентів використано оцінені положення й розміри всередині корпусу. Фактичну сумісність акумулятора перевіряйте окремо. Ємність впливає на тривалість лише з увімкненим розряджанням; маса завжди впливає на керованість. Наявні налаштування моторів, електрики, опору та контролера зберігаються.',
    ),
    componentPanel,
  );
  for (const input of [batteryCapacity, batteryMass, payloadMass]) input.step = 'any';
  function componentText() {
    return {
      batteryChoice: batteryChoice.value,
      capacity: batteryCapacity.value,
      mass: batteryMass.value,
      payloadChoice: payloadChoice.value,
      payloadMass: payloadMass.value,
    };
  }
  function readComponents(commit = true) {
    if (!componentInventory) return null;
    const reference = componentInventory.reference;
    const battery =
      batteryChoice.value === 'reference'
        ? { massGrams: reference.batteryMassGrams, capacityMah: reference.capacityMah }
        : {
            massGrams: cameraValue(batteryMass, commit),
            capacityMah: cameraValue(batteryCapacity, commit),
          };
    const cameraPayload = {
      massGrams: payloadChoice.value === 'none' ? 0 : cameraValue(payloadMass, commit),
    };
    if (Object.values(battery).includes(null) || cameraPayload.massGrams === null) return null;
    const setup = currentSetup();
    return applyAircraftComponents(
      physics?.read(commit)?.aircraft ?? setup.advanced.aircraft,
      componentInventory,
      {
        battery,
        cameraPayload,
      },
    );
  }
  function paintComponents() {
    componentPanel.hidden = !componentInventory;
    const capacityControl = physics?.fields.find(
      ({ path }) => path === 'aircraft.battery.capacityAh',
    );
    if (capacityControl) {
      // Component capacity has one editing owner. The Expert field mirrors it
      // explicitly instead of accepting a value that readComponents replaces.
      capacityControl.input.readOnly = Boolean(componentInventory);
      if (componentInventory) {
        if (!capacityOwnershipNote) {
          capacityOwnershipNote = el(
            'p',
            t(
              'Read-only mirror of battery capacity. Edit the installed battery in Aircraft; both views use the same value.',
              'Значення є лише відображенням ємності батареї. Редагуйте встановлену батарею в розділі «Дрон»; обидва подання використовують те саме значення.',
            ),
            capacityControl.row,
          );
          capacityOwnershipNote.id = `workbench-capacity-${id()}`;
          capacityControl.input.setAttribute('aria-describedby', capacityOwnershipNote.id);
          capacityOwnershipAction = action(
            t('Edit installed battery', 'Редагувати встановлену батарею'),
            () => {
              workbench.show('aircraft', false);
              batteryChoice.focus();
              batteryChoice.scrollIntoView?.({ block: 'center' });
            },
            capacityControl.row,
          );
        }
        const text =
          batteryChoice.value === 'reference'
            ? String(componentInventory.reference.capacityMah)
            : batteryCapacity.value;
        if (text.trim() && Number.isFinite(Number(text)))
          capacityControl.input.value = String(Number(text) / 1000);
        capacityControl.input.removeAttribute('aria-invalid');
      }
      if (capacityOwnershipNote) {
        capacityOwnershipNote.hidden = !componentInventory;
        capacityOwnershipAction.hidden = !componentInventory;
      }
    }
    if (!componentInventory) return;
    batteryCapacity.disabled = batteryMass.disabled = batteryChoice.value === 'reference';
    payloadMass.disabled = payloadChoice.value === 'none';
    try {
      const result = readComponents(false);
      const performance = result && aircraftPerformance(result.aircraft);
      const hover =
        performance?.hoverThrottle === null
          ? t('Insufficient thrust', 'Недостатньо тяги')
          : `${((performance?.hoverThrottle ?? 0) * 100).toFixed(1)}%`;
      componentSummary.textContent = result
        ? `${t('Estimated installed mass', 'Оцінена встановлена маса')}: ${(result.aircraft.mass * 1000).toFixed(2)} g · ${t('COM height', 'Висота центра мас')}: ${(result.aircraft.geometry.centerOfMass.y * 1000).toFixed(2)} mm · ${t('Added camera', 'Додаткова камера')}: ${result.components.cameraPayload.massGrams} g · ${t('Hover', 'Зависання')}: ${hover} · ${t('Thrust/weight', 'Тяга/вага')}: ${performance.thrustToWeight.toFixed(2)}`
        : t(
            'Complete valid component values to preview the aircraft.',
            'Введіть коректні значення компонентів для попереднього перегляду.',
          );
    } catch (error) {
      componentSummary.textContent = error.message;
    }
  }
  for (const input of [batteryChoice, batteryCapacity, batteryMass, payloadChoice, payloadMass])
    for (const event of ['input', 'change']) listen(input, event, paintComponents);
  const batteryPracticePanel = el('fieldset', undefined, setupPanel);
  el(
    'legend',
    t('Optional battery endurance', 'Необов’язкова автономність батареї'),
    batteryPracticePanel,
  );
  const batteryDepletion = field(
    t('Battery depletion (optional)', 'Розряджання батареї (необов’язково)'),
    'checkbox',
    batteryPracticePanel,
  );
  el(
    'p',
    t(
      'Enabled: using charge gradually reduces available motor power. Disabled: charge stays full while battery mass, power limits and voltage sag still affect handling. Ordinary practice has no time limit.',
      'Увімкнено: витрата заряду поступово зменшує доступну потужність моторів. Вимкнено: заряд залишається повним, а маса батареї, обмеження потужності й просідання напруги впливають на керованість. Звичайна практика не має обмеження часу.',
    ),
    batteryPracticePanel,
  );
  el(
    'p',
    t(
      'Save for next flight keeps the current flight unchanged. A fresh-battery restart saves this draft and starts a new flight from the launch point with full charge. Pause, resume and checkpoint recovery preserve the flight’s remaining charge and original conditions. Use the same course, mode and setup for repeatable tests.',
      'Збереження для наступного польоту не змінює поточний. Перезапуск зі свіжою батареєю зберігає чернетку й починає новий політ із точки старту з повним зарядом. Пауза, продовження й відновлення з контрольної точки зберігають залишок заряду та початкові умови польоту. Для повторюваних тестів використовуйте ті самі трасу, режим і налаштування.',
    ),
    batteryPracticePanel,
  );
  action(
    t('Fresh battery & restart flight', 'Свіжа батарея й перезапуск польоту'),
    () => {
      if (currentSetup()?.advanced?.aircraft.format === 'AdvancedAircraft.v2')
        return applyAndRestart();
    },
    batteryPracticePanel,
  );
  const tilt = field(t('Camera tilt (degrees)', 'Нахил камери (градуси)'), 'number', setupPanel);
  Object.assign(tilt, { min: '0', max: '60', step: 'any' });
  const fov = field(
    t('Vertical FOV (degrees)', 'Вертикальне поле зору (градуси)'),
    'number',
    setupPanel,
  );
  Object.assign(fov, { min: '40', max: '140', step: 'any' });
  function cameraValue(node, commit = true) {
    const value = node.value.trim() ? Number(node.value) : Number.NaN,
      min = Number(node.min),
      max = Number(node.max);
    if (!Number.isFinite(value) || value < min || value > max) {
      const label = node.getAttribute('aria-label'),
        message = t(
          `${label}: enter a value from ${min} to ${max}.`,
          `${label}: введіть значення від ${min} до ${max}.`,
        );
      node.setAttribute('aria-invalid', 'true');
      node.setCustomValidity?.(message);
      if (commit) {
        const failure = new Error(message);
        report(failure);
        numericFailure = status.textContent;
        throw failure;
      }
      return null;
    }
    node.removeAttribute('aria-invalid');
    node.setCustomValidity?.('');
    // Camera values are continuous degrees, including migrated fractions.
    // Preserve text while typing; canonicalize only a committed valid value.
    if (commit) node.value = String(value);
    if (numericFailure && status.textContent === numericFailure) status.textContent = '';
    numericFailure = null;
    return value;
  }
  for (const node of [tilt, fov]) {
    listen(node, 'input', () => cameraValue(node, false));
    listen(node, 'change', () => {
      try {
        cameraValue(node);
      } catch {
        // cameraValue reports the error while retaining the editable text.
      }
    });
  }
  el(
    'p',
    t(
      'Camera tilt and vertical FOV change the view, not aircraft mass. They belong to the drone and are excluded from portable rate exports. Skins do not select a drone setup.',
      'Нахил камери й вертикальне поле зору змінюють огляд, а не масу дрона. Вони зберігаються для дрона й не входять до експорту рейтів. Вигляд дрона не змінює його налаштувань.',
    ),
    setupPanel,
  );
  action(
    t('Duplicate drone setup', 'Дублювати налаштування дрона'),
    () => {
      const setup = readSetup();
      remember();
      setup.id = id();
      setup.name += ` ${t('copy', 'копія')}`;
      editedSetup = setup;
      editedSetupId = setup.id;
      setupDrafts.set(setup.id, {
        name: setup.name,
        profileId: setup.profileId,
        cameraText: setup.camera,
        advanced: clone(setup.advanced),
        components: clone(setup.components),
        baseRevision: editRevision,
      });
      load(selected);
    },
    setupPanel,
  );

  const transfer = el('details');
  el(
    'summary',
    t('Import / export · Betaflight and backups', 'Імпорт / експорт · Betaflight і резервні копії'),
    transfer,
  );
  el(
    'p',
    t(
      'Rate/throttle compatibility only. PID, filters, motor and hardware settings are shown as unapplied.',
      'Сумісність лише рейтів і газу. PID, фільтри, двигуни й обладнання залишаються незастосованими.',
    ),
    transfer,
  );
  const transferSteps = el(
    'p',
    t(
      '1 File or paste → 2 Format & baseline → 3 Review changes → 4 Save new profile',
      '1 Файл або текст → 2 Формат і основа → 3 Перегляд змін → 4 Збереження профілю',
    ),
    transfer,
  );
  transferSteps.className = 'workbench-flow';
  const importKind = select(
    t('Operation', 'Операція'),
    [
      ['patch', t('Snippet / preset patch', 'Фрагмент / патч пресету')],
      ['complete', t('Complete configuration', 'Повна конфігурація')],
      ['diff', t('Sparse diff against firmware defaults', 'Різниця від типових значень прошивки')],
    ],
    transfer,
  );
  const versions = ['4.5.2', '4.5.5', '2025.12.4', '2025.12.5', '2026.6.2'];
  const version = select(
    t('Source / export firmware version', 'Версія прошивки для імпорту / експорту'),
    [
      ['', t('Read header / choose version', 'Заголовок / виберіть версію')],
      ...versions.map((v) => [v, v]),
    ],
    transfer,
  );
  const importBaseline = select(
    t('Patch baseline', 'Основа патчу'),
    [
      ['draft', t('Current draft', 'Поточна чернетка')],
      ['defaults', t('Verified firmware defaults', 'Перевірені типові значення')],
    ],
    transfer,
  );
  const sourceProfile = field(
    t(
      'Source rate profile (blank = selected in file)',
      'Профіль рейтів джерела (порожнє = вибраний у файлі)',
    ),
    'number',
    transfer,
  );
  Object.assign(sourceProfile, { min: '0', max: '3', step: '1', value: '' });
  const textLabel = el(
    'label',
    t('Paste CLI or a SIM rate profile', 'Вставте CLI або профіль рейтів SIM'),
    transfer,
  );
  const text = el('textarea', undefined, textLabel);
  text.rows = 8;
  text.maxLength = TUNING_LIBRARY_BYTES;
  translatedAttribute(
    text,
    'aria-label',
    t('Paste CLI or a SIM rate profile', 'Вставте CLI або профіль рейтів SIM'),
  );
  const file = field(t('Upload text / JSON', 'Завантажити текст / JSON'), 'file', transfer);
  file.accept = '.txt,.json,.cli';
  let uploadGeneration = 0,
    uploadedSource = null,
    resolvedPreset = null,
    presetNeedsResolution = false;
  const readImportText = async (picked) =>
    picked.arrayBuffer
      ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
          await picked.arrayBuffer(),
        )
      : picked.text();
  listen(file, 'change', async () => {
    const generation = ++uploadGeneration;
    clearImportPreview();
    uploadedSource = null;
    resolvedPreset = null;
    presetNeedsResolution = false;
    importReview.textContent = '';
    text.value = '';
    try {
      const picked = file.files?.[0];
      if (!picked) return;
      if (picked.size > TUNING_LIBRARY_BYTES) throw new Error('File exceeds 512 KiB');
      const contents = await readImportText(picked);
      if (disposed || generation !== uploadGeneration) return;
      text.value = contents;
      uploadedSource = contents;
    } catch (error) {
      if (!disposed && generation === uploadGeneration) report(error);
    }
  });
  importReviewPanel = el('section', undefined, transfer);
  importReviewPanel.className = 'workbench-import-review';
  importReviewPanel.hidden = true;
  importTechnical = el('details', undefined, transfer);
  importTechnical.hidden = true;
  el('summary', t('Technical import report', 'Технічний звіт імпорту'), importTechnical);
  const importReview = el('pre', undefined, importTechnical);
  function importFields(profile, prefix = '', result = {}) {
    for (const [key, value] of Object.entries(profile ?? {})) {
      if (key === 'format') continue;
      const name = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object') importFields(value, name, result);
      else result[name] = value;
    }
    return result;
  }
  function paintImportReview() {
    if (!importComparison) return;
    releaseChildren(importReviewPanel);
    importReviewPanel.replaceChildren();
    importReviewPanel.hidden = importTechnical.hidden = false;
    const { result, before, after, firmwareBaseline } = importComparison;
    const native = result.provenance.source.kind === 'native';
    const baselineLabel = firmwareBaseline
      ? t('Verified firmware defaults', 'Перевірені типові значення прошивки')
      : t('Before import draft', 'Чернетка до імпорту');
    const afterLabel = t('Imported result', 'Результат імпорту');
    el('h4', t('Review import changes', 'Перегляд змін імпорту'), importReviewPanel);
    const operation = native
      ? t('SIM rate profile', 'Профіль рейтів SIM')
      : result.kind === 'patch'
        ? t('Snippet / preset patch', 'Фрагмент / патч пресету')
        : result.kind === 'diff'
          ? t('Sparse diff', 'Різниця від типових значень')
          : t('Complete configuration', 'Повна конфігурація');
    el(
      'p',
      `${operation} · ${t('Baseline', 'Основа')}: ${baselineLabel}${firmwareBaseline ? ` · ${result.sourceVersion}` : ''}`,
      importReviewPanel,
    );
    if (!native) {
      const origin =
        result.sourceVersionOrigin === 'header'
          ? t('file header', 'заголовок файлу')
          : result.sourceVersionOrigin === 'manual'
            ? t('selected manually', 'вибрано вручну')
            : t('not specified', 'не вказано');
      el(
        'p',
        `${t('Source firmware', 'Прошивка джерела')}: ${result.sourceVersion ?? '—'} (${origin}) · ${t('Source rate profile', 'Профіль рейтів джерела')}: ${result.selectedProfile}${result.name ? ` · ${result.name}` : ''}`,
        importReviewPanel,
      );
    }
    el(
      'p',
      t(
        'Only rates and throttle are previewed. Aircraft, camera and controller gains stay unchanged. Saving creates a separate profile; assignment remains explicit.',
        'Переглядаються лише рейти й газ. Дрон, камера та коефіцієнти контролера не змінюються. Збереження створює окремий профіль; призначення виконується явно.',
      ),
      importReviewPanel,
    );
    const oldFields = importFields(before.rates);
    const nextFields = importFields(after.rates);
    const changed =
      result.changedFields ??
      Object.entries(nextFields)
        .filter(([key, value]) => oldFields[key] !== value)
        .map(([field, value]) => ({ field, before: oldFields[field], after: value }));
    const tableWrap = el('div', undefined, importReviewPanel);
    tableWrap.className = 'controller-tune-preview';
    const table = el('table', undefined, tableWrap);
    el(
      'caption',
      t('Changed settings · native profile units', 'Змінені параметри · власні одиниці профілю'),
      table,
    );
    const head = el('tr', undefined, el('thead', undefined, table));
    for (const text of [t('Setting', 'Параметр'), t('Before', 'До'), t('After', 'Після')])
      el('th', text, head).setAttribute('scope', 'col');
    const body = el('tbody', undefined, table);
    for (const item of changed) {
      const row = el('tr', undefined, body);
      el('th', item.field, row, false).setAttribute('scope', 'row');
      el('td', String(item.before ?? '—'), row, false);
      el('td', String(item.after ?? '—'), row, false);
    }
    if (!changed.length)
      el(
        'p',
        t('No rate or throttle values change.', 'Значення рейтів і газу не змінюються.'),
        importReviewPanel,
      );
    const selected = (items) =>
      (items ?? []).filter((item) => item.profile === result.selectedProfile);
    const list = (label, items, describe = (item) => String(item)) => {
      const details = el('details', undefined, importReviewPanel);
      el('summary', `${label} (${items.length})`, details);
      const rows = el('ul', undefined, details);
      for (const item of items.slice(0, 32)) el('li', describe(item).slice(0, 512), rows, false);
      if (items.length > 32)
        el(
          'p',
          t('More entries are in the technical report.', 'Решта записів — у технічному звіті.'),
          details,
        );
    };
    list(
      t('Supported imported settings', 'Підтримувані імпортовані параметри'),
      native
        ? Object.keys(nextFields)
        : result.profiles.find((item) => item.index === result.selectedProfile).assignedFields,
    );
    list(
      t('Inferred firmware defaults', 'Виведені типові значення прошивки'),
      selected(result.inferredDefaults),
      (item) => `${item.field}: ${item.value}`,
    );
    list(
      t('Firmware normalization', 'Нормалізація прошивки'),
      selected(result.normalizations),
      (item) => `${item.field}: ${item.before} → ${item.after}`,
    );
    list(
      t('Ignored · not applied', 'Пропущено · не застосовано'),
      result.unapplied ?? [],
      (item) =>
        `${t('Line', 'Рядок')} ${item.line}: ${item.command ?? `${item.key} = ${item.value}`} · PID ${item.pidProfile} / ${t('rates', 'рейти')} ${item.rateProfile}`,
    );
    list(t('Source warnings', 'Попередження джерела'), result.warnings ?? []);
    const beforeEvaluator = compile(before),
      afterEvaluator = compile(after);
    const graph = (label) => {
      const node = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      node.setAttribute('role', 'img');
      node.setAttribute('aria-label', label);
      importReviewPanel.append(node);
      return node;
    };
    el(
      'p',
      `${baselineLabel}: ${t('dashed lines', 'штрихові лінії')} · ${afterLabel}: ${t('solid lines', 'суцільні лінії')}.`,
      importReviewPanel,
    );
    drawWorkbenchCurve(
      doc,
      graph(t('Import rates: baseline and result', 'Рейти імпорту: основа й результат')),
      {
        maximum: Math.max(
          1,
          ...axes.flatMap((axis) => [beforeEvaluator.rate(axis, 1), afterEvaluator.rate(axis, 1)]),
        ),
        xLabel: t('Stick travel (%)', 'Хід стіка (%)'),
        series: axes.flatMap((axis, index) => [
          {
            evaluate: (x) => beforeEvaluator.rate(axis, x),
            color: colors[index],
            dashed: true,
            label: `${axisName(axis)} · ${baselineLabel}`,
          },
          {
            evaluate: (x) => afterEvaluator.rate(axis, x),
            color: colors[index],
            label: `${axisName(axis)} · ${afterLabel}`,
          },
        ]),
      },
    );
    drawWorkbenchCurve(
      doc,
      graph(t('Import throttle: baseline and result', 'Газ імпорту: основа й результат')),
      {
        maximum: 100,
        yLabel: t('Output (%)', 'Вихід (%)'),
        xLabel: t('Stick travel (%)', 'Хід стіка (%)'),
        series: [
          {
            evaluate: (x) => beforeEvaluator.throttle(x) * 100,
            color: '#f1ca72',
            dashed: true,
            label: baselineLabel,
          },
          {
            evaluate: (x) => afterEvaluator.throttle(x) * 100,
            color: '#55c8a4',
            label: afterLabel,
          },
        ],
      },
    );
    for (const axis of axes)
      el(
        'p',
        `${axisName(axis)} · 50%: ${beforeEvaluator.rate(axis, 0.5).toFixed(1)} → ${afterEvaluator.rate(axis, 0.5).toFixed(1)} °/s · 100%: ${beforeEvaluator.rate(axis, 1).toFixed(1)} → ${afterEvaluator.rate(axis, 1).toFixed(1)} °/s`,
        importReviewPanel,
      );
  }
  function parseImport(source = uploadedSource ?? text.value) {
    if (presetNeedsResolution)
      throw new Error(
        t(
          'Preset choices changed. Resolve the preset again before previewing.',
          'Вибір пресету змінено. Повторно розгорніть пресет перед переглядом.',
        ),
      );
    const baseline = draft.format === TUNED_RESPONSE_FORMAT ? draft.rates : null;
    if (source.trim().startsWith('{')) return previewNativeRateImport(source);
    return previewBetaflightImport(source, {
      kind: importKind.value,
      sourceVersion: version.value || undefined,
      baseline:
        importKind.value === 'patch'
          ? importBaseline.value === 'draft'
            ? baseline
            : 'firmware-defaults'
          : undefined,
      ...(sourceProfile.value !== '' ? { selectedProfile: Number(sourceProfile.value) } : {}),
      baselineKind:
        importKind.value === 'patch' && importBaseline.value === 'draft'
          ? 'draft'
          : 'firmware-defaults',
      ...(importKind.value === 'patch' && importBaseline.value === 'draft'
        ? {
            baselineIdentity: {
              profileId: selected,
              revision: library.profiles.find((p) => p.id === selected).revision,
            },
          }
        : {}),
      ...(resolvedPreset && resolvedPreset.text === source
        ? { presetBundle: resolvedPreset.bundle }
        : {}),
    });
  }
  function showImport(result, beforeImport) {
    // Import is one undoable draft edit, including prior unsaved/raw values.
    updateWorkbench();
    imported = result;
    importReview.textContent = JSON.stringify(result, null, 2);
    const firmwareBaseline = result.provenance.baseline?.kind === 'firmware-defaults';
    importComparison = {
      result,
      firmwareBaseline,
      before: firmwareBaseline
        ? createTunedResponse(betaflightDefaultRateProfile(result.sourceVersion))
        : clone(beforeImport),
      after: createTunedResponse(result.profile, beforeImport),
    };
    paintImportReview();
    draft = createTunedResponse(result.profile, draft);
    draftProvenance = clone(result.provenance);
    algorithmDrafts = {};
    numericDrafts = {};
    paintFields();
    updateWorkbench();
    status.textContent = t(
      'Preview only. Save as a new profile, then assign it explicitly.',
      'Лише перегляд. Збережіть новий профіль, а потім призначте його явно.',
    );
  }
  for (const node of [text, importKind, version, importBaseline, sourceProfile])
    for (const event of ['input', 'change'])
      listen(node, event, () => {
        clearImportPreview();
        uploadGeneration++;
        if (node === text) {
          uploadedSource = null;
          resolvedPreset = null;
          presetNeedsResolution = false;
        }
      });
  action(
    t('Preview import', 'Переглянути імпорт'),
    async () => {
      clearImportPreview();
      const generation = ++uploadGeneration,
        epoch = openEpoch,
        originalDraft = JSON.stringify(draft);
      hashingImport = generation;
      status.textContent = t('Checking import source…', 'Перевірка джерела імпорту…');
      try {
        const result = await parseImport();
        if (
          disposed ||
          hashingImport !== generation ||
          generation !== uploadGeneration ||
          epoch !== openEpoch ||
          originalDraft !== JSON.stringify(draft)
        ) {
          if (hashingImport === generation) clearImportPreview();
          return;
        }
        showImport(result, JSON.parse(originalDraft));
      } catch (error) {
        if (
          !disposed &&
          hashingImport === generation &&
          generation === uploadGeneration &&
          epoch === openEpoch
        )
          report(error);
      } finally {
        if (hashingImport === generation) hashingImport = null;
      }
    },
    transfer,
  );
  action(
    t('Save import as new profile', 'Зберегти імпорт як новий профіль'),
    async () => {
      if (!imported) throw new Error(t('Preview the import first', 'Спочатку перегляньте імпорт'));
      if (rateProfileIdentity(portable()) !== rateProfileIdentity(imported.profile)) {
        clearImportPreview();
        throw new Error(
          t(
            'Rates changed after the import preview. Preview again, or use Save for next flight to keep the edited draft.',
            'Рейти змінено після перегляду імпорту. Перегляньте імпорт знову або збережіть змінену чернетку для наступного польоту.',
          ),
        );
      }
      remember();
      const nextId = id();
      await mutate(() =>
        store.createProfile(
          {
            id: nextId,
            name: profileName.value || 'Imported rates',
            response: createTunedResponse(imported.profile, draft),
            provenance: imported.provenance,
          },
          library.revision,
        ),
      );
      clearImportPreview();
      load(nextId);
    },
    transfer,
  );
  const bundleFiles = field(t('Local preset folder', 'Локальна тека пресетів'), 'file', transfer);
  bundleFiles.multiple = true;
  bundleFiles.setAttribute('webkitdirectory', '');
  const bundleEntry = field(
    t('Preset entry path within folder', 'Шлях пресету в теці'),
    'text',
    transfer,
  );
  listen(bundleEntry, 'input', () => {
    optionSelection = {};
    releaseChildren(bundleOptions);
    bundleOptions.replaceChildren();
    invalidatePresetResolution();
  });
  const bundleOptions = el('div', undefined, transfer);
  let bundle = {},
    optionSelection = {};
  function invalidatePresetResolution() {
    clearImportPreview();
    resolvedPreset = null;
    uploadedSource = null;
    presetNeedsResolution = true;
    uploadGeneration++;
    importReview.textContent = '';
    status.textContent = t(
      'Preset choices changed. Resolve the preset again before previewing.',
      'Вибір пресету змінено. Повторно розгорніть пресет перед переглядом.',
    );
  }
  listen(bundleFiles, 'change', async () => {
    const generation = ++uploadGeneration;
    clearImportPreview();
    uploadedSource = null;
    resolvedPreset = null;
    presetNeedsResolution = true;
    importReview.textContent = '';
    text.value = '';
    bundle = {};
    optionSelection = {};
    releaseChildren(bundleOptions);
    bundleOptions.replaceChildren();
    bundleEntry.value = '';
    try {
      const files = Array.from(bundleFiles.files ?? []);
      if (files.length > 128 || files.reduce((n, f) => n + f.size, 0) > TUNING_LIBRARY_BYTES)
        throw new Error('Preset bundle exceeds 128 files / 512 KiB');
      const paths = files.map((item) => item.webkitRelativePath || item.name);
      const directory = paths[0]?.split('/')[0];
      const stripDirectory =
        directory &&
        directory !== 'presets' &&
        paths.every((path) => path.startsWith(`${directory}/`));
      const entries = [];
      for (const [index, item] of files.entries()) {
        const path = stripDirectory ? paths[index].slice(directory.length + 1) : paths[index];
        const contents = await readImportText(item);
        if (disposed || generation !== uploadGeneration) return;
        entries.push([path, contents]);
      }
      if (disposed || generation !== uploadGeneration) return;
      bundle = Object.fromEntries(entries);
      bundleEntry.value = Object.keys(bundle)[0] ?? '';
    } catch (error) {
      if (!disposed && generation === uploadGeneration) report(error);
    }
  });
  action(
    t('Resolve preset and review options', 'Розгорнути пресет і переглянути опції'),
    () => {
      invalidatePresetResolution();
      const result = resolveBetaflightPresetBundle({
        files: bundle,
        entry: bundleEntry.value,
        options: optionSelection,
      });
      releaseChildren(bundleOptions);
      bundleOptions.replaceChildren();
      for (const option of result.options ?? []) {
        const box = field(option.name, 'checkbox', bundleOptions);
        box.checked = option.checked ?? false;
        listen(box, 'change', () => {
          optionSelection[option.name] = box.checked;
          invalidatePresetResolution();
        });
      }
      text.value = result.text;
      resolvedPreset = {
        text: result.text,
        bundle: { files: clone(bundle), entry: bundleEntry.value, options: clone(optionSelection) },
      };
      presetNeedsResolution = false;
      importKind.value = 'patch';
      clearImportPreview();
      importReview.textContent = JSON.stringify(result, null, 2);
      importTechnical.hidden = false;
      status.textContent = t(
        'Review options, resolve again after changes, then preview the patch against its baseline.',
        'Перевірте опції, повторно розгорніть після змін і перегляньте патч на вибраній основі.',
      );
    },
    transfer,
  );
  function portable(legacyMessage) {
    commitNumericInputs();
    if (draft.format !== TUNED_RESPONSE_FORMAT)
      throw new Error(
        legacyMessage ??
          t(
            'Legacy feel has no Betaflight equivalent',
            'Класична реакція не має еквівалента Betaflight',
          ),
      );
    return draft.rates;
  }
  action(
    t('Export SIM rates', 'Експортувати рейти SIM'),
    () => {
      if (hashingImport !== null) clearImportPreview();
      text.value = exportNativeRateProfile(portable());
      uploadedSource = null;
      resolvedPreset = null;
      presetNeedsResolution = false;
    },
    transfer,
  );
  const includeThrottleExport = field(
    t('Include throttle settings in CLI export', 'Додати налаштування газу до експорту CLI'),
    'checkbox',
    transfer,
  );
  includeThrottleExport.checked = true;
  action(
    t('Export rate-only CLI', 'Експортувати CLI лише рейтів'),
    () => {
      if (hashingImport !== null) clearImportPreview();
      text.value = exportBetaflightRates(portable(), {
        targetVersion: version.value,
        includeThrottle: includeThrottleExport.checked,
      });
      uploadedSource = null;
      resolvedPreset = null;
      presetNeedsResolution = false;
      status.textContent = includeThrottleExport.checked
        ? t(
            'CLI export ready: rotation rates and throttle settings.',
            'Експорт CLI готовий: рейти обертання й налаштування газу.',
          )
        : t(
            'CLI export ready: rotation rates only; throttle settings are omitted.',
            'Експорт CLI готовий: лише рейти обертання; налаштування газу пропущено.',
          );
    },
    transfer,
  );
  action(
    t('Backup complete library', 'Резервна копія всієї бібліотеки'),
    () => {
      if (hashingImport !== null) clearImportPreview();
      text.value = store.export();
      uploadedSource = null;
      resolvedPreset = null;
      presetNeedsResolution = false;
    },
    transfer,
  );
  action(
    t('Restore library backup', 'Відновити бібліотеку'),
    async () => {
      await mutate(() => store.restore(text.value, library.revision));
      if (disposed) return;
      // A replacement library may remove the setup being edited. Reset the
      // complete editor baseline only after persistence has succeeded.
      try {
        drafts.clear();
        setupDrafts.clear();
        editedSetup = null;
        editedSetupId = library.selectedSetupId;
        completeDraft = null;
        responseBench?.invalidate();
        load();
        status.textContent = t(
          'Library restored. The current attempt keeps its original configuration.',
          'Бібліотеку відновлено. Поточна спроба зберігає початкові налаштування.',
        );
      } catch (failure) {
        // Rendering cannot undo the committed restore or report it as failed.
        status.textContent = `${t(
          'Library restored, but the editor could not refresh. Choose Refresh library to reload the saved settings.',
          'Бібліотеку відновлено, але редактор не вдалося оновити. Виберіть «Оновити бібліотеку», щоб завантажити збережені налаштування.',
        )} ${failure.message}`;
      }
    },
    transfer,
  );
  action(
    t('Download file', 'Завантажити файл'),
    async () => {
      if (fileExporting) return;
      const options = {
        locationRef: win.location,
        documentRef: doc,
        URLImpl: win.URL,
        BlobImpl: win.Blob,
        schedule: win.setTimeout?.bind(win),
        ...platformOptions,
      };
      let parsed,
        json = false;
      try {
        parsed = JSON.parse(text.value);
        json = true;
      } catch {
        /* CLI and preset text remain plain text. */
      }
      const epoch = openEpoch;
      fileExporting = true;
      try {
        const result = await (json
          ? exportJSONFile(parsed, 'fpv-tuning.json', options)
          : exportTextFile(text.value, 'fpv-tuning.txt', options));
        if (disposed || epoch !== openEpoch) return;
        status.textContent =
          result.status === 'cancelled'
            ? t(
                'Sharing cancelled. The text remains available.',
                'Поширення скасовано. Текст залишається доступним.',
              )
            : result.status === 'shared'
              ? t(
                  'Shared with the selected app. Check the destination.',
                  'Передано вибраному застосунку. Перевірте місце призначення.',
                )
              : t(
                  'Download requested. Check your downloads or Save dialog.',
                  'Завантаження запитано. Перевірте завантаження або вікно збереження.',
                );
      } catch (error) {
        if (!disposed && epoch === openEpoch) report(error);
      } finally {
        fileExporting = false;
      }
    },
    transfer,
  );

  const actions = el('div');
  actions.className = 'tuning-actions';
  el(
    'p',
    t(
      'For a repeatable check, use the same launch point and flight mode: hover briefly, make one turn and centre the stick, then try a short throttle pulse. Return here to compare saved and draft curves, then save or revert. Advanced reference practice offers timed cues and a verified, unscored comparison ghost.',
      'Для повторюваної перевірки використовуйте ту саму точку старту й режим: ненадовго зависніть, виконайте один поворот і центруйте стік, потім зробіть короткий імпульс газу. Поверніться сюди, щоб порівняти збережені криві з чернеткою та зберегти або скасувати зміни. Еталонна практика Advanced має часові підказки й перевірену примару для порівняння без заліку.',
    ),
    actions,
  );
  el(
    'p',
    t(
      'Apply & restart assigns the selected profile to this drone. Saved changes are used only by new flights. Portable rates use direct touch input; Legacy feel retains your touch response preference.',
      'Застосування з перезапуском призначає вибраний профіль цьому дрону. Зміни діють лише в нових польотах. Переносні рейти використовують прямий сенсорний ввід; класична реакція зберігає налаштування чутливості дотику.',
    ),
    actions,
  );
  async function save() {
    commitNumericInputs();
    const profileId = selected,
      changes = {
        name: profileName.value,
        response: clone(draft),
        provenance: clone(currentReceipt()),
      },
      setup = readSetup(),
      revision = editRevision;
    await mutate(() =>
      store.saveSetupDraft(
        {
          setup,
          profile: { sourceId: profileId, ...changes },
          rateAction: sharedChoice.value,
          newProfileId: id(),
          newProfileName: changes.name,
          select: true,
        },
        revision,
      ),
    );
    if (disposed) return;
    // Saving replaces the comparison baseline even when the draft itself is unchanged.
    responseBench?.invalidate();
    drafts.delete(profileId);
    setupDrafts.delete(setup.id);
    editedSetup = null;
    editedSetupId = store.snapshot().selectedSetupId;
    completeDraft = null;
    load();
    updateWorkbench();
    onSaved(store.effective());
    status.textContent = t(
      'Saved for the next flight. The current attempt keeps its original configuration.',
      'Збережено для наступного польоту. Поточна спроба зберігає початкові налаштування.',
    );
  }
  action(t('Save for next flight', 'Зберегти для наступного польоту'), save, actions);
  async function applyAndRestart() {
    const epoch = openEpoch;
    assignment.value = selected;
    await save();
    if (disposed || epoch !== openEpoch || !root.open) return;
    endDraftTest();
    close();
    onApply(store.effective());
  }
  action(t('Apply & restart', 'Застосувати й перезапустити'), applyAndRestart, actions);
  action(
    t('Test draft · unscored', 'Перевірити чернетку · без заліку'),
    () => {
      commitNumericInputs();
      const setup = readSetup();
      remember();
      testing = true;
      draftFlightActive = true;
      returnButton.hidden = false;
      const configuration = {
        ...store.effective(),
        response: clone(draft),
        camera: setup.camera,
        ...(setup.advanced ? { advanced: clone(setup.advanced) } : {}),
      };
      if (!setup.advanced) delete configuration.advanced;
      configuration.setupId = setup.id;
      configuration.profileId = selected;
      delete configuration.simulationIdentity;
      close();
      onTest(configuration);
    },
    actions,
  );
  action(
    t('Revert draft', 'Скасувати чернетку'),
    () => {
      drafts.delete(selected);
      setupDrafts.delete(editedSetupId);
      algorithmDrafts = {};
      editedSetup = null;
      if (!store.snapshot().setups.some((item) => item.id === editedSetupId))
        editedSetupId = store.snapshot().selectedSetupId;
      completeDraft = null;
      load(undefined, true);
    },
    actions,
  );
  action(
    t('Refresh library', 'Оновити бібліотеку'),
    () => {
      drafts.clear();
      setupDrafts.clear();
      store.refresh();
      editedSetup = null;
      editedSetupId = store.snapshot().selectedSetupId;
      completeDraft = null;
      load();
      if (!store.status().error) status.textContent = '';
    },
    actions,
  );
  if (onAdvanced)
    action(
      t('Advanced reference quad · experimental', 'Еталонний дрон Advanced · експериментальний'),
      () => {
        const setup = readSetup();
        if (setup.advanced?.aircraft.format === 'AdvancedAircraft.v2') commitNumericInputs();
        else
          portable(
            t(
              'Choose a physical aircraft preset or modern rates for Advanced practice.',
              'Для практики Advanced виберіть фізичний пресет дрона або сучасні рейти.',
            ),
          );
        remember();
        close();
        return onAdvanced({
          ...store.effective(),
          response: clone(draft),
          camera: setup.camera,
          ...(setup.advanced ? { advanced: clone(setup.advanced) } : {}),
          ...(setup.components ? { components: clone(setup.components) } : {}),
        });
      },
      actions,
    );
  action(t('Close', 'Закрити'), close, actions);
  const returnButton = action(
    t('Return to tuning', 'Повернутися до рейтів'),
    () => open({ keepDraft: true, openerElement: returnButton }),
    doc.body,
  );
  returnButton.className = 'tuning-return';
  returnButton.hidden = true;
  translatedAttribute(
    returnButton,
    'data-mode-label',
    t('Unscored draft practice', 'Практика з чернеткою без заліку'),
  );
  translatedAttribute(
    returnButton,
    'aria-description',
    t('Unscored draft practice', 'Практика з чернеткою без заліку'),
  );
  function endDraftTest() {
    draftFlightActive = false;
    returnButton.hidden = true;
  }
  function remember() {
    if (selected && draft)
      drafts.set(selected, {
        response: clone(draft),
        provenance: clone(draftProvenance),
        name: profileName.value,
        algorithms: clone(algorithmDrafts),
        numeric: clone(numericDrafts),
        baseRevision: editRevision,
      });
    if (library) {
      setupDrafts.set(editedSetupId, {
        name: setupName.value,
        profileId: assignment.value || null,
        // A draft may be incomplete. Keep its text rather than coercing an
        // empty camera field to zero or discarding it during navigation.
        cameraText: { tilt: tilt.value, verticalFov: fov.value },
        componentsText: componentInventory ? componentText() : null,
        batteryDepletion: batteryDepletion.checked,
        advanced: clone(physics?.read(false) ?? currentSetup()?.advanced),
        physicsText: physics?.raw(),
        components: clone(componentInventory),
        baseRevision: editRevision,
      });
    }
  }
  function setOptions(node, options, value) {
    releaseChildren(node);
    node.replaceChildren();
    for (const [key, label] of options) {
      const option = el('option', label, node, false);
      option.value = key;
    }
    node.value = value;
  }
  function load(profileId, clearFailure = false) {
    clearImportPreview();
    uploadGeneration++;
    library = store.snapshot();
    editedSetupId ??= library.selectedSetupId;
    const setup = currentSetup();
    if (!completeDraft)
      completeDraft = createSetupDraft({
        library,
        setupId: library.setups.some((item) => item.id === setup.id)
          ? setup.id
          : library.selectedSetupId,
      });
    selected = profileId ?? setup.profileId ?? library.defaultProfileId;
    const saved = library.profiles.find((item) => item.id === selected) ?? library.profiles[0];
    selected = saved.id;
    const cached = drafts.get(selected),
      pendingSetup = setupDrafts.get(setup.id);
    draft = clone(cached?.response ?? saved.response);
    draftProvenance = clone(cached ? (cached.provenance ?? null) : (saved.provenance ?? null));
    algorithmDrafts = clone(cached?.algorithms ?? {});
    numericDrafts = clone(cached?.numeric ?? {});
    editRevision = Math.min(
      cached?.baseRevision ?? library.revision,
      pendingSetup?.baseRevision ?? library.revision,
    );
    profileName.value = cached?.name ?? saved.name;
    setOptions(
      profileSelect,
      library.profiles.map((p) => [p.id, p.name]),
      selected,
    );
    setOptions(
      setupSelect,
      [
        ...library.setups.map((p) => [p.id, p.name]),
        ...(!library.setups.some((item) => item.id === setup.id)
          ? [[setup.id, `${setup.name} · ${t('Draft', 'Чернетка')}`]]
          : []),
      ],
      setup.id,
    );
    setOptions(
      replacement,
      library.profiles.filter((p) => p.id !== selected).map((p) => [p.id, p.name]),
      library.profiles.find((p) => p.id !== selected)?.id ?? '',
    );
    setOptions(
      history,
      saved.history.map((p) => [String(p.revision), `${p.revision + 1}: ${p.name}`]),
      String(saved.history.at(-1)?.revision ?? ''),
    );
    setupName.value = pendingSetup?.name ?? setup.name;
    batteryPracticePanel.hidden = setup.advanced?.aircraft.format !== 'AdvancedAircraft.v2';
    batteryDepletion.checked =
      pendingSetup?.batteryDepletion ?? setup.advanced?.aircraft.battery.depletion ?? false;
    if (setup.preset && listAircraftPresets().some((item) => item.id === setup.preset.id)) {
      aircraftSelect.value = setup.preset.id;
      paintAircraft();
    }
    physics?.load(
      pendingSetup?.advanced ?? setup.advanced ?? null,
      physicalBaseline(setup),
      pendingSetup?.physicsText,
    );
    componentInventory = clone(pendingSetup?.components ?? setup.components ?? null);
    if (
      !componentInventory &&
      setup.preset &&
      setup.advanced?.aircraft.format === 'AdvancedAircraft.v2' &&
      listAircraftPresets().some((item) => item.id === setup.preset.id)
    )
      componentInventory = createPresetComponents(setup.preset.id, setup.advanced.aircraft);
    if (componentInventory) {
      const { reference, battery, cameraPayload } = componentInventory;
      const pending = pendingSetup?.componentsText;
      const capacity = setup.advanced.aircraft.battery.capacityAh * 1000;
      Object.assign(batteryMass, {
        min: String(reference.batteryMassGrams * 0.5),
        max: String(reference.batteryMassGrams * 2),
        value: pending?.mass ?? String(battery.massGrams),
      });
      Object.assign(batteryCapacity, {
        min: String(reference.capacityMah * 0.5),
        max: String(reference.capacityMah * 2),
        value: pending?.capacity ?? String(capacity),
      });
      Object.assign(payloadMass, {
        min: '0',
        max: String(reference.maxPayloadGrams),
        value: pending?.payloadMass ?? String(cameraPayload.massGrams),
      });
      batteryChoice.value =
        pending?.batteryChoice ??
        (battery.massGrams === reference.batteryMassGrams && capacity === reference.capacityMah
          ? 'reference'
          : 'custom');
      payloadChoice.value =
        pending?.payloadChoice ?? (cameraPayload.massGrams === 0 ? 'none' : 'custom');
    }
    paintComponents();
    camera = clone(pendingSetup?.cameraText ?? setup.camera);
    tilt.value = String(camera.tilt);
    fov.value = String(camera.verticalFov);
    for (const node of [tilt, fov]) cameraValue(node, false);
    paintAssignment(pendingSetup ? pendingSetup.profileId : setup.profileId);
    paintFields();
    paintLibraryPreviews();
    updateWorkbench();
    const error = store.status().error;
    if (error) report(new Error(error));
    else if (editRevision !== library.revision)
      status.textContent = t(
        'This draft predates a library change. Export it before refreshing; saving over newer settings is blocked.',
        'Ця чернетка старіша за зміну бібліотеки. Експортуйте її перед оновленням; перезапис новіших налаштувань заблоковано.',
      );
    else if (clearFailure && !root.querySelector('[aria-invalid="true"]')) status.textContent = '';
  }
  function paintAssignment(profileId = assignment.value || null) {
    setOptions(
      assignment,
      [
        ['', t('Player default', 'Типовий профіль гравця')],
        ...library.profiles.map((p) => [p.id, p.name]),
      ],
      profileId ?? '',
    );
    affected.textContent = `${t('Shared by: ', 'Використовують: ')}${
      profileUsers(library, selected)
        .map((p) => p.name)
        .join(', ') || t('no drones yet', 'ще жоден дрон')
    }${library.defaultProfileId === selected ? t(' · player default', ' · типовий профіль гравця') : ''}`;
  }
  function readSetup(commit = true) {
    const setup = {
      ...clone(currentSetup()),
      id: editedSetupId,
      name: setupName.value,
      profileId: assignment.value || null,
      camera: { tilt: cameraValue(tilt, commit), verticalFov: cameraValue(fov, commit) },
    };
    const advanced = physics?.read(commit);
    if (advanced) setup.advanced = advanced;
    const components = readComponents(commit);
    if (components) {
      setup.advanced.aircraft = components.aircraft;
      setup.components = components.components;
    }
    if (setup.advanced?.aircraft.format === 'AdvancedAircraft.v2')
      setup.advanced.aircraft.battery.depletion = batteryDepletion.checked;
    return setup;
  }
  function acceptOwnSave(previousRevision, { reloadAircraft = false } = {}) {
    library = store.snapshot();
    if (reloadAircraft) {
      editedSetup = null;
      editedSetupId = library.selectedSetupId;
      completeDraft = null;
    }
    if (editRevision === previousRevision) editRevision = library.revision;
    for (const cached of drafts.values())
      if (cached.baseRevision === previousRevision) cached.baseRevision = library.revision;
    for (const cached of setupDrafts.values())
      if (cached.baseRevision === previousRevision) cached.baseRevision = library.revision;
    if (reloadAircraft) {
      const setup = currentSetup();
      drafts.delete(selected);
      drafts.delete(setup.profileId ?? library.defaultProfileId);
      // Advanced saves the complete response, camera and component inventory.
      // Returning to older live inputs would apply the same payload twice or
      // overwrite an explicitly selected aircraft. Its pending name is separate.
      setupDrafts.set(setup.id, {
        name: setupName.value,
        profileId: setup.profileId,
        baseRevision: library.revision,
      });
      load();
    }
  }
  async function mutate(fn) {
    if (busy || disposed)
      throw new Error(t('A save is already in progress', 'Збереження вже триває'));
    busy = true;
    const before = library.revision;
    const controls = Array.from(root.querySelectorAll('input,select,textarea,button')).map(
      (node) => [node, node.disabled],
    );
    for (const [node] of controls) node.disabled = true;
    root.setAttribute('aria-busy', 'true');
    try {
      await fn();
      acceptOwnSave(before);
    } finally {
      busy = false;
      root.removeAttribute('aria-busy');
      for (const [node, disabled] of controls) node.disabled = disabled;
    }
  }
  listen(profileSelect, 'change', () => {
    const profile = library.profiles.find((p) => p.id === profileSelect.value);
    paintLibraryPreviews();
    status.textContent = `${t('Browsing rates', 'Перегляд рейтів')}: ${profile?.name ?? ''}. ${t('Choose Use rate profile in draft to edit.', 'Виберіть «Використати профіль у чернетці».')}`;
  });
  action(
    t('Use rate profile in draft', 'Використати профіль у чернетці'),
    () => {
      remember();
      const next = profileSelect.value;
      load(next);
      assignment.value = next;
      updateWorkbench();
    },
    toolbar,
  );
  listen(setupSelect, 'change', () => {
    paintLibraryPreviews();
    status.textContent = t(
      'Browsing saved setups. Choose Use saved setup in draft to edit.',
      'Перегляд збережених налаштувань. Виберіть «Використати налаштування в чернетці».',
    );
  });
  action(
    t('Use saved setup in draft', 'Використати налаштування в чернетці'),
    () => {
      if (setupSelect.value === editedSetupId) return;
      remember();
      editedSetupId = setupSelect.value;
      editedSetup = null;
      completeDraft = null;
      load();
    },
    toolbar,
  );
  listen(assignment, 'change', () => {
    const assigned = assignment.value,
      next = assigned || library.defaultProfileId;
    remember();
    load(next);
    assignment.value = assigned;
    updateWorkbench();
  });
  listen(algorithm, 'change', () => {
    const old = draft.format === TUNED_RESPONSE_FORMAT ? draft.rates.algorithm : 'legacy';
    algorithmDrafts[old] = clone(draft);
    const next = algorithm.value;
    draft = clone(
      algorithmDrafts[next] ??
        (next === 'legacy'
          ? DEFAULT_RESPONSE
          : createTunedResponse(
              createRateProfile({
                algorithm: next,
                ...(draft.rates ? { throttle: draft.rates.throttle } : {}),
              }),
              draft,
            )),
    );
    paintFields();
  });
  function commitNumericInputs() {
    try {
      for (const commit of numericCommits) commit();
    } catch (failure) {
      report(failure);
      numericFailure = status.textContent;
      throw failure;
    }
  }
  function number(key, label, value, min, max, step, change, parent = values) {
    const row = el('div', undefined, parent);
    row.className = 'tuning-number';
    const input = field(label, 'number', row),
      slider = field(label, 'range', row);
    const algorithm = draft.format === TUNED_RESPONSE_FORMAT ? draft.rates.algorithm : 'legacy',
      pending = (numericDrafts[algorithm] ??= {});
    let applied = value;
    const precision = String(step).split('.')[1]?.length ?? 0;
    const invalid = (message) => {
      input.setAttribute('aria-invalid', 'true');
      input.setCustomValidity?.(message);
    };
    const update = (node, commit) => {
      // Keep unfinished text separately from evaluated values. Repainting or
      // navigating drafts must not turn an invalid entry into a valid old rate.
      if (node === input) pending[key] = input.value;
      const n = node.value.trim() ? Number(node.value) : Number.NaN;
      if (!Number.isFinite(n) || n < min || n > max) {
        const message = t(
          `${label}: enter a value from ${min} to ${max}.`,
          `${label}: введіть значення від ${min} до ${max}.`,
        );
        invalid(message);
        if (commit) throw new Error(message);
        return;
      }
      const normalized = Number((Math.round(n / step) * step).toFixed(precision));
      if (!commit && Math.abs(normalized - n) > 1e-9) {
        // A partially typed number stays editable until blur/change or an action
        // commits it. Never show that number as an already applied rate.
        invalid(t(`Uses increments of ${step}.`, `Крок значення: ${step}.`));
        return;
      }
      slider.value = String(normalized);
      if (commit) input.value = String(normalized);
      delete pending[key];
      input.removeAttribute('aria-invalid');
      input.setCustomValidity?.('');
      if (numericFailure && status.textContent === numericFailure) status.textContent = '';
      numericFailure = null;
      if (Math.abs(normalized - applied) > 1e-9) change(normalized);
      applied = normalized;
      paintPreview();
    };
    const checkedUpdate = (node, commit) => {
      try {
        update(node, commit);
      } catch (failure) {
        report(failure);
        numericFailure = status.textContent;
      }
    };
    numericCommits.push(() => update(input, true));
    for (const node of [input, slider]) {
      Object.assign(node, {
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(value),
      });
      // An import requested before this edit cannot replace its newer text,
      // including incomplete values that have not changed the evaluator yet.
      listen(node, 'input', () => {
        if (hashingImport !== null) clearImportPreview();
        checkedUpdate(node, node === slider);
      });
      listen(node, 'change', () => {
        if (hashingImport !== null) clearImportPreview();
        checkedUpdate(node, true);
      });
    }
    if (Object.hasOwn(pending, key)) {
      input.value = pending[key];
      checkedUpdate(input, false);
    }
    return {
      input,
      slider,
      setValue(value) {
        // Linked edits change the peer's draft too. Keep its comparison value
        // synchronized so typing the peer's former value is still a new edit.
        applied = value;
        input.value = slider.value = String(value);
        delete pending[key];
        input.removeAttribute('aria-invalid');
        input.setCustomValidity?.('');
      },
    };
  }
  function paintFields() {
    numericCommits = [];
    releaseChildren(values);
    values.replaceChildren();
    axisInputs = {};
    const tuned = draft.format === TUNED_RESPONSE_FORMAT;
    algorithm.value = tuned ? draft.rates.algorithm : 'legacy';
    link.disabled = !tuned;
    if (!tuned) {
      for (const [key, label, min, max] of [
        ['maxRate', t('Maximum rate (°/s)', 'Максимальний рейт (°/с)'), 60, 720],
        ['expo', 'Expo (%)', 0, 80],
      ])
        number(key, label, draft[key], min, max, 1, (value) => {
          draft[key] = value;
        });
    } else {
      const a = draft.rates.algorithm,
        limits = RATE_PARAMETER_LIMITS[a];
      const spec =
        a === 'actual'
          ? [
              ['rcRate', t('Center sensitivity (°/s)', 'Чутливість центру (°/с)'), 10],
              ['rate', t('Maximum rate (°/s)', 'Максимальний рейт (°/с)'), 10],
              ['expo', 'Expo (%)', 1],
            ]
          : a === 'raceflight'
            ? [
                ['rcRate', 'Rate (°/s)', 10],
                ['rate', 'Acro+ (%)', 1],
                ['expo', 'Expo (%)', 1],
              ]
            : [
                ['rcRate', 'RC rate', 0.01],
                [
                  'rate',
                  a === 'quick'
                    ? t('Maximum rate (°/s)', 'Максимальний рейт (°/с)')
                    : a === 'kiss'
                      ? 'Rate'
                      : 'Super rate',
                  a === 'quick' ? 10 : 0.01,
                ],
                ['expo', 'Expo', 0.01],
              ];
      for (const axis of axes) {
        axisInputs[axis] = {};
        const group = el('fieldset', undefined, values);
        el('legend', axisName(axis), group);
        for (const [key, label, factor] of [
          ...spec,
          ['limit', t('Rate limit (°/s)', 'Обмеження рейту (°/с)'), 1],
        ]) {
          axisInputs[axis][key] = number(
            `axes.${axis}.${key}`,
            label,
            draft.rates.axes[axis][key] * factor,
            (key === 'rcRate' ? 1 : key === 'limit' ? 200 : 0) * factor,
            (key === 'limit' ? 1998 : limits[key]) * factor,
            factor,
            (value) => {
              draft.rates.axes[axis][key] = Math.round(value / factor);
              if (link.checked && axis !== 'yaw') {
                const other = axis === 'roll' ? 'pitch' : 'roll';
                draft.rates.axes[other][key] = Math.round(value / factor);
                axisInputs[other]?.[key]?.setValue(value);
              }
            },
            group,
          );
        }
      }
      if (a === 'quick') {
        const mode = field(t('Quick RC expo mode', 'Режим Quick RC expo'), 'checkbox', values);
        mode.checked = draft.rates.quickRatesRcExpo;
        listen(mode, 'change', () => {
          draft.rates.quickRatesRcExpo = mode.checked;
          paintPreview();
        });
      }
      const throttle = el('fieldset', undefined, values);
      el('legend', t('Throttle', 'Газ'), throttle);
      const model = select(
        t('Throttle curve version', 'Версія кривої газу'),
        [
          ['betaflight-4.5', 'Betaflight 4.5'],
          ['betaflight-2025.12', 'Betaflight 2025.12 / 2026.6'],
        ],
        throttle,
      );
      model.value = draft.rates.throttle.model;
      listen(model, 'change', () => {
        draft.rates.throttle.model = model.value;
        paintFields();
      });
      for (const [key, label] of [
        ['mid', t('Midpoint (%)', 'Середня точка (%)')],
        ['expo', 'Expo (%)'],
        ...(draft.rates.throttle.model === 'betaflight-2025.12'
          ? [['hover', t('Hover point (%)', 'Точка зависання (%)')]]
          : []),
      ])
        number(
          `throttle.${key}`,
          label,
          draft.rates.throttle[key],
          0,
          100,
          1,
          (value) => {
            draft.rates.throttle[key] = value;
          },
          throttle,
        );
      const limiting = select(
        t('Throttle limit', 'Обмеження газу'),
        [
          ['off', t('Off', 'Вимкнено')],
          ['scale', 'Scale'],
          ['clip', 'Clip'],
        ],
        throttle,
      );
      limiting.value = draft.rates.throttle.limitType;
      listen(limiting, 'change', () => {
        draft.rates.throttle.limitType = limiting.value;
        paintPreview();
      });
      number(
        'throttle.limitPercent',
        t('Limit (%)', 'Обмеження (%)'),
        draft.rates.throttle.limitPercent,
        25,
        100,
        1,
        (value) => {
          draft.rates.throttle.limitPercent = value;
        },
        throttle,
      );
    }
    number(
      'maxTilt',
      t('Self-level maximum tilt (°)', 'Максимальний нахил самовирівнювання (°)'),
      draft.maxTilt,
      5,
      60,
      1,
      (value) => {
        draft.maxTilt = value;
      },
    );
    const legacyResponse = number(
      'responseTicks',
      t('Legacy airframe response (50 Hz ticks)', 'Реакція класичної моделі (такти 50 Гц)'),
      draft.responseTicks,
      1,
      30,
      1,
      (value) => {
        draft.responseTicks = value;
      },
    );
    if (currentSetup().advanced) {
      legacyResponse.input.disabled = legacyResponse.slider.disabled = true;
      el(
        'small',
        t(
          'Inactive for this aircraft backend; preserved for Legacy flights.',
          'Неактивно для цієї фізичної моделі; збережено для класичних польотів.',
        ),
        legacyResponse.input.parentNode.parentNode,
      );
    }
    paintPreview();
  }
  function compile(response) {
    return response.format === TUNED_RESPONSE_FORMAT
      ? createRateEvaluator(response.rates)
      : {
          rate: (_axis, x) =>
            (responseCurve(Math.round(x * 1000), response.expo) * response.maxRate) / 1000,
          throttle: (x) => x,
        };
  }
  function rateReadouts(response, evaluated) {
    return axes
      .map(
        (axis) =>
          `${axisName(axis)} · ${t('center slope', 'нахил у центрі')} ${(response.format === TUNED_RESPONSE_FORMAT ? evaluated.rate(axis, 0.000001) * 1000000 : response.maxRate * (1 - response.expo / 100)).toFixed(1)} · 50% ${evaluated.rate(axis, 0.5).toFixed(1)} · 100% ${evaluated.rate(axis, 1).toFixed(1)} °/s`,
      )
      .join('\n');
  }
  function rateAlgorithm(response) {
    return response.format === TUNED_RESPONSE_FORMAT
      ? `${title(response.rates.algorithm)}${response.rates.algorithm === 'quick' ? ` · ${t('RC expo mode', 'Режим RC expo')}: ${response.rates.quickRatesRcExpo ? t('on', 'увімкнено') : t('off', 'вимкнено')}` : ''}`
      : t('Legacy feel', 'Класична реакція');
  }
  function paintLibraryPreviews() {
    if (!library) return;
    const profile = library.profiles.find((item) => item.id === profileSelect.value);
    profilePreview.hidden = !profile;
    if (profile) {
      const evaluated = compile(profile.response);
      profilePreviewSummary.textContent = `${profile.name} · ${rateAlgorithm(profile.response)}`;
      profilePreviewReadouts.textContent = rateReadouts(profile.response, evaluated);
      drawWorkbenchCurve(doc, profilePreviewSvg, {
        maximum: Math.max(1, ...axes.map((axis) => evaluated.rate(axis, 1))),
        xLabel: t('Stick travel (%)', 'Хід стіка (%)'),
        series: axes.map((axis, index) => ({
          evaluate: (x) => evaluated.rate(axis, x),
          color: colors[index],
          label: axisName(axis),
          dashed: index === 1,
        })),
      });
    }
    const setup = library.setups.find((item) => item.id === setupSelect.value);
    if (!setup) {
      setupPreviewSummary.textContent = t(
        'This setup is not saved yet. Inspect the current draft in Aircraft, Rates and Camera.',
        'Ці налаштування ще не збережено. Перегляньте поточну чернетку в розділах «Дрон», «Рейти» та «Камера».',
      );
      setupPreviewReadouts.textContent = '';
      return;
    }
    const assigned = library.profiles.find(
      (item) => item.id === (setup.profileId ?? library.defaultProfileId),
    );
    const aircraft = setup.advanced?.aircraft;
    const preset = listAircraftPresets().find((item) => item.id === setup.preset?.id);
    setupPreviewSummary.textContent = `${setup.name} · ${preset?.name ?? aircraft?.id ?? t('Legacy aircraft', 'Класичний дрон')}${aircraft ? ` · ${(aircraft.mass * 1000).toFixed(1)} ${t('g flying weight', 'г польотної маси')}` : ''}`;
    setupPreviewReadouts.textContent = `${t('Camera', 'Камера')}: ${t('tilt', 'нахил')} ${setup.camera.tilt}° · ${t('vertical FOV', 'вертикальне поле зору')} ${setup.camera.verticalFov}°\n${t('Rates', 'Рейти')}: ${assigned.name} · ${rateAlgorithm(assigned.response)}${setup.profileId ? '' : ` · ${t('Player default', 'Типовий профіль гравця')}`}\n${rateReadouts(assigned.response, compile(assigned.response))}`;
  }
  function paintInspected() {
    if (evaluator && savedEvaluator) {
      const position = Number(previewStick.value) / 100;
      inspected.textContent = `${previewStick.value}% · ${axisName(previewAxis.value)} · ${t('Saved', 'Збережене')} ${savedEvaluator.rate(previewAxis.value, position).toFixed(1)} °/s · ${t('Draft', 'Чернетка')} ${evaluator.rate(previewAxis.value, position).toFixed(1)} °/s`;
      rateCurve?.inspect(Math.abs(position));
    }
  }
  function paintPreview() {
    if (!draft) return;
    try {
      paintReceipt();
      evaluator = compile(draft);
      savedEvaluator = compile(library.profiles.find((p) => p.id === selected).response);
      const maximum = Math.max(
        1,
        ...axes.flatMap((axis) => [evaluator.rate(axis, 1), savedEvaluator.rate(axis, 1)]),
      );
      rateCurve = drawWorkbenchCurve(doc, svg, {
        maximum,
        xLabel: t('Stick travel (%)', 'Хід стіка (%)'),
        series: axes.flatMap((axis, i) =>
          visibility[axis].checked
            ? [
                {
                  evaluate: (x) => savedEvaluator.rate(axis, x),
                  color: colors[i],
                  dashed: true,
                  label: `${axisName(axis)} ${t('saved', 'збережене')}`,
                },
                {
                  evaluate: (x) => evaluator.rate(axis, x),
                  color: colors[i],
                  label: `${axisName(axis)} ${t('draft', 'чернетка')}`,
                },
              ]
            : [],
        ),
      });
      paintInspected();
      if (throttleSvg)
        drawWorkbenchCurve(doc, throttleSvg, {
          maximum: 100,
          yLabel: t('Output (%)', 'Вихід (%)'),
          xLabel: t('Stick travel (%)', 'Хід стіка (%)'),
          series: [
            {
              evaluate: (x) => savedEvaluator.throttle(x) * 100,
              color: '#f1ca72',
              dashed: true,
              label: t('Saved throttle', 'Збережений газ'),
            },
            {
              evaluate: (x) => evaluator.throttle(x) * 100,
              color: '#55c8a4',
              label: t('Draft throttle', 'Газ чернетки'),
            },
          ],
        });
      readouts.textContent =
        axes
          .filter((axis) => visibility[axis].checked)
          .map(
            (axis) =>
              `${axisName(axis)} · ${t('center slope', 'нахил у центрі')} ${(draft.format === TUNED_RESPONSE_FORMAT ? evaluator.rate(axis, 0.000001) * 1000000 : draft.maxRate * (1 - draft.expo / 100)).toFixed(1)} · 50% ${evaluator.rate(axis, 0.5).toFixed(1)} · 100% ${evaluator.rate(axis, 1).toFixed(1)} °/s`,
          )
          .join('\n') +
        `\n${t('Throttle', 'Газ')}: 0% ${evaluator.throttle(0).toFixed(3)} · 50% ${evaluator.throttle(0.5).toFixed(3)} · 100% ${evaluator.throttle(1).toFixed(3)}`;
    } catch (failure) {
      report(failure);
    }
  }
  let angle = 0,
    previousTime = null,
    lastDiagnostic = 0;
  function animate(time) {
    if (disposed || !root.open) {
      frame = null;
      return;
    }
    if (
      motion.checked &&
      !doc.hidden &&
      workbench?.current() === 'rates' &&
      previewDisclosure.open &&
      !win.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
      doc.body?.dataset.effects !== 'reduced' &&
      evaluator &&
      previousTime !== null
    )
      angle =
        (angle +
          evaluator.rate(
            previewAxis.value,
            capturePreview.checked
              ? getDiagnostics().context === 'live-preview'
                ? (getDiagnostics().calibrated?.[previewAxis.value] ?? 0)
                : 0
              : Number(previewStick.value) / 100,
          ) *
            Math.min(0.05, (time - previousTime) / 1000)) %
        360;
    previousTime = time;
    const rotation =
      previewAxis.value === 'roll'
        ? 'rotateY'
        : previewAxis.value === 'pitch'
          ? 'rotateX'
          : 'rotateZ';
    quad.style.transform = `${rotation}(${angle}deg)`;
    if (time - lastDiagnostic > 200) {
      lastDiagnostic = time;
      const info = getDiagnostics(),
        available = (value) => (value == null ? t('unavailable', 'недоступно') : value);
      const source =
        {
          keyboard: t('Keyboard', 'Клавіатура'),
          touch: t('Touch', 'Дотик'),
          controller: t('Game controller', 'Ігровий контролер'),
          radio: t('Calibrated radio', 'Калібрований пульт'),
          recording: t('Recording', 'Запис'),
        }[info.source] ?? available(null);
      const context =
        info.context === 'live-preview'
          ? t('Live input preview; flight is paused', 'Попередній перегляд вводу; політ на паузі')
          : info.context === 'last-flight-sample'
            ? t(
                'Last committed flight input; flight is paused',
                'Останній прийнятий ввід польоту; політ на паузі',
              )
            : t(
                'No flight input captured for this source',
                'Ще немає вводу польоту для цього джерела',
              );
      const requested =
        info.calibrated && evaluator
          ? Object.fromEntries(
              axes.map((axis) => [
                axis,
                Number(evaluator.rate(axis, info.calibrated[axis]).toFixed(1)),
              ]),
            )
          : null;
      for (const [axis, { meter, output }] of inputMeters) {
        const value = info.calibrated?.[axis];
        meter.hidden = !Number.isFinite(value);
        if (Number.isFinite(value)) meter.value = value;
        output.textContent = Number.isFinite(value)
          ? `${Math.round(value * 100)}%`
          : t('unavailable', 'недоступно');
      }
      inputReadiness.textContent = `${t('Input source', 'Джерело вводу')}: ${source} · ${info.calibrated ? t('Input available; check mapping and centre before tuning.', 'Ввід доступний; перевірте канали й центр перед налаштуванням.') : t('No live calibrated sample. Open calibration or check your input source.', 'Немає каліброваного зразка. Відкрийте калібрування або перевірте джерело вводу.')}`;
      diagnostics.textContent = `${info.mapping ? `${t('Mapping', 'Призначення')}: ${info.mapping} · ${t('Throttle change input', 'Ввід зміни газу')}: ${info.throttleRate ?? '—'} (${t('normalized; flight throttle unavailable', 'нормалізовано; газ польоту недоступний')})\n` : ''}${t('Input source', 'Джерело вводу')}: ${source}\n${context}\n${t('Raw input', 'Сире введення')}: ${JSON.stringify(available(info.raw))}\n${t('Calibrated', 'Каліброване')}: ${JSON.stringify(available(info.calibrated))}\n${t('Requested rotation (draft °/s)', 'Задане обертання (чернетка °/с)')}: ${JSON.stringify(available(requested))}\n${t('Achieved rotation (last committed flight °/s)', 'Досягнуте обертання (останній прийнятий крок польоту °/с)')}: ${JSON.stringify(available(info.achieved))}\n${t('Flight tick', 'Крок польоту')}: ${available(info.flightTick)}\n${t('Browser sample age (ms)', 'Вік зразка браузера (мс)')}: ${available(info.sampleAgeMs)} · ${t('Observed timestamp cadence (Hz)', 'Спостережувана частота міток (Гц)')}: ${available(info.cadenceHz)}`;
    }
    frame = win.requestAnimationFrame(animate);
  }
  function open({ keepDraft = false, openerElement = doc.activeElement } = {}) {
    if (disposed || busy) return;
    // This confirmation describes the previous save action, not the attempt
    // that may have been restarted since. Keep errors and import review text.
    if (
      status.textContent ===
      t(
        'Saved for the next flight. The current attempt keeps its original configuration.',
        'Збережено для наступного польоту. Поточна спроба зберігає початкові налаштування.',
      )
    )
      status.textContent = '';
    openEpoch++;
    opener = openerElement;
    onOpen();
    if (!keepDraft) {
      remember();
      store.refresh();
      load(selected);
    } else if (!draft) load();
    else library = store.snapshot();
    returnButton.hidden = true;
    testing = false;
    if (!root.open) root.showModal();
    heading.focus();
    previousTime = null;
    if (frame === null) frame = win.requestAnimationFrame(animate);
  }
  function close() {
    openEpoch++;
    responseBench?.invalidate();
    controllerTunes?.invalidate();
    clearImportPreview();
    releaseCurvePointer();
    remember();
    if (root.open) root.close();
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    capturePreview.checked = false;
    paintCaptureStatus();
    returnButton.hidden = !draftFlightActive;
    onClose({ testing });
    if (opener?.isConnected) opener.focus();
  }
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) {
      releaseCurvePointer();
      if (frame !== null) win.cancelAnimationFrame(frame);
      frame = null;
      previousTime = null;
    } else if (root.open && frame === null) frame = win.requestAnimationFrame(animate);
  });
  listen(root, 'cancel', (event) => {
    event.preventDefault();
    close();
  });
  listen(win, 'storage', (event) => {
    if (root.open && event.key === 'revealline.fpv.tuning.v1')
      status.textContent = t(
        'Another tab changed the library. Export your draft before refreshing. Saving a stale draft is blocked.',
        'Інша вкладка змінила бібліотеку. Експортуйте чернетку перед оновленням. Збереження застарілої чернетки заблоковано.',
      );
  });
  const sharedChoice = select(
    t('When saving edited rates', 'Під час збереження змінених рейтів'),
    [
      ['copy', t('Save as a copy', 'Зберегти як копію')],
      ['update', t('Update shared profile', 'Оновити спільний профіль')],
    ],
    management,
  );
  sharedChoice.value = 'copy';
  workbench = mountWorkbenchChrome({
    document: doc,
    window: win,
    root,
    t,
    listen,
    action,
    el,
    heading,
    status,
    onSection(section) {
      if (section === 'rates') return;
      releaseCurvePointer();
      capturePreview.checked = false;
      paintCaptureStatus();
    },
  });
  workbench.add('overview', introduction);
  const flow = el(
    'p',
    t('Input → Rates → Controller → Aircraft → Camera', 'Ввід → Рейти → Контролер → Дрон → Камера'),
    workbench.panel('overview'),
  );
  flow.className = 'workbench-flow';
  const inputReadiness = el('p', '', workbench.panel('overview'));
  const inputReviewed = field(
    t(
      'I checked my input connection, mapping and stick centres',
      'Я перевірив з’єднання, призначення каналів і центри стіків',
    ),
    'checkbox',
    workbench.panel('overview'),
  );
  function readinessSignature() {
    const conditions = getPracticeConditions();
    return JSON.stringify(
      conditions?.input ?? { source: getDiagnostics().source ?? 'unavailable' },
    );
  }
  listen(inputReviewed, 'change', () => {
    inputReviewSignature = inputReviewed.checked ? readinessSignature() : null;
    responseBench?.invalidate();
  });
  const inputMeters = new Map();
  const inputMeterGroup = el('div', undefined, workbench.panel('overview'));
  inputMeterGroup.className = 'workbench-input-meters';
  for (const axis of [...axes, 'throttle']) {
    const label = axis === 'throttle' ? t('Throttle', 'Газ') : axisName(axis);
    const row = el('label', label, inputMeterGroup);
    const meter = el('meter', undefined, row),
      output = el('output', '—', row);
    meter.min = axis === 'throttle' ? 0 : -1;
    meter.max = 1;
    meter.value = 0;
    translatedAttribute(meter, 'aria-label', label);
    inputMeters.set(axis, { meter, output });
  }
  const assignmentHelp = el(
    'p',
    t(
      'The assigned profile is the saved source. Edited rates shown in the header will be saved as a copy unless you choose to update the shared profile in Library.',
      'Призначений профіль — збережене джерело. Змінені рейти в заголовку буде збережено як копію, якщо в Бібліотеці не вибрати оновлення спільного профілю.',
    ),
    setupPanel,
  );
  assignmentHelp.className = 'workbench-help';
  if (onCalibration)
    action(
      t('Check input & calibration', 'Перевірити ввід і калібрування'),
      async () => {
        if (!canCalibrate()) {
          status.textContent = t(
            'Input calibration is unavailable during replay. Your draft is retained.',
            'Калібрування вводу недоступне під час відтворення. Чернетку збережено.',
          );
          return;
        }
        remember();
        const returnOpener = opener;
        const returnToDraft = () => open({ keepDraft: true, openerElement: returnOpener });
        close();
        try {
          if ((await onCalibration(returnToDraft)) === false) returnToDraft();
        } catch (failure) {
          returnToDraft();
          throw failure;
        }
      },
      workbench.panel('overview'),
    );
  const changesView = el('details', undefined, workbench.panel('overview'));
  el('summary', t('Show changed settings', 'Показати змінені налаштування'), changesView);
  const changesList = el('ul', undefined, changesView);
  const aircraftDisclosure = el('details', undefined, workbench.panel('overview'));
  aircraftDisclosure.open = true;
  el('summary', t('Current aircraft preview', 'Перегляд поточного дрона'), aircraftDisclosure);
  const draftAircraftView = el('div', undefined, aircraftDisclosure);
  workbench.add('aircraft', aircraftPanel, setupPanel);
  workbench.add('rates', editor, preview);
  workbench.add('camera', tilt.parentNode, fov.parentNode);
  const cameraSliders = [];
  for (const exact of [tilt, fov]) {
    const slider = field(exact.getAttribute('aria-label'), 'range', workbench.panel('camera'));
    Object.assign(slider, { min: exact.min, max: exact.max, step: '0.1', value: exact.value });
    cameraSliders.push({ exact, slider });
    listen(slider, 'input', () => {
      exact.value = slider.value;
      cameraValue(exact, false);
      updateWorkbench();
    });
    listen(exact, 'input', () => {
      if (cameraValue(exact, false) !== null) slider.value = exact.value;
    });
  }
  const cameraSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  cameraSvg.setAttribute('role', 'img');
  translatedAttribute(
    cameraSvg,
    'aria-label',
    t('Camera framing preview at 16:9', 'Попередній перегляд камери 16:9'),
  );
  const cameraDisclosure = el('details', undefined, workbench.panel('camera'));
  cameraDisclosure.open = true;
  cameraDisclosure.className = 'workbench-camera-preview';
  el('summary', t('Camera framing preview', 'Попередній перегляд кадру камери'), cameraDisclosure);
  cameraDisclosure.append(cameraSvg);
  el(
    'p',
    t(
      'Vertical FOV stays constant as the screen shape changes; horizontal FOV depends on aspect ratio. Tilt and FOV change only your view.',
      'Вертикальне поле зору незмінне за різних пропорцій екрана; горизонтальне залежить від них. Нахил і поле зору змінюють лише огляд.',
    ),
    workbench.panel('camera'),
  );
  workbench.add('library', toolbar, libraryPreviews, affected, management, transfer);
  transfer.open = false;
  physics = mountWorkbenchPhysics({
    t,
    el,
    field,
    action,
    translatedAttribute,
    listen,
    aircraftParent: workbench.panel('aircraft'),
    controllerParent: workbench.panel('controller'),
    onChange: () => {
      paintComponents();
      updateWorkbench();
    },
  });
  action(
    t('Edit exact PID gains', 'Редагувати точні коефіцієнти PID'),
    () => {
      workbench.reveal(workbench.panel('controller'));
    },
    workbench.panel('controller'),
  );
  action(
    t('Restore saved controller', 'Відновити збережений контролер'),
    () => {
      const current = physics.read();
      if (!current) return;
      current.controller = clone(currentSetup().advanced.controller);
      const setup = currentSetup();
      physics.load(current, physicalBaseline(setup));
      paintComponents();
      updateWorkbench();
    },
    workbench.panel('controller'),
  );
  const throttleSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  throttleSvg.setAttribute('role', 'img');
  translatedAttribute(
    throttleSvg,
    'aria-label',
    t('Throttle curve: saved and draft', 'Крива газу: збережене й чернетка'),
  );
  preview.append(throttleSvg);
  el('h4', t('Commanded rotation', 'Задане обертання'), demonstration);
  listen(previewStick, 'input', paintInspected);
  listen(previewAxis, 'change', paintInspected);
  const previewDisclosure = doc.createElement('details');
  previewDisclosure.open = true;
  listen(previewDisclosure, 'toggle', () => {
    if (!previewDisclosure.open) releaseCurvePointer();
  });
  el(
    'summary',
    t('Visual previews and comparisons', 'Наочні перегляди й порівняння'),
    previewDisclosure,
  );
  for (const child of [...preview.children]) previewDisclosure.append(child);
  preview.append(previewDisclosure);
  const diagnosticDetails = el('details', undefined, workbench.panel('overview'));
  el('summary', t('Input diagnostics', 'Діагностика введення'), diagnosticDetails);
  diagnosticDetails.append(diagnostics);
  root.append(actions);
  actions.className = 'tuning-actions workbench-actions';
  // Explanations belong to Overview; the action bar remains compact on small screens.
  for (const button of [...actions.querySelectorAll('button')]) {
    if (button.textContent === t('Refresh library', 'Оновити бібліотеку'))
      workbench.panel('library').append(button);
    if (
      button.textContent ===
      t('Advanced reference quad · experimental', 'Еталонний дрон Advanced · експериментальний')
    )
      workbench.panel('controller').append(button);
  }
  for (const paragraph of [...actions.querySelectorAll('p')])
    workbench.panel('overview').append(paragraph);
  action(
    t('Undo last edit', 'Скасувати останню зміну'),
    () => {
      if (!completeDraft?.undo()) return;
      const editor = completeDraft.state().editorState;
      if (editor) {
        editedSetup = clone(editor.setup);
        editedSetupId = editor.setup.id;
        drafts.set(editor.profileId, {
          response: clone(editor.response),
          name: editor.profileName,
          provenance: clone(editor.provenance),
          algorithms: clone(editor.algorithms),
          numeric: clone(editor.numeric),
          baseRevision: editRevision,
        });
        setupDrafts.set(editor.setup.id, {
          name: editor.setupName,
          profileId: editor.assignment,
          cameraText: clone(editor.cameraText),
          componentsText: clone(editor.componentsText),
          batteryDepletion: editor.batteryDepletion,
          advanced: clone(editor.advanced),
          physicsText: clone(editor.physicsText),
          components: clone(editor.components),
          baseRevision: editRevision,
        });
        load(editor.profileId, true);
        return;
      }
      const state = completeDraft.snapshot();
      editedSetup = clone(state.setup);
      editedSetupId = state.setup.id;
      drafts.set(state.profile.sourceId, {
        response: state.profile.response,
        name: state.profile.name,
        provenance: state.profile.provenance,
        baseRevision: editRevision,
      });
      setupDrafts.set(state.setup.id, {
        name: state.setup.name,
        profileId: state.setup.profileId,
        cameraText: state.setup.camera,
        advanced: state.setup.advanced,
        components: state.setup.components,
        baseRevision: editRevision,
      });
      load(state.profile.sourceId, true);
    },
    actions,
  );
  function captureEditorState() {
    return {
      profileId: selected,
      profileName: profileName.value,
      response: clone(draft),
      provenance: clone(currentReceipt()),
      algorithms: clone(algorithmDrafts),
      numeric: clone(numericDrafts),
      setup: clone(currentSetup()),
      setupName: setupName.value,
      assignment: assignment.value || null,
      cameraText: { tilt: tilt.value, verticalFov: fov.value },
      componentsText: componentInventory ? componentText() : null,
      batteryDepletion: batteryDepletion.checked,
      advanced: clone(physics?.read(false) ?? currentSetup()?.advanced ?? null),
      physicsText: physics?.raw() ?? {},
      components: clone(componentInventory),
    };
  }
  function updateWorkbench() {
    if (!workbench || !library || !draft || !physics) return;
    let setup;
    try {
      setup = readSetup(false);
    } catch {
      completeDraft?.capture(completeDraft.snapshot(), captureEditorState());
      responseBench?.invalidate();
      return;
    }
    try {
      completeDraft?.capture(
        {
          setup,
          profile: {
            sourceId: selected,
            name: profileName.value,
            response: clone(draft),
            ...(currentReceipt() ? { provenance: clone(currentReceipt()) } : {}),
          },
        },
        captureEditorState(),
      );
    } catch {
      /* Incomplete text stays editable. Save validates the complete setup. */
    }
    for (const { exact, slider } of cameraSliders) {
      const value = cameraValue(exact, false);
      // Native ranges clamp out-of-bounds assignments. Keep the last valid
      // slider/preview while the exact field retains unfinished numeric text.
      if (value !== null) slider.value = String(value);
    }
    const changes = completeDraft?.changes() ?? [];
    const invalid = [...root.querySelectorAll('[aria-invalid="true"]')].length;
    const flightConfiguration = getFlightConfiguration();
    const usedByFlight =
      flightConfiguration &&
      canonicalJSON(flightConfiguration.response) === canonicalJSON(draft) &&
      canonicalJSON(flightConfiguration.camera) === canonicalJSON(setup.camera) &&
      canonicalJSON(flightConfiguration.advanced ?? null) === canonicalJSON(setup.advanced ?? null);
    // A saved configuration can become active after restarting or launching
    // elsewhere. Derive ownership from the frozen attempt, not a past save.
    const draftState =
      changes.length || invalid
        ? t('Draft', 'Чернетка')
        : usedByFlight
          ? t('Used by this flight', 'Використовується цим польотом')
          : t('Saved for next flight', 'Збережено для наступного польоту');
    workbench.summary(
      `${setupName.value} · ${profileName.value} · ${changes.length} ${t('changes', 'змін')}${invalid ? ` · ${invalid} ${t('unfinished values', 'незавершених значень')}` : ''} · ${draftState}`,
    );
    changesList.replaceChildren();
    for (const change of changes)
      el(
        'li',
        `${{ aircraft: t('Aircraft', 'Дрон'), rates: t('Rates', 'Рейти'), controller: t('Controller', 'Контролер'), camera: t('Camera', 'Камера') }[change.group]} · ${change.path.split('.').slice(-2).join(' ')}: ${JSON.stringify(change.before) ?? '—'} → ${JSON.stringify(change.after) ?? '—'}`,
        changesList,
        false,
      );
    if (setup.camera.tilt !== null && setup.camera.verticalFov !== null)
      paintCameraFraming(doc, cameraSvg, setup.camera.tilt, setup.camera.verticalFov, t);
    if (setup.advanced?.aircraft.format === 'AdvancedAircraft.v2') {
      const aircraft = setup.advanced.aircraft;
      const figure = createAircraftPreview({
        document: doc,
        aircraft,
        name: setup.name,
        wheelbaseMm: Math.round(aircraft.armLength * 2000),
        locale: locale(),
      });
      draftAircraftView.replaceChildren(figure);
      const perf = aircraftPerformance(aircraft);
      el(
        'p',
        `${t('Current draft', 'Поточна чернетка')}: ${(aircraft.mass * 1000).toFixed(2)} g · ${t('Hover', 'Зависання')} ${perf.hoverThrottle === null ? '—' : `${(perf.hoverThrottle * 100).toFixed(1)}%`} · ${t('Thrust / weight', 'Тяга / вага')} ${perf.thrustToWeight.toFixed(2)}`,
        draftAircraftView,
        false,
      );
      const geometryKey = JSON.stringify({
        id: aircraft.id,
        name: setup.name,
        geometry: aircraft.geometry,
        armLength: aircraft.armLength,
        locale: locale(),
      });
      if (!quad.firstChild || quad.dataset.geometry !== geometryKey) {
        const preview = createAircraftPreview({
          document: doc,
          aircraft,
          name: setup.name,
          wheelbaseMm: Math.round(aircraft.armLength * 2000),
          locale: locale(),
        });
        quad.replaceChildren(preview.querySelector('svg'));
        quad.dataset.geometry = geometryKey;
      }
    } else {
      draftAircraftView.replaceChildren();
      const key = `legacy-generic:${locale()}`;
      if (quad.dataset.geometry !== key) {
        // This illustrates the commanded axes, not a measured Legacy airframe.
        const diagram = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        diagram.setAttribute('viewBox', '0 0 180 120');
        diagram.setAttribute('role', 'img');
        diagram.setAttribute(
          'aria-label',
          t(
            'Generic commanded rotation · illustrative geometry',
            'Умовний перегляд заданого обертання · ілюстративна геометрія',
          ),
        );
        const part = (tag, attributes) => {
          const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
          for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
          diagram.append(node);
        };
        part('path', {
          d: 'M48 30 L132 90 M48 90 L132 30',
          stroke: '#91a7ba',
          'stroke-width': '7',
          fill: 'none',
        });
        for (const [cx, cy] of [
          [48, 30],
          [132, 30],
          [48, 90],
          [132, 90],
        ])
          part('circle', { cx, cy, r: '18', fill: 'none', stroke: '#55c8a4', 'stroke-width': '3' });
        part('rect', {
          x: '77',
          y: '39',
          width: '26',
          height: '42',
          rx: '5',
          fill: '#304f68',
          stroke: '#edf5ff',
        });
        part('path', {
          d: 'M90 40 V17 M84 24 L90 17 L96 24',
          stroke: '#f1ca72',
          'stroke-width': '3',
          fill: 'none',
        });
        quad.replaceChildren(diagram);
        quad.dataset.geometry = key;
      }
    }
    workbench.refresh();
    const nextSignature = JSON.stringify({ setup, response: draft, raw: captureEditorState() });
    if (nextSignature !== benchSignature) {
      benchSignature = nextSignature;
      responseBench?.invalidate();
      controllerTunes?.refresh();
    }
  }
  function comparisonConfiguration({ saved = false } = {}) {
    if (!library || !draft) return null;
    if (!saved && root.querySelector('[aria-invalid="true"]'))
      throw new Error(
        t(
          'Complete valid draft values before comparison.',
          'Перед порівнянням введіть коректні значення чернетки.',
        ),
      );
    const baseline = saved ? completeDraft.baseline() : null;
    const setup = baseline?.setup ?? readSetup(false);
    return {
      format: 'FpvEffectiveFlightConfig.v1',
      response: clone(baseline?.profile.response ?? draft),
      camera: clone(setup.camera),
      setupId: setup.id,
      profileId: baseline?.profile.sourceId ?? selected,
      ...(setup.advanced ? { advanced: clone(setup.advanced) } : {}),
    };
  }
  function useController(controller) {
    const configuration = physics.read();
    if (!configuration)
      throw new Error(t('Select a compatible aircraft first.', 'Спочатку оберіть сумісний дрон.'));
    configuration.controller = clone(controller);
    const raw = Object.fromEntries(
      Object.entries(physics.raw()).filter(([path]) => !path.startsWith('controller.')),
    );
    physics.load(configuration, physicalBaseline(currentSetup()), raw);
    updateWorkbench();
    workbench.show('controller');
    status.textContent = t(
      'Controller values copied into the draft. Test, compare and save when ready.',
      'Значення контролера скопійовано в чернетку. Перевірте, порівняйте й збережіть, коли будете готові.',
    );
  }
  controllerTunes = createControllerTunePanel({
    document: doc,
    window: win,
    locale,
    getConfiguration: () => comparisonConfiguration(),
    onUse: useController,
    report,
    platformOptions,
  });
  workbench.panel('library').append(controllerTunes.root);
  action(
    t('Choose or save a controller tune', 'Вибрати або зберегти налаштування контролера'),
    () => {
      workbench.show('library');
      const title = controllerTunes.root.querySelector('h3');
      title.tabIndex = -1;
      title.focus();
      title.scrollIntoView?.({ block: 'start' });
    },
    workbench.panel('controller'),
  );
  responseBench = mountResponseBenchPanel({
    document: doc,
    window: win,
    locale,
    report,
    getSaved: () => comparisonConfiguration({ saved: true }),
    getDraft: () => comparisonConfiguration(),
    onUse: useController,
    workerURL: responseBenchWorkerURL,
    getInputReadiness: () => ({
      ready: inputReviewed.checked && inputReviewSignature === readinessSignature(),
    }),
    getPracticeConditions,
    onManualTest(configuration) {
      remember();
      testing = true;
      draftFlightActive = true;
      returnButton.hidden = false;
      close();
      onTest(clone(configuration));
    },
  });
  workbench.panel('controller').append(responseBench.root);
  function workbenchEdit(event) {
    if (controllerTunes.root.contains(event.target) || responseBench.root.contains(event.target))
      return;
    updateWorkbench();
  }
  listen(root, 'input', workbenchEdit);
  listen(root, 'change', workbenchEdit);
  // Keep typing and adjustment keys inside the modal; Escape still uses dialog cancel.
  listen(root, 'keydown', (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) event.stopPropagation();
  });
  doc.body.append(root);
  return Object.freeze({
    root,
    returnButton,
    open,
    close,
    acceptOwnSave,
    endDraftTest,
    captureActive: () => root.open && capturePreview.checked,
    releaseCapture() {
      capturePreview.checked = false;
      paintCaptureStatus();
      capturePreview.focus();
    },
    async savePracticeDraft(advanced, metadata = {}) {
      remember();
      if (metadata.response) {
        draft = clone(metadata.response);
        algorithmDrafts = {};
        numericDrafts = {};
      }
      if (metadata.camera) {
        tilt.value = String(metadata.camera.tilt);
        fov.value = String(metadata.camera.fov);
      }
      editedSetup = {
        ...clone(currentSetup()),
        advanced: clone(advanced),
        ...(metadata.preset ? { preset: clone(metadata.preset) } : {}),
      };
      if (metadata.components !== undefined) {
        editedSetup.components = clone(metadata.components);
        componentInventory = clone(metadata.components);
      }
      physics.load(advanced, advanced);
      remember();
      const pending = setupDrafts.get(editedSetupId);
      pending.advanced = clone(advanced);
      pending.components = clone(componentInventory);
      delete pending.componentsText;
      load(selected);
      await save();
    },
    button(parent) {
      // Safari does not focus buttons on pointer activation. Keep the actual
      // trigger so closing the modal restores keyboard navigation to it.
      const node = action(
        t('Aircraft, rates & throttle', 'Дрон, рейти й газ'),
        () => open({ openerElement: node }),
        parent ?? null,
      );
      node.dataset.fpvTuning = '';
      buttons.push(node);
      return node;
    },
    refresh() {
      if (disposed) return;
      for (const [node, pair] of textBindings) {
        const value = t(...pair);
        if (node.firstChild?.nodeType === 3) node.firstChild.textContent = value;
        else {
          const children = Array.from(node.children);
          node.textContent = value;
          node.append(...children);
        }
      }
      for (const { node, name, pair } of attributeBindings) node.setAttribute(name, t(...pair));
      paintCaptureStatus();
      controllerTunes?.refresh();
      responseBench?.refresh();
      paintImportReview();
      const pair = translations.get(status.textContent);
      if (pair) status.textContent = t(...pair);
      if (library && !busy) {
        const pendingAssignment = assignment.value;
        paintAssignment();
        assignment.value = pendingAssignment;
        paintFields();
        paintAircraft();
        paintComponents();
        paintLibraryPreviews();
        updateWorkbench();
      }
      workbench?.refresh();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseCurvePointer();
      responseBench?.dispose();
      controllerTunes?.dispose();
      if (frame !== null) win.cancelAnimationFrame(frame);
      for (const remove of removers) remove();
      for (const button of buttons) button.remove();
      returnButton.remove();
      root.remove();
    },
  });
}
