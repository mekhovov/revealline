import { STICK_LAYOUTS } from './radio-profile.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const AXES = ['throttle', 'yaw', 'pitch', 'roll'];
const clamp = (n, a = -1, b = 1) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : 0));

/** An instructional view of the host's input and simulation. It never owns input,
 * advances a course objective, arms a flight or marks a recording verified. */
export function mountBeginnerCoach({
  root,
  window: win = globalThis.window,
  locale = () => 'en',
  onStart = () => {},
  onPause = () => {},
  onRetry = () => {},
  onNext = () => {},
  onExit = () => {},
  onRadio = () => {},
}) {
  const doc = root.ownerDocument;
  let lesson = null,
    stage = 'closed',
    explored = 'throttle',
    viewedStep = 0,
    replay = false,
    snapshot = {},
    lastRender = '',
    nextAvailable = false,
    disposed = false,
    lastPaint = 0;
  let refs = {};
  const lang = () => ((typeof locale === 'function' ? locale() : locale) === 'uk' ? 'uk' : 'en');
  const t = (en, uk) => (lang() === 'uk' ? uk : en);
  const copy = (value) =>
    typeof value === 'string' ? value : (value?.[lang()] ?? value?.en ?? '');
  const node = (tag, className, value) => {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  };
  const svg = (tag, attrs = {}, value) => {
    const el = doc.createElementNS(SVG_NS, tag);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, String(val));
    if (value !== undefined) el.textContent = value;
    return el;
  };
  const button = (action, label, className = '') => {
    const el = node('button', className, label);
    el.type = 'button';
    el.dataset.coachAction = action;
    return el;
  };
  const axisName = (axis) =>
    ({
      throttle: t('Throttle', 'Газ'),
      yaw: t('Yaw', 'Рискання'),
      pitch: t('Pitch', 'Тангаж'),
      roll: t('Roll', 'Крен'),
      mixed: t('Combine controls', 'Поєднайте керування'),
    })[axis] ?? axis;
  const directionName = (axis) =>
    ({
      throttle: t('↑ more lift · ↓ less lift', '↑ більше тяги · ↓ менше тяги'),
      yaw: t('← turn left · turn right →', '← поворот ліворуч · праворуч →'),
      pitch: t('↑ nose forward · ↓ nose back', '↑ ніс уперед · ↓ ніс назад'),
      roll: t('← tilt left · tilt right →', '← нахил ліворуч · праворуч →'),
    })[axis];
  const axisExplanation = (axis) =>
    ({
      throttle: t(
        'All four motors work harder together. More thrust makes you rise; less lets gravity bring you down. Throttle controls thrust, not height.',
        'Усі чотири мотори разом працюють сильніше. Більша тяга піднімає дрон; менша дозволяє силі тяжіння опускати його. Газ керує тягою, а не висотою.',
      ),
      yaw: t(
        'Turn the nose left or right while keeping the drone level. Yaw changes where you face; it does not move you sideways.',
        'Поверніть ніс ліворуч або праворуч, зберігаючи горизонтальне положення. Рискання змінює напрям погляду, а не рухає дрон убік.',
      ),
      pitch: t(
        'Push forward to tip the nose down. Some thrust now points forward, so you accelerate. Pull back gently to slow down.',
        'Штовхніть стік уперед, щоб опустити ніс. Частина тяги тепер спрямована вперед, і дрон прискорюється. Плавно потягніть назад, щоб загальмувати.',
      ),
      roll: t(
        'Move sideways to bank the drone. It leans and accelerates sideways without needing to turn the nose.',
        'Рухайте стік убік, щоб нахилити дрон. Він нахиляється та прискорюється вбік без повороту носа.',
      ),
    })[axis];
  const activeStep = () =>
    Math.min(Math.max(0, snapshot.state?.step ?? 0), (lesson?.steps.length ?? 1) - 1);
  const currentStep = () => lesson?.steps[stage === 'guide' ? viewedStep : activeStep()];
  const mode = () => snapshot.mode ?? lesson?.mode ?? 'self-level';
  const criterion = (index = activeStep()) => lesson?.course?.steps?.[mode()]?.[index];
  const isExploring = () => stage === 'guide' && lesson?.index === 0 && viewedStep === 0;
  const displayedStep = () => {
    if (!isExploring()) return currentStep();
    return {
      ...currentStep(),
      axis: explored,
      motion: { throttle: 'lift', yaw: 'yaw', pitch: 'pitch', roll: 'roll' }[explored],
      direction: 1,
      target: explored === 'throttle' ? 0.58 : 0.25,
    };
  };
  const controls = () => {
    // The host passes normalized values. Quantized recorded input is a fallback.
    if (snapshot.source === 'radio' && snapshot.monitorAvailable === false)
      return { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    const value = snapshot.monitor?.controls ?? snapshot.monitor?.input ?? snapshot.monitor;
    return Object.fromEntries(
      AXES.map((axis) => [
        axis,
        clamp(
          Number.isFinite(value?.[axis])
            ? value[axis]
            : (snapshot.state?.lastInput?.[axis] ?? 0) / 1000,
          axis === 'throttle' ? 0 : -1,
          1,
        ),
      ]),
    );
  };
  function makeStick(side, layout, step) {
    const section = node('section', 'coach-stick'),
      h = layout[side * 2],
      v = layout[side * 2 + 1],
      highlighted = step.axis === h || step.axis === v || step.axis === 'mixed';
    section.dataset.highlight = String(highlighted);
    section.append(
      node('h4', '', side === 0 ? t('Left stick', 'Лівий стік') : t('Right stick', 'Правий стік')),
    );
    const drawing = svg('svg', {
      viewBox: '0 0 180 180',
      role: 'img',
      'aria-label': `${axisName(h)} / ${axisName(v)}`,
    });
    drawing.append(
      svg('circle', { cx: 90, cy: 90, r: 68, class: 'coach-stick-rim' }),
      svg('circle', { cx: 90, cy: 90, r: 34, class: 'coach-stick-grid' }),
      svg('path', { d: 'M22 90H158M90 22V158', class: 'coach-stick-grid' }),
      svg('path', {
        d: 'M84 17L90 10L96 17M163 84L170 90L163 96M96 163L90 170L84 163M17 96L10 90L17 84',
        class: 'coach-stick-arrows',
      }),
    );
    const target = {
      throttle: ['throttle', 'mixed'].includes(step.axis) ? clamp(step.target ?? 0.5, 0, 1) : 0.5,
      yaw: 0,
      pitch: 0,
      roll: 0,
    };
    if (step.axis !== 'throttle' && step.axis !== 'mixed')
      target[step.axis] = clamp((step.target ?? 0.25) * (step.direction ?? 1));
    const targetX = target[h] * 60,
      targetY = -(v === 'throttle' ? target[v] * 2 - 1 : target[v]) * 60;
    const suggestion = svg('g', { class: 'coach-stick-suggestion' });
    suggestion.style.setProperty('--coach-target-x', `${targetX}px`);
    suggestion.style.setProperty('--coach-target-y', `${targetY}px`);
    suggestion.append(svg('circle', { cx: 90, cy: 90, r: 11, class: 'coach-target-dot' }));
    const live = svg('circle', { cx: 90, cy: 90, r: 6, class: 'coach-live-dot' });
    drawing.append(suggestion, live);
    const labels = node('div', 'coach-stick-axes');
    for (const axis of [v, h]) {
      const label = node('p', axis === step.axis ? 'is-focus' : '');
      label.append(node('strong', '', axisName(axis)), node('span', '', directionName(axis)));
      labels.append(label);
    }
    const readout = node('output', 'coach-stick-readout');
    section.append(drawing, labels, readout);
    refs.sticks.push({ live, readout, h, v });
    return section;
  }
  function makeDrone(step) {
    const motion = step.motion ?? 'hover',
      figure = node('figure', 'coach-drone-figure'),
      drawing = svg('svg', {
        viewBox: '0 0 400 230',
        role: 'img',
        'aria-label': t('Illustration of drone movement', 'Ілюстрація руху дрона'),
      });
    drawing.dataset.motion = motion;
    drawing.dataset.direction = String(step.direction ?? 1);
    drawing.style.setProperty(
      '--coach-direction',
      String((step.direction ?? 1) * (motion === 'roll' ? -1 : 1)),
    );
    if (motion === 'roll') drawing.dataset.direction = String(-(step.direction ?? 1));
    const arrow = (d, color = 'thrust') =>
      svg('path', { d, class: `coach-force coach-force-${color}` });
    drawing.append(
      svg('path', {
        d: 'M20 195H380M60 195V205M120 195V205M180 195V205M240 195V205M300 195V205M360 195V205',
        class: 'coach-ground',
      }),
      svg('path', { d: 'M25 60H375M25 110H375M25 160H375', class: 'coach-drone-grid' }),
    );
    const drone = svg('g', { class: 'coach-drone-body' });
    if (motion === 'yaw') {
      drone.append(svg('path', { d: 'M168 82L232 146M232 82L168 146', class: 'coach-drone-arm' }));
      for (const [cx, cy] of [
        [164, 78],
        [236, 78],
        [164, 150],
        [236, 150],
      ])
        drone.append(
          svg('circle', { cx, cy, r: 22, class: 'coach-prop' }),
          svg('path', { d: `M${cx - 15} ${cy}h30`, class: 'coach-prop-line' }),
        );
      drone.append(
        svg('rect', { x: 184, y: 92, width: 32, height: 45, rx: 5, class: 'coach-frame' }),
        svg('path', { d: 'M188 88L200 73L212 88Z', class: 'coach-nose' }),
      );
      drawing.append(
        arrow('M268 80Q305 122 268 156M268 156L270 141M268 156L283 153', 'motion'),
        svg(
          'text',
          { x: 310, y: 119, class: 'coach-svg-label', 'text-anchor': 'middle' },
          t('TURN', 'ПОВОРОТ'),
        ),
      );
    } else {
      drone.append(
        svg('path', { d: 'M132 114H268', class: 'coach-drone-arm' }),
        svg('rect', { x: 177, y: 104, width: 48, height: 21, rx: 5, class: 'coach-frame' }),
        svg('rect', { x: 140, y: 100, width: 14, height: 22, rx: 2, class: 'coach-frame' }),
        svg('rect', { x: 246, y: 100, width: 14, height: 22, rx: 2, class: 'coach-frame' }),
        svg('ellipse', { cx: 147, cy: 99, rx: 32, ry: 5, class: 'coach-prop' }),
        svg('ellipse', { cx: 253, cy: 99, rx: 32, ry: 5, class: 'coach-prop' }),
        svg('path', { d: 'M184 125V134M216 125V134', class: 'coach-drone-arm' }),
      );
      if (motion !== 'roll')
        drone.append(svg('path', { d: 'M224 108L235 113L224 119Z', class: 'coach-nose' }));
      drone.append(
        arrow('M160 91V52M153 60L160 52L167 60'),
        arrow('M240 91V52M233 60L240 52L247 60'),
      );
      if (['pitch', 'roll', 'route'].includes(motion))
        drawing.append(arrow('M267 164H340M331 157L340 164L331 171', 'motion'));
      if (motion === 'brake')
        drawing.append(
          arrow('M255 173H341M332 166L341 173L332 180', 'motion'),
          arrow('M145 65H73M82 58L73 65L82 72'),
          svg(
            'text',
            { x: 300, y: 157, class: 'coach-svg-label', 'text-anchor': 'middle' },
            t('MOMENTUM', 'ІНЕРЦІЯ'),
          ),
        );
      if (['lift', 'hover', 'land'].includes(motion))
        drawing.append(
          arrow('M314 100V159M307 151L314 159L321 151', 'gravity'),
          svg(
            'text',
            { x: 325, y: 177, class: 'coach-svg-label', 'text-anchor': 'middle' },
            t('GRAVITY', 'ТЯЖІННЯ'),
          ),
        );
      if (motion === 'acro')
        drawing.append(
          svg('path', { d: 'M118 145H282', class: 'coach-level-reference' }),
          svg(
            'text',
            { x: 200, y: 181, class: 'coach-svg-label', 'text-anchor': 'middle' },
            t('CENTRED STICK ≠ LEVEL DRONE', 'СТІК У ЦЕНТРІ ≠ РІВНИЙ ДРОН'),
          ),
        );
    }
    drawing.append(drone);
    const view =
      motion === 'yaw'
        ? t('TOP VIEW', 'ВИГЛЯД ЗГОРИ')
        : motion === 'roll'
          ? t('FRONT VIEW', 'ВИГЛЯД СПЕРЕДУ')
          : t('SIDE VIEW', 'ВИГЛЯД ЗБОКУ');
    drawing.append(svg('text', { x: 20, y: 25, class: 'coach-svg-view' }, view));
    figure.append(
      drawing,
      node(
        'figcaption',
        '',
        t(
          'Movement example · not a replay or a flight command',
          'Приклад руху · це не запис і не команда польоту',
        ),
      ),
    );
    return figure;
  }
  function objectiveText(target) {
    if (!target)
      return t(
        'Follow the highlighted objective in the world.',
        'Виконайте підсвічену ціль у світі.',
      );
    if (target.type === 'gate')
      return t(
        `Fly through the opening at ${(target.minY / 1000).toFixed(1)}–${(target.maxY / 1000).toFixed(1)} m.`,
        `Пролетіть крізь отвір на висоті ${(target.minY / 1000).toFixed(1)}–${(target.maxY / 1000).toFixed(1)} м.`,
      );
    const height = `${(target.min.y / 1000).toFixed(1)}–${(target.max.y / 1000).toFixed(1)}`;
    const seconds = ((target.ticks ?? 0) / 50).toFixed(1);
    return target.type === 'land'
      ? t(
          `Land inside the marked pad. Hold steady for ${seconds} s.`,
          `Сядьте в межах позначеного майданчика. Утримуйте положення ${seconds} с.`,
        )
      : t(
          `Stay in the highlighted zone at ${height} m for ${seconds} s.`,
          `Залишайтеся в підсвіченій зоні на висоті ${height} м протягом ${seconds} с.`,
        );
  }
  function hint() {
    const state = snapshot.state,
      step = currentStep(),
      target = criterion();
    if (snapshot.source === 'radio' && snapshot.monitorAvailable === false)
      return t(
        'Radio signal unavailable. Reconnect or open Radio setup; the cyan dots are neutral until the selected radio returns.',
        'Сигнал пульта недоступний. Підключіть його знову або відкрийте налаштування; блакитні крапки нейтральні до відновлення сигналу.',
      );
    if (replay)
      return t(
        'Watch the solid dots: these are the recorded controls. Your sticks do not change playback.',
        'Стежте за суцільними крапками: це записане керування. Ваші стіки не змінюють відтворення.',
      );
    if (stage === 'guide')
      return t(
        'Flight is paused. Read, explore the controls, then start when you are ready.',
        'Політ на паузі. Перегляньте пояснення й керування та починайте, коли будете готові.',
      );
    if (!state || ['paused', 'ready', 'disarmed'].includes(state.status))
      return t(
        'Ready? Lower throttle, centre the other axes, then Arm / resume. A radio may also need its arm switch OFF → ON.',
        'Готові? Опустіть газ, центруйте інші осі й натисніть «Увімкнути / продовжити». Пульт також може потребувати перемикання ВИМК → УВІМК.',
      );
    if (state.status === 'complete')
      return t(
        'Nice flying. Your recording is being checked before this lesson is recorded as complete.',
        'Гарний політ. Запис перевіряється, перш ніж урок буде зараховано.',
      );
    if (['crashed', 'failed', 'timeout', 'expired'].includes(state.status))
      return t(
        'Every pilot retries. Open the guide, then try the small movement again.',
        'Кожен пілот пробує знову. Відкрийте пояснення й повторіть невеликий рух.',
      );
    if (state.hold > 0)
      return t(
        'You are in the right place. Keep it gentle while the ring fills.',
        'Ви в потрібному місці. Рухайте стіки плавно, поки заповнюється індикатор.',
      );
    if (target?.max && state.position?.y > target.max.y + 200)
      return t(
        'A little high. Ease throttle down, then restore it near hover before you descend too far.',
        'Трохи зависоко. Зменште газ, а до потрібної висоти поверніть його до рівня зависання.',
      );
    if (target?.min && state.position?.y < target.min.y - 200)
      return t(
        'A little low. Add a small amount of throttle; ease it back as you approach the target height.',
        'Трохи занизько. Плавно додайте газ і зменште його, наближаючись до потрібної висоти.',
      );
    const speed = Math.hypot(state.velocity?.x ?? 0, state.velocity?.z ?? 0);
    if (target?.maxSpeed && speed > target.maxSpeed)
      return t(
        'Still moving? Centre is not a brake. Gently tilt against your travel, then level out as you slow.',
        'Дрон ще рухається? Центр стіка не гальмує. Плавно нахиліть дрон проти руху й вирівняйте, коли сповільнитеся.',
      );
    if (
      mode() === 'acro' &&
      Math.max(Math.abs(state.attitude?.roll ?? 0), Math.abs(state.attitude?.pitch ?? 0)) > 1600
    )
      return t(
        'In Acro, centred sticks keep the tilt. Briefly move the opposite way to return to level.',
        'В Acro центральне положення стіків зберігає нахил. Коротко рухайте стік у протилежний бік, щоб вирівнятися.',
      );
    return copy(step?.tip) || copy(step?.instruction);
  }
  function makeTelemetry() {
    const strip = node('div', 'coach-telemetry');
    refs.telemetry = [];
    for (const [key, label] of [
      ['height', t('Height', 'Висота')],
      ['speed', t('Speed', 'Швидкість')],
      ['tilt', t('Tilt', 'Нахил')],
      ['throttle', axisName('throttle')],
    ]) {
      const item = node('div', ''),
        value = node('strong', '', '—');
      item.append(node('span', '', label), value);
      strip.append(item);
      refs.telemetry.push({ key, value });
    }
    return strip;
  }
  function render() {
    if (!lesson || stage === 'closed' || disposed) return;
    const focusAction = root.contains(doc.activeElement)
      ? doc.activeElement?.dataset.coachAction
      : null;
    refs = { sticks: [] };
    root.replaceChildren();
    root.hidden = false;
    root.classList.add('beginner-coach');
    root.dataset.stage = stage;
    root.dataset.reducedMotion = String(Boolean(snapshot.reducedMotion));
    root.setAttribute('aria-label', t('Your flight coach', 'Ваш інструктор польоту'));
    const step = displayedStep(),
      index = stage === 'guide' ? viewedStep : activeStep();
    const card = node('section', 'coach-card');
    let notes = null;
    const startLabel = () =>
      replay
        ? t('Continue playback', 'Продовжити перегляд')
        : activeStep() > 0 || (snapshot.state?.ticks ?? 0) > 0
          ? t('Back to practice →', 'До практики →')
          : t('Let’s fly →', 'Почнімо політ →');
    const heading = node('header', 'coach-heading'),
      eyebrow = node(
        'p',
        'coach-eyebrow',
        t(
          `FLIGHT SCHOOL · ${String((lesson.index ?? 0) + 1).padStart(2, '0')} / 14`,
          `ШКОЛА ПОЛЬОТІВ · ${String((lesson.index ?? 0) + 1).padStart(2, '0')} / 14`,
        ),
      );
    const headingText = node('div', '');
    headingText.append(
      eyebrow,
      node(
        stage === 'guide' ? 'h2' : 'h3',
        '',
        stage === 'guide' ? copy(lesson.title) : copy(step?.title),
      ),
    );
    heading.append(headingText);
    if (stage === 'live')
      heading.append(button('guide', t('Explain', 'Пояснення'), 'coach-explain'));
    if (stage === 'guide') {
      const close = button('exit', '×', 'coach-exit');
      close.setAttribute('aria-label', t('Back to school', 'До школи'));
      close.title = t('Back to school', 'До школи');
      heading.append(button('start', startLabel(), 'primary coach-start'), close);
    }
    card.append(heading);
    if (stage === 'complete') {
      card.append(
        node(
          'p',
          'coach-success',
          t('✓ Lesson complete · recording verified', '✓ Урок завершено · запис перевірено'),
        ),
        node('p', '', copy(lesson.concept)),
      );
      const actions = node('div', 'coach-actions');
      if (nextAvailable)
        actions.append(button('next', t('Next lesson →', 'Наступний урок →'), 'primary'));
      actions.append(
        button('retry', t('Fly it again', 'Пролетіти ще раз')),
        button('exit', t('Back to school', 'До школи')),
      );
      card.append(actions);
      root.append(card);
      return;
    }
    const progress = node('div', 'coach-progress');
    progress.setAttribute('aria-label', t('Lesson steps', 'Кроки уроку'));
    for (const [i, entry] of lesson.steps.entries()) {
      const item =
        stage === 'guide' ? button(`step-${i}`, String(i + 1)) : node('span', '', String(i + 1));
      item.className = 'coach-step-dot';
      item.dataset.state = i < activeStep() ? 'done' : i === index ? 'current' : 'later';
      if (i === index) item.setAttribute('aria-current', 'step');
      item.setAttribute('aria-label', `${i + 1}. ${copy(entry.title)}`);
      if (stage === 'guide') item.title = copy(entry.title);
      progress.append(item);
    }
    card.append(progress);
    if (stage === 'guide') {
      notes = node('details', 'coach-notes');
      notes.append(
        node(
          'summary',
          '',
          t('Lesson notes & keyboard controls', 'Нотатки до уроку та клавіатура'),
        ),
      );
      notes.append(
        node('p', 'coach-summary', copy(lesson.summary)),
        node(
          'p',
          'coach-pause-note',
          t(
            'Read and explore with motors off, then start practice when you are ready.',
            'Читайте й досліджуйте з вимкненими моторами, а коли будете готові — починайте практику.',
          ),
        ),
      );
      const lessonStep = node('section', 'coach-step-copy');
      lessonStep.append(
        node(
          'p',
          'coach-step-label',
          t(
            `STEP ${index + 1} OF ${lesson.steps.length}`,
            `КРОК ${index + 1} ІЗ ${lesson.steps.length}`,
          ),
        ),
        node('h3', '', copy(step?.title)),
        node('p', 'coach-instruction', copy(step?.instruction)),
      );
      card.append(lessonStep);
      if (isExploring()) {
        const picker = node('div', 'coach-axis-picker');
        picker.setAttribute('role', 'group');
        picker.setAttribute(
          'aria-label',
          t('Explore a control with motors off', 'Дослідіть керування з вимкненими моторами'),
        );
        for (const axis of AXES) {
          const choice = button(`axis-${axis}`, axisName(axis));
          choice.setAttribute('aria-pressed', String(explored === axis));
          picker.append(choice);
        }
        card.append(picker);
      }
      const visuals = node('div', 'coach-visuals'),
        controller = node('section', 'coach-controller');
      const stickMode = STICK_LAYOUTS[snapshot.stickMode] ? snapshot.stickMode : 2;
      controller.append(
        node(
          'h3',
          '',
          t(`YOUR CONTROLS · MODE ${stickMode}`, `ВАШЕ КЕРУВАННЯ · MODE ${stickMode}`),
        ),
      );
      refs.signal = node('p', 'coach-example-note');
      notes.append(refs.signal);
      const sticks = node('div', 'coach-sticks');
      for (const side of [0, 1]) sticks.append(makeStick(side, STICK_LAYOUTS[stickMode], step));
      controller.append(sticks);
      const legend = node('p', 'coach-dot-legend');
      legend.append(
        node(
          'span',
          'coach-legend-live',
          replay ? t('Recorded input', 'Записаний сигнал') : t('Your input', 'Ваш сигнал'),
        ),
        node('span', 'coach-legend-example', t('Example movement', 'Приклад руху')),
      );
      controller.append(
        legend,
        node(
          'p',
          'coach-example-note',
          t(
            'The hollow dot demonstrates one small movement, not autopilot. Watch the drone and adjust gently.',
            'Порожня крапка показує один невеликий рух, а не автопілот. Стежте за дроном і коригуйте плавно.',
          ),
        ),
      );
      visuals.append(controller);
      const behavior = node('section', 'coach-behavior');
      behavior.append(
        node('h3', '', t('WHAT THE DRONE DOES', 'ЩО РОБИТЬ ДРОН')),
        makeDrone(step),
        node(
          'p',
          '',
          isExploring() ? axisExplanation(explored) : copy(step?.why) || copy(lesson.concept),
        ),
      );
      visuals.append(behavior);
      card.append(visuals);
      const keys = node('p', 'coach-keys');
      keys.append(node('strong', '', t('Keyboard: ', 'Клавіатура: ')));
      for (const [key, axis] of [
        ['↑ / ↓', 'throttle'],
        ['Q / E', 'yaw'],
        ['W / S', 'pitch'],
        ['A / D', 'roll'],
      ])
        keys.append(node('kbd', '', key), node('span', '', axisName(axis)));
      keys.append(
        node(
          'small',
          '',
          t(
            'Hold Shift for finer movements. Throttle stays where you set it.',
            'Утримуйте Shift для точніших рухів. Газ залишається у встановленому положенні.',
          ),
        ),
      );
      notes.append(keys);
      const tip = node('aside', 'coach-tip');
      tip.append(
        node('strong', '', t('Pilot’s tip', 'Порада пілота')),
        node('p', '', copy(step?.tip)),
      );
      notes.append(tip);
    } else card.append(node('p', 'coach-instruction', copy(step?.instruction)));
    const target = node('p', 'coach-target', objectiveText(criterion(index)));
    refs.hint = node('p', 'coach-live-hint');
    refs.hint.setAttribute('role', 'status');
    refs.hint.setAttribute('aria-live', 'polite');
    const hold = node('div', 'coach-hold');
    refs.hold = node('div', 'coach-hold-fill');
    hold.append(refs.hold);
    hold.setAttribute('aria-hidden', 'true');
    (notes ?? card).append(target, makeTelemetry(), hold, refs.hint);
    if (notes) card.append(notes);
    if (stage === 'guide') {
      const actions = node('div', 'coach-actions');
      actions.append(
        button('start', startLabel(), 'primary'),
        button('radio', t('Set up radio', 'Налаштувати пульт')),
        button('exit', t('Back to school', 'До школи')),
      );
      card.append(
        actions,
        node(
          'p',
          'coach-pause-note',
          t(
            'Flight stays paused while this guide is open. The real arm and throttle checks still apply.',
            'Поки пояснення відкрито, політ залишається на паузі. Звичайні перевірки газу та увімкнення діють.',
          ),
        ),
      );
    }
    root.append(card);
    if (focusAction)
      root.querySelector(`[data-coach-action="${focusAction}"]`)?.focus({ preventScroll: true });
    paint();
  }
  function paint() {
    if (!lesson || !refs.sticks) return;
    const input = controls();
    if (refs.signal)
      refs.signal.textContent =
        snapshot.source === 'radio'
          ? snapshot.monitorAvailable === false
            ? t('Radio disconnected · no live signal', 'Пульт відключено · живого сигналу немає')
            : t(
                'Move your radio sticks: the cyan dots follow the calibrated signal while the drone stays paused.',
                'Рухайте стіки пульта: блакитні крапки показують калібрований сигнал, а дрон залишається на паузі.',
              )
          : replay
            ? t(
                'Cyan dots show the recorded commands.',
                'Блакитні крапки показують записані команди.',
              )
            : t(
                'While paused, the cyan dots show the last flight input. Explore the illustrated movement; keyboard and touch movement starts in practice.',
                'На паузі блакитні крапки показують останній сигнал польоту. Дослідіть рух на ілюстрації; клавіатура й сенсорне керування працюють під час практики.',
              );
    for (const stick of refs.sticks) {
      const x = input[stick.h],
        y = stick.v === 'throttle' ? input[stick.v] * 2 - 1 : input[stick.v];
      stick.live.setAttribute('cx', 90 + x * 60);
      stick.live.setAttribute('cy', 90 - y * 60);
      stick.readout.textContent = `${axisName(stick.h)} ${Math.round(x * 100)}% · ${axisName(stick.v)} ${Math.round(input[stick.v] * 100)}%`;
    }
    const state = snapshot.state,
      at = state?.attitude;
    const values = {
      height: `${((state?.position?.y ?? 0) / 1000).toFixed(1)} ${t('m', 'м')}`,
      speed: `${(Math.hypot(state?.velocity?.x ?? 0, state?.velocity?.y ?? 0, state?.velocity?.z ?? 0) / 1000).toFixed(1)} ${t('m/s', 'м/с')}`,
      tilt: `${(Math.max(Math.abs(at?.roll ?? 0), Math.abs(at?.pitch ?? 0)) / 100).toFixed(0)}°`,
      throttle: `${Math.round(input.throttle * 100)}%`,
    };
    for (const item of refs.telemetry ?? []) item.value.textContent = values[item.key];
    if (refs.hint) {
      const text = hint();
      if (refs.hint.textContent !== text) refs.hint.textContent = text;
    }
    if (refs.hold)
      refs.hold.style.width = `${clamp((state?.hold ?? 0) / (criterion()?.ticks || 1), 0, 1) * 100}%`;
  }
  function showGuide() {
    if (!lesson || disposed || stage === 'complete') return;
    onPause();
    stage = 'guide';
    viewedStep = activeStep();
    render();
    root.querySelector('[data-coach-action="start"]')?.focus({ preventScroll: true });
  }
  function click(event) {
    const action = event.target.closest?.('[data-coach-action]')?.dataset.coachAction;
    if (!action || !lesson || disposed) return;
    if (action === 'start') {
      stage = 'live';
      render();
      onStart();
    } else if (action === 'guide') showGuide();
    else if (action === 'radio') {
      onPause();
      onRadio();
    } else if (action === 'retry') onRetry();
    else if (action === 'next') onNext();
    else if (action === 'exit') {
      onPause();
      onExit();
    } else if (action.startsWith('axis-') && AXES.includes(action.slice(5))) {
      explored = action.slice(5);
      render();
    } else if (action.startsWith('step-')) {
      viewedStep = clamp(Number(action.slice(5)), 0, lesson.steps.length - 1);
      render();
    }
  }
  root.addEventListener('click', click);
  root.hidden = true;
  return {
    open(value, options = {}) {
      if (disposed) return;
      lesson = value;
      snapshot = {};
      replay = Boolean(options.replay);
      explored = 'throttle';
      viewedStep = 0;
      lastRender = '';
      lastPaint = 0;
      stage = options.practice || replay ? 'live' : 'guide';
      if (stage === 'guide') onPause();
      render();
    },
    update(value) {
      if (!lesson || disposed || stage === 'closed') return;
      snapshot = { ...snapshot, ...value };
      const key = `${lang()}|${activeStep()}|${snapshot.stickMode}|${snapshot.source}|${snapshot.monitorAvailable}|${snapshot.mode}|${Boolean(snapshot.reducedMotion)}`;
      if (key !== lastRender) {
        lastRender = key;
        render();
      }
      const now = win.performance?.now?.() ?? Date.now();
      if (now - lastPaint >= 80) {
        lastPaint = now;
        paint();
      }
    },
    blocksArm: () => Boolean(lesson && stage === 'guide'),
    showGuide,
    complete({ verified, nextAvailable: hasNext = false } = {}) {
      if (!lesson || disposed || !verified) return;
      nextAvailable = hasNext;
      stage = 'complete';
      render();
    },
    close() {
      stage = 'closed';
      lesson = null;
      refs = {};
      root.replaceChildren();
      root.hidden = true;
    },
    dispose() {
      disposed = true;
      root.removeEventListener('click', click);
      root.replaceChildren();
      root.hidden = true;
      lesson = null;
      refs = {};
    },
  };
}
