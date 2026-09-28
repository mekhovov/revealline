import { CELL, FIXED_DT } from '../core/index.mjs';
import {
  neutralPilotEntries,
  createNeutralPilotSession,
  advanceNeutralPilotSession,
  pilotRuns,
  pilotSessionEnded,
  exportPilotObservations,
  MAX_PILOT_TICKS,
} from './neutral-pilot-session.mjs';
export { resolveNeutralPilotRuntime } from './neutral-pilot-session.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import { drawEnemyPressure, drawLineImpacts } from '../ui/classic-view.mjs';

const SIZE = 16;
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
  const entries = neutralPilotEntries();
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    selection.append(option);
  }
  let entry,
    session,
    difficulty,
    paused = true,
    previous = 0,
    accumulator = 0,
    updated = 0,
    canvases = [],
    sequence = 0;
  const held = new Map();
  const currentRuns = () => pilotRuns(session);
  function pause() {
    paused = true;
    held.clear();
    accumulator = 0;
    const finished = session && (pilotSessionEnded(session) || session.ticks >= MAX_PILOT_TICKS);
    $('play').disabled = Boolean(finished);
    $('play').textContent = finished ? 'Reset to play again' : 'Play';
  }
  function reset() {
    pause();
    entry = entries.find((row) => row.id === selection.value) ?? entries[0];
    difficulty = $('difficulty').value;
    session = createNeutralPilotSession({ mission: entry.id, difficulty });
    $('play').disabled = false;
    $('play').textContent = 'Play';
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
    else if (!pilotSessionEnded(session) && session.ticks < MAX_PILOT_TICKS) {
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
    const record = exportPilotObservations(session, $('notes').value);
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
      const directions = Array.from(
        { length: entry.mode === 'solo' ? 1 : 2 },
        (_, seat) =>
          [...held.values()].filter((row) => row.seat === seat).sort((a, b) => b.order - a.order)[0]
            ?.direction ?? null,
      );
      advanceNeutralPilotSession(session, directions);
      accumulator -= FIXED_DT;
      if (session.ticks >= MAX_PILOT_TICKS || pilotSessionEnded(session)) pause();
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
        .join(
          ' | ',
        )} · ${session.events.filter((event) => ['player.failed', 'player.downed'].includes(event.type)).length} failures`;
      updated = now;
    }
    window.requestAnimationFrame(frame);
  }
  reset();
  window.requestAnimationFrame(frame);
  return { reset, pause };
}

if (typeof document !== 'undefined') startNeutralPilotPlayer(document, window);
