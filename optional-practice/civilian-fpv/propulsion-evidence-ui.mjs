import {
  PROPULSION_EVIDENCE_FIELDS,
  PROPULSION_EVIDENCE_LIMITS,
  createPropulsionEvidenceEvaluator,
  createSyntheticPropulsionEvidence,
} from './propulsion-evidence.mjs';
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
  const disposers = [];
  let evaluator = null,
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
