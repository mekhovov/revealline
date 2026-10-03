import { drawHumanoidPixelBody, drawHuntRemains } from '../hunt/destruction.mjs';

const UNIT = 28;
const INKS = [
  { body: '#276644', head: '#194b30', edge: '#102a1c', band: '#9fc95f' },
  { body: '#30517c', head: '#243b60', edge: '#152b48', band: '#cbd6ec' },
];

export function classicCatchMarks(run) {
  return run.recentCatches.map((mark) => ({
    ...mark,
    kind: 'runner',
    cause: 'ram',
    x: mark.x + 0.5,
    y: mark.y + 0.5,
  }));
}

export function drawClassicTarget(ctx, x, y, size, pose = 0) {
  ctx.save();
  ctx.fillStyle = '#fff0b6';
  ctx.fillRect(x + size * 0.02, y + size * 0.02, size * 0.96, size * 0.96);
  ctx.strokeStyle = '#7c4d16';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeRect(x + size * 0.04, y + size * 0.04, size * 0.92, size * 0.92);
  ctx.translate(x + size * 0.07, y + size * 0.04);
  ctx.scale((size * 0.88) / 16, (size * 0.88) / 16);
  drawHumanoidPixelBody(ctx, { kind: 'runner', pose }, { accent: '#e3a247' });
  ctx.restore();
}

export function drawClassicBoard(
  canvas,
  run,
  { effects, brutal = false, blood = true, showRemains = true } = {},
) {
  const { width, height, walls, wrap } = run.level;
  if (canvas.width !== width * UNIT || canvas.height !== height * UNIT) {
    canvas.width = width * UNIT;
    canvas.height = height * UNIT;
    canvas.style.aspectRatio = `${width} / ${height}`;
  }
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#c3cda8' : '#c9d3b1';
      ctx.fillRect(x * UNIT, y * UNIT, UNIT, UNIT);
    }
  }
  ctx.strokeStyle = '#74846144';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = 1; x < width; x++) {
    ctx.moveTo(x * UNIT, 0);
    ctx.lineTo(x * UNIT, canvas.height);
  }
  for (let y = 1; y < height; y++) {
    ctx.moveTo(0, y * UNIT);
    ctx.lineTo(canvas.width, y * UNIT);
  }
  ctx.stroke();
  // Cosmetic remains are under every target, wall and body. Replayed catches
  // restore only settled marks; the effect owner primes old bursts as seen.
  if (showRemains) {
    ctx.save();
    ctx.scale(UNIT / 16, UNIT / 16);
    for (const mark of classicCatchMarks(run)) drawHuntRemains(ctx, mark, { brutal, blood });
    ctx.restore();
  }
  if (effects) {
    ctx.save();
    ctx.scale(UNIT / 16, UNIT / 16);
    effects.draw(ctx);
    ctx.restore();
  }
  for (const wall of walls) {
    const x = wall.x * UNIT,
      y = wall.y * UNIT;
    ctx.fillStyle = '#3e4b43';
    ctx.fillRect(x, y, UNIT, UNIT);
    ctx.fillStyle = '#6d7a67';
    ctx.fillRect(x + 2, y + 2, UNIT - 4, 5);
    ctx.strokeStyle = '#23392c';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = wrap ? '#d89838' : '#253c2c';
  ctx.setLineDash(wrap ? [7, 7] : []);
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  ctx.setLineDash([]);
  if (run.target)
    drawClassicTarget(ctx, run.target.x * UNIT, run.target.y * UNIT, UNIT, run.tick % 3);
  for (const snake of run.snakes) {
    const ink = INKS[snake.id];
    // Adjacent links have full-cell collision and a connected visual body.
    for (let i = snake.body.length - 1; i >= 0; i--) {
      const cell = snake.body[i],
        x = cell.x * UNIT,
        y = cell.y * UNIT;
      ctx.fillStyle = ink.edge;
      ctx.fillRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
      ctx.fillStyle = i ? ink.body : ink.head;
      ctx.fillRect(x + 3, y + 3, UNIT - 6, UNIT - 6);
      const previous = snake.body[i - 1];
      if (previous && Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y) === 1) {
        ctx.fillStyle = ink.body;
        if (previous.x !== cell.x)
          ctx.fillRect(Math.min(cell.x, previous.x) * UNIT + UNIT / 2, y + 6, UNIT, UNIT - 12);
        else ctx.fillRect(x + 6, Math.min(cell.y, previous.y) * UNIT + UNIT / 2, UNIT - 12, UNIT);
      }
      if (i) {
        ctx.fillStyle = ink.band;
        if (snake.id) {
          ctx.fillRect(x + 8, y + 8, 4, 4);
          ctx.fillRect(x + 16, y + 16, 4, 4);
        } else ctx.fillRect(x + 7, y + 7, 4, 4);
      }
    }
    const head = snake.body[0],
      x = head.x * UNIT,
      y = head.y * UNIT;
    const eyePositions = {
      up: [
        [8, 7],
        [19, 7],
      ],
      down: [
        [8, 20],
        [19, 20],
      ],
      left: [
        [7, 8],
        [7, 19],
      ],
      right: [
        [20, 8],
        [20, 19],
      ],
    }[snake.direction];
    for (const [ex, ey] of eyePositions) {
      ctx.fillStyle = '#f6f6d9';
      ctx.fillRect(x + ex - 3, y + ey - 3, 6, 6);
      ctx.fillStyle = '#14271b';
      ctx.fillRect(x + ex - 1, y + ey - 1, 3, 3);
    }
    if (!snake.alive) {
      ctx.strokeStyle = '#b33036';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
    }
  }
}
