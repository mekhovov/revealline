import { mountModePlayShell } from '../ui/mode-play-shell.mjs';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';
import { attachFullscreen } from '../ui/fullscreen.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { setMenuIcon } from '../ui/native-menu-icons.mjs';
import { attachRoomInput } from './room-input.mjs';
import { createBoardFootprints } from '../couch/board-footprint.mjs';
import { getSummary } from '../core/index.mjs';
import { getCoopSummary } from '../coop/core.mjs';
import { classicSnakeSummary } from '../snake/classic-core.mjs';
import { classicTargetIdentity } from '../snake/classic-target-identity.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { boardPlacement, screenPan } from '../ui/feedback-cues.mjs';
import { actorPhaseSound } from '../ui/encounter-audio.mjs';
import { attachContextualReactions } from '../ui/contextual-reactions.mjs';
import { attachEncounterDisplayControls } from '../ui/encounter-display-controls.mjs';
import { attachMenuStyleControls } from '../ui/menu-style-controls.mjs';
import { mountToolDisplay } from '../ui/tool-display.mjs';
import { getLocale, t } from '../i18n/index.mjs';
import { createRoomAudioActivation, createRoomEventCursor } from './room-events.mjs';
import { attachRoomSupport } from './room-controls.mjs';

/** The room transport owns readiness and outcomes. This adapter owns only native
 * menu/input presentation and the one page mixer; it never advances a simulation. */
export function mountRoomUI({ getState, getSeat, canPlay, submit, pause, display, destruction }) {
  const doc = globalThis.document,
    $ = (id) => doc.getElementById(id),
    uk = getLocale() === 'uk',
    say = (en, ua) => (uk ? ua : en),
    create = (tag, text, className) => {
      const node = doc.createElement(tag);
      if (text) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
  let shell,
    input,
    navigation,
    footprints,
    observer,
    cards = [],
    pendingTurns = [],
    lastControls = '',
    supportInput,
    identity = null,
    wantsPlay = false,
    gestureReady = false,
    wasLive = false,
    ended = null;
  const cursor = createRoomEventCursor(),
    projections = [];
  const audioMaster = createAudioMaster(),
    audioPreferences = createAudioPreferences({ audioMaster }),
    sound = new Soundscape({ audioMaster, persistentMusic: true });
  sound.configure({ master: 1, music: 0, sfx: 0.7 });
  sound.setDestructionPreferences(() => encounter.snapshot());
  const reactions = attachContextualReactions({
    sound,
    container: $('room-reaction-caption'),
    settingsContainer: $('room-reaction-settings'),
    getReduced: () => display.snapshot().effectiveReducedEffects,
  });
  const audioActivation = createRoomAudioActivation({
    sound,
    active: () => canPlay() && !shell.blocksPlay(),
    onEnabled: () => {
      reactions.resume();
      void reactions.prepare(
        (getState()?.engine.runs ?? []).flatMap((run) =>
          (run.targets ?? []).map((target) => target.kind),
        ),
      );
    },
  });
  const encounter = attachEncounterDisplayControls({
    prefix: 'room-',
    soundContainer: $('room-settings'),
    destructionPreferences: destruction,
  });
  const style = attachMenuStyleControls({ prefix: 'room-' });
  const toolDisplay = mountToolDisplay({ preferences: display });
  const labels = {
    'room-sound-title': ['Sound', 'Звук'],
    'master-label': ['Master volume', 'Загальна гучність'],
    'effects-label': ['Effects volume', 'Гучність ефектів'],
    'reduced-label': ['Reduced effects', 'Менше ефектів'],
    'remains-label': ['Show enemy remains', 'Показувати рештки ворогів'],
    'text-size-label': ['Text size', 'Розмір тексту'],
    'text-face-label': ['Text style', 'Стиль тексту'],
    'room-board-label': ['Snake board', 'Поле Snake'],
    'room-tail-label': ['Snake trail', 'Слід Snake'],
    'boost-button': ['Boost', 'Прискорення'],
    'action-button': ['Ability', 'Здібність'],
    'pickup-button': ['Supply', 'Припаси'],
    support: ['Support', 'Підтримка'],
  };
  for (const [id, values] of Object.entries(labels)) $(id).textContent = values[uk ? 1 : 0];
  if (uk) {
    for (const [id, names] of Object.entries({
      'room-board': ['Сучасне', 'Ретро-поле'],
      'room-tail': ['Кабель', 'Сигнал'],
    }))
      [...$(id).options].forEach((option, i) => {
        option.textContent = names[i];
      });
    const textSize = doc.querySelector('[data-tool-text-size]');
    [...textSize.options].forEach((option, i) => {
      option.textContent = ['Звичайний', 'Великий'][i];
    });
    const textFace = doc.querySelector('[data-tool-text-face]');
    [...textFace.options].forEach((option, i) => {
      option.textContent = [t('interface:themeFont'), t('common:text.plain')][i];
    });
  }
  const stopDisplay = display.subscribe((choice) => {
    $('room-reduced').checked = choice.reducedEffects;
  });
  $('room-reduced').addEventListener('change', () =>
    display.set({ reducedEffects: $('room-reduced').checked }),
  );
  $('room-master').addEventListener('input', () =>
    audioPreferences.setVolume(Number($('room-master').value)),
  );
  $('room-effects').addEventListener('input', () =>
    sound.configure({ sfx: Number($('room-effects').value) }),
  );
  const modes = create('nav');
  modes.className = 'room-mode-links';
  for (const [name, label, path] of [
    ['solo', 'Solo', '../'],
    ['versus', 'Versus', '../couch/'],
    ['team', 'Team', '../couch/relay-rescue.html'],
    ['simulator', 'FPV SIM', '../../optional-practice/fpv-worlds/index.html'],
    ['snake', 'Snake', '../snake/play.html'],
  ]) {
    const link = create('a', label);
    link.href = `${path}?lang=${getLocale()}`;
    link.className = 'button secondary';
    setMenuIcon(link, name);
    modes.append(link);
  }
  $('legacy-header').hidden = true;
  const briefing = create('div'),
    menuNotice = create('p'),
    resultCopy = create('p');
  menuNotice.id = 'room-menu-notice';
  menuNotice.setAttribute('role', 'status');
  briefing.append(menuNotice, $('intro'), $('qualification'));
  $('room-results').append(resultCopy);
  const ready = () => {
    if (!getState()) {
      $('create').click();
      shell.open('missions');
      return;
    }
    wantsPlay = true;
    $('ready').click();
    if (!canPlay()) shell.open('missions');
  };
  shell = mountModePlayShell({
    idPrefix: 'room',
    modeName: say('Private rooms', 'Приватні кімнати'),
    locale: getLocale(),
    wordmarkURL: new URL('../ui/art/identity/fpv-line/wordmark.png', import.meta.url).href,
    slots: {
      modes,
      missions: [$('notice'), $('reconnect'), $('setup'), $('lobby')],
      briefing,
      play: $('room-play'),
      settings: $('room-settings'),
      help: $('room-help'),
      results: $('room-results'),
    },
    services: { attachModalNavigation, attachFullscreen, setMenuIcon },
    actions: {
      pause: () => {
        suspend();
        pause();
      },
      start: ready,
      resume: ready,
      continue: ready,
      retry: () => {
        $('rematch').click();
        shell.open('missions');
      },
      canResume: () => !!getState() && ['waiting', 'paused', 'playing'].includes(getState().status),
      toggleSound: () => {
        audioPreferences.setMuted(!audioMaster.snapshot().muted);
        unlock();
      },
    },
    focusPlay: () =>
      cards[getState()?.recipe.mode === 'versus' ? getSeat() : 0]?.canvas.focus({
        preventScroll: true,
      }),
    initial: 'home',
  });
  // subscribe() publishes immediately; the title must exist before its first
  // shared mute value arrives, even when this page has not joined a room.
  const stopAudio = audioMaster.subscribe((choice) => {
    $('room-master').value = String(choice.volume);
    shell.update({ muted: choice.muted });
  });
  // Transport actions retain their native listeners and guards.
  $('ready').addEventListener('click', () => {
    unlock();
    wantsPlay = true;
  });
  $('rematch').addEventListener('click', () => {
    wantsPlay = false;
  });
  $('room-results').append($('receipt'));
  const inputScope = () =>
    shell.topDialog() ? `dialog:${shell.topDialog().id}` : canPlay() ? 'flight' : 'room:inactive';
  navigation = attachControllerNavigation({
    keyboard: true,
    getScope: inputScope,
    getRoot: () => shell.topDialog() ?? shell.elements.root,
    getDefaultFocus: () => shell.topDialog()?.querySelector('button:not(:disabled),a[href]'),
    onBack: () => shell.back(),
    onMenu: () => shell.back(),
  });
  input = attachRoomInput({
    arena: $('boards'),
    getScope: inputScope,
    active: () => canPlay() && !shell.blocksPlay(),
    onPause: () => shell.openHome(),
    onNavigate: (command) => navigation.handle(command),
    onSteer: (direction) => {
      if (pendingTurns.length < 8) pendingTurns.push(direction);
    },
    onGamepad: (message) => {
      $('room-live-status').textContent = message;
    },
  });
  supportInput = attachRoomSupport({
    document: doc,
    button: $('support'),
    active: () => canPlay() && !shell.blocksPlay(),
    isTeam: () => getState()?.engine.kind === 'team',
    pause: () => shell.openHome(),
  });
  function unlock() {
    gestureReady = true;
    void audioActivation.enable();
  }
  function suspend() {
    pendingTurns = [];
    lastControls = '';
    supportInput?.clear();
    input?.clear();
    audioActivation.suspend();
    sound.feedbackDirector.reset();
    reactions.suspend();
    wasLive = false;
  }
  function arrange() {
    const area = $('boards'),
      state = getState();
    if (!state || cards.length !== 2) {
      delete area.dataset.arrangement;
      footprints?.refresh();
      return;
    }
    const run = state.engine.runs[0],
      width = run.width ?? run.level.width,
      height = run.height ?? run.level.height;
    const hud = Math.max(...cards.map((card) => card.hud.getBoundingClientRect().height)) + 6;
    const paired = Math.min((area.clientWidth - 8) / 2 / width, (area.clientHeight - hud) / height);
    const stacked = Math.min(
      area.clientWidth / width,
      ((area.clientHeight - 8) / 2 - hud) / height,
    );
    area.dataset.arrangement = stacked > paired ? 'stacked' : 'paired';
    footprints?.refresh();
  }
  function boards(canvases, snapshot) {
    footprints?.dispose();
    observer?.disconnect();
    cards = canvases.map((canvas, board) => {
      const run = snapshot.engine.runs[board],
        card = create('article', '', 'room-board'),
        hud = create('div', '', 'room-hud'),
        title = create('strong'),
        stats = create('span'),
        details = create('span'),
        box = create('div', '', 'room-board-wrap');
      canvas.width = (run.width ?? run.level.width) * 16;
      canvas.height = (run.height ?? run.level.height) * 16;
      canvas.tabIndex = 0;
      hud.append(title, stats, details);
      box.append(canvas);
      card.append(hud, box);
      return { card, canvas, hud, title, stats, details };
    });
    $('boards').replaceChildren(...cards.map((card) => card.card));
    footprints = createBoardFootprints(canvases);
    if (globalThis.ResizeObserver) {
      observer = new ResizeObserver(arrange);
      observer.observe($('boards'));
      for (const card of cards) observer.observe(card.hud);
    }
    arrange();
  }
  function update(snapshot, { replacement = false, recovering = false } = {}) {
    if (!snapshot) {
      suspend();
      cursor.reset();
      identity = null;
      wantsPlay = false;
      shell.update({ phase: 'ready', canResume: false, missionName: '' });
      shell.open('missions');
      return;
    }
    const nextIdentity = `${snapshot.roomId}:${snapshot.generation}`;
    if (identity !== nextIdentity) {
      identity = nextIdentity;
      suspend();
      projections.length = 0;
      reactions.reset(identity);
      ended = null;
    }
    const live = canPlay(),
      terminalLive = snapshot.status === 'finished' && wasLive;
    const received = cursor.accept(snapshot, {
      silent:
        replacement || recovering || !wasLive || (!live && !terminalLive) || shell.blocksPlay(),
    });
    const title =
      snapshot.recipe.content?.mission.title[uk ? 'uk' : 'en'] ??
      snapshot.recipe.level.name ??
      snapshot.recipe.level.id;
    shell.update({
      phase: snapshot.status === 'finished' ? 'results' : live ? 'playing' : 'paused',
      canResume: ['waiting', 'paused', 'playing'].includes(snapshot.status),
      missionName: title,
      summary: $('accepted-mission').textContent,
      muted: audioMaster.snapshot().muted,
    });
    if (live && wantsPlay) {
      shell.enterPlay();
      wantsPlay = false;
    }
    if (!live && wasLive && !terminalLive) {
      suspend();
      shell.open('missions');
    }
    if (snapshot.status === 'finished' && ended !== nextIdentity) {
      ended = nextIdentity;
      resultCopy.textContent = $('result').textContent;
      shell.open('results');
    }
    menuNotice.textContent = $('notice').textContent;
    $('room-live-status').textContent =
      `${title} · ${snapshot.status === 'playing' ? say(`Seat ${getSeat() + 1}`, `Місце ${getSeat() + 1}`) : $('notice').textContent}`;
    if (received.primed) sound.feedbackDirector.reset();
    if ((live || terminalLive) && gestureReady && (terminalLive || !shell.blocksPlay())) {
      sound.paused = false;
      sound.gameplayPaused = false;
      reactions.resume();
      for (let board = 0; board < snapshot.engine.runs.length; board++) {
        const run = snapshot.engine.runs[board],
          placement = boardPlacement(cards[board]?.canvas),
          events = received.events.filter((item) => item.board === board).map((item) => item.event),
          options = { board: `room-${board}`, mode: snapshot.recipe.mode, placement };
        for (const event of events) {
          const target = event.target ?? event;
          const cue =
            event.type === 'actor.phase'
              ? actorPhaseSound(event.previous, event.phase)
              : ({
                  'target.caught': 'catch',
                  'shutter.changed': 'shutter',
                }[event.type] ??
                (event.type === 'pickup.collected' && snapshot.engine.kind === 'snake'
                  ? event.pickup?.kind === 'pulse'
                    ? 'pulse'
                    : 'reel'
                  : null));
          if (cue) {
            sound.encounter(cue, {
              ...options,
              family: target.family ?? target.kind ?? event.actorFamily,
              ...(event.type === 'target.caught'
                ? classicTargetIdentity(target.kind ?? target.family, $('room-board').value)
                : {}),
              brutal: encounter.snapshot().brutal,
              vocals: encounter.snapshot().vocals,
              closed: event.closed,
              pan: screenPan(target.x ?? 0, run.width ?? run.level.width, placement),
            });
            if (event.type === 'actor.phase' && cue !== 'warning')
              sound.encounter('equipment', {
                ...options,
                family: target.family ?? target.kind ?? event.actorFamily,
                pan: screenPan(target.x ?? 0, run.width ?? run.level.width, placement),
              });
          }
        }
        if (snapshot.engine.kind !== 'snake')
          sound.events(
            events.filter(
              (event) =>
                event.type !== 'actor.phase' &&
                !(terminalLive && ['run.completed', 'run.failed'].includes(event.type)),
            ),
            run,
            {},
            options,
          );
        reactions.events(
          events.map((event) =>
            event.type === 'target.caught'
              ? {
                  ...event,
                  type: 'actor.caught',
                  id: event.target?.id,
                  actorFamily: event.target?.family ?? event.target?.kind ?? 'lookout',
                  player: event.playerId,
                }
              : event,
          ),
          {
            mode: snapshot.recipe.mode,
            board,
            danger: events.some((event) => /failed|downed|locked/.test(event.type)),
          },
        );
      }
    }
    if (terminalLive && gestureReady) {
      const lost =
        snapshot.result?.outcome === 'lost' ||
        (snapshot.result?.winner &&
          !['draw', `p${getSeat() + 1}`].includes(snapshot.result.winner));
      sound.encounter(lost ? 'failure' : 'objective');
      for (const voice of [...sound.voices]) if (voice.feedback && voice.source?.loop) voice.stop();
    }
    wasLive = live && !shell.blocksPlay();
    for (const [board, card] of cards.entries()) {
      const run = snapshot.engine.runs[board],
        summary =
          snapshot.engine.kind === 'snake'
            ? classicSnakeSummary(run)
            : snapshot.engine.kind === 'team'
              ? getCoopSummary(run)
              : getSummary(run);
      card.title.textContent =
        snapshot.recipe.mode === 'team'
          ? say('Team', 'Команда')
          : `${say('Player', 'Гравець')} ${board + 1}${board === getSeat() ? say(' · You', ' · Ви') : ''}`;
      const time = Math.floor(snapshot.activeMs / 1000),
        clock = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
      card.stats.textContent =
        snapshot.engine.kind === 'snake'
          ? `${summary.catches}/${summary.goal} · ${say('Score', 'Бали')} ${summary.score} · ${clock}`
          : `${(summary.coverage * 100).toFixed(1)}% · ${say('Lives', 'Життя')} ${summary.lives ?? summary.reserves} · ${clock}${summary.hunt ? ` · ${say('Hunt', 'Полювання')} ${summary.hunt.score ?? 0}` : ''}`;
      card.details.textContent =
        snapshot.engine.kind === 'team'
          ? summary.players
              .map(
                (player) =>
                  `P${player.id + 1} ${statusText(player.status)}${player.rescue ? ` · ${Math.round(player.rescue.progress * 100)}%` : ''} · ${Math.ceil(player.supportCooldown)}s`,
              )
              .join(' / ')
          : snapshot.engine.kind === 'snake'
            ? run.snakes
                .map(
                  (snake) =>
                    `${say('Length', 'Довжина')} ${snake.body.length} · ${(snake.turns ?? []).map((dir) => ({ up: '↑', right: '→', down: '↓', left: '←' })[dir]).join(' ') || '·'}`,
                )
                .join(' / ')
            : `${say('Score', 'Бали')} ${summary.score} · ${statusText(summary.status)}`;
    }
    const team = snapshot.engine.kind === 'team',
      snake = snapshot.engine.kind === 'snake';
    $('support').hidden = !team;
    const equipment = !snake && !team ? arcadeActionCapabilities(snapshot.recipe.level) : null;
    $('boost-button').hidden = snake || (!team && !equipment.manualBoost);
    $('action-button').hidden = snake || team || !equipment.manualAbility;
    $('pickup-button').hidden = snake || team || !equipment.manualPickup;
    arrange();
  }
  function statusText(value) {
    return uk
      ? ({
          active: 'у строю',
          downed: 'потребує порятунку',
          respawning: 'повертається',
          dead: 'вибув',
          running: 'гра',
          won: 'перемога',
          lost: 'поразка',
        }[value] ?? value)
      : value;
  }
  function frame() {
    const state = getState();
    const controls = input.poll();
    const live = canPlay() && !shell.blocksPlay();
    if (!live || !state) return;
    const command = {
      ...controls,
      support: state.engine.kind === 'team' && (supportInput.held() || controls.action),
      steer: false,
    };
    if (state.engine.kind === 'team') command.action = command.pickup = false;
    if (state.engine.kind === 'snake') command.action = command.pickup = command.boost = false;
    const turns = pendingTurns.splice(0);
    if (turns.length) for (const direction of turns) submit({ ...command, direction, steer: true });
    else if (JSON.stringify(command) !== lastControls) submit(command);
    lastControls = JSON.stringify(command);
    for (const [board, run] of state.engine.runs.entries()) {
      let projected = run;
      if (state.engine.kind === 'snake') {
        projected = projections[board] ??= {};
        Object.assign(projected, {
          tick: run.tick,
          time: run.elapsedMs / 1000,
          status: run.status,
          levelId: run.level.id,
          width: run.level.width,
          height: run.level.height,
          players: run.snakes.map((snake) => ({
            ...snake.body[0],
            id: snake.id,
            bodyId: 'fpv-scout-v1',
            status: snake.alive ? 'active' : 'dead',
          })),
          enemies: (run.targets ?? (run.target ? [run.target] : [])).map((target) => ({
            ...target,
            bodyId: 'humanoid',
            family: target.kind,
            frozenUntil: run.pulseTicks > 0 ? Infinity : 0,
          })),
        });
      }
      sound.feedback(live, { family: 'fpv' }, projected, {
        mode: state.recipe.mode,
        board: `room-${board}`,
        placement: boardPlacement(cards[board]?.canvas),
        silentStart: true,
        phaseEvents: false,
      });
    }
  }
  return {
    shell,
    boards,
    update,
    frame,
    suspend,
    boardStyle: () => $('room-board').value,
    tailStyle: () => $('room-tail').value,
    width: (board) => footprints?.width(board),
    dispose() {
      suspend();
      sound.suspend();
      cursor.reset();
      footprints?.dispose();
      observer?.disconnect();
      input.destroy();
      supportInput.dispose();
      navigation.destroy();
      reactions.dispose();
      sound.dispose();
      stopAudio();
      audioPreferences.dispose();
      audioMaster.dispose();
      encounter.dispose();
      style.dispose();
      toolDisplay.dispose();
      stopDisplay();
      shell.dispose();
    },
  };
}
