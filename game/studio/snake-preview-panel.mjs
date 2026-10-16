import { createSnakeStudioPreview } from './snake-preview.mjs';
import { createClassicPresentation } from '../snake/classic-presentation.mjs';
import { CLASSIC_COPY } from '../snake/classic-copy.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { createEncounterDisplayPreferences } from '../encounter-display-preferences.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';

/** The editor owns the draft; this disclosure owns only an expendable preview.
 * Closing it releases the shared artwork lease, effects and canvas bitmaps. */
export function mountSnakeStudioPreview({ container, getLevel, getCast, language = 'en' }) {
  const doc = container.ownerDocument,
    win = doc.defaultView,
    words = (en, uk) => (language === 'uk' ? uk : en),
    copy = CLASSIC_COPY[language];
  const element = (tag, text, attributes = {}) => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  };
  const details = element('details', null, { class: 'snake-play-preview' });
  details.append(element('summary', words('Play preview', 'Перегляд у грі')));
  const fields = element('div', null, { class: 'fields' });
  const choice = (title, rows) => {
    const label = element('label', title),
      select = element('select');
    for (const [value, text] of rows) select.append(element('option', text, { value }));
    label.append(select);
    fields.append(label);
    return select;
  };
  const mode = choice(words('Mode', 'Режим'), [
    ['solo', copy.solo],
    ['versus', copy.versus],
    ['team', copy.team],
  ]);
  const boardStyle = choice(words('Board appearance', 'Вигляд поля'), [
    ['theme', words('Game theme', 'Тема гри')],
    ['retro', 'Retro Field'],
  ]);
  const bodyStyle = choice(words('Body appearance', 'Вигляд хвоста'), [
    ['cable', words('Cable', 'Кабель')],
    ['signal', words('Signal', 'Сигнал')],
  ]);
  const actions = element('div', null, { class: 'actions' });
  const action = (label, handler) => {
    const node = element('button', label, { type: 'button' });
    node.addEventListener('click', handler);
    actions.append(node);
    return node;
  };
  const play = action(words('Start preview', 'Почати перегляд'), () => {
    if (!session) return;
    session.preview.setPlaying(!session.preview.snapshot().playing);
    lastFrame = null;
    render();
    schedule();
    canvases[0]?.focus({ preventScroll: true });
  });
  const step = action(words('One step', 'Один крок'), () => {
    stopFrame();
    session?.preview.step(options());
    render();
  });
  const restart = action(words('Restart preview', 'Перезапустити перегляд'), () => refresh(true));
  const status = element('p', '', { role: 'status', class: 'preview-status' }),
    stats = element('p', '', { class: 'preview-stats' }),
    boards = element('div', null, { class: 'preview-boards' }),
    controls = element('div', null, { class: 'preview-steering' });
  details.append(
    element(
      'p',
      words(
        'Try the current mission with the game’s renderer and rules. Seed 17; edits restart the preview paused. Preview play is silent and does not save records. Display, remains and destruction follow your game settings.',
        'Спробуйте поточну місію з виглядом і правилами гри. Зерно 17; зміни перезапускають перегляд на паузі. Перегляд без звуку та збереження рекордів. Вигляд, рештки й руйнування відповідають налаштуванням гри.',
      ),
    ),
    fields,
    actions,
    status,
    stats,
    boards,
    controls,
    element(
      'p',
      words(
        'Focus a preview board to steer. Solo: WASD or arrows. Two players: P1 WASD, P2 arrows. Space pauses. Queue a turn, then use One step to inspect corners, prey movement or a wrap crossing.',
        'Перейдіть на поле перегляду для керування. Соло: WASD або стрілки. Двоє: Г1 — WASD, Г2 — стрілки. Пробіл — пауза. Задайте поворот і натисніть «Один крок», щоб оглянути кут, рух здобичі чи перехід через край.',
      ),
    ),
  );
  container.append(details);
  let session = null,
    canvases = [],
    lastSource = null,
    frame = null,
    lastFrame = null;
  const options = () => ({
    boardStyle: boardStyle.value,
    style: bodyStyle.value,
    cast: getCast(),
    presentation: session?.presentation.snapshot(),
    reduced: session?.display.snapshot().effectiveReducedEffects,
    showRemains: session?.remains.snapshot().showRemains,
    ...session?.destruction.snapshot(),
    pixelRatio: win.devicePixelRatio ?? 1,
  });
  function stopFrame() {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = lastFrame = null;
  }
  function schedule() {
    if (frame !== null || !session?.preview.snapshot().playing || doc.hidden) return;
    frame = win.requestAnimationFrame((time) => {
      frame = null;
      if (!session || doc.hidden) return;
      session.preview.advance(lastFrame === null ? 0 : time - lastFrame, options());
      lastFrame = time;
      render();
      schedule();
    });
  }
  function render() {
    if (!session) return;
    const { playing, match } = session.preview.snapshot();
    play.disabled = step.disabled = !match || match.status !== 'running';
    restart.disabled = !match;
    controls.querySelectorAll('button').forEach((node) => (node.disabled = play.disabled));
    bodyStyle.disabled = boardStyle.value === 'retro';
    play.textContent = playing
      ? words('Pause preview', 'Призупинити перегляд')
      : words('Start preview', 'Почати перегляд');
    if (!match) return;
    const nextStatus =
      match.status === 'finished'
        ? words('Preview finished. Restart to try again.', 'Перегляд завершено. Спробуйте ще раз.')
        : playing
          ? words('Preview running.', 'Перегляд триває.')
          : words('Preview paused.', 'Перегляд на паузі.');
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
    stats.textContent = match.boards
      .map(
        (board, i) =>
          `${mode.value === 'versus' ? `${copy[i ? 'p2' : 'p1']}: ` : ''}${copy.caught} ${board.catches}/${board.goal ?? '∞'} · ${words('Step', 'Крок')} ${board.tick} · ${copy.length} ${board.lengths.join(' / ')}${board.status === 'running' ? '' : ` · ${copy[board.status]}`}`,
      )
      .join(' | ');
    session.preview.draw(canvases, options());
  }
  function rebuildBoards() {
    const count = mode.value === 'versus' ? 2 : 1;
    canvases.forEach((canvas) => (canvas.width = canvas.height = 0));
    canvases = Array.from({ length: count }, (_, i) =>
      element('canvas', null, {
        width: '1',
        height: '1',
        tabindex: '0',
        role: 'img',
        'aria-label': `${words('Snake play preview', 'Перегляд гри Snake')}${count === 2 ? ` · ${copy[i ? 'p2' : 'p1']}` : ''}`,
      }),
    );
    boards.replaceChildren(...canvases);
    controls.replaceChildren();
    for (let seat = 0; seat < (mode.value === 'solo' ? 1 : 2); seat++) {
      const group = element('fieldset'),
        pad = element('div', null, { class: 'preview-pad' });
      group.append(element('legend', copy[seat ? 'p2' : 'p1']), pad);
      for (const [direction, symbol, label] of [
        ['up', '↑', words('Up', 'Угору')],
        ['left', '←', words('Left', 'Ліворуч')],
        ['down', '↓', words('Down', 'Униз')],
        ['right', '→', words('Right', 'Праворуч')],
      ]) {
        const node = element('button', symbol, {
          type: 'button',
          'data-direction': direction,
          'aria-label': `${copy[seat ? 'p2' : 'p1']} · ${label}`,
        });
        const turn = () => session?.preview.turn(seat, direction);
        node.addEventListener('pointerdown', (event) => {
          if (event.button !== 0 || node.disabled) return;
          event.preventDefault();
          turn();
        });
        node.addEventListener('click', (event) => {
          if (event.detail === 0) turn();
        });
        pad.append(node);
      }
      controls.append(group);
    }
  }
  function refresh(force = false) {
    if (!session) return;
    const level = getLevel(),
      source = JSON.stringify([mode.value, level]);
    if (force || source !== lastSource) {
      stopFrame();
      lastSource = source;
      try {
        session.preview.load(level, { mode: mode.value });
        rebuildBoards();
      } catch (error) {
        canvases.forEach((canvas) => (canvas.width = canvas.height = 0));
        boards.replaceChildren();
        controls.replaceChildren();
        canvases = [];
        status.textContent = `${words('Fix the mission before previewing', 'Виправте місію перед переглядом')}: ${error.message}`;
        stats.textContent = '';
      }
    }
    render();
  }
  function close() {
    stopFrame();
    const previous = session;
    session = null;
    lastSource = null;
    previous?.stops.forEach((stop) => stop());
    previous?.preview.dispose();
    previous?.presentation.dispose();
    previous?.display.dispose();
    previous?.remains.dispose();
    previous?.destruction.dispose();
    canvases.forEach((canvas) => (canvas.width = canvas.height = 0));
    canvases = [];
    boards.replaceChildren();
    controls.replaceChildren();
  }
  function open() {
    if (session || !details.open) return;
    const display = createDisplayPreferences({ window: win, getStorage: () => win.localStorage });
    session = {
      preview: createSnakeStudioPreview(),
      display,
      remains: createEncounterDisplayPreferences({
        window: win,
        getStorage: () => win.localStorage,
      }),
      destruction: createDestructionPreferences({
        window: win,
        getStorage: () => win.localStorage,
      }),
      presentation: createClassicPresentation({
        window: win,
        document: doc,
        displayPreferences: display,
        onChange: render,
      }),
      stops: [],
    };
    session.stops = [session.display, session.remains, session.destruction].map((owner) =>
      owner.subscribe(render),
    );
    refresh(true);
  }
  details.addEventListener('toggle', () => (details.open ? open() : close()));
  mode.addEventListener('change', () => refresh(true));
  boardStyle.addEventListener('change', render);
  bodyStyle.addEventListener('change', render);
  boards.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const key =
      { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' }[event.code] ?? event.key.toLowerCase();
    if (key === ' ') {
      event.preventDefault();
      if (!event.repeat && !play.disabled) play.click();
      return;
    }
    const direction = {
      w: 'up',
      a: 'left',
      s: 'down',
      d: 'right',
      arrowup: 'up',
      arrowleft: 'left',
      arrowdown: 'down',
      arrowright: 'right',
    }[key];
    if (!direction) return;
    event.preventDefault();
    if (!event.repeat)
      session?.preview.turn(mode.value !== 'solo' && key.startsWith('arrow') ? 1 : 0, direction);
  });
  const hide = () => {
    if (!doc.hidden) return;
    stopFrame();
    session?.preview.setPlaying(false);
    render();
  };
  doc.addEventListener('visibilitychange', hide);
  win.addEventListener('resize', render);
  win.addEventListener('pagehide', close);
  win.addEventListener('pageshow', open);
  return Object.freeze({ refresh });
}
