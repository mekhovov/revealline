import { geometryForRun } from '../core/geometry.mjs';
import { CELL, FIXED_DT } from '../core/registry.mjs';
import { encounterCutCells } from '../core/encounter.mjs';

/** Read-only cues shared by live play and replay rendering. No presentation clock owns a phase. */
export function encounterView(state) {
  const e = state?.encounter;
  if (!e) return null;
  const recipe = state.level.encounter;
  const min = recipe.minReleaseCutCells;
  const remaining = state.cells.reduce((sum, cell) => sum + Number(cell === CELL.FIELD), 0);
  const cutCells = encounterCutCells(state);
  const ended = state.status === 'lost';
  const seconds = ended ? 0 : Math.max(0, ((e.phaseEndTick ?? state.tick) - state.tick) * FIXED_DT);
  const enemy = state.enemies.find((item) => item.id === recipe.enemyId);
  const suppressed = !!enemy && enemy.stunnedUntil > state.time + 1e-8;
  const isolated = remaining <= min;
  const lane = Number.isFinite(e.lane)
    ? `${e.axis === 'horizontal' ? 'row' : 'column'} ${Math.floor(e.lane)}`
    : '';
  const phaseName = {
    delay: 'SHIELD RELAY',
    warning: 'LANE WARNING',
    active: suppressed ? 'LANE SUPPRESSED' : 'LANE ACTIVE',
    rest: 'SHIELD RELAY',
    transition: 'SHIELD OPENING',
    open: 'CORE OPEN',
    defeated: 'CORE RELEASED',
  }[e.phase];
  const title = ended
    ? 'FLIGHT ENDED'
    : `${e.stage === 'shielded' ? '1 / 2' : '2 / 2'} · ${phaseName}${e.defeated ? '' : ` · ${seconds.toFixed(1)}s`}`;
  let instruction;
  if (ended) instruction = 'Restart to try the two stages again.';
  else if (state.status === 'respawning')
    instruction = 'Recovering at home. The encounter clock continues; wait for control to return.';
  else if (e.defeated)
    instruction =
      e.defeatCause === 'isolated'
        ? 'Core isolated. The picture is yours.'
        : 'Release cut secured. The picture is yours.';
  else if (e.stage === 'shielded')
    instruction = `Capture the shield relay. ${lane ? `Watch ${lane}.` : 'Return every line to safe ground.'}`;
  else if (e.stage === 'transition')
    instruction = 'Relay secured. A vertical attack comes before the first opening.';
  else if (isolated)
    instruction =
      e.phase === 'open'
        ? 'Core isolated. Return to safe ground with no live line to finish.'
        : 'Core isolated. Reach safe ground and wait for CORE OPEN.';
  else
    instruction = `Live line ${cutCells} / ${min} new cells · Close on safe ground during CORE OPEN.${lane && e.phase !== 'open' ? ` Watch ${lane}.` : ''}`;
  return Object.freeze({
    title,
    instruction,
    phase: e.phase,
    stage: e.stage,
    seconds,
    lane,
    cutCells,
    min,
    remaining,
    isolated,
    suppressed,
  });
}

/** Hatched warning and solid active lane remain distinct with motion and sound disabled. */
export function drawEncounterLane(ctx, state, palette) {
  const e = state.encounter;
  if (!e || e.defeated || !['warning', 'active'].includes(e.phase) || !Number.isFinite(e.lane))
    return;
  const geometry = geometryForRun(state);
  const W = geometry.width * 16,
    H = geometry.height * 16;
  const width = state.level.encounter.laneWidth * 16;
  const horizontal = e.axis === 'horizontal';
  const x = horizontal ? 16 : e.lane * 16 - width / 2;
  const y = horizontal ? e.lane * 16 - width / 2 : 16;
  const w = horizontal ? W - 32 : width,
    h = horizontal ? width : H - 32;
  const enemy = state.enemies.find((item) => item.id === state.level.encounter.enemyId);
  const suppressed = !!enemy && enemy.stunnedUntil > state.time + 1e-8;
  ctx.save();
  ctx.beginPath();
  ctx.rect(16, 16, W - 32, H - 32);
  ctx.clip();
  ctx.fillStyle = suppressed ? palette.muted : palette.danger;
  ctx.globalAlpha = e.phase === 'active' && !suppressed ? 0.48 : 0.14;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = palette.paper;
  ctx.lineWidth = e.phase === 'active' ? 2 : 1;
  ctx.setLineDash(e.phase === 'warning' || suppressed ? [5, 4] : []);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  if (e.phase === 'warning' || suppressed) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = suppressed ? palette.muted : palette.danger;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let n = -H; n < W; n += 12) {
      ctx.moveTo(n, 0);
      ctx.lineTo(n + H, H);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEncounterCore(ctx, state, enemy, palette, reduced) {
  const e = state.encounter;
  if (!e || enemy.id !== state.level.encounter.enemyId || e.defeated) return;
  const open = e.phase === 'open';
  const spread = open ? 24 : e.stage === 'transition' ? 21 : 18;
  const offset = spread + (open && !reduced ? Math.round(Math.sin(state.time * 3) * 2) : 0);
  const x = enemy.x * 16,
    y = enemy.y * 16;
  ctx.save();
  ctx.strokeStyle = open ? palette.safe : palette.paper;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    ctx.moveTo(x + dx * (offset - 8), y + dy * offset);
    ctx.lineTo(x + dx * offset, y + dy * offset);
    ctx.lineTo(x + dx * offset, y + dy * (offset - 8));
  }
  ctx.stroke();
  ctx.fillStyle = open ? palette.safe : palette.paper;
  // Two stable progress blocks distinguish shielded and exposed stages without color.
  ctx.fillRect(x - 7, y + offset + 4, 5, 4);
  if (e.stage !== 'shielded') ctx.fillRect(x + 2, y + offset + 4, 5, 4);
  else {
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + offset + 4, 5, 4);
  }
  ctx.restore();
}
