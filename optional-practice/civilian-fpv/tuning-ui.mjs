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
import { exportJSONFile, exportTextFile } from '../../game/platform.mjs';
import {
  previewBetaflightImport,
  previewNativeRateImport,
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
  translatedAttribute(root, 'aria-label', t('Aircraft, rates & throttle', 'Дрон, рейти й газ'));
  const removers = [],
    buttons = [],
    drafts = new Map(),
    setupDrafts = new Map();
  let library,
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
    imported = null,
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
    translatedAttribute(input, 'aria-label', label);
    return input;
  };
  const select = (label, choices, parent = root) => {
    const wrap = el('label', label, parent),
      input = el('select', undefined, wrap);
    translatedAttribute(input, 'aria-label', label);
    for (const [value, text] of choices) {
      const option = el('option', text, input);
      option.value = value;
    }
    return input;
  };
  const heading = el('h2', t('Aircraft, rates & throttle', 'Дрон, рейти й газ'));
  heading.tabIndex = -1;
  el(
    'p',
    t(
      'Profiles on this device. Rates control requested rotation; the aircraft determines how quickly it follows.',
      'Профілі на цьому пристрої. Рейти визначають задане обертання, а модель дрона — його реакцію.',
    ),
  );
  const status = el('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  function report(failure) {
    status.textContent = `${t('Could not apply: ', 'Не вдалося застосувати: ')}${failure.message}`;
  }
  function clearImportPreview() {
    imported = null;
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
  const aircraftSelect = select(
    t('Aircraft preset', 'Пресет дрона'),
    listAircraftPresets().map((p) => [p.id, `${p.name} · ${p.variant}`]),
    aircraftPanel,
  );
  aircraftSelect.value = listAircraftPresets()[0].id;
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
  const aircraftEvidence = el('details', undefined, aircraftPanel);
  el(
    'summary',
    t('Specifications and model evidence', 'Характеристики й дані моделі'),
    aircraftEvidence,
  );
  const aircraftDetails = el('div', undefined, aircraftEvidence);
  function paintAircraft() {
    const preset = getAircraftPreset(aircraftSelect.value);
    aircraftSummary.textContent = `${preset.flyingMassGrams} ${t('g flying weight', 'г польотної маси')} · ${preset.propellerDiameterMm} ${t('mm propellers', 'мм пропелери')} · ${preset.wheelbaseMm} ${t('mm wheelbase', 'мм база')} · ${preset.battery.name}`;
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
    const performance = aircraftPerformance(createPresetConfiguration(preset.id).aircraft);
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
      calculated: t('Calculated', 'Розраховано'),
      estimated: t('Estimated', 'Оцінка'),
    };
    const fields = {
      assembledMass: t('Assembled mass', 'Маса зібраного дрона'),
      batteryMass: t('Battery mass', 'Маса батареї'),
      inertia: t('Inertia', 'Інерція'),
      propulsion: t('Propulsion', 'Тяга й двигуни'),
      drag: t('Aerodynamic drag', 'Аеродинамічний опір'),
    };
    for (const [field, label] of Object.entries(fields))
      el('p', `${label}: ${kinds[preset.evidence[field].kind]}`, aircraftDetails, false);
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
  async function useAircraft({ reset = false } = {}) {
    if (rateChoice.value === 'keep') commitNumericInputs();
    remember();
    const setup = library.setups.find((item) => item.id === library.selectedSetupId);
    if (reset && !setup.preset)
      throw new Error(
        t(
          'This setup has no built-in preset to restore.',
          'Ці налаштування не мають вбудованого пресету для відновлення.',
        ),
      );
    const profileId = id();
    await mutate(() =>
      store.createPresetSetup(
        {
          presetId: reset ? setup.preset.id : aircraftSelect.value,
          setupId: reset ? setup.id : id(),
          profileId,
          rates: rateChoice.value,
          ...(reset ? { replace: true } : {}),
          ...(rateChoice.value === 'keep'
            ? {
                response: clone(draft),
                ...(currentReceipt() ? { provenance: clone(currentReceipt()) } : {}),
              }
            : {}),
        },
        library.revision,
      ),
    );
    if (reset) setupDrafts.delete(setup.id);
    load(profileId);
    onSaved(store.effective());
    status.textContent = t(
      'Aircraft saved for the next flight. Choose Apply & restart to fly it now.',
      'Дрон збережено для наступного польоту. Виберіть «Застосувати й перезапустити», щоб полетіти зараз.',
    );
  }
  action(t('Use this aircraft', 'Використати цей дрон'), () => useAircraft(), aircraftPanel);
  action(
    t('Reset saved aircraft to its preset', 'Скинути збережений дрон до його пресету'),
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
  const visibility = Object.fromEntries(
    axes.map((axis) => {
      const box = field(axisName(axis), 'checkbox', preview);
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
  const readouts = el('pre', undefined, preview);
  const demonstration = el('div', undefined, preview);
  demonstration.className = 'tuning-demonstration';
  const quad = el('div', '✚', demonstration);
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
    const setup = library.setups.find((item) => item.id === library.selectedSetupId);
    return applyAircraftComponents(setup.advanced.aircraft, componentInventory, {
      battery,
      cameraPayload,
    });
  }
  function paintComponents() {
    componentPanel.hidden = !componentInventory;
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
  action(
    t('Save battery & physical camera', 'Зберегти акумулятор і фізичну камеру'),
    async () => {
      const setup = readSetup();
      await mutate(() => store.saveSetup(setup, editRevision));
      setupDrafts.delete(setup.id);
      load(selected);
      onSaved(store.effective());
      status.textContent = t(
        'Components saved for the next flight. Use Apply & restart to fly them now.',
        'Компоненти збережено для наступного польоту. Натисніть «Застосувати й перезапустити», щоб випробувати їх зараз.',
      );
    },
    componentPanel,
  );
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
      if (
        library.setups.find((setup) => setup.id === library.selectedSetupId)?.advanced?.aircraft
          .format === 'AdvancedAircraft.v2'
      )
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
    t('Save drone assignment & camera', 'Зберегти профіль і камеру дрона'),
    async () => {
      const setup = readSetup();
      await mutate(() => store.saveSetup(setup, editRevision));
      setupDrafts.delete(setup.id);
      onSaved(store.effective());
    },
    setupPanel,
  );
  action(
    t('Duplicate drone setup', 'Дублювати налаштування дрона'),
    async () => {
      remember();
      const setup = readSetup();
      setup.id = id();
      setup.name += ` ${t('copy', 'копія')}`;
      await mutate(() => store.createAndSelectSetup(setup, library.revision));
      load(selected);
      status.textContent = t(
        'Drone setup duplicated and selected.',
        'Налаштування дрона продубльовано й вибрано.',
      );
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
  const importReview = el('pre', undefined, transfer);
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
  function showImport(result) {
    imported = result;
    importReview.textContent = JSON.stringify(result, null, 2);
    draft = createTunedResponse(result.profile, draft);
    draftProvenance = clone(result.provenance);
    algorithmDrafts = {};
    numericDrafts = {};
    paintFields();
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
        showImport(result);
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
      importReview.textContent = JSON.stringify(result, null, 2);
      clearImportPreview();
      status.textContent = t(
        'Review options, resolve again after changes, then preview the patch against its baseline.',
        'Перевірте опції, повторно розгорніть після змін і перегляньте патч на вибраній основі.',
      );
    },
    transfer,
  );
  function portable() {
    commitNumericInputs();
    if (draft.format !== TUNED_RESPONSE_FORMAT)
      throw new Error(
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
      drafts.clear();
      setupDrafts.clear();
      load();
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
    await mutate(() => store.saveEditing(profileId, changes, setup, revision));
    if (disposed) return;
    drafts.delete(profileId);
    setupDrafts.delete(setup.id);
    load(profileId);
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
      setupDrafts.delete(library.selectedSetupId);
      algorithmDrafts = {};
      load(selected);
    },
    actions,
  );
  action(
    t('Refresh library', 'Оновити бібліотеку'),
    () => {
      drafts.clear();
      setupDrafts.clear();
      store.refresh();
      load();
    },
    actions,
  );
  if (onAdvanced)
    action(
      t('Advanced reference quad · experimental', 'Еталонний дрон Advanced · експериментальний'),
      () => {
        const setup = readSetup();
        if (setup.advanced?.aircraft.format === 'AdvancedAircraft.v2') commitNumericInputs();
        else portable();
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
      setupDrafts.set(library.selectedSetupId, {
        name: setupName.value,
        profileId: assignment.value || null,
        // A draft may be incomplete. Keep its text rather than coercing an
        // empty camera field to zero or discarding it during navigation.
        cameraText: { tilt: tilt.value, verticalFov: fov.value },
        componentsText: componentInventory ? componentText() : null,
        batteryDepletion: batteryDepletion.checked,
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
  function load(profileId) {
    clearImportPreview();
    uploadGeneration++;
    library = store.snapshot();
    const setup = library.setups.find((item) => item.id === library.selectedSetupId);
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
      library.setups.map((p) => [p.id, p.name]),
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
    componentInventory = setup.components ? clone(setup.components) : null;
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
    const error = store.status().error;
    if (error) report(new Error(error));
    else if (editRevision !== library.revision)
      status.textContent = t(
        'This draft predates a library change. Export it before refreshing; saving over newer settings is blocked.',
        'Ця чернетка старіша за зміну бібліотеки. Експортуйте її перед оновленням; перезапис новіших налаштувань заблоковано.',
      );
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
  function readSetup() {
    const setup = {
      ...clone(library.setups.find((setup) => setup.id === library.selectedSetupId)),
      id: library.selectedSetupId,
      name: setupName.value,
      profileId: assignment.value || null,
      camera: { tilt: cameraValue(tilt), verticalFov: cameraValue(fov) },
    };
    const components = readComponents();
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
    if (editRevision === previousRevision) editRevision = library.revision;
    for (const cached of drafts.values())
      if (cached.baseRevision === previousRevision) cached.baseRevision = library.revision;
    for (const cached of setupDrafts.values())
      if (cached.baseRevision === previousRevision) cached.baseRevision = library.revision;
    if (reloadAircraft) {
      const setup = library.setups.find((item) => item.id === library.selectedSetupId);
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
    remember();
    load(profileSelect.value);
  });
  listen(setupSelect, 'change', () => {
    remember();
    void mutate(() => store.selectSetup(setupSelect.value, library.revision))
      .then(() => {
        load();
        onSaved(store.effective());
      })
      .catch((failure) => {
        setupSelect.value = library.selectedSetupId;
        report(failure);
      });
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
    number(
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
  function paintPreview() {
    if (!draft) return;
    try {
      paintReceipt();
      evaluator = compile(draft);
      savedEvaluator = compile(library.profiles.find((p) => p.id === selected).response);
      svg.replaceChildren();
      const maximum = Math.max(
        1,
        ...axes.flatMap((axis) => [evaluator.rate(axis, 1), savedEvaluator.rate(axis, 1)]),
      );
      for (const [i, axis] of axes.entries())
        if (visibility[axis].checked) {
          for (const [engine, dashed] of [
            [savedEvaluator, true],
            [evaluator, false],
          ]) {
            const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute(
              'd',
              Array.from(
                { length: 101 },
                (_, x) =>
                  `${x ? 'L' : 'M'}${20 + x * 5.6},${190 - (engine.rate(axis, x / 100) / maximum) * 175}`,
              ).join(' '),
            );
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', colors[i]);
            path.setAttribute('stroke-width', '2');
            if (dashed) path.setAttribute('stroke-dasharray', '5 4');
            svg.append(path);
          }
        }
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
    if (motion.checked && evaluator && previousTime !== null)
      angle =
        (angle +
          evaluator.rate(previewAxis.value, Number(previewStick.value) / 100) *
            Math.min(0.05, (time - previousTime) / 1000)) %
        360;
    previousTime = time;
    const rotation =
      previewAxis.value === 'roll'
        ? 'rotateZ'
        : previewAxis.value === 'pitch'
          ? 'rotateX'
          : 'rotateY';
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
      diagnostics.textContent = `${t('Input source', 'Джерело вводу')}: ${source}\n${context}\n${t('Raw input', 'Сире введення')}: ${JSON.stringify(available(info.raw))}\n${t('Calibrated', 'Каліброване')}: ${JSON.stringify(available(info.calibrated))}\n${t('Requested rotation (draft °/s)', 'Задане обертання (чернетка °/с)')}: ${JSON.stringify(available(requested))}\n${t('Achieved rotation (last committed flight °/s)', 'Досягнуте обертання (останній прийнятий крок польоту °/с)')}: ${JSON.stringify(available(info.achieved))}\n${t('Flight tick', 'Крок польоту')}: ${available(info.flightTick)}\n${t('Browser sample age (ms)', 'Вік зразка браузера (мс)')}: ${available(info.sampleAgeMs)} · ${t('Observed timestamp cadence (Hz)', 'Спостережувана частота міток (Гц)')}: ${available(info.cadenceHz)}`;
    }
    frame = win.requestAnimationFrame(animate);
  }
  function open({ keepDraft = false, openerElement = doc.activeElement } = {}) {
    if (disposed || busy) return;
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
    clearImportPreview();
    remember();
    if (root.open) root.close();
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    returnButton.hidden = !draftFlightActive;
    onClose({ testing });
    if (opener?.isConnected) opener.focus();
  }
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
  doc.body.append(root);
  return Object.freeze({
    root,
    returnButton,
    open,
    close,
    acceptOwnSave,
    endDraftTest,
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
      const pair = translations.get(status.textContent);
      if (pair) status.textContent = t(...pair);
      if (library && !busy) {
        const pendingAssignment = assignment.value;
        paintAssignment();
        assignment.value = pendingAssignment;
        paintFields();
        paintAircraft();
        paintComponents();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame !== null) win.cancelAnimationFrame(frame);
      for (const remove of removers) remove();
      for (const button of buttons) button.remove();
      returnButton.remove();
      root.remove();
    },
  });
}
