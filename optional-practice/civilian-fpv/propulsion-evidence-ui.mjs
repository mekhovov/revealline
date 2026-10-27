import {
  PROPULSION_EVIDENCE_FIELDS,
  PROPULSION_EVIDENCE_LIMITS,
  createPropulsionEvidenceEvaluator,
  createSyntheticPropulsionEvidence,
} from './propulsion-evidence.mjs';
import { solvePropulsionEvidenceLoad } from './propulsion-load.mjs';
import {
  validateAircraftPhysics,
  aircraftMotorPoint,
  aircraftMotorSpeedForThrust,
} from './aircraft-physics.mjs';

/** Inspection only. The host supplies a current aircraft but no write callback.
 * Source text is inert and asynchronous imports cannot replace a newer choice. */
export function mountPropulsionEvidencePanel({
  parent,
  locale = () => 'en',
  getAircraft = () => null,
} = {}) {
  const doc = parent.ownerDocument;
  const root = doc.createElement('details');
  root.className = 'propulsion-evidence-panel';
  root.style.overflowWrap = 'anywhere';
  parent.append(root);
  const t = (en, uk) => ((typeof locale === 'function' ? locale() : locale) === 'uk' ? uk : en);
  const create = (tag, container = root) => {
    const node = doc.createElement(tag);
    container.append(node);
    return node;
  };
  const heading = create('summary'),
    intro = create('p');
  const fileLabel = create('label'),
    fileText = create('span', fileLabel),
    file = create('input', fileLabel);
  file.type = 'file';
  file.accept = '.json,application/json';
  // World hides its own file inputs; this standalone inspection control must
  // remain visible and keyboard reachable in either host.
  file.style.display = 'block';
  file.style.maxWidth = '100%';
  file.dataset.action = 'import-file';
  const pasteLabel = create('label'),
    pasteText = create('span', pasteLabel),
    paste = create('textarea', pasteLabel);
  paste.rows = 4;
  paste.style.display = 'block';
  paste.style.width = '100%';
  paste.style.boxSizing = 'border-box';
  paste.maxLength = PROPULSION_EVIDENCE_LIMITS.maxBytes;
  paste.spellcheck = false;
  paste.dataset.action = 'paste-data';
  const buttons = create('div'),
    importButton = create('button', buttons),
    demoButton = create('button', buttons);
  importButton.type = demoButton.type = 'button';
  importButton.dataset.action = 'import-paste';
  demoButton.dataset.action = 'synthetic-demo';
  const status = create('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.dataset.role = 'import-status';
  const content = create('div');
  content.hidden = true;
  const datasetName = create('h4', content),
    provenance = create('p', content);
  provenance.dataset.role = 'provenance';
  const metadata = create('details', content),
    metadataHeading = create('summary', metadata),
    metadataList = create('dl', metadata);
  metadataList.dataset.role = 'metadata';
  const coverage = create('p', content);
  coverage.dataset.role = 'coverage';
  const valueLabel = create('label', content),
    valueText = create('span', valueLabel),
    valueInput = create('input', valueLabel);
  valueInput.type = 'number';
  valueInput.step = 'any';
  valueInput.dataset.action = 'axis-value';
  const evaluateButton = create('button', content);
  evaluateButton.type = 'button';
  evaluateButton.dataset.action = 'evaluate';
  const pointStatus = create('p', content);
  pointStatus.setAttribute('role', 'status');
  pointStatus.setAttribute('aria-live', 'polite');
  pointStatus.dataset.role = 'point-status';
  const output = create('div', content);
  output.style.overflowX = 'auto';
  const table = create('table', output),
    caption = create('caption', table),
    tableHead = create('thead', table),
    tableBody = create('tbody', table);
  const missing = create('p', content),
    uncertainty = create('p', content),
    power = create('p', content);
  missing.dataset.role = 'missing';
  uncertainty.dataset.role = 'uncertainty';
  power.dataset.role = 'power';
  const checks = create('ul', content);
  checks.dataset.role = 'diagnostics';
  const comparisonHeading = create('h4', content),
    comparison = create('p', content),
    comparisonNote = create('p', content);
  comparison.dataset.role = 'comparison';
  const load = create('fieldset', content),
    loadHeading = create('legend', load),
    loadIntro = create('p', load);
  const loadField = (action, max) => {
    const label = create('label', load),
      text = create('span', label),
      input = create('input', label);
    label.style.display = 'block';
    input.type = 'number';
    input.min = '0';
    input.max = String(max);
    input.step = 'any';
    input.dataset.action = action;
    return { text, input };
  };
  const openVoltage = loadField('load-open-voltage', 1000),
    resistance = loadField('load-resistance', 1000),
    copies = loadField('load-copies', 4),
    currentLimit = loadField('load-current-limit', 40000);
  copies.input.min = '1';
  copies.input.step = '1';
  copies.input.value = '1';
  const basisLabel = create('label', load),
    basis = create('input', basisLabel),
    basisText = create('span', basisLabel);
  basis.type = 'checkbox';
  basis.checked = false;
  basis.dataset.action = 'load-current-basis';
  const calculate = create('button', load);
  calculate.type = 'button';
  calculate.dataset.action = 'calculate-load';
  const loadStatus = create('p', load),
    loadSource = create('p', load),
    loadValues = create('dl', load),
    loadLimits = create('p', load);
  loadStatus.dataset.role = 'load-status';
  loadStatus.setAttribute('role', 'status');
  loadStatus.setAttribute('aria-live', 'polite');
  loadSource.dataset.role = 'load-source';
  loadValues.dataset.role = 'load-values';
  loadLimits.dataset.role = 'load-limits';
  const disposers = [];
  let evaluator = null,
    loadResult = null,
    loadStatusCode = 'idle',
    disposed = false,
    generation = 0,
    statusCode = 'idle';
  function listen(node, type, callback) {
    node.addEventListener(type, callback);
    disposers.push(() => node.removeEventListener(type, callback));
  }
  const number = (value) =>
    value === null || !Number.isFinite(value)
      ? t('Unavailable', 'Недоступно')
      : String(Number(value.toPrecision(7)));
  const fieldName = (field) =>
    ({
      command: t('ESC command', 'Команда ESC'),
      rpm: t('Motor speed', 'Обертова швидкість мотора'),
      voltage: t('Voltage', 'Напруга'),
      airspeed: t('Airspeed', 'Швидкість потоку повітря'),
      thrust: t('Thrust', 'Тяга'),
      torque: t('Shaft torque', 'Крутний момент вала'),
      current: t('Current', 'Струм'),
    })[field];
  const unavailable = () => t('Unavailable', 'Недоступно');
  const loadNumber = (value) => (Number.isFinite(value) ? String(value) : unavailable());
  function renderLoad() {
    loadHeading.textContent = t('Battery load calculation', 'Розрахунок навантаження батареї');
    loadIntro.textContent = t(
      'Use the imported voltage sweep at its fixed ESC command. Enter hypothetical battery inputs manually; nothing is taken from or applied to an aircraft.',
      'Використайте імпортований ряд напруг за сталої команди ESC. Введіть гіпотетичні параметри батареї вручну; налаштування дрона не використовуються й не змінюються.',
    );
    openVoltage.text.textContent = t('Open-circuit voltage (V)', 'Напруга без навантаження (В)');
    resistance.text.textContent = t('Series resistance (Ω)', 'Послідовний опір (Ом)');
    copies.text.textContent = t(
      'Identical independent copies of this one-rotor path (1–4)',
      'Однакові незалежні копії цього ряду даних одного ротора (1–4)',
    );
    currentLimit.text.textContent = t(
      'Optional total-current warning threshold (A; blank for none)',
      'Необов’язковий поріг попередження про сумарний струм (А; можна залишити порожнім)',
    );
    basisText.textContent = t(
      'I declare that the source current is DC input current at the recorded terminal voltage, not motor phase current.',
      'Я заявляю, що струм джерела є вхідним постійним струмом за зафіксованої напруги на клемах, а не фазним струмом мотора.',
    );
    calculate.textContent = t('Calculate load', 'Розрахувати навантаження');
    calculate.disabled = !evaluator || evaluator.axis.field !== 'voltage';
    loadLimits.textContent = t(
      'Calculated central values only; displayed digits do not establish measurement accuracy. Battery voltage and resistance stay fixed; identical loads share one bus without interactions. Current basis is your declaration; measurement wiring is unverified. Uncertainty is not propagated. No command-to-RPM conversion, aircraft prediction, battery discharge or current regulation is modeled.',
      'Лише розраховані центральні значення; кількість показаних цифр не визначає точність вимірювання. Напруга батареї та опір сталі; однакові навантаження мають спільне живлення без взаємного впливу. Тип струму визначено вашою заявою; схему вимірювання не перевірено. Поширення похибок не розраховується. Перетворення команди на оберти, поведінка дрона, розряд батареї та регулювання струму не моделюються.',
    );
    const reasons = {
      'voltage-axis-required': t(
        'A voltage-axis dataset is required; command and RPM sweeps cannot be reinterpreted.',
        'Потрібні дані з віссю напруги; ряди команд або обертів не можна переінтерпретувати.',
      ),
      'single-rotor-required': t(
        'The dataset must describe one rotor, not a whole aircraft or unknown scope.',
        'Дані мають описувати один ротор, а не весь дрон чи невідомий об’єкт.',
      ),
      'static-flow-required': t(
        'Static-air conditions are required.',
        'Потрібні умови нерухомого повітря.',
      ),
      'known-zero-airspeed-required': t(
        'Every sample must have known zero airspeed.',
        'Кожна точка має містити відому нульову швидкість потоку.',
      ),
      'command-unavailable': t(
        'Every sample must include the ESC command.',
        'Кожна точка має містити команду ESC.',
      ),
      'fixed-command-required': t(
        'The ESC command must stay constant throughout the voltage sweep.',
        'Команда ESC має бути сталою в усьому ряді напруг.',
      ),
      'current-unavailable': t(
        'Current is required at every sample.',
        'Струм потрібен у кожній точці.',
      ),
      'negative-current': t(
        'Negative current is unsupported for this load calculation.',
        'Від’ємний струм не підтримується цим розрахунком навантаження.',
      ),
      'nonmonotone-current': t(
        'Current must not decrease as voltage increases, including across coverage gaps.',
        'Струм не має зменшуватися зі збільшенням напруги, зокрема між розривами даних.',
      ),
      'no-common-coverage': t(
        'The paths have no common voltage coverage.',
        'Ряди даних не мають спільного діапазону напруг.',
      ),
      'root-below-coverage': t(
        'The solution lies below documented voltage coverage; no extrapolation is used.',
        'Розв’язок нижче задокументованого діапазону напруг; екстраполяція не застосовується.',
      ),
      'root-above-coverage': t(
        'The solution lies above documented voltage coverage; no extrapolation is used.',
        'Розв’язок вище задокументованого діапазону напруг; екстраполяція не застосовується.',
      ),
      'root-in-coverage-gap': t(
        'The solution falls in a gap in the source coverage; no interpolation across gaps is used.',
        'Розв’язок потрапляє в розрив даних джерела; інтерполяція через розриви не застосовується.',
      ),
      'numerical-resolution': t(
        'Numerical precision cannot resolve this operating point reliably.',
        'Числова точність не дозволяє надійно визначити цю робочу точку.',
      ),
    };
    const reason =
      evaluator?.axis.field !== 'voltage'
        ? reasons['voltage-axis-required']
        : loadResult?.status === 'unavailable'
          ? reasons[loadResult.reason]
          : null;
    loadStatus.textContent = reason
      ? `${unavailable()}: ${reason}`
      : loadResult?.status === 'limit-exceeded'
        ? t(
            'Warning threshold exceeded. The calculated current is not clipped or regulated.',
            'Поріг попередження перевищено. Розрахований струм не обрізається й не регулюється.',
          )
        : loadResult?.status === 'solved'
          ? t(
              'Calculated operating point within documented coverage.',
              'Розрахована робоча точка в задокументованих межах даних.',
            )
          : loadStatusCode === 'invalid'
            ? t(
                'Enter finite voltage and resistance from 0 to 1000, an integer copy count from 1 to 4, and an optional current threshold from 0 to 40000. Confirm the source current basis.',
                'Введіть скінченні напругу та опір від 0 до 1000, цілу кількість копій від 1 до 4 та необов’язковий поріг струму від 0 до 40000. Підтвердьте тип струму джерела.',
              )
            : t(
                'Enter the manual inputs, confirm the source current basis, then calculate. Results clear when inputs or the dataset change.',
                'Введіть параметри вручну, підтвердьте тип струму джерела й запустіть розрахунок. Результати очищуються після зміни параметрів або набору даних.',
              );
    loadStatus.setAttribute('role', loadStatusCode === 'invalid' ? 'alert' : 'status');
    loadSource.textContent = '';
    loadValues.replaceChildren();
    if (!loadResult) return;
    const kind = {
      measured: t('source declares measured data', 'джерело декларує виміряні дані'),
      calculated: t('calculated source data', 'розраховані дані джерела'),
      synthetic: t(
        'synthetic source data, invented values',
        'синтетичні дані джерела, вигадані значення',
      ),
    }[evaluator.evidence.source.kind];
    const inputs = loadResult.inputs;
    loadSource.textContent = `${evaluator.evidence.name} — ${kind}. ${t('Manual model', 'Модель із ручними параметрами')}: ${loadNumber(inputs.openVoltage)} V, ${loadNumber(inputs.resistance)} Ω; ${t('identical independent copies', 'однакові незалежні копії')}: ${loadResult.sources.length}.`;
    if (inputs.currentLimit !== null)
      loadSource.textContent += ` ${t('Warning threshold', 'Поріг попередження')}: ${loadNumber(inputs.currentLimit)} A.`;
    const point = loadResult.operatingPoint;
    if (!point) return;
    const path = point.paths[0];
    loadSource.textContent += ` ${
      path.status === 'sample'
        ? t('Uses an original source sample.', 'Використано початкову точку джерела.')
        : t(
            'Uses linear interpolation within one covered interval.',
            'Використано лінійну інтерполяцію в одному задокументованому інтервалі.',
          )
    }`;
    for (const [label, value, unit] of [
      [t('Fixed ESC command', 'Стала команда ESC'), path.values.command, evaluator.units.command],
      [t('Terminal voltage', 'Напруга на клемах'), point.voltage, 'V'],
      [t('Total DC input current', 'Сумарний вхідний постійний струм'), point.current, 'A'],
      [
        t('Power at open-circuit voltage', 'Потужність за напруги без навантаження'),
        inputs.openVoltage * point.current,
        'W',
      ],
      [
        t('Power delivered to loads', 'Потужність, передана навантаженням'),
        point.electricalWatts,
        'W',
      ],
      [t('Series-resistance loss', 'Втрати на послідовному опорі'), point.batteryLossWatts, 'W'],
      [
        t(
          'Equation residual V + R × I − open voltage',
          'Нев’язка рівняння V + R × I − напруга без навантаження',
        ),
        point.residualVolts,
        'V',
      ],
      [
        t('Numerical residual tolerance', 'Числовий допуск нев’язки'),
        point.residualToleranceVolts,
        'V',
      ],
      [
        t('Current per identical path', 'Струм на один однаковий ряд даних'),
        path.values.current,
        'A',
      ],
      [t('Thrust per identical path', 'Тяга на один однаковий ряд даних'), path.values.thrust, 'N'],
      [
        t('Shaft torque per identical path', 'Крутний момент вала на один однаковий ряд даних'),
        path.values.torque,
        'N·m',
      ],
    ]) {
      create('dt', loadValues).textContent = `${label} (${unit})`;
      create('dd', loadValues).textContent = loadNumber(value);
    }
  }
  function clearLoad() {
    if (disposed) return;
    loadResult = null;
    loadStatusCode = 'idle';
    renderLoad();
  }
  function calculateLoad() {
    if (disposed || !evaluator) return;
    clearLoad();
    if (evaluator.axis.field !== 'voltage') return;
    const voltage = openVoltage.input.value.trim(),
      ohms = resistance.input.value.trim(),
      count = Number(copies.input.value),
      limit = currentLimit.input.value.trim();
    try {
      if (!voltage || !ohms || !basis.checked || !Number.isInteger(count) || count < 1 || count > 4)
        throw new Error('Invalid manual inputs');
      loadResult = solvePropulsionEvidenceLoad({
        evidence: Array.from({ length: count }, () => evaluator.evidence),
        openVoltage: Number(voltage),
        resistance: Number(ohms),
        currentLimit: limit === '' ? null : Number(limit),
        currentBasis: 'dc-input-at-recorded-voltage',
      });
    } catch {
      loadStatusCode = 'invalid';
    }
    renderLoad();
  }
  function metadataRow(label, value) {
    create('dt', metadataList).textContent = label;
    create('dd', metadataList).textContent = value === null ? unavailable() : String(value);
  }
  function diagnostics(items) {
    checks.replaceChildren();
    const labels = {
      'negative-load-reading': t(
        'Some load readings are negative. Raw observations are preserved; check the source convention and uncertainty.',
        'Деякі показники навантаження від’ємні. Початкові значення збережено; перевірте знаки та похибки у джерелі.',
      ),
      'shaft-power-exceeds-electrical-central-values': t(
        'Calculated shaft power exceeds electrical input at some readings. This compares central values, not uncertainty bounds; check the data.',
        'Розрахована потужність вала перевищує електричну потужність у деяких точках. Порівнюються центральні значення, а не межі похибки; перевірте дані.',
      ),
      'channels-unavailable': t(
        'Some measurement channels are unavailable.',
        'Деякі канали вимірювання недоступні.',
      ),
      'redistribution-not-confirmed': t(
        'Permission to redistribute this dataset is not confirmed. Local inspection does not change its license.',
        'Дозвіл на поширення цих даних не підтверджено. Локальний перегляд не змінює ліцензію.',
      ),
      'air-density-unavailable': t(
        'Air density was not supplied; no density correction is inferred.',
        'Густину повітря не вказано; її вплив не розраховується.',
      ),
      'interpolation-uncertainty-excludes-model-error': t(
        'Interpolated uncertainty values do not include interpolation or model error.',
        'Інтерпольовані значення похибок не враховують похибку інтерполяції або моделі.',
      ),
    };
    for (const code of new Set(items.map((item) => item.code)))
      create('li', checks).textContent = labels[code] ?? code;
  }
  function compare(point) {
    comparisonHeading.textContent = t(
      'Estimated motor at equivalent thrust',
      'Оцінка мотора за однакової тяги',
    );
    comparisonNote.textContent = t(
      'ESC command and RPM cannot be mapped to this model’s motor speed automatically. This comparison uses one steady motor at the sampled voltage and equal thrust; it does not match density, battery sag, aircraft current limits, transients or a complete aircraft.',
      'Команду ESC та оберти не можна автоматично перетворити на швидкість мотора цієї моделі. Порівнюється один мотор в усталеному режимі за напруги з даних і однакової тяги; густина повітря, просідання напруги, обмеження струму дрона, перехідні процеси та весь дрон не зіставляються.',
    );
    if (
      !point?.values ||
      evaluator.evidence.conditions.scope !== 'single-rotor' ||
      evaluator.evidence.conditions.flow !== 'static' ||
      point.values.airspeed !== 0 ||
      point.values.thrust === null ||
      point.values.thrust < 0 ||
      !(point.values.voltage > 0)
    ) {
      comparison.textContent = t(
        'Comparison unavailable: a covered single-rotor static point with known zero airspeed, nonnegative thrust and positive voltage is required.',
        'Порівняння недоступне: потрібна точка вимірювання одного ротора в межах даних для нерухомого повітря, з нульовою швидкістю потоку, невід’ємною тягою та додатною напругою.',
      );
      return;
    }
    let aircraft;
    try {
      aircraft = validateAircraftPhysics(getAircraft());
    } catch {
      comparison.textContent = t(
        'Comparison unavailable: no compatible active aircraft model.',
        'Порівняння недоступне: немає сумісної активної моделі дрона.',
      );
      return;
    }
    const { thrust, voltage } = point.values;
    if (voltage < aircraft.battery.emptyVoltage || voltage > aircraft.battery.fullVoltage) {
      comparison.textContent = t(
        `Comparison unavailable: ${number(voltage)} V is outside this aircraft’s configured battery range (${number(aircraft.battery.emptyVoltage)}–${number(aircraft.battery.fullVoltage)} V). Bench data remains available for inspection.`,
        `Порівняння недоступне: ${number(voltage)} В поза налаштованим діапазоном батареї цього дрона (${number(aircraft.battery.emptyVoltage)}–${number(aircraft.battery.fullVoltage)} В). Стендові дані залишаються доступними для перегляду.`,
      );
      return;
    }
    const maximum = aircraftMotorPoint(aircraft, aircraft.motorOutputLimit, voltage).thrust;
    if (thrust > maximum) {
      comparison.textContent = t(
        'Comparison unavailable: the sampled thrust exceeds this motor’s configured output limit at that voltage.',
        'Порівняння недоступне: тяга з даних перевищує налаштовану межу цього мотора за вказаної напруги.',
      );
      return;
    }
    const motorSpeed = aircraftMotorSpeedForThrust(aircraft, thrust, voltage);
    const estimate = aircraftMotorPoint(aircraft, motorSpeed, voltage);
    comparison.textContent = t(
      `At ${number(thrust)} N and ${number(voltage)} V per motor: estimated current ${number(estimate.current)} A (data: ${number(point.values.current)}); estimated torque ${number(estimate.torque)} N·m (data: ${number(point.values.torque)}).`,
      `За ${number(thrust)} Н та ${number(voltage)} В на мотор: оцінений струм ${number(estimate.current)} А (дані: ${number(point.values.current)}); оцінений момент ${number(estimate.torque)} Н·м (дані: ${number(point.values.torque)}).`,
    );
  }
  function renderPoint() {
    if (!evaluator || disposed) return;
    tableBody.replaceChildren();
    tableHead.replaceChildren();
    const header = create('tr', tableHead);
    for (const label of [
      t('Quantity', 'Величина'),
      t('Value', 'Значення'),
      t('Source uncertainty', 'Похибка з джерела'),
    ]) {
      const th = create('th', header);
      th.scope = 'col';
      th.textContent = label;
    }
    const raw = valueInput.value.trim(),
      value = Number(raw);
    const point = raw !== '' && Number.isFinite(value) ? evaluator.evaluate(value) : null;
    if (!point)
      pointStatus.textContent = t(
        'Enter a finite number in the displayed axis units.',
        'Введіть скінченне число в указаних одиницях осі.',
      );
    else if (point.status === 'outside-coverage')
      pointStatus.textContent = t(
        'Outside documented coverage. No extrapolated values are shown.',
        'Поза задокументованими межами даних. Екстрапольовані значення не показуються.',
      );
    else
      pointStatus.textContent =
        point.status === 'sample'
          ? t('Original source sample.', 'Початкова точка з джерела.')
          : t(
              'Linear interpolation between source samples.',
              'Лінійна інтерполяція між точками джерела.',
            );
    if (point?.values)
      for (const field of PROPULSION_EVIDENCE_FIELDS) {
        const row = create('tr', tableBody),
          name = create('th', row);
        name.scope = 'row';
        name.textContent = `${fieldName(field)}${evaluator.units[field] ? ` (${evaluator.units[field]})` : ''}`;
        create('td', row).textContent = number(point.values[field]);
        create('td', row).textContent = number(point.uncertainty[field]);
      }
    const missingFields = point?.values ? point.missingFields : PROPULSION_EVIDENCE_FIELDS;
    missing.textContent = missingFields.length
      ? `${t('Unavailable channels', 'Недоступні канали')}: ${missingFields.map(fieldName).join(', ')}.`
      : t(
          'All listed channels have values at this point.',
          'У цій точці є значення для всіх указаних каналів.',
        );
    uncertainty.textContent = t(
      'Unknown uncertainty is not zero. Interpolated uncertainty does not establish a confidence interval or include model error.',
      'Невідома похибка не дорівнює нулю. Інтерпольована похибка не визначає довірчий інтервал і не враховує похибку моделі.',
    );
    power.textContent = `${t('Electrical power', 'Електрична потужність')}: ${number(point?.power?.electricalWatts ?? null)} W; ${t('shaft power', 'потужність вала')}: ${number(point?.power?.shaftWatts ?? null)} W.`;
    diagnostics([...evaluator.diagnostics, ...(point?.diagnostics ?? [])]);
    compare(point);
  }
  function refresh() {
    if (disposed) return;
    heading.textContent = t('Bench data comparison', 'Порівняння стендових даних');
    intro.textContent = t(
      'Inspect a local propulsion dataset. Importing never changes aircraft settings or flight behavior.',
      'Перегляньте локальні дані силової установки. Імпорт не змінює налаштування дрона чи поведінку в польоті.',
    );
    fileText.textContent = t('Open JSON file (up to 256 KiB)', 'Відкрити JSON-файл (до 256 КіБ)');
    pasteText.textContent = t(
      'Or paste propulsion evidence JSON',
      'Або вставте JSON зі стендовими даними',
    );
    importButton.textContent = t('Inspect pasted data', 'Переглянути вставлені дані');
    demoButton.textContent = t('Load synthetic example', 'Завантажити синтетичний приклад');
    evaluateButton.textContent = t('Evaluate point', 'Обчислити точку');
    status.textContent = {
      idle: t(
        'Open a dataset or load the invented example to learn the format.',
        'Відкрийте набір даних або завантажте вигаданий приклад, щоб ознайомитися з форматом.',
      ),
      reading: t('Reading local file…', 'Читання локального файлу…'),
      loaded: t(
        'Dataset opened for inspection. Aircraft settings are unchanged.',
        'Дані відкрито для перегляду. Налаштування дрона не змінено.',
      ),
      invalid: t(
        'Could not open this dataset. Check its format and units. The previously opened dataset is preserved.',
        'Не вдалося відкрити дані. Перевірте формат та одиниці. Попередній набір даних збережено.',
      ),
      large: t(
        'The file exceeds the 256 KiB limit. The previously opened dataset is preserved.',
        'Файл перевищує межу 256 КіБ. Попередній набір даних збережено.',
      ),
    }[statusCode];
    status.setAttribute('role', ['invalid', 'large'].includes(statusCode) ? 'alert' : 'status');
    content.hidden = !evaluator;
    renderLoad();
    if (!evaluator) return;
    const evidence = evaluator.evidence,
      source = evidence.source;
    datasetName.textContent = evidence.name;
    provenance.textContent = {
      measured: t(
        'Source declares measured component data; whole-aircraft fidelity is not established.',
        'Джерело декларує вимірювання компонентів; відповідність усього дрона не підтверджено.',
      ),
      calculated: t(
        'Calculated data — model predictions, not measurements.',
        'Розраховані дані — прогноз моделі, не вимірювання.',
      ),
      synthetic: t(
        'Synthetic example — invented values, not measurements or a real-aircraft preset.',
        'Синтетичний приклад — вигадані значення, не вимірювання й не пресет реального дрона.',
      ),
    }[source.kind];
    metadataHeading.textContent = t(
      'Source, components and test conditions',
      'Джерело, компоненти та умови тесту',
    );
    metadataList.replaceChildren();
    for (const [label, value] of [
      [t('Source', 'Джерело'), source.title],
      [t('Source URL', 'Адреса джерела'), source.url],
      [t('Revision', 'Версія'), source.revision],
      [t('Retrieved', 'Дата отримання'), source.retrievedAt],
      ['SHA-256', source.sha256],
      [t('License', 'Ліцензія'), source.license.id],
      [t('License URL', 'Адреса ліцензії'), source.license.url],
      [t('Attribution', 'Зазначення авторства'), source.license.attribution],
      [
        t('Redistribution claim', 'Заявлений дозвіл на поширення'),
        {
          permitted: t(
            'Permitted by supplied metadata; not independently verified',
            'Дозволено за вказаними даними; незалежно не перевірено',
          ),
          unknown: t('Unknown', 'Невідомо'),
          restricted: t('Restricted', 'Обмежено'),
        }[source.license.redistribution],
      ],
      [t('Motor', 'Мотор'), evidence.components.motor],
      [t('Propeller', 'Пропелер'), evidence.components.propeller],
      ['ESC', evidence.components.esc],
      [t('ESC firmware', 'Прошивка ESC'), evidence.components.escFirmware],
      [t('Control protocol', 'Протокол керування'), evidence.components.controlProtocol],
      [
        t('Flow condition', 'Умови потоку'),
        {
          static: t('Static air', 'Нерухоме повітря'),
          axial: t('Axial flow', 'Осьовий потік'),
          edgewise: t('Edgewise flow', 'Поперечний потік'),
          mixed: t('Mixed', 'Змішані'),
          unknown: t('Unknown', 'Невідомі'),
        }[evidence.conditions.flow],
      ],
      [
        t('Measurement scope', 'Об’єкт вимірювання'),
        {
          'single-rotor': t('One rotor and motor', 'Один ротор і мотор'),
          'whole-aircraft': t('Whole aircraft', 'Увесь дрон'),
          unknown: t('Unknown', 'Невідомий'),
        }[evidence.conditions.scope],
      ],
      [t('Air density (kg/m³)', 'Густина повітря (кг/м³)'), evidence.conditions.airDensityKgM3],
      [t('Temperature (°C)', 'Температура (°C)'), evidence.conditions.temperatureC],
      [t('Pressure (Pa)', 'Тиск (Па)'), evidence.conditions.pressurePa],
      [t('Humidity (0–1)', 'Вологість (0–1)'), evidence.conditions.humidityRatio],
      [t('Installation', 'Установка'), evidence.conditions.installation],
      [t('Notes', 'Примітки'), evidence.conditions.notes],
      [
        t('Source units', 'Одиниці джерела'),
        PROPULSION_EVIDENCE_FIELDS.map(
          (field) => `${fieldName(field)}: ${evidence.units[field] ?? unavailable()}`,
        ).join('; '),
      ],
      [
        t('Source uncertainty type', 'Тип похибки джерела'),
        {
          unknown: t('Unknown', 'Невідомий'),
          reported: t('As reported by the source', 'Як указано у джерелі'),
          'absolute-bound': t('Absolute bound', 'Абсолютна межа'),
          standard: t('Standard uncertainty', 'Стандартна невизначеність'),
          expanded: t('Expanded uncertainty', 'Розширена невизначеність'),
        }[evidence.uncertainty.kind],
      ],
      [t('Coverage factor', 'Коефіцієнт охоплення'), evidence.uncertainty.coverageFactor],
      [t('Uncertainty notes', 'Примітки щодо похибок'), evidence.uncertainty.notes],
    ])
      metadataRow(label, value);
    valueText.textContent = `${fieldName(evaluator.axis.field)} (${evaluator.axis.unit})`;
    coverage.textContent = `${t('One-dimensional test path', 'Одновимірний ряд тестових даних')}: ${evaluator.intervals.map(([a, b]) => `${number(a)}–${number(b)}`).join('; ')} ${evaluator.axis.unit}. ${t('Other conditions are observed values, not independent controls.', 'Інші умови є зафіксованими значеннями, а не незалежними параметрами керування.')}`;
    caption.textContent = t(
      'Values at the selected source point',
      'Значення у вибраній точці даних',
    );
    renderPoint();
  }
  function adopt(source) {
    const candidate = createPropulsionEvidenceEvaluator(source);
    evaluator = candidate;
    loadResult = null;
    loadStatusCode = 'idle';
    basis.checked = false;
    valueInput.value = String(candidate.intervals[0][0]);
    statusCode = 'loaded';
    refresh();
  }
  function importEvidence(source) {
    if (disposed) return false;
    generation++;
    try {
      adopt(source);
      return true;
    } catch {
      statusCode = 'invalid';
      refresh();
      return false;
    }
  }
  listen(importButton, 'click', () => importEvidence(paste.value));
  listen(demoButton, 'click', () => {
    if (disposed) return;
    const source = createSyntheticPropulsionEvidence();
    paste.value = JSON.stringify(source, null, 2);
    importEvidence(source);
  });
  listen(file, 'change', async () => {
    if (disposed) return;
    const selected = file.files?.[0];
    file.value = '';
    if (!selected) return;
    const token = ++generation;
    if (
      !Number.isFinite(selected.size) ||
      selected.size < 0 ||
      selected.size > PROPULSION_EVIDENCE_LIMITS.maxBytes
    ) {
      statusCode = 'large';
      refresh();
      return;
    }
    statusCode = 'reading';
    refresh();
    try {
      const source = await selected.text();
      if (disposed || generation !== token) return;
      adopt(source);
    } catch {
      if (!disposed && generation === token) {
        statusCode = 'invalid';
        refresh();
      }
    }
  });
  listen(valueInput, 'input', renderPoint);
  listen(evaluateButton, 'click', renderPoint);
  for (const { input } of [openVoltage, resistance, copies, currentLimit])
    listen(input, 'input', clearLoad);
  listen(basis, 'change', clearLoad);
  listen(calculate, 'click', calculateLoad);
  refresh();
  return {
    root,
    refresh,
    importEvidence,
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      disposers.forEach((remove) => remove());
      evaluator = null;
      root.remove();
    },
  };
}
