import { mountModePlayShell } from '../../game/ui/mode-play-shell.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';
import { createFlightMenuNavigation } from '../civilian-fpv/input.mjs';
import { createPracticeAudio } from './audio.mjs';
import { getLocale, setLocale, onLocaleChange } from '../../game/i18n/index.mjs';
import { CIVILIAN_PRACTICE_CATALOGUE } from './catalogue.mjs';
import {
  createPractice,
  validatePracticeCatalogue,
  exportPracticeCatalogue,
  replayPractice,
  validatePracticeInput,
  PRACTICE_HZ,
} from './model.mjs';
import { attachPracticeInput } from './input.mjs';
import { PRACTICE_COPY } from './copy.mjs';
import { preparePracticeOffline, removePracticeOffline } from './offline.mjs';

export function mountCivilianPractice({ document: doc, window: win }) {
  const launchLocale = win.location?.href && new URL(win.location.href).searchParams.get('lang');
  if (launchLocale === 'en' || launchLocale === 'uk') setLocale(launchLocale);
  const $ = (id) => doc.getElementById(id);
  const tr = (key) => (PRACTICE_COPY[getLocale()] ?? PRACTICE_COPY.en)[key];
  let catalogue = validatePracticeCatalogue(CIVILIAN_PRACTICE_CATALOGUE),
    model = createPractice(catalogue, catalogue.drills[0].id),
    commands = [],
    recordingTicks = 0,
    recordingFull = false,
    previous = null,
    accumulator = 0,
    frame = null,
    disposed = false,
    playShell = null,
    gamepads = [];
  const readGamepads = () => {
    try {
      gamepads = Array.from(win.navigator?.getGamepads?.() ?? []);
    } catch {
      gamepads = [];
    }
    return gamepads;
  };
  const completed = new Set();
  const audio = createPracticeAudio({ window: win });
  const updateSound = () => {
    $('sound').textContent = tr(audio.enabled() ? 'soundOn' : 'soundOff');
    $('sound').setAttribute('aria-pressed', String(audio.enabled()));
    playShell?.update({ muted: !audio.enabled() });
  };
  const stopSound = audio.subscribe(updateSound);
  const canvas = $('board');
  let context;
  try {
    context = canvas.getContext('2d');
  } catch {
    /* readable capability fallback */
  }
  $('fallback').hidden = !!context;
  const pause = () => {
    model.pause();
    audio.pause();
    input?.clear();
    accumulator = 0;
    render();
  };
  const input = attachPracticeInput({
    document: doc,
    window: win,
    arena: $('arena'),
    buttons: [...doc.querySelectorAll('[data-axis]')],
    active: () => model.snapshot().status === 'active' && !$('help-dialog').open,
    readGamepads: () => gamepads,
    onPause(reason) {
      pause();
      if (reason === 'menu') playShell?.openHome();
    },
    onStatus: (key) => {
      $('pad-status').textContent = tr(key === 'ready' ? 'connected' : key);
    },
  });
  const authored = () => model.drill().locales[getLocale()] ?? model.drill().locales.en;
  function options() {
    $('drill').replaceChildren(
      ...catalogue.drills.map((drill) => {
        const option = doc.createElement('option');
        option.value = drill.id;
        option.textContent = `${completed.has(`${model.identity}:${drill.id}`) ? '✓ ' : ''}${(drill.locales[getLocale()] ?? drill.locales.en).title}`;
        return option;
      }),
    );
    $('drill').value = model.drill().id;
  }
  function render() {
    if (disposed) return;
    const state = model.snapshot(),
      target = state.target,
      copy = authored();
    $('status').textContent = recordingFull
      ? tr('sessionFull')
      : `${tr(state.status === 'complete' ? 'complete' : state.status)} · ${tr('progress')} ${state.checkpoint}/${state.total}`;
    $('brief').textContent = copy.brief;
    $('readout').textContent =
      `${tr('position')} ${(state.x / 100).toFixed(1)}, ${(state.z / 100).toFixed(1)} m · ${tr('height')} ${(state.altitude / 100).toFixed(2)} m · ${tr('heading')} ${state.heading}°`;
    $('target').textContent = target
      ? `${tr('target')} ${state.checkpoint + 1}: ${(target.x / 100).toFixed(1)}, ${(target.z / 100).toFixed(1)} m · ${tr('height')} ${(target.altitude / 100).toFixed(2)} ± ${(target.verticalTolerance / 100).toFixed(2)} m${target.heading === null ? '' : ` · ${tr('heading')} ${target.heading}° ± ${target.headingTolerance}°`} · ${tr(target.landed ? 'land' : 'hold')}: ${state.holdTicks}/${target.holdTicks}`
      : tr('complete');
    $('discovery').textContent = state.status === 'complete' ? copy.discovery : '';
    $('start').disabled = recordingFull || state.status === 'active' || state.status === 'complete';
    $('pause').disabled = state.status !== 'active';
    playShell?.update({
      phase:
        state.status === 'active'
          ? 'playing'
          : state.status === 'complete'
            ? 'results'
            : state.status,
      missionName: copy.title,
      summary: copy.brief,
      canResume: !recordingFull && state.ticks > 0 && state.status !== 'complete',
      muted: !audio.enabled(),
    });
    draw(state);
  }
  function draw(state) {
    if (!context) return;
    const ctx = context,
      width = canvas.width,
      height = canvas.height,
      sx = width / catalogue.world.width,
      sy = height / catalogue.world.depth;
    ctx.fillStyle = '#091814';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#355c4b';
    ctx.lineWidth = 1;
    for (let number = 0; number <= 10; number++) {
      ctx.beginPath();
      ctx.moveTo((number * width) / 10, 0);
      ctx.lineTo((number * width) / 10, height);
      ctx.moveTo(0, (number * height) / 10);
      ctx.lineTo(width, (number * height) / 10);
      ctx.stroke();
    }
    const points = model.drill().checkpoints;
    ctx.strokeStyle = '#567363';
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x * sx, point.z * sy);
      else ctx.lineTo(point.x * sx, point.z * sy);
    });
    ctx.stroke();
    points.forEach((point, index) => {
      if (index < state.checkpoint) return;
      const active = index === state.checkpoint;
      ctx.strokeStyle = active ? '#f6c66f' : '#799d8a';
      ctx.lineWidth = active ? 4 : 1;
      ctx.beginPath();
      ctx.arc(point.x * sx, point.z * sy, point.radius * sx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = '18px system-ui';
      ctx.fillText(String(index + 1), point.x * sx + point.radius * sx + 3, point.z * sy);
    });
    ctx.save();
    ctx.translate(state.x * sx, state.z * sy);
    ctx.rotate((state.heading * Math.PI) / 180);
    ctx.fillStyle = '#dcf59e';
    ctx.strokeStyle = '#07100b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 13);
    ctx.lineTo(0, 6);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const meterY = height - 20 - (state.altitude / catalogue.world.ceiling) * (height - 40);
    ctx.fillStyle = '#eef5e8';
    ctx.fillRect(width - 12, meterY, 8, 8);
  }
  function localized() {
    doc.documentElement.lang = getLocale();
    for (const node of doc.querySelectorAll('[data-copy]'))
      node.textContent = tr(node.dataset.copy);
    $('language').value = getLocale();
    $('arena').setAttribute('aria-label', tr('arena'));
    doc.querySelector('.touch-controls').setAttribute('aria-label', tr('touch'));
    $('catalogue').setAttribute('aria-label', tr('json'));
    options();
    updateSound();
    playShell?.setLocale(getLocale());
    for (const { node, en, uk } of modeLabels) node.textContent = getLocale() === 'uk' ? uk : en;
    render();
  }
  function reset(drillId = model.drill().id) {
    audio.reset();
    input.clear();
    model = createPractice(catalogue, drillId);
    commands = [];
    recordingTicks = 0;
    recordingFull = false;
    accumulator = 0;
    options();
    render();
  }
  const trace = () => ({
    format: 'revealline-practice-transcript.v1',
    catalogueIdentity: model.identity,
    drillId: model.drill().id,
    commands: structuredClone(commands),
  });
  function advance() {
    const command = validatePracticeInput(input.sample());
    if (model.snapshot().status !== 'active') return;
    if (recordingTicks >= 72000 || commands.length >= 12000) {
      recordingFull = true;
      pause();
      return;
    }
    const last = commands.at(-1);
    if (last && last.ticks < 200 && JSON.stringify(last.input) === JSON.stringify(command))
      last.ticks++;
    else commands.push({ ticks: 1, input: command });
    recordingTicks++;
    audio.update(model.snapshot(), command);
    const state = model.step(command);
    audio.update(state, command);
    if (state.status === 'complete') {
      input.clear();
      if (replayPractice(catalogue, trace()).status === 'complete')
        completed.add(`${model.identity}:${model.drill().id}`);
      options();
    }
  }
  function tick(now) {
    if (disposed) return;
    menuNavigation.poll({ now, gamepads: readGamepads() });
    if (previous !== null && now - previous > 1000) pause();
    if (model.snapshot().status === 'active') {
      accumulator += previous === null ? 0 : Math.max(0, Math.min(250, now - previous));
      while (accumulator >= 1000 / PRACTICE_HZ && model.snapshot().status === 'active') {
        accumulator -= 1000 / PRACTICE_HZ;
        advance();
      }
      render();
    }
    previous = now;
    frame = win.requestAnimationFrame(tick);
  }
  $('start').onclick = () => {
    input.clear();
    playShell?.enterPlay();
    model.start();
    void audio.resume();
    previous = null;
    accumulator = 0;
    $('arena').focus();
    render();
  };
  $('pause').onclick = pause;
  $('sound').onclick = async () => {
    await audio.setEnabled(!audio.enabled());
    updateSound();
    render();
  };
  $('reset').onclick = () => reset();
  $('drill').onchange = () => reset($('drill').value);
  $('language').onchange = () => setLocale($('language').value);
  $('connect').onclick = () => {
    pause();
    readGamepads();
    input.connect();
  };
  $('help').onclick = () => {
    pause();
    $('help-dialog').showModal();
  };
  $('close-help').onclick = () => $('help-dialog').close();
  $('help-dialog').addEventListener('close', () => {
    input.clear();
    (playShell?.topDialog()?.querySelector('h1') ?? $('arena')).focus();
  });
  $('export').onclick = () => {
    $('catalogue').value = exportPracticeCatalogue(catalogue);
    $('catalogue').focus();
  };
  $('export-trace').onclick = () => {
    $('catalogue').value = JSON.stringify(trace());
    $('author-status').textContent = tr('traceReady');
  };
  $('import').onclick = () => {
    try {
      const checked = validatePracticeCatalogue($('catalogue').value);
      catalogue = checked;
      reset(checked.drills[0].id);
      $('author-status').textContent = tr('imported');
    } catch {
      $('author-status').textContent = tr('invalid');
    }
  };
  $('offline').onclick = async () => {
    try {
      await preparePracticeOffline({ navigator: win.navigator, location: win.location });
      $('package-status').textContent = tr('installed');
    } catch {
      $('package-status').textContent = tr('installFailed');
    }
  };
  $('remove-offline').onclick = async () => {
    try {
      await removePracticeOffline({
        navigator: win.navigator,
        caches: win.caches,
        location: win.location,
      });
      $('package-status').textContent = tr('removed');
    } catch {
      $('package-status').textContent = tr('installFailed');
    }
  };
  const section = (className) => {
    const node = doc.createElement('section');
    node.className = className;
    return node;
  };
  const playSurface = doc.querySelector('main');
  playSurface.classList.add('gym-play-surface');
  const missions = section('gym-missions');
  missions.append($('drill').closest('label'), $('brief'));
  const briefing = section('gym-briefing');
  const instructions = doc.createElement('p');
  instructions.dataset.copy = 'instructions';
  briefing.append(instructions);
  const settings = section('gym-settings');
  const language = doc.createElement('label');
  const languageName = doc.createElement('span');
  languageName.textContent = 'Language / Мова';
  language.append(languageName, $('language'));
  settings.append(language, $('sound'), $('connect'), $('pad-status'), $('instructions'));
  const expert = section('gym-expert');
  const helper = $('help');
  expert.append(helper);
  const modes = section('gym-mode-links');
  let arcadeRoot = null;
  try {
    const current = new URL(win.location.href);
    const retained = current.searchParams.get('game-return');
    const supplied = retained ? new URL(retained, current) : null;
    const source = /^(.*\/)optional-practice\/civilian-flight\/(?:index\.html)?$/.exec(
      current.pathname,
    );
    const target =
      supplied ??
      (source && ['localhost', '127.0.0.1', '[::1]'].includes(current.hostname)
        ? new URL(source[1] + 'game/', current)
        : null);
    if (target && target.origin === current.origin && !target.username && !target.password) {
      const match =
        /^(.*\/game\/)(?:index\.html|company\.html|couch\/(?:index\.html|relay-rescue\.html)?|snake\/(?:index\.html|play\.html)?)?$/.exec(
          target.pathname,
        );
      if (match) arcadeRoot = new URL(match[1], target);
    }
  } catch {
    /* Isolated packages do not invent an arcade installation. */
  }
  const modeLabels = [];
  for (const [path, en, uk] of [
    ['', 'Solo', 'Соло'],
    ['couch/', 'Versus', 'Двобій'],
    ['couch/relay-rescue.html', 'Team', 'Команда'],
    [null, 'FPV SIM', 'FPV SIM'],
    ['snake/play.html', 'Snake', 'Змійка'],
  ]) {
    if (!arcadeRoot && path !== null) continue;
    const node = doc.createElement(path === null ? 'button' : 'a');
    node.className = 'button';
    setMenuIcon(
      node,
      { Solo: 'solo', Versus: 'versus', Team: 'team', 'FPV SIM': 'simulator', Snake: 'controls' }[
        en
      ],
    );
    modeLabels.push({ node, en, uk });
    node.textContent = getLocale() === 'uk' ? uk : en;
    if (path === null) {
      node.type = 'button';
      node.setAttribute('aria-current', 'page');
    } else {
      const target = new URL(path, arcadeRoot);
      target.searchParams.set('lang', getLocale());
      node.href = target.href;
      node.onclick = () => {
        target.searchParams.set('lang', getLocale());
        node.href = target.href;
      };
    }
    modes.append(node);
  }
  const wordmarkURL = arcadeRoot
    ? new URL('ui/art/identity/fpv-line/wordmark.png', arcadeRoot).href
    : '';
  doc.querySelector('body > header').hidden = true;
  doc.querySelector('.gym-toolbar').hidden = true;
  playShell = mountModePlayShell({
    document: doc,
    mount: doc.body,
    idPrefix: 'gym-shell',
    wordmarkURL,
    modeName: () => (getLocale() === 'uk' ? 'FPV SIM · Тренувальний зал' : 'FPV SIM · Flight gym'),
    locale: getLocale(),
    services: { setMenuIcon },
    slots: { modes, missions, briefing, play: playSurface, settings, expert },
    actions: {
      pause,
      start: () => {
        $('start').click();
      },
      resume: () => {
        $('start').click();
      },
      retry: () => {
        reset();
        $('start').click();
      },
      continue: () => {
        $('start').click();
      },
      canResume: () =>
        model.snapshot().ticks > 0 && model.snapshot().status !== 'complete' && !recordingFull,
      toggleSound: () => {
        $('sound').click();
      },
      fullscreen: () => {
        pause();
        const request = doc.fullscreenElement
          ? doc.exitFullscreen?.()
          : doc.documentElement.requestFullscreen?.();
        void request?.catch?.(() => {});
      },
      open(surface) {
        if (model.snapshot().status === 'active') pause();
        if (surface === 'results') {
          // The completed board and discovery remain the native result scene.
          playShell.enterPlay();
          $('discovery').setAttribute('tabindex', '-1');
          $('discovery').focus();
          return false;
        }
        if (surface === 'briefing') render();
        if (surface === 'workshop' || surface === 'help') {
          $('help').click();
          if (surface === 'workshop') $('help-dialog').querySelector('details').open = true;
          return false;
        }
      },
    },
    initial: 'home',
    focusPlay: () => $('arena').focus(),
  });
  const menuHint = doc.createElement('p');
  menuHint.className = 'gym-menu-hint';
  const menuContext = () => {
    const dialog = $('help-dialog').open ? $('help-dialog') : playShell.topDialog();
    if (dialog) return { root: dialog, key: dialog.id, blockRadio: true };
    if (model.snapshot().status === 'active') return null;
    return {
      root: playShell.elements.root,
      key: `gym:${model.snapshot().status}`,
      blockRadio: true,
    };
  };
  const menuNavigation = createFlightMenuNavigation({
    document: doc,
    window: win,
    locale: getLocale,
    getContext: menuContext,
    onHint(value) {
      const context = menuContext();
      if (!value && context?.root.dataset.modeSurface) return;
      menuHint.hidden = !context;
      if (context && menuHint.parentNode !== context.root) context.root.append(menuHint);
      if (menuHint.textContent !== value) menuHint.textContent = value;
    },
    onBack() {
      if ($('help-dialog').open) $('close-help').click();
      else if (playShell.topDialog()) playShell.back();
      else playShell.openHome();
    },
  });
  const stopLocale = onLocaleChange(localized);
  localized();
  frame = win.requestAnimationFrame(tick);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    menuNavigation.dispose();
    menuHint.remove();
    playShell?.dispose();
    input.dispose();
    stopSound();
    audio.dispose();
    $('sound').onclick = null;
    stopLocale();
    win.cancelAnimationFrame(frame);
    win.removeEventListener('pagehide', pagehide);
    win.removeEventListener('orientationchange', pause);
  };
  const pagehide = (event) => {
    pause();
    if (!event.persisted) dispose();
  };
  win.addEventListener('pagehide', pagehide);
  win.addEventListener('orientationchange', pause);
  return {
    dispose,
    snapshot: () => model.snapshot(),
    trace,
    catalogue: () => validatePracticeCatalogue(catalogue),
  };
}
if (typeof document !== 'undefined' && document.getElementById('arena'))
  mountCivilianPractice({ document, window });
