import { boundedJSON, canonicalJSON, dataIdentity } from '../../game/data-json.mjs';
import { createResponseBenchClient } from './response-bench-client.mjs';

const NOTES_KEY = 'revealline.fpv.manual-comparison.v1';
const copy = (value) => structuredClone(value);
const axisTranslations = { roll: 'Крен', pitch: 'Тангаж', yaw: 'Рискання' };
const groupTranslations = {
  aircraft: 'Дрон',
  rates: 'Рейти',
  controller: 'Контролер',
  camera: 'Камера',
  assistance: 'Допомога',
};

/** This panel never saves a setup. Selection hands a copied controller tune to
 * the owning draft; all computation belongs to cancellable, dedicated workers. */
export function mountResponseBenchPanel({
  document: doc,
  window: win,
  locale = () => 'en',
  getSaved,
  getDraft,
  onUse = () => {},
  report = () => {},
  getInputReadiness = () => false,
  workerURL,
  createClient = createResponseBenchClient,
  onManualTest,
  getPracticeConditions = () => null,
} = {}) {
  const lang = () => (typeof locale === 'function' ? locale() : locale),
    t = (en, uk) => (lang() === 'uk' ? uk : en);
  let epoch = 0,
    client = null,
    disposed = false,
    running = false,
    result = null,
    manual = null,
    previousLocale = lang();
  const listeners = [],
    bindings = [];
  const el = (tag, en, uk, parent) => {
    const node = doc.createElement(tag);
    if (en !== undefined) {
      const text = doc.createTextNode(t(en, uk ?? en));
      node.append(text);
      bindings.push({ node: text, en, uk: uk ?? en });
    }
    parent?.append(node);
    return node;
  };
  const listen = (node, type, callback) => {
    node.addEventListener(type, callback);
    listeners.push({ node, remove: () => node.removeEventListener(type, callback) });
  };
  const clear = (parent) => {
    for (let i = listeners.length - 1; i >= 0; i--)
      if (parent.contains(listeners[i].node)) {
        listeners[i].remove();
        listeners.splice(i, 1);
      }
    for (let i = bindings.length - 1; i >= 0; i--)
      if (parent.contains(bindings[i].node)) bindings.splice(i, 1);
    parent.replaceChildren();
  };
  const root = el('section');
  root.className = 'tuning-bench';
  el('h3', 'Compare flight response', 'Порівняйте реакцію дрона', root);
  el(
    'p',
    'Choose manual flying for personal feedback, or a simulation bench for identical scripted inputs.',
    'Оберіть польоти для власних вражень або стенд симуляції з однаковими заданими рухами стиків.',
    root,
  );
  const fields = el('div', undefined, undefined, root);
  fields.className = 'tuning-fields';
  function select(en, uk, values) {
    const label = el('label', en, uk, fields),
      node = el('select', undefined, undefined, label);
    for (const [value, english, ukrainian] of values) {
      const option = el('option', english, ukrainian, node);
      option.value = value;
    }
    node.value = values[0][0];
    listen(node, 'change', () => invalidate());
    return node;
  }
  const scope = select('Comparison scope', 'Що порівнювати', [
    ['controller', 'PID / controller only', 'Лише PID / контролер'],
    ['setup', 'Compare complete setups', 'Порівняти повні налаштування'],
  ]);
  const axis = select('Response axis', 'Вісь реакції', [
    ['roll', 'Roll', 'Крен'],
    ['pitch', 'Pitch', 'Тангаж'],
    ['yaw', 'Yaw', 'Рискання'],
  ]);
  const readiness = el('p', undefined, undefined, root);
  readiness.setAttribute('role', 'status');
  const availability = el('p', undefined, undefined, root);
  const actions = el('div', undefined, undefined, root);
  actions.className = 'tuning-actions';
  function button(en, uk, callback, parent = actions) {
    const node = el('button', en, uk, parent);
    node.type = 'button';
    listen(node, 'click', callback);
    return node;
  }
  const compare = button(
    'Run simulation bench',
    'Запустити стенд симуляції',
    () => void run('compare'),
  );
  const suggest = button(
    'Find a SIM tuning suggestion',
    'Знайти пораду для налаштування SIM',
    () => void run('suggest'),
  );
  const cancel = button('Cancel comparison', 'Скасувати порівняння', () => invalidate());
  cancel.hidden = true;
  const progress = el('p', undefined, undefined, root);
  progress.setAttribute('role', 'status');
  progress.setAttribute('aria-live', 'polite');
  const output = el('div', undefined, undefined, root);
  output.className = 'tuning-bench-results';
  el(
    'p',
    'The bench is a controlled Acro response rig without gravity or contacts. Metrics use every 500 Hz physics step; the chart shows 50 Hz samples. Results assess this SIM model, not real-aircraft tuning.',
    'Стенд перевіряє реакцію в Acro без гравітації та зіткнень. Показники враховують кожен крок фізики 500 Гц; графік показує 50 Гц. Результати стосуються моделі SIM, а не налаштування реального дрона.',
    root,
  );

  const manualSection = el('details', undefined, undefined, root);
  el('summary', 'Manual A/B practice', 'Ручне тренування A/B', manualSection);
  el(
    'p',
    'Use the same launch and maneuver in both setups. Pilot inputs will differ; these notes are subjective and separate from the simulation bench.',
    'Використовуйте однаковий старт і маневр в обох налаштуваннях. Рухи пілота відрізнятимуться; ці враження суб’єктивні й окремі від стенда симуляції.',
    manualSection,
  );
  const manualConditions = el('p', undefined, undefined, manualSection);
  const manualActions = el('div', undefined, undefined, manualSection);
  manualActions.className = 'tuning-actions';
  const prepare = button(
    'Prepare A/B practice',
    'Підготувати тренування A/B',
    prepareManual,
    manualActions,
  );
  const flySaved = button(
    'Fly saved setup',
    'Летіти зі збереженими налаштуваннями',
    () => void flyManual('saved'),
    manualActions,
  );
  const flyDraft = button(
    'Fly draft setup',
    'Летіти з чернеткою',
    () => void flyManual('draft'),
    manualActions,
  );
  const notes = el('div', undefined, undefined, manualSection);
  notes.className = 'tuning-fields';
  const notesA = note('Saved setup: control and comfort', 'Збережені: керованість і комфорт');
  const notesB = note('Draft setup: control and comfort', 'Чернетка: керованість і комфорт');
  const saveNotes = button(
    'Save comparison notes on this device',
    'Зберегти нотатки порівняння на цьому пристрої',
    () => void persistNotes(),
    manualSection,
  );
  const notesStatus = el('p', undefined, undefined, manualSection);
  notesStatus.setAttribute('role', 'status');
  const history = el('details', undefined, undefined, manualSection);
  el('summary', 'Recent comparison notes', 'Останні нотатки порівнянь', history);
  const historyBody = el('div', undefined, undefined, history);
  function note(en, uk) {
    const label = el('label', en, uk, notes),
      field = el('textarea', undefined, undefined, label);
    field.rows = 3;
    field.maxLength = 2000;
    return field;
  }
  function inputStatus() {
    try {
      const value = getInputReadiness();
      return typeof value === 'boolean'
        ? { ready: value }
        : { ready: value?.ready === true, summary: value?.summary };
    } catch {
      return { ready: false };
    }
  }
  function capability() {
    try {
      const draft = getDraft(),
        physical = draft?.advanced ?? draft;
      return (
        physical?.aircraft?.format === 'AdvancedAircraft.v2' &&
        physical?.controller?.format === 'AdvancedControllerTune.v3'
      );
    } catch {
      return false;
    }
  }
  function refresh() {
    if (disposed) return;
    if (previousLocale !== lang()) {
      for (const binding of bindings) binding.node.textContent = t(binding.en, binding.uk);
      previousLocale = lang();
      if (result) renderResult(result);
      renderHistory();
    }
    const input = inputStatus(),
      supported = capability();
    readiness.textContent = input.ready
      ? t(
          'Input check ready: connection, mapping and calibration reviewed.',
          'Перевірка вводу готова: з’єднання, призначення та калібрування перевірено.',
        )
      : t(
          'Before a tuning suggestion, check input connection, mapping and calibration in Overview.',
          'Перед порадою з налаштування перевірте з’єднання, призначення й калібрування вводу в Огляді.',
        );
    if (typeof input.summary === 'string')
      readiness.textContent += ` ${input.summary.slice(0, 240)}`;
    availability.textContent = supported
      ? t(
          'Available for this aircraft controller. Choose an axis; suggestions change only one nonzero gain by ±10%.',
          'Доступно для цього контролера. Оберіть вісь; порада змінює лише один ненульовий коефіцієнт на ±10%.',
        )
      : t(
          'Unavailable for this backend. Select a catalog aircraft using the current aircraft controller to run comparisons.',
          'Недоступно для цієї моделі. Для порівняння оберіть дрон каталогу з поточним контролером.',
        );
    const workerAvailable = typeof win?.Worker === 'function';
    if (!workerAvailable)
      availability.textContent += t(
        ' This platform does not provide Web Workers.',
        ' Ця платформа не надає Web Workers.',
      );
    compare.disabled = running || !supported || !workerAvailable;
    suggest.disabled = running || !supported || !workerAvailable || !input.ready;
    cancel.hidden = !running;
    prepare.disabled = running;
    flySaved.disabled = flyDraft.disabled = !manual || typeof onManualTest !== 'function';
    saveNotes.disabled = !manual;
    if (!manual)
      manualConditions.textContent = t(
        'Prepare a frozen saved/draft pair before testing or writing notes.',
        'Перед тестуванням або нотатками підготуйте незмінну пару збережених налаштувань і чернетки.',
      );
  }
  function invalidate() {
    epoch++;
    client?.cancel();
    running = false;
    result = null;
    clear(output);
    progress.textContent = '';
    refresh();
  }
  async function run(kind) {
    invalidate();
    const generation = epoch;
    try {
      const snapshot = copy(getDraft());
      if (kind === 'suggest' && !inputStatus().ready)
        throw new Error(
          t('Complete the input check first.', 'Спочатку завершіть перевірку вводу.'),
        );
      client ??= createClient({ Worker: win?.Worker, ...(workerURL ? { url: workerURL } : {}) });
      running = true;
      refresh();
      const onProgress = (value) => {
        if (disposed || generation !== epoch) return;
        const stages = {
          saved: t('Measuring saved setup', 'Вимірювання збережених налаштувань'),
          draft: t('Measuring draft', 'Вимірювання чернетки'),
          baseline: t('Measuring the baseline', 'Вимірювання базових значень'),
          fitting: t('Checking bounded gain changes', 'Перевірка обмежених змін коефіцієнтів'),
          validation: t(
            'Checking separate validation maneuvers',
            'Перевірка окремих контрольних маневрів',
          ),
        };
        progress.textContent = `${stages[value.stage] ?? t('Running comparison', 'Виконується порівняння')} · ${value.completed}/${value.total}`;
      };
      const completed =
        kind === 'compare'
          ? await client.compare(
              { saved: copy(getSaved()), draft: snapshot, scope: scope.value, axis: axis.value },
              { onProgress },
            )
          : await client.suggest(
              { draft: snapshot, axis: axis.value, inputReady: true },
              { onProgress },
            );
      if (disposed || generation !== epoch) return;
      running = false;
      result = completed;
      progress.textContent = t(
        'Comparison complete. Your draft and flight are unchanged.',
        'Порівняння завершено. Чернетка й політ не змінилися.',
      );
      renderResult(completed);
      refresh();
    } catch (error) {
      if (disposed || generation !== epoch || error?.name === 'AbortError') return;
      running = false;
      progress.textContent = String(error?.message ?? error);
      report(error);
      refresh();
    }
  }
  function number(value, unit = '') {
    if (value === null)
      return t('Not reached / not applicable', 'Не досягнуто / не застосовується');
    if (typeof value !== 'number' || !Number.isFinite(value)) return t('Unavailable', 'Недоступно');
    const rounded =
      Math.abs(value) > 0 && Math.abs(value) < 0.001 ? value.toExponential(3) : value.toFixed(3);
    return `${rounded}${unit ? ` ${unit}` : ''}`;
  }
  const metricNames = [
    ['trackingError', 'Mean tracking error', 'Середня похибка реакції', '°/s'],
    ['riseTimeSeconds', 'Rise time (10–90%)', 'Час наростання (10–90%)', 's'],
    ['settlingTimeSeconds', 'Settling time', 'Час усталення', 's'],
    ['releaseSettlingTimeSeconds', 'Settling after release', 'Усталення після відпускання', 's'],
    ['overshootRate', 'Overshoot', 'Перевищення', '°/s'],
    ['crossAxisRate', 'Cross-axis response (RMS)', 'Реакція інших осей (RMS)', '°/s'],
    ['saturationSeconds', 'Time at actuator limits', 'Час на межі приводів', 's'],
    ['controlEffort', 'Differential motor effort', 'Диференційне зусилля моторів', 'normalized²'],
    [
      'motorActivity',
      'Motor activity (mean speed²)',
      'Активність моторів (середня швидкість²)',
      'normalized²',
    ],
  ];
  function metrics(parent, before, after, suggestion = false) {
    const grid = el('div', undefined, undefined, parent);
    grid.className = 'tuning-fields';
    for (const [key, en, uk, unit] of metricNames) {
      const item = el('fieldset', undefined, undefined, grid);
      el('legend', en, uk, item);
      el(
        'p',
        `${suggestion ? t('Current draft', 'Поточна чернетка') : t('Saved', 'Збережені')}: ${number(before[key], unit)}`,
        undefined,
        item,
      );
      el(
        'p',
        `${suggestion ? t('Suggested', 'Запропоновані') : t('Draft', 'Чернетка')}: ${number(after[key], unit)}`,
        undefined,
        item,
      );
    }
  }
  function chart(parent, before, after) {
    const figure = el('figure', undefined, undefined, parent);
    figure.className = 'tuning-bench-chart';
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 520 240');
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      t(
        'Saved and draft response to identical scripted stick inputs',
        'Реакція збережених налаштувань і чернетки на однакові задані рухи стиків',
      ),
    );
    figure.append(svg);
    const values = [...before, ...after].flatMap((p) => [p.achieved, p.requested]);
    const limit = Math.max(1, ...values.map(Math.abs)) * 1.15;
    const x = (time) => 54 + (time / 3) * 450,
      y = (rate) => 110 - (rate / limit) * 88;
    function shape(tag, attributes, text) {
      const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
      if (text !== undefined) node.textContent = text;
      svg.append(node);
      return node;
    }
    for (const fraction of [-1, 0, 1]) {
      shape('line', {
        x1: 54,
        x2: 504,
        y1: y(limit * fraction),
        y2: y(limit * fraction),
        stroke: '#36536a',
      });
      shape(
        'text',
        {
          x: 48,
          y: y(limit * fraction) + 4,
          'text-anchor': 'end',
          fill: '#c4d5e5',
          'font-size': 12,
        },
        Math.round(limit * fraction),
      );
    }
    for (let time = 0; time <= 3; time++)
      shape(
        'text',
        { x: x(time), y: 219, 'text-anchor': 'middle', fill: '#c4d5e5', 'font-size': 12 },
        `${time}s`,
      );
    shape('text', { x: 7, y: 12, fill: '#c4d5e5', 'font-size': 12 }, '°/s');
    const line = (trace, field) =>
      trace
        .map((p, i) => `${i ? 'L' : 'M'}${x(p.seconds).toFixed(2)},${y(p[field]).toFixed(2)}`)
        .join(' ');
    shape('path', {
      d: line(before, 'requested'),
      fill: 'none',
      stroke: '#edf5ff',
      'stroke-width': 1.5,
      'stroke-dasharray': '2 5',
    });
    shape('path', {
      d: line(before, 'achieved'),
      fill: 'none',
      stroke: '#55c8a4',
      'stroke-width': 2.5,
    });
    shape('path', {
      d: line(after, 'achieved'),
      fill: 'none',
      stroke: '#f1ca72',
      'stroke-width': 2.5,
      'stroke-dasharray': '8 4',
    });
    if (before.some((point, index) => point.requested !== after[index]?.requested))
      shape('path', {
        d: line(after, 'requested'),
        fill: 'none',
        stroke: '#c5a5f5',
        'stroke-width': 1.5,
        'stroke-dasharray': '8 3 2 3',
      });
    el(
      'figcaption',
      'Solid green: saved · Dashed amber: draft · Dotted white: saved command · Purple dash-dot, when different: draft command. The chart is downsampled; metrics retain every physics step.',
      'Суцільна зелена: збережені · Штрихова бурштинова: чернетка · Біла пунктирна: збережена команда · Фіолетова штрих-пунктирна за відмінності: команда чернетки. Графік проріджено; показники враховують усі кроки фізики.',
      figure,
    );
  }
  function renderResult(value) {
    clear(output);
    if (
      value.conditions?.seededSensorNoiseEnabled === false ||
      (value.conditions?.savedSensorNoise === 0 && value.conditions?.draftSensorNoise === 0)
    )
      el(
        'p',
        'Sensor noise is disabled. Different seeds do not add noise to these tests.',
        'Шум датчика вимкнено. Різні зерна не додають шуму до цих тестів.',
        output,
      );
    if (value.failedCases?.length)
      el(
        'p',
        `${value.failedCases.length} ${t('candidate simulations failed and were excluded.', 'симуляцій кандидатів завершилися помилкою й були виключені.')}`,
        undefined,
        output,
      );
    if (value.gates) {
      const gates = el('details', undefined, undefined, output);
      el('summary', 'Measurement and acceptance limits', 'Межі вимірювання й прийняття', gates);
      el(
        'p',
        'All three seconds count, including startup. Settling means staying within the larger of 1°/s or 2% of the target for at least 100 ms. A target that is not reached has no settling time.',
        'Враховуються всі три секунди, включно зі стартом. Усталення означає перебування в межах більшого з 1°/с або 2% цілі щонайменше 100 мс. Для недосягнутої цілі час усталення відсутній.',
        gates,
      );
      el(
        'p',
        'Tracking must improve by more than the larger of 0.005°/s or 0.5%. Each validation case allows at most one physics step (2 ms) of time regression. Other limits use the larger of the displayed absolute and relative tolerances.',
        'Похибка має покращитися більше ніж на більше з 0,005°/с або 0,5%. Кожен контрольний випадок допускає погіршення часу не більше одного кроку фізики (2 мс). Інші межі використовують більше з наведених абсолютного й відносного допусків.',
        gates,
      );
      const list = el('ul', undefined, undefined, gates);
      for (const [key, limits] of Object.entries(value.gates.regression)) {
        const name = metricNames.find(([id]) => id === key);
        const label = name
          ? t(name[1], name[2])
          : t('RMS tracking error', 'Середньоквадратична похибка');
        el(
          'li',
          `${label}: ${limits.absolute} ${limits.unit === 'degrees/second' ? '°/s' : 'normalized²'} / ${limits.relative * 100}%`,
          undefined,
          list,
        );
      }
      el(
        'p',
        'Motor effort measures differences between motor speeds; motor activity also counts collective speed. These are normalized actuator measurements, not electrical energy.',
        'Зусилля моторів вимірює відмінності їхніх швидкостей; активність також враховує спільну швидкість. Це нормовані показники приводів, а не електрична енергія.',
        gates,
      );
    }
    if (value.kind === 'comparison') {
      const changed =
        value.changedGroups
          .map((group) => (lang() === 'uk' ? groupTranslations[group] : group))
          .join(', ') || t('none', 'немає');
      el('h4', `${t('Changed groups', 'Змінені групи')}: ${changed}`, undefined, output);
      el(
        'p',
        `${t('Axis', 'Вісь')}: ${lang() === 'uk' ? axisTranslations[value.axis] : value.axis} · 500 Hz · ${t('Same 3-second input sequence, starting state and seed', 'Однакова 3-секундна послідовність вводу, початковий стан і зерно шуму')}`,
        undefined,
        output,
      );
      chart(output, value.baseline.trace, value.candidate.trace);
      metrics(output, value.baseline.metrics, value.candidate.metrics);
    } else if (value.status === 'no-clear-improvement') {
      el('h4', 'No clear improvement', 'Немає однозначного покращення', output);
      el(
        'p',
        'No tested gain change passed both fitting and every separate validation case. Keep your current tune or compare a manual edit.',
        'Жодна перевірена зміна не пройшла добір і всі окремі контрольні випадки. Залиште поточне налаштування або порівняйте власну зміну.',
        output,
      );
    } else {
      el('h4', 'Validated SIM suggestions', 'Перевірені поради для SIM', output);
      for (const suggestion of value.suggestions) {
        const item = el('fieldset', undefined, undefined, output);
        const axisLabel = lang() === 'uk' ? axisTranslations[suggestion.axis] : suggestion.axis;
        el(
          'legend',
          `${axisLabel} · ${suggestion.gain.toUpperCase()} · ${suggestion.multiplier > 1 ? '+10%' : '−10%'}`,
          undefined,
          item,
        );
        el('p', `${suggestion.previous} → ${suggestion.value}`, undefined, item);
        metrics(item, suggestion.fittingBaseline, suggestion.fit.metrics, true);
        el(
          'p',
          `${suggestion.validation.length} ${t('separate direction, ramp, throttle and noise-seed cases passed.', 'окремих перевірок напрямку, плавного вводу, газу й зерна шуму пройдено.')}`,
          undefined,
          item,
        );
        const validation = el('details', undefined, undefined, item);
        el(
          'summary',
          'Validation cases and tradeoffs',
          'Контрольні випадки й компроміси',
          validation,
        );
        for (const entry of suggestion.validation) {
          const detail = el('details', undefined, undefined, validation);
          const caseAxis = entry.testCase.axis ?? suggestion.axis;
          const condition = `${lang() === 'uk' ? axisTranslations[caseAxis] : caseAxis} · ${entry.testCase.shape === 'ramp' ? t('Ramp', 'Плавний ввід') : t('Step / release', 'Крок / відпускання')} · ${entry.testCase.direction > 0 ? '+' : '−'} · ${Math.round(entry.testCase.throttle * 100)}% ${t('throttle', 'газу')}`;
          el('summary', condition, undefined, detail);
          metrics(detail, entry.baseline, entry.candidate, true);
        }
        button(
          'Use suggestion in draft',
          'Використати пораду в чернетці',
          async () => {
            if (disposed || result !== value) return;
            try {
              await onUse(copy(suggestion.controller), copy(suggestion));
              invalidate();
            } catch (error) {
              report(error);
              progress.textContent = String(error?.message ?? error);
            }
          },
          item,
        );
      }
    }
  }
  function prepareManual() {
    try {
      const conditions = getPracticeConditions();
      if (!conditions)
        throw new Error(
          t(
            'Open practice before preparing a repeatable A/B launch.',
            'Відкрийте тренування перед підготовкою повторюваного старту A/B.',
          ),
        );
      const saved = boundedJSON(getSaved(), { maxBytes: 128 * 1024, maxNodes: 5000, maxDepth: 20 });
      const draft = boundedJSON(getDraft(), { maxBytes: 128 * 1024, maxNodes: 5000, maxDepth: 20 });
      const groups = [
        [
          'aircraft',
          (saved.advanced ?? saved).aircraft ?? null,
          (draft.advanced ?? draft).aircraft ?? null,
        ],
        [
          'controller',
          (saved.advanced ?? saved).controller ?? null,
          (draft.advanced ?? draft).controller ?? null,
        ],
        ['rates', saved.response ?? null, draft.response ?? null],
        ['camera', saved.camera ?? null, draft.camera ?? null],
      ]
        .filter(([, a, b]) => canonicalJSON(a) !== canonicalJSON(b))
        .map(([name]) => name);
      if (scope.value === 'controller' && groups.some((group) => group !== 'controller'))
        throw new Error(
          t(
            'PID comparison changes controller settings only. Choose Compare complete setups for other changes.',
            'Порівняння PID змінює лише контролер. Для інших змін оберіть порівняння повних налаштувань.',
          ),
        );
      manual = {
        id: `manual-${Date.now()}`,
        saved,
        draft,
        conditions: boundedJSON(conditions, { maxBytes: 8192, maxNodes: 500, maxDepth: 12 }),
        savedIdentity: dataIdentity(saved),
        draftIdentity: dataIdentity(draft),
      };
      notesA.value = notesB.value = '';
      manualConditions.textContent = t(
        'Saved and draft configurations are frozen for this pair. Repeat a hover, short roll input and release from the same launch. Camera and input differences remain part of your notes.',
        'Збережені налаштування й чернетку зафіксовано для цієї пари. Повторіть зависання, короткий крен і відпускання з однакового старту. Відмінності камери й вводу враховуйте у враженнях.',
      );
      manualConditions.textContent += ` ${t('Changed groups', 'Змінені групи')}: ${groups.map((group) => (lang() === 'uk' ? groupTranslations[group] : group)).join(', ') || t('none', 'немає')}.`;
      if (typeof conditions.label === 'string')
        manualConditions.textContent += ` ${conditions.label.slice(0, 240)}`;
      notesStatus.textContent = '';
      refresh();
    } catch (error) {
      report(error);
      manualConditions.textContent = String(error?.message ?? error);
    }
  }
  async function flyManual(variant) {
    if (!manual || typeof onManualTest !== 'function') return;
    try {
      const currentConditions = getPracticeConditions();
      if (
        !currentConditions ||
        canonicalJSON(currentConditions) !== canonicalJSON(manual.conditions)
      )
        throw new Error(
          t(
            'Practice or input conditions changed. Prepare a new A/B pair before flying.',
            'Умови тренування або вводу змінилися. Перед польотом підготуйте нову пару A/B.',
          ),
        );
      await onManualTest(copy(manual[variant]), { variant, conditions: copy(manual.conditions) });
    } catch (error) {
      report(error);
      manualConditions.textContent = String(error?.message ?? error);
    }
  }
  function readNotes() {
    const raw = win?.localStorage?.getItem(NOTES_KEY);
    if (!raw) return [];
    const data = boundedJSON(raw, { maxBytes: 64 * 1024, maxNodes: 1000, maxDepth: 5 });
    if (
      data.format !== 'FpvManualComparisonNotes.v1' ||
      !Array.isArray(data.entries) ||
      data.entries.length > 6
    )
      throw new Error(
        t('Stored comparison notes are unavailable.', 'Збережені нотатки порівнянь недоступні.'),
      );
    for (const item of data.entries)
      if (
        typeof item.id !== 'string' ||
        typeof item.saved !== 'string' ||
        typeof item.draft !== 'string' ||
        item.saved.length > 2000 ||
        item.draft.length > 2000 ||
        typeof item.savedIdentity !== 'string' ||
        typeof item.draftIdentity !== 'string'
      )
        throw new Error(
          t('Stored comparison notes are invalid.', 'Збережені нотатки порівнянь некоректні.'),
        );
    return data.entries;
  }
  function renderHistory() {
    clear(historyBody);
    try {
      const items = readNotes();
      if (!items.length)
        el(
          'p',
          'No saved comparison notes yet.',
          'Збережених нотаток порівнянь ще немає.',
          historyBody,
        );
      for (const item of items) {
        const field = el('fieldset', undefined, undefined, historyBody);
        el('legend', item.id, undefined, field);
        el('p', `${t('Saved', 'Збережені')}: ${item.saved}`, undefined, field);
        el('p', `${t('Draft', 'Чернетка')}: ${item.draft}`, undefined, field);
      }
    } catch (error) {
      notesStatus.textContent = String(error?.message ?? error);
    }
  }
  async function persistNotes() {
    if (!manual) return;
    const entry = {
      id: manual.id,
      savedIdentity: manual.savedIdentity,
      draftIdentity: manual.draftIdentity,
      saved: notesA.value.slice(0, 2000),
      draft: notesB.value.slice(0, 2000),
    };
    const write = () => {
      const storage = win?.localStorage;
      if (!storage)
        throw new Error(
          t(
            'Device storage is unavailable. Your notes remain visible.',
            'Сховище пристрою недоступне. Нотатки залишаються видимими.',
          ),
        );
      const entries = [entry, ...readNotes().filter((item) => item.id !== entry.id)].slice(0, 6);
      storage.setItem(NOTES_KEY, canonicalJSON({ format: 'FpvManualComparisonNotes.v1', entries }));
    };
    try {
      if (win?.navigator?.locks?.request) await win.navigator.locks.request(NOTES_KEY, write);
      else write();
      if (disposed) return;
      notesStatus.textContent = t(
        'Comparison notes saved on this device. The latest six pairs are retained.',
        'Нотатки збережено на цьому пристрої. Зберігаються останні шість пар.',
      );
      renderHistory();
    } catch (error) {
      if (disposed) return;
      notesStatus.textContent = `${t('Notes could not be saved. Your text remains here.', 'Не вдалося зберегти нотатки. Текст залишається тут.')} ${error?.message ?? error}`;
      report(error);
    }
  }
  renderHistory();
  refresh();
  return Object.freeze({
    root,
    refresh,
    invalidate,
    dispose() {
      if (disposed) return;
      disposed = true;
      epoch++;
      client?.dispose();
      for (const listener of listeners) listener.remove();
      listeners.length = 0;
      bindings.length = 0;
      root.remove();
    },
  });
}
