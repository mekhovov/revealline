/** Cosmetic state observation only. Never mutates a run or creates progress.
 * Compact replay uses the same fields, so it gets the same accepted-state cues. */
const boards = new WeakMap();
/** Effect lifetimes continue after a board finishes, independently of its frozen
 * drone clock. The host still freezes this cosmetic clock on pause/background. */
export function advanceClassicReactionTime(previous = 0, elapsedMs = 0, active = true) {
  if (!active) return previous;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(100, elapsedMs)) : 0;
  return (previous + elapsed) % 60000;
}
const same = (a, b) => a.x === b.x && a.y === b.y;
const copy = (run) => ({
  tick: run.tick,
  parcels: (run.operation?.parcels ?? []).map((p) => ({ ...p })),
  switches: (run.operation?.switchyards ?? []).map((s) => ({ ...s })),
  removed: (run.removedWalls ?? []).map((p) => ({ ...p })),
  shutters: (run.shutters ?? []).map(({ id, closed }) => ({ id, closed })),
});
export function observeClassicWorldReactions(canvas, run, attemptKey, timeMs = 0) {
  let board = boards.get(canvas);
  if (
    !board ||
    board.attemptKey !== attemptKey ||
    board.level !== run.level ||
    run.tick < board.previous.tick
  ) {
    board = { attemptKey, level: run.level, previous: copy(run), effects: [] };
    boards.set(canvas, board);
  }
  if (run.tick !== board.previous.tick) {
    const prior = board.previous;
    const add = (kind, at, extra = {}) => {
      if (at) board.effects.push({ kind, at: { x: at.x, y: at.y }, start: timeMs, ...extra });
    };
    for (const mark of run.recentCatches ?? []) if (mark.tick > prior.tick) add('catch', mark);
    for (const parcel of run.operation?.parcels ?? []) {
      const before = prior.parcels.find((p) => p.id === parcel.id);
      if (!before || before.state === parcel.state) continue;
      const recipe = run.level.operation.parcels.find((p) => p.id === parcel.id);
      if (parcel.state === 'carried')
        add('load', run.snakes.find((s) => s.id === parcel.carrier)?.body[0]);
      if (parcel.state === 'delivered')
        add('delivery', run.level.operation.docks.find((d) => d.id === recipe.dockId)?.at);
    }
    for (const state of run.operation?.switchyards ?? []) {
      const before = prior.switches.find((s) => s.id === state.id);
      if (before?.toggles !== state.toggles) {
        const group = run.level.operation.switchyards.find((s) => s.id === state.id);
        for (const at of group.switches) add('switch', at, { to: group.routes[0][0] });
      }
    }
    for (const shutter of run.shutters ?? []) {
      const before = prior.shutters.find((p) => p.id === shutter.id);
      if (before && before.closed !== shutter.closed)
        for (const at of shutter.cells) add(shutter.closed ? 'gate-close' : 'gate-open', at);
    }
    for (const at of run.removedWalls ?? [])
      if (!prior.removed.some((p) => same(p, at))) add('erosion', at);
    board.previous = copy(run);
  }
  board.effects = board.effects.filter((e) => (timeMs - e.start + 60000) % 60000 < 520).slice(-48);
  return board.effects;
}

export function drawClassicWorldReactions(
  ctx,
  run,
  effects,
  world,
  { unit = 28, palette, timeMs = 0, reduced = false, concealEnemies = false } = {},
) {
  // Gameplay status is never encoded in these particles. Static accepted-state
  // markers remain in the operation/gate renderer when motion is disabled.
  if (reduced) return;
  ctx.save();
  for (const effect of effects) {
    if (concealEnemies && ['catch', 'erosion'].includes(effect.kind)) continue;
    const t = ((timeMs - effect.start + 60000) % 60000) / 520;
    if (t >= 1) continue;
    const x = (effect.at.x + 0.5) * unit,
      y = (effect.at.y + 0.5) * unit;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = effect.kind === 'delivery' ? palette.safe : palette.accent;
    ctx.fillStyle = world.treatment === 'atmospheric-ruins' ? '#a7b995' : palette.accent;
    ctx.lineWidth = 1.5;
    if (effect.kind === 'gate-open' || effect.kind === 'gate-close') {
      // Motion remains on the accepted side rails: an open gate never looks
      // partly closed and a closed gate never exposes a false central passage.
      const opening = effect.kind === 'gate-open';
      ctx.fillStyle = opening ? palette.safe : palette.accent;
      for (const side of [-1, 1]) {
        const railX = x + side * unit * 0.44;
        const travel = (opening ? t : 1 - t) * unit * 0.28;
        ctx.fillRect(railX - 1, y - travel - 2, 2, 4);
        ctx.fillRect(railX - 1, y + travel - 2, 2, 4);
      }
    } else if (effect.kind === 'switch' && effect.to) {
      // Follow the actual displayed orthogonal link, never the prey's route.
      const endX = (effect.to.x + 0.5) * unit,
        endY = (effect.to.y + 0.5) * unit;
      const a = Math.abs(endX - x),
        b = Math.abs(endY - y),
        distance = t * (a + b);
      const px = distance < a ? x + Math.sign(endX - x) * distance : endX;
      const py = distance < a ? y : y + Math.sign(endY - y) * (distance - a);
      ctx.fillRect(px - 2, py - 2, 4, 4);
    } else if (['load', 'delivery'].includes(effect.kind)) {
      const size = unit * (0.23 + t * 0.15);
      ctx.strokeRect(x - size, y - size, size * 2, size * 2);
      if (effect.kind === 'delivery') {
        // Parcel transfers into the dock; it does not linger as a solid object.
        const s = unit * 0.22 * (1 - t);
        ctx.fillRect(x - s, y - s, s * 2, s * 2);
        // Receiving lamps acknowledge the accepted parcel transfer.
        ctx.fillStyle = palette.safe;
        for (const side of [-1, 1])
          ctx.fillRect(x + side * unit * 0.36 - 1, y - unit * 0.2, 2, unit * 0.35);
      } else {
        ctx.fillStyle = '#ddc693';
        ctx.fillRect(x - unit * 0.2, y - unit * 0.18, unit * 0.4, 2);
        ctx.fillRect(x - unit * 0.2, y + unit * 0.18, unit * 0.4, 2);
      }
    } else {
      const material = {
        orchard: '#b4c688',
        freight: '#d1a078',
        workshop: '#dca373',
        harbor: '#a3ccbd',
        relay: '#d8d8b4',
        quarry: '#a1b499',
      };
      ctx.fillStyle =
        effect.kind === 'erosion' ? (material[world.scene] ?? '#bac2a8') : palette.accent;
      if (effect.kind === 'catch' && t < 0.45) {
        const reach = unit * (0.15 + t * 0.5);
        ctx.beginPath();
        ctx.moveTo(x - reach, y);
        ctx.lineTo(x + reach, y);
        ctx.moveTo(x, y - reach);
        ctx.lineTo(x, y + reach);
        ctx.stroke();
      }
      // Fragments stay in their accepted cell and cannot masquerade as hazards.
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const radius = unit * (0.1 + t * 0.28);
        ctx.fillRect(
          x + dx * radius - 1,
          y + dy * radius - 1,
          effect.kind === 'erosion' ? 3 : 2,
          2,
        );
      }
    }
  }
  ctx.restore();
}

/** Sparse equipment lives inside accepted wall cells. No floor fog, shadows or
 * mobile-only gameplay information. Reduced effects holds a quiet static state. */
export function drawClassicWorldEquipment(
  ctx,
  run,
  world,
  { unit = 28, palette, timeMs = 0, reduced = false } = {},
) {
  drawClassicWorldVictory(ctx, run, world, { unit, palette, timeMs, reduced });
  if (!world.ambient) return;
  const removed = new Set((run.removedWalls ?? []).map((p) => `${p.x},${p.y}`));
  const candidates = run.level.walls.filter((p) => !removed.has(`${p.x},${p.y}`));
  const [fx, fy] = world.focus ?? [12, 9];
  candidates.sort(
    (a, b) => (a.x - fx) ** 2 + (a.y - fy) ** 2 - ((b.x - fx) ** 2 + (b.y - fy) ** 2),
  );
  // One installation is a focal point; do not cover the board in blinking lights.
  const at = candidates[0];
  if (!at) return;
  const phase = reduced ? 0 : timeMs / 1100;
  ctx.save();
  ctx.translate(at.x * unit, at.y * unit);
  ctx.scale(unit / 28, unit / 28);
  ctx.beginPath();
  ctx.rect(0, 0, 28, 28);
  ctx.clip();
  ctx.fillStyle = '#213335';
  ctx.fillRect(7, 7, 14, 14);
  ctx.strokeStyle = run.status === 'won' ? palette.safe : palette.accent;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1;
  if (world.ambient === 'fan' || world.ambient === 'water') {
    ctx.save();
    ctx.translate(14, 14);
    ctx.rotate(phase);
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(1, -1, 5, 2);
      ctx.rotate(Math.PI / 2);
    }
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  } else if (world.ambient === 'windsock') {
    ctx.fillRect(10, 8, 1, 12);
    ctx.beginPath();
    ctx.moveTo(11, 8);
    ctx.lineTo(19, 10 + Math.sin(phase));
    ctx.lineTo(11, 13);
    ctx.closePath();
    ctx.fill();
  } else if (world.ambient === 'leaves') {
    ctx.fillStyle = '#91ae68';
    ctx.fillRect(12, 9, 3, 10);
    ctx.fillRect(8, 11, 4, 3);
    ctx.fillRect(15, 12 + Math.round(Math.sin(phase)), 4, 3);
  } else {
    ctx.fillRect(9, 10, 3, 7);
    ctx.fillRect(16, 10, 3, 7);
  }
  if (run.status === 'won') {
    ctx.strokeRect(5, 5, 18, 18);
  }
  ctx.restore();
}

/** World acknowledgement is flat light/inlay, even on obstacle-free lessons.
 * It appears only after victory, never supplies a hazard or gameplay reward. */
export function drawClassicWorldVictory(
  ctx,
  run,
  world,
  { unit = 28, palette, timeMs = 0, reduced = false } = {},
) {
  if (run.status !== 'won') return;
  const [fx, fy] = world.focus ?? [run.level.width / 2, run.level.height / 2];
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return;
  const phase = reduced ? 0 : Math.floor(timeMs / 220) % 4;
  const ink =
    {
      orchard: '#d4dda0',
      freight: '#edbc85',
      workshop: '#efbd83',
      harbor: '#a5dccd',
      relay: '#c9dced',
      quarry: '#c1d2a0',
    }[world.scene] ?? palette.safe;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, run.level.width * unit, run.level.height * unit);
  ctx.clip();
  ctx.translate((fx + 0.5) * unit, (fy + 0.5) * unit);
  ctx.scale(unit, unit);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.055;
  ctx.globalAlpha = 0.4;
  if (world.scene === 'orchard') {
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = reduced || i <= phase ? 0.4 : 0.18;
      ctx.fillRect(-1.6 + i, -0.14, 0.28, 0.28);
    }
    ctx.beginPath();
    ctx.moveTo(-1.8, 0.5);
    ctx.lineTo(1.8, 0.5);
    ctx.stroke();
  } else if (world.scene === 'freight') {
    for (let i = 0; i < 3; i++) {
      const x = -1.3 + i;
      ctx.beginPath();
      ctx.moveTo(x, -0.5);
      ctx.lineTo(x + 0.5, 0);
      ctx.lineTo(x, 0.5);
      ctx.stroke();
    }
    ctx.fillRect(-1.5 + phase * 0.8, -0.08, 0.3, 0.16);
  } else if (world.scene === 'workshop') {
    ctx.beginPath();
    ctx.arc(0, 0, 0.8, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0.52, -0.42);
    ctx.stroke();
    for (const x of [-1.4, 1.2]) ctx.fillRect(x, -0.4, 0.2, 0.8);
  } else if (world.scene === 'harbor') {
    for (let y = -0.6; y <= 0.6; y += 0.6) {
      ctx.beginPath();
      ctx.moveTo(-1.5, y);
      ctx.bezierCurveTo(-0.5, y - 0.25, 0.5, y + 0.25, 1.5, y);
      ctx.stroke();
    }
    ctx.fillRect(-1.7, -0.7, 0.12, 1.4);
    ctx.fillRect(1.6, -0.7, 0.12, 1.4);
  } else if (world.scene === 'relay') {
    for (const radius of [0.5, 0.85, 1.2]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillRect(-0.06, -0.1, 0.12, 0.8);
    ctx.fillRect(-0.4, 0.7, 0.8, 0.1);
  } else {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-1.4 + i * 0.35, 0.8 - i * 0.35);
      ctx.lineTo(1.4, 0.8 - i * 0.35);
      ctx.lineTo(1.4, -0.8);
      ctx.stroke();
    }
  }
  ctx.restore();
}
