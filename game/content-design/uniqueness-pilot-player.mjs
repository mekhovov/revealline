import {
  createClassicUniquenessPilots,
  createHorizonVersusUniquenessPilot,
  createUniquenessPilotControls,
} from './uniqueness-pilot.mjs';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { compileContentProject, resolveMission } from './project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import { drawEnemyPressure, drawLineImpacts } from '../ui/classic-view.mjs';

const SIZE = 16;
export function resolveNeutralPilotRuntime(entry, difficulty) {
  const tuning = resolveGameplayTuning(difficulty);
  const sourceLevel = entry.resolveLevel
    ? entry.resolveLevel(difficulty)
    : difficulty === 'gentle'
      ? createDifficultyContext(
          {
            version: 'xonix-campaign.v1',
            id: 'neutral-pilot',
            revision: 'greybox-1',
            title: 'Neutral pilot',
            levels: [entry.level],
          },
          'gentle',
        ).campaign.levels[0]
      : entry.level;
  return { sourceLevel, tuning, level: applyGameplayTuning(sourceLevel, tuning) };
}
/** Neutral paint only. Coordinates and warnings come from simulation state. */
export function drawNeutralPilotBoard(context, run) {
  const dot = (item, color, radius = 5) => {
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return;
    context.fillStyle = color;
    context.beginPath();
    context.arc(item.x * SIZE, item.y * SIZE, radius, 0, Math.PI * 2);
    context.fill();
  };
  for (let i = 0; i < run.cells.length; i++) {
    context.fillStyle =
      run.cells[i] === CELL.WALL ? '#737c88' : run.cells[i] === CELL.SAFE ? '#334c47' : '#17202b';
    context.fillRect((i % run.width) * SIZE, Math.floor(i / run.width) * SIZE, SIZE, SIZE);
  }
  const terrain = run.classic?.terrain ?? run.terrain;
  if (terrain)
    for (let i = 0; i < terrain.length; i++)
      if (terrain[i] && run.cells[i] !== CELL.SAFE) {
        context.fillStyle = terrain[i] === 2 ? '#744849' : '#665632';
        context.fillRect(
          (i % run.width) * SIZE + 2,
          Math.floor(i / run.width) * SIZE + 2,
          SIZE - 4,
          SIZE - 4,
        );
      }
  const players = run.players ?? [{ ...run.player, trail: run.trail }];
  for (const [seat, player] of players.entries()) {
    context.fillStyle = seat ? '#ee94d1' : '#a8edff';
    for (const cell of player.trail ?? [])
      context.fillRect(
        (cell % run.width) * SIZE + 5,
        Math.floor(cell / run.width) * SIZE + 5,
        6,
        6,
      );
    dot(player, player.status === 'downed' ? '#ffffff' : seat ? '#ee94d1' : '#a8edff', 6);
  }
  for (const enemy of run.enemies)
    if (enemy.active !== false) dot(enemy, '#fc7a86', Math.max(5, (enemy.radius ?? 0.3) * SIZE));
  for (const objective of run.objectives ?? []) if (!objective.captured) dot(objective, '#ffdb69');
  for (const pickup of run.classic?.powerups ?? [])
    if (pickup.collectedTick === null && pickup.active !== false) dot(pickup, '#70e4a6', 4);
  if (run.classic) {
    const view = foundationCompatibleView(run);
    drawEnemyPressure(context, view, { safe: '#b7dfcb' });
    drawLineImpacts(context, view, { time: run.time });
  } else for (const impact of run.impacts ?? []) dot(impact, '#fff0b2', 5);
}

export function startNeutralPilotPlayer(document, window) {
  const $ = (id) => document.getElementById(id),
    selection = $('mission'),
    boardHost = $('boards'),
    status = $('status');
  const controls = createUniquenessPilotControls(),
    project = createHorizonVersusUniquenessPilot();
  const controlPresets = new Map([['standard', controls]]);
  const controlsFor = (difficulty) => {
    if (!controlPresets.has(difficulty))
      controlPresets.set(difficulty, createUniquenessPilotControls(difficulty));
    return controlPresets.get(difficulty);
  };
  const versusProject = compileContentProject(project);
  const versus = resolveMission(compileContentProject(project), project.missions[0].id, {
    mode: 'versus',
  });
  const pressure = CURRENT_ART_SOURCES.find(
    (row) => row.owner.levelId === 'orchard-crossing' && row.source.packId === 'fpv-arcade-r5',
  );
  const entries = [
    ...createClassicUniquenessPilots().map((row) => ({
      id: row.id,
      mode: 'solo',
      level: row.level,
      label: row.brief.name,
      decision: row.brief.decision,
    })),
    {
      id: versus.missionId,
      mode: 'versus',
      level: versus.level,
      resolveLevel: (difficulty) =>
        resolveMission(versusProject, versus.missionId, { mode: 'versus', difficulty }).level,
      label: 'Horizon: two-bank race',
      decision: versus.design.routeDecision,
    },
    {
      id: 'control-solo',
      mode: 'solo',
      level: controls.solo.level,
      resolveLevel: (difficulty) => controlsFor(difficulty).solo.level,
      label: 'Control: Solo First return',
      decision: controls.solo.design.routeDecision,
    },
    {
      id: 'control-team',
      mode: 'team',
      level: controls.team.level,
      resolveLevel: (difficulty) => controlsFor(difficulty).team.level,
      label: 'Control: Team Twin landings',
      decision: controls.team.design.routeDecision,
    },
    {
      id: 'control-pressure',
      mode: 'solo',
      level: pressure.level,
      label: 'Control: Pressure Lines Orchard Crossing',
      decision: pressure.level.metadata.description,
    },
  ];
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    selection.append(option);
  }
  let entry,
    simulation,
    runtime,
    difficulty,
    paused = true,
    previous = 0,
    accumulator = 0,
    updated = 0,
    inputs = [],
    failures = [],
    canvases = [],
    sequence = 0;
  const held = new Map();
  const currentRuns = () => (entry.mode === 'versus' ? simulation.runs : [simulation]);
  function pause() {
    paused = true;
    held.clear();
    accumulator = 0;
    $('play').textContent = 'Play';
  }
  function reset() {
    pause();
    entry = entries.find((row) => row.id === selection.value) ?? entries[0];
    difficulty = $('difficulty').value;
    runtime = resolveNeutralPilotRuntime(entry, difficulty);
    const { level } = runtime;
    simulation =
      entry.mode === 'team'
        ? startCoop(createCoop(level, { seed: 17, difficulty }))
        : entry.mode === 'versus'
          ? createDuel(
              level,
              { seed: 17, classId: 'scout' },
              { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
            )
          : createRun(level, { seed: 17, classId: 'scout' });
    if (entry.mode === 'versus') resumeDuel(simulation);
    inputs = [];
    failures = [];
    $('notes').value = '';
    boardHost.replaceChildren();
    canvases = currentRuns().map((run, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = run.width * SIZE;
      canvas.height = run.height * SIZE;
      canvas.setAttribute('aria-label', `Neutral game board ${index + 1}`);
      boardHost.append(canvas);
      return canvas;
    });
    $('brief').textContent = entry.decision;
    $('pads').children[1].hidden = entry.mode === 'solo';
    status.textContent = `Ready · ${difficulty} · Seed 17 · review only`;
  }
  for (let seat = 0; seat < 2; seat++) {
    const pad = document.createElement('div');
    pad.className = 'pad';
    const label = document.createElement('strong');
    label.textContent = `Player ${seat + 1}`;
    pad.append(label);
    for (const [direction, text, position] of [
      ['up', '↑', 2],
      ['left', '←', 4],
      ['down', '↓', 5],
      ['right', '→', 6],
    ]) {
      const button = document.createElement('button');
      button.textContent = text;
      button.style.gridColumn = String(((position - 1) % 3) + 1);
      button.style.gridRow = String(Math.floor((position - 1) / 3) + 2);
      button.setAttribute('aria-label', `Player ${seat + 1} ${direction}`);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        held.set(`pointer-${event.pointerId}`, { seat, direction, order: ++sequence });
      });
      const release = (event) => held.delete(`pointer-${event.pointerId}`);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      pad.append(button);
    }
    $('pads').append(pad);
  }
  const keys = {
    ArrowUp: [0, 'up'],
    ArrowDown: [0, 'down'],
    ArrowLeft: [0, 'left'],
    ArrowRight: [0, 'right'],
    KeyW: [1, 'up'],
    KeyS: [1, 'down'],
    KeyA: [1, 'left'],
    KeyD: [1, 'right'],
  };
  window.addEventListener('keydown', (event) => {
    if (['TEXTAREA', 'INPUT', 'SELECT'].includes(event.target?.tagName)) return;
    if (event.code === 'Escape') {
      pause();
      return;
    }
    if (!keys[event.code] || paused) return;
    event.preventDefault();
    const [seat, direction] = keys[event.code];
    held.set(event.code, { seat: entry.mode === 'solo' ? 0 : seat, direction, order: ++sequence });
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  $('play').addEventListener('click', () => {
    if (!paused) pause();
    else {
      paused = false;
      held.clear();
      accumulator = 0;
      $('play').textContent = 'Pause';
    }
  });
  $('reset').addEventListener('click', reset);
  selection.addEventListener('change', reset);
  $('difficulty').addEventListener('change', reset);
  $('export').addEventListener('click', () => {
    pause();
    const record = {
      format: 'revealline-neutral-pilot-observations.v1',
      mission: entry.id,
      mode: entry.mode,
      seed: 17,
      difficulty,
      sourceLevel: runtime.sourceLevel,
      runtimeLevels: currentRuns().map((run) => run.level),
      tuning: runtime.tuning,
      states: currentRuns().map((run) => ({
        status: run.status,
        tick: run.tick,
        time: run.time,
        coverage: run.coverage,
      })),
      failures,
      inputs,
      notes: $('notes').value,
      approval: 'Unapproved playtest observations; not saved game progress.',
    };
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }),
      ),
      link = document.createElement('a');
    link.href = url;
    link.download = `${entry.id}-observations.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  function frame(now) {
    const elapsed = previous ? Math.min(0.1, (now - previous) / 1000) : 0;
    previous = now;
    if (!paused) accumulator += elapsed;
    while (!paused && accumulator >= FIXED_DT) {
      const commands = [0, 1].map((seat) => ({
        direction:
          [...held.values()].filter((row) => row.seat === seat).sort((a, b) => b.order - a.order)[0]
            ?.direction ?? null,
        boost: false,
        support: false,
      }));
      if (entry.mode === 'team') stepCoop(simulation, commands);
      else if (entry.mode === 'versus') stepDuel(simulation, commands);
      else stepRun(simulation, commands[0], FIXED_DT);
      inputs.push(commands);
      for (const [seat, run] of currentRuns().entries())
        for (const event of run.events)
          if (['player.failed', 'player.downed'].includes(event.type))
            failures.push({ seat, tick: run.tick, event: structuredClone(event) });
      accumulator -= FIXED_DT;
      if (
        inputs.length >= 72000 ||
        (entry.mode === 'versus'
          ? simulation.status === 'finished'
          : ['won', 'lost'].includes(simulation.status))
      )
        pause();
    }
    currentRuns().forEach((run, index) =>
      drawNeutralPilotBoard(canvases[index].getContext('2d'), run),
    );
    if (now - updated > 250) {
      status.textContent = `${paused ? 'Paused' : 'Playing'} · ${difficulty} · ${currentRuns()
        .map(
          (run, index) =>
            `${entry.mode === 'versus' ? `Player ${index + 1}: ` : ''}${run.time.toFixed(1)}s · ${(run.coverage * 100).toFixed(1)}% · ${run.status}`,
        )
        .join(' | ')} · ${failures.length} failures`;
      updated = now;
    }
    window.requestAnimationFrame(frame);
  }
  reset();
  window.requestAnimationFrame(frame);
  return { reset, pause };
}

if (typeof document !== 'undefined') startNeutralPilotPlayer(document, window);
