import { createRun, stepRun, getSummary, releaseInputs, CLASSES, FIXED_DT } from './core/index.mjs';
import { BoardPainter } from './ui/render.mjs';
import { attachInput } from './ui/input.mjs';
import { Soundscape } from './ui/audio.mjs';
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  awardCompletion,
  achievements,
  unlockedBodies,
  canPlay,
} from './progress.mjs';
import { downloadJSON } from './content.mjs';
import { prepareScenario } from './imports.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  MAX_REPLAY_TICKS,
} from './replay.mjs';

const $ = (id) => document.getElementById(id),
  show = (id, on) => ($(id).hidden = !on);
const getJSON = async (path) => {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load ${path}`);
  return r.json();
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const timeLabel = (time) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

try {
  const [campaign, themesFile, presets, classRegistry] = await Promise.all([
    getJSON('content/campaign.json'),
    getJSON('content/themes.json'),
    getJSON('../authoring/motion-lab/presets.json'),
    getJSON('content/classes.json'),
  ]);
  campaign.classRecipes = classRegistry;
  let buildVersion = '0.1.0',
    isRelease = false;
  try {
    buildVersion = (await getJSON('build-info.json')).version;
    isRelease = true;
  } catch {}
  if (isRelease) document.querySelectorAll('[data-source-only]').forEach((a) => (a.hidden = true));
  $('version').textContent =
    `${/^\d/.test(buildVersion) ? 'v' : ''}${buildVersion}${isRelease ? '' : ' / DEV'}`;
  const params = new URLSearchParams(location.search);
  let scenario = null;
  if (params.get('practice') === '1') {
    const raw = sessionStorage.getItem('revealline.playground.current');
    if (!raw)
      throw new Error(
        'This practice tab has no configuration. Open the Playground and choose Play configuration.',
      );
    const prepared = await prepareScenario(JSON.parse(raw), { classRecipes: classRegistry });
    scenario = prepared.scenario;
  }
  const saveKey = `revealline.game.${isRelease ? 'release' : 'dev'}.${buildVersion}.${campaign.id}.${campaign.revision}`;
  let loaded;
  try {
    loaded = loadProgress(localStorage, saveKey, campaign);
  } catch {
    loaded = {
      progress: emptyProgress(campaign),
      warning: 'Storage is unavailable; progress is session-only.',
      recovery: null,
    };
  }
  let progress = loaded.progress,
    recovery = loaded.recovery;
  if (loaded.warning) {
    $('save-warning').textContent = loaded.warning;
    show('save-warning', true);
  }
  let levelIndex = 0,
    theme = themesFile.themes[0],
    classId = 'scout',
    turnPolicy = 'immediate',
    seed = 1,
    bodyId = theme.player,
    run,
    runId,
    started = false,
    paused = true,
    demo = false,
    practice = !!scenario,
    accumulator = 0,
    handled = false,
    pendingAction = false,
    pendingPickup = false,
    saveSucceeded = true,
    recorder = null,
    recordingStopped = false,
    captionUntil = 0,
    bodyWarning = '';
  if (scenario) {
    theme = scenario.theme;
    classId = scenario.settings.classId;
    turnPolicy = scenario.settings.turnPolicy;
    seed = scenario.settings.seed;
    bodyId = theme.player;
  }
  const sound = new Soundscape();
  const painter = new BoardPainter(presets, {
    onAsset: (message) => {
      const rig = scenario?.visualOverrides?.player
        ? 'Custom player artwork keeps the selected body’s rotor anchors. Check alignment.'
        : '';
      const copy = [message, rig, bodyWarning].filter(Boolean).join(' ');
      $('asset-warning').textContent = copy;
      show('asset-warning', !!copy);
    },
  });
  const mediaReduce = matchMedia('(prefers-reduced-motion: reduce)');
  $('reduced-effects').checked = mediaReduce.matches;
  $('tap-steering').checked = matchMedia('(pointer: coarse)').matches;
  function warning(message) {
    $('run-message').textContent = message;
    captionUntil = (run?.time || 0) + 5;
  }
  function dialogOpen() {
    return !!document.querySelector('dialog[open]');
  }
  const input = attachInput({
    arena: $('game-canvas'),
    onPause: (force) => pause(force),
    onActivity: () => {
      if (started && paused && !dialogOpen()) resume();
    },
    tapMode: () => $('tap-steering').checked,
    active: () => started && !dialogOpen() && !['won', 'lost'].includes(run?.status),
    onGamepad: (message) => ($('input-status').textContent = message),
  });
  function clearInput() {
    pendingAction = false;
    pendingPickup = false;
    input.clear();
    if (run) {
      releaseInputs(run);
      if (recorder && !recordingStopped) recordRelease(recorder);
    }
    accumulator = 0;
  }
  function setTheme() {
    bodyWarning = '';
    if (!presets.characters[bodyId]) {
      bodyWarning = `Body ${bodyId} is not registered. Using the neutral rig; choose a registered appearance to change its animation.`;
      bodyId = 'neutral-marker';
    }
    for (const [name, value] of Object.entries({
      paper: theme.palette.paper,
      ink: theme.palette.ink,
      accent: theme.palette.accent,
      safe: theme.palette.safe,
      danger: theme.palette.danger,
    }))
      document.documentElement.style.setProperty(`--${name}`, value);
    $('theme-caption').textContent =
      `${theme.name.toUpperCase()} / ${theme.subtitle.toUpperCase()}`;
    $('score-label').textContent = theme.labels.currency.toUpperCase();
    $('pickup-button').firstChild.textContent = theme.labels.supply + ' ';
    $('action-button').title = theme.labels.ability;
    $('world-legend').textContent =
      `${theme.labels.enemy} · ${theme.labels.boss} · ${theme.labels.supply}`;
    $('footer-note').textContent =
      theme.id === 'coupa'
        ? 'Fictional spend-management theme · original helper artwork'
        : 'Original game study · configurable worlds';
    painter.style = scenario?.presentation?.style || 'hybrid';
    painter.setLook(theme, bodyId, scenario?.visualOverrides || {});
    updateBodies();
  }
  function updateBodies() {
    const allowed = unlockedBodies(progress);
    $('body-select').replaceChildren();
    for (const [id, body] of Object.entries(presets.characters)) {
      const option = new Option(
        `${body.label}${allowed.has(id) || practice ? '' : ' · locked'}`,
        id,
      );
      option.disabled = !allowed.has(id) && !practice;
      $('body-select').append(option);
    }
    if (!allowed.has(bodyId) && !practice) bodyId = theme.player;
    $('body-select').value = bodyId;
  }
  function leavePractice() {
    scenario = null;
    practice = false;
    demo = false;
    theme = themesFile.themes.find((t) => t.id === theme.id) || themesFile.themes[0];
    if (!classRegistry.some((c) => c.id === classId)) classId = classRegistry[0].id;
    bodyId = unlockedBodies(progress).has(bodyId) ? bodyId : theme.player;
    $('class-select').replaceChildren(...classRegistry.map((c) => new Option(c.label, c.id)));
    $('theme-select').replaceChildren(...themesFile.themes.map((t) => new Option(t.name, t.id)));
    $('theme-select').value = theme.id;
    setTheme();
  }
  function paintMissions() {
    $('missions').replaceChildren();
    campaign.levels.forEach((level, index) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `mission${index === levelIndex && !practice ? ' selected' : ''}`;
      b.disabled = !canPlay(progress, campaign, index);
      b.dataset.level = String(index);
      b.setAttribute('aria-label', `${index + 1}. ${level.name}${b.disabled ? ' — locked' : ''}`);
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = level.name;
      const medal = document.createElement('span');
      medal.className = 'medal';
      medal.textContent = progress.clears[level.id]
        ? '★'.repeat(progress.clears[level.id].medals)
        : b.disabled
          ? '—'
          : '↗';
      b.append(number, name, medal);
      b.onclick = () => {
        leavePractice();
        levelIndex = index;
        prepare();
      };
      $('missions').append(b);
    });
    $('campaign-progress').textContent =
      `${String(Object.keys(progress.clears).length).padStart(2, '0')} / ${String(campaign.levels.length).padStart(2, '0')}`;
  }
  function updateLoadout() {
    const recipe = (scenario?.classRecipes || classRegistry).find((c) => c.id === classId);
    $('class-description').textContent = recipe.description;
    $('action-button').firstChild.textContent = `${recipe.label} `;
    $('class-select').value = classId;
    $('turn-select').value = turnPolicy;
  }
  function overlay(kind) {
    show('game-overlay', true);
    show('next-button', kind === 'won');
    show('retry-button', kind === 'won' || kind === 'lost');
    show('start-button', kind === 'ready' || kind === 'pause');
    show('result-medals', kind === 'won');
    $('overlay-eyebrow').textContent = practice
      ? 'PRACTICE / NO CAMPAIGN REWARDS'
      : `MISSION ${String(levelIndex + 1).padStart(2, '0')} / ${run.level.name.toUpperCase()}`;
    if (kind === 'ready') {
      $('overlay-title').innerHTML =
        levelIndex === 0 && !practice
          ? 'Clear a path.<br>Reveal a world.'
          : escapeHTML(run.level.name);
      $('overlay-copy').textContent = practice
        ? 'Test this authored configuration in the real game engine. Practice does not change your campaign collection.'
        : campaign.briefs[levelIndex];
      $('start-button').textContent = 'Start mission ↗';
      $('overlay-footnote').textContent =
        'Arrows / WASD · E ability · R supply · touch controls below';
    }
    if (kind === 'pause') {
      $('overlay-title').textContent = 'Take a breath.';
      $('overlay-copy').textContent =
        'Your line, enemies and clock are paused. Continue when you are ready.';
      $('start-button').textContent = 'Resume →';
      $('overlay-footnote').textContent = 'Focus loss pauses the game and releases held controls.';
    }
    if (kind === 'won') {
      $('overlay-title').textContent = 'A little more light.';
      $('overlay-copy').textContent =
        `${(run.coverage * 100).toFixed(1)}% revealed · ${run.score.toLocaleString()} points · ${timeLabel(run.time)}. ${practice ? 'Practice complete.' : saveSucceeded ? 'Your progress is saved for this version.' : 'Progress is available for this session only.'}`;
      $('result-medals').textContent = '★'.repeat(
        run.medal === 'gold' ? 3 : run.medal === 'silver' ? 2 : 1,
      );
      $('next-button').textContent = practice
        ? 'Try it yourself →'
        : levelIndex === campaign.levels.length - 1
          ? 'Back to first signal →'
          : 'Next mission →';
      $('overlay-footnote').textContent = practice
        ? 'Demonstrations and imported maps do not grant unlocks.'
        : run.medal === 'gold'
          ? 'Gold: fast and no lives lost.'
          : 'Try another class, or return for a clean, faster route.';
    }
    if (kind === 'lost') {
      $('overlay-title').textContent = 'A new line awaits.';
      $('overlay-copy').textContent =
        `You revealed ${(run.coverage * 100).toFixed(1)}%. Watch the danger, choose your cut and try again.`;
      $('retry-button').textContent = 'Try again ↻';
      $('overlay-footnote').textContent =
        'Retries start immediately. Previous campaign progress is kept.';
    }
  }
  function escapeHTML(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  }
  function prepare() {
    clearInput();
    run = createRun(scenario?.level || campaign.levels[levelIndex], {
      seed,
      turnPolicy,
      classId,
      classRecipes: scenario?.classRecipes || classRegistry,
    });
    runId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    started = false;
    paused = true;
    handled = false;
    recordingStopped = false;
    recorder = createRecorder(
      run.level,
      { seed, turnPolicy, classId, classRecipes: scenario?.classRecipes || classRegistry },
      buildVersion,
    );
    $('export-replay').disabled = false;
    captionUntil = 0;
    $('mode-caption').textContent = practice
      ? 'PLAYGROUND / PRACTICE'
      : `FIRST SIGNAL · ${String(levelIndex + 1).padStart(2, '0')} / 08`;
    updateLoadout();
    paintMissions();
    overlay('ready');
    warning(
      practice
        ? 'Practice uses the same simulation; campaign awards are disabled.'
        : campaign.briefs[levelIndex],
    );
    refreshHUD();
  }
  function resume() {
    if (!run || ['won', 'lost'].includes(run.status)) return;
    clearInput();
    started = true;
    paused = false;
    show('game-overlay', false);
    $('game-canvas').focus({ preventScroll: true });
    $('pause-button').textContent = 'Ⅱ';
  }
  function pause(force) {
    if (!started || ['won', 'lost'].includes(run?.status)) return;
    if (force !== true && paused) {
      resume();
      return;
    }
    clearInput();
    paused = true;
    overlay('pause');
    $('pause-button').textContent = '▶';
  }
  function refreshHUD() {
    $('coverage').innerHTML = `${(run.coverage * 100).toFixed(1)}<small>%</small>`;
    $('coverage-bar').style.width = `${run.coverage * 100}%`;
    $('goal-marker').style.left = `${run.level.goal.coverage * 100}%`;
    $('target').textContent = `TARGET ${Math.round(run.level.goal.coverage * 100)}%`;
    $('lives').textContent = '◆ '.repeat(run.lives).trim() || '—';
    $('lives').setAttribute('aria-label', `${run.lives} lives`);
    $('time').textContent = timeLabel(run.time);
    $('score').textContent = String(run.score).padStart(5, '0');
    const required = run.objectives.filter((o) => o.required),
      done = required.filter((o) => o.captured);
    $('objective-state').textContent = required.length
      ? `${theme.labels.objective}: ${done.length} / ${required.length}`
      : 'Close a line to reveal the picture';
    $('flight-state').textContent =
      run.status === 'won'
        ? 'Mission complete'
        : run.status === 'lost'
          ? 'Flight ended'
          : run.status === 'respawning'
            ? 'Recovering…'
            : !started
              ? 'Ready for launch'
              : paused
                ? 'Paused'
                : run.player.cutting
                  ? 'LIVE LINE / EXPOSED'
                  : 'Safe ground';
    $('status-dot').style.background = run.player.cutting ? 'var(--danger)' : 'var(--safe)';
    const left = Math.max(0, run.ability.cooldownUntil - run.time);
    $('ability-state').textContent =
      `${left > 0 ? left.toFixed(1) + 's cooldown' : run.ability.capacity && run.ability.ammo === 0 ? 'Empty — refill at supply' : 'Ready'}${run.ability.capacity ? ' · ' + run.ability.ammo + '/' + run.ability.capacity + ' charges' : ''}`;
  }
  function eventFeedback(events) {
    for (const event of events) {
      sound.event(event.type);
      if (event.type === 'cells.claimed')
        warning(
          `Line secured. ${(run.coverage * 100).toFixed(1)}% revealed${event.indices?.length < 50 ? ' — both sides may still contain an enemy.' : '.'}`,
        );
      if (event.type === 'player.failed')
        warning(
          event.cause === 'self-contact'
            ? 'Your line crossed itself. Choose a new route.'
            : 'Your line was caught. The territory you revealed is kept.',
        );
      if (event.type === 'shield.absorbed')
        warning('Shield absorbed the hit. Your unfinished line is cancelled; no life lost.');
      if (event.type === 'ability.rejected')
        warning(
          {
            empty: 'No charges left. Return to a supply pad and press Supply.',
            cooldown: 'Ability is recharging. Watch the cooldown beside your controls.',
            'already-full': 'Your supplies are already full.',
            'out-of-range': 'Move onto a supply pad to pick up a charge.',
          }[event.reason] || 'Ability is unavailable right now.',
        );
      if (event.type === 'ability.used')
        warning(
          {
            scan: 'Hidden objectives marked. Short direction hints show where enemies are heading.',
            'stun-field': 'Stun field placed. Nearby moving field enemies are briefly held.',
            'slow-field': 'Slow field placed. Nearby field enemies move at quarter speed.',
            shield: 'Shield active. One enemy contact can cancel your line safely.',
          }[event.primitive] || `${theme.labels.ability} active.`,
        );
      if (event.type === 'pickup.collected')
        warning('Supplies ready. Choose your next opportunity.');
      if (event.type === 'boss.warning')
        warning(`${theme.labels.boss}: the marked lane will activate shortly.`);
    }
    painter.effectsFor(events);
  }
  function update(elapsed) {
    const controls = input.poll();
    pendingAction = pendingAction || controls.action;
    pendingPickup = pendingPickup || controls.pickup;
    if (!paused && started && !dialogOpen() && !['won', 'lost'].includes(run.status)) {
      if (elapsed > 0.25) {
        pause(true);
        warning('Paused after a long frame interruption. Resume to continue safely.');
        return;
      }
      accumulator += elapsed;
      while (accumulator + 1e-9 >= FIXED_DT && !['won', 'lost'].includes(run.status)) {
        const command = demo
          ? { direction: 'down', boost: false, action: false, pickup: false }
          : {
              direction: controls.direction,
              boost: controls.boost,
              action: pendingAction || controls.action,
              pickup: pendingPickup || controls.pickup,
            };
        if (!recordingStopped && recorder.ticks >= MAX_REPLAY_TICKS) {
          recordingStopped = true;
          recorder = null;
          $('export-replay').disabled = true;
          warning(
            'The 30-minute replay budget is full. Recording was discarded; you can keep playing.',
          );
        }
        stepRun(run, command, FIXED_DT);
        pendingAction = false;
        pendingPickup = false;
        accumulator -= FIXED_DT;
        if (!recordingStopped)
          try {
            recordInput(recorder, command);
          } catch {
            recordingStopped = true;
            recorder = null;
            $('export-replay').disabled = true;
            warning(
              'Replay recording stopped. You can keep playing; start a new attempt to record again.',
            );
          }
        eventFeedback(run.events);
      }
      if (!handled && ['won', 'lost'].includes(run.status)) {
        handled = true;
        paused = true;
        clearInput();
        if (run.status === 'won' && !practice) {
          progress = awardCompletion(progress, campaign, getSummary(run), { runId });
          let saved;
          try {
            saved = saveProgress(localStorage, saveKey, progress, recovery);
          } catch {
            saved = { ok: false, warning: 'Progress is session-only.' };
          }
          saveSucceeded = saved.ok;
          if (saved.ok) recovery = null;
          else {
            $('save-warning').textContent = saved.warning;
            show('save-warning', true);
          }
          updateBodies();
          paintMissions();
        }
        overlay(run.status === 'won' ? 'won' : 'lost');
      }
    } else {
      pendingAction = false;
      pendingPickup = false;
    }
    sound.update(!paused && started, theme);
    refreshHUD();
  }
  for (const t of themesFile.themes) $('theme-select').append(new Option(t.name, t.id));
  if (scenario && !themesFile.themes.some((t) => t.id === theme.id))
    $('theme-select').append(new Option(theme.name, theme.id));
  $('theme-select').value = theme.id;
  for (const c of scenario?.classRecipes || classRegistry)
    $('class-select').append(new Option(c.label, c.id));
  $('theme-select').onchange = () => {
    theme =
      themesFile.themes.find((t) => t.id === $('theme-select').value) ||
      (scenario?.theme?.id === $('theme-select').value ? scenario.theme : themesFile.themes[0]);
    bodyId = theme.player;
    setTheme();
  };
  $('body-select').onchange = () => {
    bodyWarning = '';
    bodyId = $('body-select').value;
    painter.setLook(theme, bodyId, scenario?.visualOverrides || {});
  };
  $('class-select').onchange = () => {
    classId = $('class-select').value;
    demo = false;
    prepare();
  };
  $('turn-select').onchange = () => {
    turnPolicy = $('turn-select').value;
    demo = false;
    prepare();
  };
  $('start-button').onclick = () => resume();
  $('pause-button').onclick = () => pause();
  $('restart-button').onclick = () => {
    demo = false;
    prepare();
    resume();
  };
  $('retry-button').onclick = () => {
    demo = false;
    prepare();
    resume();
  };
  $('next-button').onclick = () => {
    if (practice) {
      if (demo) {
        leavePractice();
        levelIndex = 0;
      }
    } else levelIndex = (levelIndex + 1) % campaign.levels.length;
    prepare();
  };
  $('demo-button').onclick = () => {
    leavePractice();
    levelIndex = 0;
    practice = true;
    demo = true;
    prepare();
    resume();
    warning('Demonstration: this is a real simulated cut. It grants no rewards.');
  };
  $('sound-button').onclick = async () => {
    try {
      const on = await sound.toggle();
      $('sound-button').setAttribute('aria-pressed', String(on));
      $('sound-button').setAttribute('aria-label', on ? 'Mute sound' : 'Enable sound');
    } catch {
      warning('Audio could not start in this browser.');
    }
  };
  $('tap-steering').onchange = () => clearInput();
  $('help-button').onclick = () => {
    pause(true);
    $('help-dialog').showModal();
  };
  $('collection-button').onclick = () => {
    pause(true);
    $('achievements').replaceChildren();
    for (const a of achievements(progress, campaign)) {
      const row = document.createElement('div');
      row.className = `achievement${a.earned ? ' earned' : ''}`;
      const title = document.createElement('strong');
      title.textContent = `${a.earned ? '◆' : '◇'} ${a.name}`;
      const copy = document.createElement('span');
      copy.textContent = a.description;
      row.append(title, copy);
      $('achievements').append(row);
    }
    $('collection-note').textContent =
      'First clear unlocks Skyline FPV, Fixed-wing, Falcon, Vector and Auditor appearances. Four clears unlock Night signal FPV and Delta interceptor. Cosmetics do not change abilities.';
    $('collection-dialog').showModal();
  };
  document
    .querySelectorAll('[data-close]')
    .forEach((b) => (b.onclick = () => $(b.dataset.close).close()));
  $('export-replay').onclick = () => {
    try {
      if (!recorder) throw new Error('Start a new attempt to record a replay.');
      downloadJSON(exportReplay(recorder, run), `revealline-${run.levelId}-replay.json`);
      warning('Replay exported with its exact rules, inputs and final state.');
    } catch (error) {
      warning(`Replay could not export: ${error.message}`);
    }
  };
  window.addEventListener('blur', () => pause(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(true);
  });
  setTheme();
  prepare();
  class FieldScene extends Phaser.Scene {
    create() {
      this.boardTexture = this.textures.createCanvas('field', 768, 576);
      this.boardImage = this.add.image(0, 0, 'field').setOrigin(0);
      this.game.canvas.setAttribute('aria-hidden', 'true');
    }
    update(now, delta) {
      const dt = clamp(delta / 1000, 0, 1);
      update(dt);
      painter.draw(this.boardTexture.context, run, Math.min(dt, 0.1), {
        paused,
        reduced: $('reduced-effects').checked,
        fullReveal: run.status === 'won',
        showGrid: scenario?.presentation?.showGrid || false,
      });
    }
  }
  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game-canvas',
    width: 768,
    height: 576,
    backgroundColor: theme.palette.field,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    fps: { target: 60, forceSetTimeOut: false },
    scene: FieldScene,
    banner: false,
  });
} catch (error) {
  $('overlay-title').textContent = 'The game could not load.';
  $('overlay-copy').textContent = error.message;
  show('start-button', false);
  $('run-message').textContent =
    new URLSearchParams(location.search).get('practice') === '1'
      ? 'Open the Playground and choose Play configuration, or use REVEAL / LINE to return to campaign.'
      : 'Serve the project through HTTP and check the content files. Your saved progress is unchanged.';
  console.error(error);
}
