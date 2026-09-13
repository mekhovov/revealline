import { createCouchShell } from './couch-shell.mjs';
import { onNativeInactive } from '../platform.mjs';
import { createDuel, stepDuel, pauseDuel, resumeDuel } from '../multiplayer.mjs';
import { FIXED_DT, releaseInputs } from '../core/index.mjs';
import { attachCouchInput } from './couch-input.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { BoardPainter, boardPaintSizeForLevel } from '../ui/render.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { readAssetStore } from '../storage.mjs';
import { importPackLibrary, resolvePackCampaign } from '../packs.mjs';
import { Soundscape, DEFAULT_TRACKS } from '../ui/audio.mjs';
import { recommendedBody } from '../content.mjs';
import { emptyProgress, unlockedBodies } from '../progress.mjs';
const $ = (id) => document.getElementById(id);
const json = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url}`);
  return r.json();
};
try {
  const [campaign, registry, themes, presets] = await Promise.all([
    json('../content/campaign.json'),
    json('../content/classes.json'),
    json('../content/themes.json'),
    json('../../authoring/motion-lab/presets.json'),
  ]);
  const maps = campaign.levels.map((level) => ({
    key: level.id,
    level,
    classes: registry,
    themes: themes.themes,
    visualOverrides: {},
    defaultThemeId: level.themeId || campaign.themeId,
    track: null,
  }));
  try {
    const channel = document.querySelector('meta[name="revealline-offline"]')
      ? `release-${(await json('../build-info.json')).version}`
      : 'dev';
    const saved = await readAssetStore(`revealline.packs.${channel}.v1`);
    if (saved) {
      const installed = await importPackLibrary(saved);
      for (const pack of installed.packs)
        for (const c of pack.campaigns) {
          const resolved = resolvePackCampaign(pack, c.id);
          for (const level of c.levels)
            maps.push({
              key: `${pack.id}/${c.id}/${level.id}`,
              level,
              defaultThemeId: level.themeId || c.themeId,
              track:
                resolved.music.find((track) => track.id === (level.musicId || c.musicId)) || null,
              classes: resolved.classRecipes,
              themes: resolved.themes,
              visualOverrides: {
                ...resolved.visualOverrides,
                ...resolved.levelVisuals.find((v) => v.levelId === level.id)?.visualOverrides,
              },
            });
        }
    }
  } catch (e) {
    $('race-message').textContent = `Pack loading: ${e.message}`;
  }
  for (const m of maps) $('race-level').append(new Option(m.level.name, m.key));
  for (const t of themes.themes) $('race-theme').append(new Option(t.name, t.id));
  for (const c of registry) $('race-class').append(new Option(c.label, c.id));
  const painters = [new BoardPainter(presets), new BoardPainter(presets)];
  const sound = new Soundscape({ persistentMusic: true });
  let neutralResumeTick = false;
  const freeBodies = unlockedBodies(emptyProgress(campaign), campaign);
  function bodyFor(theme, classId) {
    const candidate = recommendedBody(theme, classId);
    return Object.hasOwn(presets.characters, candidate) && freeBodies.has(candidate)
      ? candidate
      : freeBodies.has(theme.player)
        ? theme.player
        : 'neutral-marker';
  }
  let selectedMapKey = null;
  const contexts = [0, 1].map((i) => $(`race-canvas-${i}`).getContext('2d'));
  let match,
    theme,
    accumulator = 0,
    last = 0,
    won = [0, 0],
    finished = false,
    generation = 0,
    framePads = [],
    frameReadError = null,
    padDescriptors = new Map(),
    slots = [null, null],
    assignmentsChanged = false,
    pendingPadLoss = false,
    menuOwner = null,
    menuHint = '',
    menuGate = '',
    menuStatus =
      'Release controls, then press a face button or Menu to choose the menu controller.',
    menuScope = null,
    inactive = false,
    disposed = false,
    frameId = null,
    stopNative = () => {};
  let menuRouter, navigation, shell;
  $('race-tap').checked = matchMedia('(pointer: coarse)').matches;
  $('race-reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clear({ resetDirection = false } = {}) {
    if (resetDirection) input.clear();
    else input.clearPhysical();
    accumulator = 0;
    menuRouter?.clear();
    navigation?.clear();
    if (match?.status === 'running') menuScope = 'flight';
    menuHint = '';
  }
  function prepare() {
    clear({ resetDirection: true });
    const entry = maps.find((m) => m.key === $('race-level').value),
      level = entry.level;
    const classId = entry.classes.some((c) => c.id === $('race-class').value)
      ? $('race-class').value
      : entry.classes[0].id;
    $('race-class').replaceChildren(...entry.classes.map((c) => new Option(c.label, c.id)));
    $('race-class').value = classId;
    const themeId =
      selectedMapKey !== entry.key && entry.defaultThemeId
        ? entry.defaultThemeId
        : $('race-theme').value;
    selectedMapKey = entry.key;
    theme = entry.themes.find((t) => t.id === themeId) || entry.themes[0];
    $('race-theme').replaceChildren(...entry.themes.map((t) => new Option(t.name, t.id)));
    $('race-theme').value = theme.id;
    match = createDuel(
      level,
      { seed: 2026, turnPolicy: $('race-turn').value, classId, classRecipes: entry.classes },
      { seconds: Number($('race-time').value) },
    );
    generation++;
    const { width, height } = boardPaintSizeForLevel(level);
    for (const player of [0, 1]) {
      const canvas = $(`race-canvas-${player}`);
      canvas.width = width;
      canvas.height = height;
      canvas.style.setProperty('--board-ratio', `${width} / ${height}`);
    }
    sound.reset();
    sound.setTrack(entry.track || DEFAULT_TRACKS[0], { atBoundary: true });
    painters.forEach((p) => {
      p.setLook(theme, bodyFor(theme, $('race-class').value), entry.visualOverrides);
      p.setLevel?.(level, { seed: 2026 });
      p.skipCelebration?.();
    });
    finished = false;
    $('race-start').textContent = 'Start round ↗';
    $('race-message').textContent =
      'Both boards use the same map, class and seed. Ready when you are.';
    updateMenu();
  }
  function pause() {
    sound.pause();
    if (!match || match.status === 'finished') return;
    pauseDuel(match, { preserveContinuation: true });
    clear();
    if (match.status === 'paused') {
      $('race-start').textContent = 'Resume round →';
      $('race-message').textContent = 'Both players are paused. Resume when everyone is ready.';
    }
    updateMenu();
  }
  $('race-start').onclick = () => {
    if (disposed || match.status === 'running' || shell.scope() !== 'main') return;
    if (match.status === 'finished') {
      if (won.some((n) => n >= 2)) won = [0, 0];
      prepare();
    }
    clear();
    resumeDuel(match, { preserveContinuation: true });
    neutralResumeTick = true;
    sound.resume().catch(() => {});
    $('race-message').textContent = 'Make your line count. First clear wins.';
    updateMenu();
    input.focus();
  };
  $('race-pause').onclick = () => {
    if (shell.scope() === 'review') shell.back();
    else pause();
  };
  onNativeInactive(suspend)
    .then((stop) => {
      if (disposed) stop();
      else stopNative = stop;
    })
    .catch((error) => {
      if (!disposed)
        $('race-message').textContent = `App lifecycle adapter unavailable: ${error.message}`;
    });
  for (const id of ['race-level', 'race-class', 'race-turn', 'race-time'])
    $(id).onchange = () => {
      if (match?.status !== 'ready' || disposed) return;
      won = [0, 0];
      prepare();
    };
  $('race-theme').onchange = () => {
    if (match?.status !== 'ready' || disposed) return;
    const entry = maps.find((m) => m.key === $('race-level').value);
    theme = entry.themes.find((t) => t.id === $('race-theme').value);
    painters.forEach((p) =>
      p.setLook(theme, bodyFor(theme, $('race-class').value), entry.visualOverrides),
    );
  };
  $('race-audio').onclick = async () => {
    try {
      const on = await sound.toggle();
      if (disposed) return;
      $('race-audio').textContent = on ? 'Mute music ♫' : 'Enable music ♫';
    } catch (e) {
      if (!disposed) $('race-menu-status').textContent = e.message;
    }
  };
  $('race-tap').onchange = clear;
  const input = attachCouchInput({
    continuousSteering: () => true,
    getGamepads: readCachedPads,
    active: () => match?.status === 'running',
    tapMode: () => $('race-tap').checked,
    onPause: pause,
    onAcceptedInput: (player, source) => shell?.observe(player, source),
    onStop: (player) => {
      if (match) releaseInputs(match.runs[player]);
    },
    onPads: (count, nextSlots) => {
      assignmentsChanged = nextSlots.some((slot, i) => slot !== slots[i]);
      slots = [...nextSlots];
      const message = `${count} standard controller${count === 1 ? '' : 's'} assigned · ${slots.map((slot, i) => `Player ${i + 1}: ${slot === null ? 'keyboard/touch' : `pad slot ${slot}`}`).join(' · ')}. Keyboard and touch remain available. Escape pauses both boards.`;
      if ($('race-pad-status').textContent !== message) $('race-pad-status').textContent = message;
    },
  });
  shell = createCouchShell({
    coarse: matchMedia('(pointer: coarse)').matches,
    onTransition: () => clear(),
    onNewMatch: () => {
      if (match?.status === 'running' || disposed) return;
      won = [0, 0];
      prepare();
    },
  });
  function couchScope() {
    return match?.status === 'running'
      ? 'flight'
      : `couch:${match?.status || 'loading'}:${generation}:${shell?.scope() || 'main'}`;
  }
  function readCachedPads() {
    if (frameReadError) throw frameReadError;
    return framePads;
  }
  function readAssignedMenuPads() {
    // Keep sparse browser positions. The router also receives the physical index.
    return readCachedPads().map((pad) => (slots.includes(pad?.index) ? pad : null));
  }
  function capturePads() {
    framePads = [];
    frameReadError = null;
    try {
      if (typeof navigator.getGamepads !== 'function') throw new Error('Gamepad API unavailable');
      const pads = navigator.getGamepads();
      const count = Number.isInteger(pads?.length) ? Math.max(0, Math.min(32, pads.length)) : 0;
      framePads = Array.from({ length: count }, (_, i) => pads[i] || null);
    } catch (error) {
      frameReadError = error || new Error('Controller read failed');
    }
    const next = new Map();
    for (const pad of framePads) {
      if (!pad?.connected || pad.mapping !== 'standard') continue;
      next.set(
        pad.index,
        JSON.stringify([
          typeof pad.id === 'string' ? pad.id.slice(0, 512) : '',
          pad.mapping,
          pad.buttons?.length ?? 0,
          pad.axes?.length ?? 0,
        ]),
      );
    }
    for (const index of slots) {
      if (
        index === null ||
        !padDescriptors.has(index) ||
        next.get(index) === padDescriptors.get(index)
      )
        continue;
      // Couch flight allocation is index-based. A changed descriptor is a new
      // device even if a disconnect event was missed between animation frames.
      menuRouter.disconnect(index);
      pendingPadLoss = true;
      pause();
      clear();
    }
    padDescriptors = next;
  }
  function focusPrimaryAction() {
    if (!match || match.status === 'running' || disposed) return;
    shell.focus();
    navigation.engage();
    menuHint = 'Choose the primary action with South when everyone is ready.';
    updateMenu();
  }
  function updateMenu() {
    if (!match || disposed) return;
    const running = match.status === 'running';
    $('race-start').disabled = running;
    $('race-pause').disabled = !running;
    $('race-menu-release').hidden = running || !menuOwner;
    $('race-menu-release').disabled = running || !menuOwner;
    const entry = maps.find((m) => m.key === selectedMapKey);
    shell?.update({
      match,
      won,
      summary: `${entry.level.name} · ${theme.name} · ${$('race-turn').value === 'grid-center' ? 'Grid-center turns' : 'Immediate turns'} · ${Number($('race-time').value)} seconds`,
    });
    const owner = menuOwner ? slots.indexOf(menuOwner.index) : -1;
    const text = running
      ? shell.controllerHint()
      : `${owner >= 0 ? `Player ${owner + 1} controller has the menu. South selects; East cancels; Menu goes back.` : menuStatus}${menuGate ? ` ${menuGate}` : ''}${menuHint ? ` ${menuHint}` : ''} Keyboard and touch remain available.`;
    if ($('race-menu-status').textContent !== text) $('race-menu-status').textContent = text;
  }
  menuRouter = createControllerRouter({ readPads: readAssignedMenuPads });
  const menuIds = new Set([
    'race-start',
    'race-focus',
    'race-options',
    'race-help',
    'race-solo-return',
    'race-level',
    'race-theme',
    'race-class',
    'race-turn',
    'race-time',
    'race-setup-back',
    'race-touch-0',
    'race-touch-1',
    'race-tap',
    'race-reduced',
    'race-audio',
    'race-menu-release',
    'race-options-back',
    'race-help-back',
    'race-help-read',
    'race-help-reading',
    'race-review',
    'race-pause',
    'race-confirm-back',
    'race-confirm-reset',
    'race-leave-back',
    'race-leave',
  ]);
  navigation = attachControllerNavigation({
    getScope: couchScope,
    getRoot: () => shell.root(),
    getDefaultFocus: () => shell.primary(),
    keyboard: true,
    accept: (element) => menuIds.has(element.id),
    getControlLabels: () => ({ directions: 'D-pad / left stick', confirm: 'South', back: 'East' }),
    onBack: () => shell.back(),
    onMenu: () => shell.back(),
    onHint: (message) => {
      menuHint = message;
      updateMenu();
    },
  });
  $('race-help-read').onclick = () =>
    navigation.beginReading({
      region: $('race-help-reading'),
      origin: $('race-help-read'),
      label: 'Couch controls',
    });
  $('race-menu-release').onclick = () => {
    if (match.status === 'running' || !menuOwner) return;
    menuRouter.invalidate();
    menuOwner = null;
    clear();
    menuStatus =
      'Menu controller released. Release controls, then press a face button or Menu to join.';
    updateMenu();
    shell.focus();
  };
  function sampleMenu(now) {
    const scope = couchScope();
    // Even Ready can lose or reassign a pad without changing the duel status.
    // Clear before sampling so that this frame cannot claim a new menu owner.
    if (assignmentsChanged || pendingPadLoss) menuRouter.clear();
    const result = menuRouter.sample({ scope, timeMs: now });
    const released = !menuOwner && result.disconnected;
    menuOwner = result.assigned;
    menuGate =
      menuOwner && ['joined', 'waiting-neutral'].includes(result.status.code)
        ? 'Release controller buttons and the movement stick to continue.'
        : '';
    if (result.disconnected) {
      clear();
      if (!released) menuStatus = result.status.message;
      updateMenu();
      return;
    }
    menuStatus = frameReadError
      ? 'Controller access is unavailable.'
      : !framePads.some((pad) => pad?.connected && pad.mapping === 'standard') &&
          framePads.some((pad) => pad?.connected)
        ? 'This controller has no standard mapping.'
        : result.status.message;
    if (assignmentsChanged || pendingPadLoss) {
      clear();
      updateMenu();
      return;
    }
    if (menuOwner && result.status.code === 'joined') {
      menuScope = scope;
      focusPrimaryAction();
    } else if (scope !== menuScope) {
      menuScope = scope;
      navigation.clear();
      navigation.sync();
    } else {
      navigation.handle(result.ui);
    }
    updateMenu();
  }
  function suspend() {
    if (disposed) return;
    pause();
    sound.suspend();
    clear();
    framePads = [];
    frameReadError = null;
    last = 0;
    inactive = true;
  }
  const hidden = () => {
    if (document.hidden) suspend();
  };
  const nativeMenuInput = () => {
    if (!disposed && match?.status !== 'running') {
      // Relinquishing DOM focus alone does not stop the router's held repeats.
      // Preserve native focus until a fresh neutral-and-press controller gesture.
      menuRouter.clear();
      menuHint = '';
    }
  };
  const disconnected = (event) => {
    if (slots.includes(event.gamepad?.index)) {
      menuRouter.disconnect(event.gamepad.index);
      pendingPadLoss = true;
      suspend();
    }
  };
  const pagehide = (event) => {
    suspend();
    if (event.persisted) return;
    disposed = true;
    input.destroy();
    menuRouter.destroy();
    navigation.destroy();
    shell.destroy();
    stopNative();
    cancelAnimationFrame(frameId);
    window.removeEventListener('blur', suspend);
    window.removeEventListener('gamepaddisconnected', disconnected);
    window.removeEventListener('pagehide', pagehide);
    document.removeEventListener('visibilitychange', hidden);
    document.removeEventListener('pointerdown', nativeMenuInput, true);
    document.removeEventListener('keydown', nativeMenuInput, true);
  };
  window.addEventListener('blur', suspend);
  window.addEventListener('gamepaddisconnected', disconnected);
  window.addEventListener('pagehide', pagehide);
  document.addEventListener('visibilitychange', hidden);
  document.addEventListener('pointerdown', nativeMenuInput, true);
  document.addEventListener('keydown', nativeMenuInput, true);
  function frame(now) {
    if (disposed) return;
    const available = !document.hidden && document.hasFocus();
    if (!available && !inactive) suspend();
    if (available && inactive) {
      inactive = false;
      last = 0;
    }
    const dt = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    const wasRunning = match.status === 'running';
    if (available) {
      assignmentsChanged = false;
      capturePads();
      input.poll();
      if (!wasRunning) sampleMenu(now);
      pendingPadLoss = false;
    }
    if (available && wasRunning && match.status === 'running') {
      if (dt > 0.25) pause();
      else {
        accumulator += dt;
        while (accumulator + 1e-9 >= FIXED_DT && match.status === 'running') {
          const before = match.runs.map((r) => r.tick);
          const beforeStatus = match.runs.map((r) => r.status);
          const commands = input
            .consume()
            .map((command, i) =>
              beforeStatus[i] === 'respawning'
                ? { direction: null, boost: false, action: false, pickup: false }
                : neutralResumeTick
                  ? { ...command, boost: false, action: false, pickup: false }
                  : command,
            );
          stepDuel(match, commands);
          neutralResumeTick = false;
          for (let i = 0; i < 2; i++)
            if (
              beforeStatus[i] === 'respawning' ||
              match.runs[i].status === 'respawning' ||
              match.runs[i].events.some((event) => event.type === 'capture.stopped')
            )
              input.clearPlayer(i);
          accumulator -= FIXED_DT;
          for (let i = 0; i < 2; i++)
            if (match.runs[i].tick !== before[i]) {
              painters[i].effectsFor(match.runs[i].events, match.runs[i]);
              for (const event of match.runs[i].events) sound.event(event);
            }
        }
      }
    }
    if (match.status === 'finished' && !finished) {
      finished = true;
      clear();
      if (match.winner !== null) won[match.winner]++;
      const name =
        match.winner === 0 ? 'Sunflower' : match.winner === 1 ? 'Skyline' : 'Both players';
      $('race-message').textContent =
        `${match.winner === null ? 'Draw' : `${name} wins the round`}. ${match.reason}.${won.some((n) => n >= 2) ? ` ${name} wins the match!` : ''}`;
      $('race-start').textContent = won.some((n) => n >= 2)
        ? 'Play another match ↗'
        : 'Next round ↗';
      painters.forEach((p, i) => {
        if (match.runs[i].status === 'won')
          p.startCelebration?.({
            levelId: match.runs[i].levelId,
            seed: 2026,
            reduced: $('race-reduced').checked,
          });
      });
    }
    $('series-score').textContent = `${won[0]} : ${won[1]}`;
    const left = Math.max(0, Math.ceil((match.limitTicks - match.tick) / 120));
    $('race-clock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    for (let i = 0; i < 2; i++) {
      const run = match.runs[i];
      $(`racer-stats-${i}`).textContent =
        `${(run.coverage * 100).toFixed(1)}% · ${run.lives} lives · ${run.score} points`;
      $(`racer-state-${i}`).textContent = match.status === 'running' ? run.status : match.status;
      const cue = encounterView(run),
        group = $(`racer-encounter-${i}`),
        title = $(`racer-encounter-title-${i}`),
        instruction = $(`racer-encounter-instruction-${i}`);
      group.hidden = !cue;
      if (cue) {
        const context =
          match.status === 'paused'
            ? 'PAUSED · '
            : match.status === 'ready'
              ? 'READY · '
              : match.status === 'finished'
                ? 'ROUND ENDED · '
                : '';
        const heading = `${context}${cue.title}`;
        const copy =
          match.status === 'finished' && !['won', 'lost'].includes(run.status)
            ? `Frozen at round end. Live line ${cue.cutCells} / ${cue.min} new cells.`
            : cue.instruction;
        // The run owns this clock. Keep paused/finished cues and avoid rewriting unchanged text.
        if (title.textContent !== heading) title.textContent = heading;
        if (instruction.textContent !== copy) instruction.textContent = copy;
        group.dataset.phase = cue.phase;
      } else {
        title.textContent = '';
        instruction.textContent = '';
        delete group.dataset.phase;
      }
      painters[i].draw(contexts[i], run, Math.min(dt, 0.1), {
        paused: match.status !== 'running',
        reduced: $('race-reduced').checked,
        fullReveal: run.status === 'won',
        celebrationPaused: document.hidden,
      });
    }
    sound.update(
      match.status === 'running',
      theme,
      match.runs.find((r) => !['won', 'lost'].includes(r.status)) || match.runs[0],
    );
    updateMenu();
    frameId = requestAnimationFrame(frame);
  }
  prepare();
  frameId = requestAnimationFrame(frame);
} catch (error) {
  $('race-message').textContent = `The race could not load: ${error.message}`;
} finally {
  document.querySelectorAll('[data-boot-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('aria-busy');
  });
  $('boot-status').hidden = true;
}
