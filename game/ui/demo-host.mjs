import { contentText } from '../i18n/content.mjs';
import { t, onLocaleChange } from '../i18n/index.mjs';
import { createRun } from '../core/index.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { BoardPainter, boardPaintSizeForRun } from './render.mjs';
import { resolveDemoPicture } from './demo-picture.mjs';
import { createDemoDirector } from '../demo-director.mjs';
import {
  createDemoIdle,
  createDemoPractice,
  createDemoCaptions,
  readDemoSettings,
} from '../demo-experience.mjs';
import { attachDemoInput } from './demo-input.mjs';
import { bindingLabels } from '../key-bindings.mjs';
import { controllerBindingLabels } from '../controller-bindings.mjs';

/** In-page spectator/practice owner. All campaign mutations are outside this host. */
export function attachDemoHost({
  document: doc = globalThis.document,
  presets,
  getContext,
  loadSources,
  readMedia,
  canAutoStart,
  canOpen,
  onEnter,
  onExit,
  onFreshStart,
  clearInput,
  menu,
  canWrite = () => false,
  settingsKey,
  storage = globalThis.localStorage,
  setCollect = () => {},
  clearRecordings = async () => {},
}) {
  const $ = (id) => doc.getElementById(id),
    dialog = $('demo-dialog'),
    canvas = $('demo-canvas');
  if (!dialog || !canvas) return null;
  const idle = createDemoIdle(),
    captions = createDemoCaptions();
  let settings = readDemoSettings(storage, settingsKey, getContext().reduced);
  let active = false,
    disposed = false,
    interrupted = false,
    director = null,
    controller = null,
    epoch = 0,
    practice = null,
    armed = false,
    context = null,
    painter = null,
    picture = null,
    source = null,
    dwell = 0,
    caption = 'demo:tipStart',
    error = '',
    origin = null,
    switchClass = null,
    busy = false,
    adoptedPlayer = null,
    handoffGeneration = 0;
  const owners = new WeakMap(),
    listeners = [];
  const listen = (element, type, fn, options) => {
    if (!element) return;
    element.addEventListener(type, fn, options);
    listeners.push(() => element.removeEventListener(type, fn, options));
  };
  const text = (id, value) => {
    if ($(id).textContent !== value) $(id).textContent = value;
  };
  const currentRun = () => practice?.state ?? director?.player?.state;
  const watching = () => active && !practice && !interrupted;
  function renderControls() {
    if (!active) return;
    dialog.classList.toggle('is-practice', !!practice);
    const state = currentRun(),
      terminal = ['won', 'lost'].includes(state?.status);
    const loading = busy || !director?.player;
    text(
      'demo-source',
      t(practice ? 'demo:practice' : source?.kind === 'bot' ? 'demo:live' : 'demo:recorded'),
    );
    text('demo-level', source ? contentText(source.level, 'name') : t('demo:loading'));
    text(
      'demo-caption',
      t(
        practice
          ? terminal
            ? 'demo:practiceComplete'
            : armed
              ? 'demo:steer'
              : 'demo:practicePaused'
          : state?.status === 'won'
            ? 'demo:recapWin'
            : caption,
        { percent: Math.round((state?.coverage ?? 0) * 100) },
      ),
    );
    text(
      'demo-status',
      error ||
        (loading
          ? t('demo:loading')
          : state
            ? t('demo:readout', {
                percent: Math.round(state.coverage * 100),
                lives: state.lives,
                seconds: Math.floor(state.time),
              })
            : ''),
    );
    text(
      'demo-picture-note',
      t(picture?.pictureVisibility === 'clear' ? 'demo:earnedPicture' : 'demo:blurredPicture'),
    );
    $('demo-actions').hidden = !interrupted && !practice;
    $('demo-takeover').hidden = !!practice;
    $('demo-takeover').disabled = loading || terminal;
    $('demo-fresh').disabled = loading;
    $('demo-resume').disabled = busy || (!!practice && terminal);
    text('demo-resume', t(practice ? 'demo:continuePractice' : 'demo:keepWatching'));
    $('demo-next').hidden = !!practice;
    $('demo-next').disabled = busy;
    $('demo-practice-controls').hidden = !practice;
    $('demo-interrupt').hidden = interrupted || !!practice;
    $('demo-return').hidden = !practice;
    $('demo-pause').hidden = !practice || !armed;
    const capabilities = arcadeActionCapabilities(state?.level);
    $('demo-ability').hidden = !capabilities.manualAbility;
    $('demo-pickup').hidden = !capabilities.manualPickup;
    $('demo-boost').hidden = !capabilities.manualBoost;
    $('demo-craft').hidden = !practice || !state?.hangars?.length;
    const keys = bindingLabels(getContext().preferences.keyboardBindings);
    text(
      'demo-bound-controls',
      t('demo:boundControls', {
        directions: [keys.up, keys.down, keys.left, keys.right].join(' · '),
        pause:
          keys.pause
            .split(' / ')
            .filter((key) => key !== 'Esc')
            .join(' / ') || t('common:actions.pause'),
      }),
    );
    const current = getContext();
    $('demo-pad-controls').hidden = !current.controller;
    if (current.controller) {
      const pad = controllerBindingLabels(
        current.preferences.controllerBindings,
        current.controller.id,
      ).flight;
      text(
        'demo-pad-controls',
        t('demo:padControls', {
          directions: [pad.up, pad.down, pad.left, pad.right].join(' · '),
          pause: pad.pause,
        }),
      );
    }
    for (const action of ['boost', 'ability', 'pickup'])
      text(`demo-${action}`, `${t(`demo:${action}`)} · ${keys[action]}`);
  }
  function clear() {
    clearInput();
    input.clear();
  }
  function interrupt() {
    if (!active) return;
    interrupted = true;
    armed = false;
    director?.pause();
    practice?.pause();
    clear();
    renderControls();
    $('demo-fresh').focus({ preventScroll: true });
  }
  function suspend() {
    idle.activity();
    if (!active) return;
    handoffGeneration++;
    busy = false;
    interrupted = true;
    armed = false;
    director?.suspend();
    practice?.pause();
    clear();
    renderControls();
  }
  function close({ handoff = false } = {}) {
    if (!active) return;
    active = false;
    controller?.abort();
    epoch++;
    handoffGeneration++;
    adoptedPlayer = null;
    director?.dispose();
    director = null;
    painter = picture = source = practice = context = null;
    armed = false;
    busy = false;
    clear();
    idle.activity();
    dialog.close();
    onExit({ handoff, origin });
  }
  async function prepare(source, { signal }) {
    const player = await source.create({ signal });
    let nextPicture = null,
      nextPainter = null;
    try {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const current = getContext(),
        entry = source.entry;
      const theme =
        entry.themes.find((item) => item.id === source.level.themeId) ||
        entry.themes.find((item) => item.id === entry.campaign.themeId) ||
        entry.themes[0];
      nextPainter = new BoardPainter(presets);
      nextPainter.setLevel(source.level, { seed: player.info.seed });
      const overrides = {
        ...entry.visualOverrides,
        ...(entry.levelVisuals?.find((item) => item.levelId === source.levelId)?.visualOverrides ??
          {}),
      };
      // Match the runtime's theme-specific map artwork binding.
      const visual = entry.levelVisuals?.find(
        (item) => item.levelId === source.levelId && item.themeId === theme.id,
      );
      if (visual?.background) overrides.background = visual.background;
      await nextPainter.setLook(
        theme,
        theme.classBodies?.[player.state.activeClassId] || theme.player,
        overrides,
      );
      nextPicture = await resolveDemoPicture({
        entry,
        level: source.level,
        theme,
        library: current.library,
        entries: current.entries,
        readMedia,
        signal,
      });
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (nextPicture.artSeed !== null)
        nextPainter.setLevel(source.level, { seed: nextPicture.artSeed });
      const wrapper = {
        get state() {
          return player.state;
        },
        get phase() {
          return player.phase;
        },
        get error() {
          return player.error;
        },
        info: player.info,
        play: () => player.play(),
        pause: () => player.pause(),
        advance: (dt) => player.advance(dt),
        exportRecording: () => player.exportRecording(),
        forkForPractice: (options) => player.forkForPractice(options),
        dispose() {
          player.dispose?.();
          nextPicture.dispose();
          nextPainter.dispose?.();
        },
      };
      owners.set(wrapper, {
        painter: nextPainter,
        picture: nextPicture,
        theme,
        overrides,
        classId: player.state.activeClassId,
      });
      return wrapper;
    } catch (failure) {
      player.dispose?.();
      nextPicture?.dispose();
      nextPainter?.dispose?.();
      throw failure;
    }
  }
  function changed(snapshot) {
    if (!active) return;
    if (snapshot.source && snapshot.player !== adoptedPlayer) {
      adoptedPlayer = snapshot.player;
      context = null;
      source = snapshot.source;
      ({ painter, picture } = owners.get(snapshot.player));
      const size = boardPaintSizeForRun(snapshot.player.state);
      canvas.width = size.width;
      canvas.height = size.height;
      captions.reset();
      caption = 'demo:tipStart';
      dwell = 0;
      error = '';
    }
    if (snapshot.phase === 'unavailable') {
      close();
      text('demo-availability', t('demo:unavailable'));
      return;
    }
    if (snapshot.phase === 'paused') interrupted = true;
    renderControls();
  }
  async function open() {
    if (disposed || active || !canOpen()) return false;
    origin = doc.activeElement;
    onEnter();
    clear();
    active = true;
    interrupted = false;
    practice = null;
    armed = false;
    error = '';
    source = null;
    busy = true;
    context = null;
    picture = null;
    painter = null;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal,
      ticket = ++epoch;
    dialog.showModal();
    canvas.focus({ preventScroll: true });
    renderControls();
    try {
      const sources = await loadSources({ signal });
      if (!active || signal.aborted || ticket !== epoch) return false;
      director = createDemoDirector({ sources, prepare, onChange: changed });
      busy = false;
      if (interrupted) {
        await director.next();
        director.pause();
      } else await director.start();
      return active;
    } catch (failure) {
      if (ticket !== epoch || signal.aborted) return false;
      error = t('demo:loadError');
      close();
      text('demo-availability', t('demo:loadError'));
      return false;
    } finally {
      if (ticket === epoch) {
        busy = false;
        renderControls();
      }
    }
  }
  function startPractice(run) {
    switchClass = null;
    practice = createDemoPractice(run);
    director.pause();
    interrupted = true;
    armed = true;
    dwell = 0;
    $('demo-craft').replaceChildren(
      ...run.classRecipes.map((recipe) => {
        const option = doc.createElement('option');
        option.value = recipe.id;
        option.textContent = contentText(recipe, 'label');
        return option;
      }),
    );
    $('demo-craft').value = run.activeClassId;
    clear();
    renderControls();
    canvas.focus({ preventScroll: true });
  }
  async function takeover() {
    if (busy || !director?.player || practice) return;
    interrupt();
    busy = true;
    renderControls();
    const ticket = epoch,
      handoff = ++handoffGeneration,
      player = director.player;
    try {
      const fork = await player.forkForPractice({ signal: controller.signal });
      if (
        !active ||
        ticket !== epoch ||
        handoff !== handoffGeneration ||
        director.player !== player ||
        doc.hidden ||
        !doc.hasFocus()
      )
        return;
      startPractice(fork.run);
    } catch {
      if (active && ticket === epoch) error = t('demo:takeoverError');
    } finally {
      if (ticket === epoch && handoff === handoffGeneration) {
        busy = false;
        renderControls();
      }
    }
  }
  async function fresh() {
    if (busy || !source || !director?.player) return;
    interrupt();
    busy = true;
    renderControls();
    const ticket = epoch,
      handoff = ++handoffGeneration,
      selected = source;
    const current = () =>
      active && ticket === epoch && handoff === handoffGeneration && !doc.hidden && doc.hasFocus();
    try {
      const adopted = await onFreshStart(selected, current);
      if (!current()) return;
      if (adopted) {
        close({ handoff: true });
        return;
      }
      const options = director.player.exportRecording().options;
      startPractice(createRun(selected.level, options));
    } catch {
      if (active && ticket === epoch) error = t('demo:takeoverError');
    } finally {
      if (ticket === epoch && handoff === handoffGeneration) {
        busy = false;
        renderControls();
      }
    }
  }
  const input = attachDemoInput({
    root: dialog,
    canvas,
    active: () => active,
    watching,
    practice: () => !!practice && armed,
    getBindings: () => getContext().preferences.keyboardBindings,
    interrupt,
    back: () => close(),
    pause: interrupt,
    menu,
    steer: (direction) => {
      if (practice && armed) {
        practice.steer(direction);
        renderControls();
      }
    },
    onHangar: () => {
      interrupt();
      $('demo-craft').focus();
    },
    onActivity: () => idle.activity(),
  });
  listen($('shell-demo'), 'click', () => void open());
  listen($('demo-button'), 'click', () => void open());
  listen($('demo-interrupt'), 'click', interrupt);
  listen($('demo-pause'), 'click', interrupt);
  listen($('demo-back'), 'click', () => close());
  listen(dialog, 'cancel', (event) => {
    event.preventDefault();
    close();
  });
  listen($('demo-takeover'), 'click', () => void takeover());
  listen($('demo-fresh'), 'click', () => void fresh());
  listen($('demo-next'), 'click', () => {
    if (!busy) void director.next();
  });
  listen($('demo-craft'), 'change', () => {
    switchClass = $('demo-craft').value;
  });
  listen($('demo-resume'), 'click', () => {
    clear();
    error = '';
    if (practice) armed = true;
    else {
      interrupted = false;
      void director?.play();
    }
    renderControls();
    canvas.focus({ preventScroll: true });
  });
  listen($('demo-return'), 'click', () => {
    practice = null;
    armed = false;
    interrupted = false;
    clear();
    void director?.play();
    renderControls();
  });
  for (const type of ['keydown', 'pointerdown', 'wheel'])
    listen(doc, type, () => idle.activity(), true);
  const saveSettings = () => {
    settings = { auto: $('demo-auto').checked, collect: $('demo-collect').checked };
    setCollect(settings.collect);
    idle.activity();
    try {
      if (canWrite()) storage.setItem(settingsKey, JSON.stringify({ version: 1, ...settings }));
    } catch {
      text('demo-settings-status', t('demo:settingsSessionOnly'));
    }
  };
  $('demo-auto').checked = settings.auto;
  $('demo-collect').checked = settings.collect;
  setCollect(settings.collect);
  listen($('demo-auto'), 'change', saveSettings);
  listen($('demo-collect'), 'change', saveSettings);
  listen($('demo-clear'), 'click', async () => {
    try {
      await clearRecordings();
      text('demo-settings-status', t('demo:cleared'));
    } catch {
      text('demo-settings-status', t('demo:cacheError'));
    }
  });
  const unsubscribe = onLocaleChange(renderControls);
  return {
    get active() {
      return active;
    },
    get practiceArmed() {
      return !!practice && armed;
    },
    get toggleBoostEligible() {
      return !!practice && armed && practice.state.status === 'running';
    },
    get scope() {
      return practice && armed ? 'attract-practice' : 'attract';
    },
    open,
    close,
    suspend,
    interrupt,
    activity: () => idle.activity(),
    controller(frame) {
      input.controller(frame);
    },
    update(seconds) {
      if (!active) {
        if (idle.advance(seconds, settings.auto && canAutoStart())) void open();
        return;
      }
      if (doc.hidden || !doc.hasFocus()) {
        suspend();
        return;
      }
      const result = practice
        ? practice.advance(seconds, () => {
            const controls = { ...input.controls(), switchClass };
            switchClass = null;
            return controls;
          })
        : director?.advance(seconds);
      const state = currentRun();
      if (!state || !painter) return;
      const look = owners.get(director.player);
      if (look.classId !== state.activeClassId) {
        look.classId = state.activeClassId;
        void painter.setLook(
          look.theme,
          look.theme.classBodies?.[look.classId] || look.theme.player,
          look.overrides,
        );
      }
      if (result?.reason === 'frame-gap') interrupt();
      if (result?.events?.length) painter.effectsFor(result.events, state);
      if (!practice && !interrupted) caption = captions.advance(seconds, result?.events);
      renderControls();
      context ??= canvas.getContext('2d');
      if (context)
        painter.draw(context, state, Math.min(seconds, 0.1), {
          displayCSSWidth: canvas.clientWidth,
          paused: practice ? practice.phase !== 'playing' : director.phase !== 'playing',
          reduced: getContext().reduced,
          fullReveal: state.status === 'won',
          backdrop: picture?.backdrop,
          pictureVisibility: picture?.pictureVisibility ?? 'blurred',
          celebrationPaused: interrupted,
        });
      if (!practice && !interrupted && director.phase === 'complete') {
        dwell += Math.min(seconds, 0.25);
        if (dwell >= 4) {
          dwell = 0;
          void director.next();
        }
      }
    },
    destroy() {
      close();
      disposed = true;
      input.destroy();
      unsubscribe?.();
      for (const remove of listeners) remove();
    },
  };
}
