import { operationActivationsMet } from './classic-routing-v5.mjs';
/** Read-only objective projection used by live boards, previews and compact replay. */
export function classicOperationMarkers(run) {
  const recipe = run.level.operation,
    state = run.operation;
  if (!recipe || !state) return [];
  const stage = recipe.stages[state.stage];
  if (!stage) return [];
  const delivered = (id) => state.parcels.some((p) => p.id === id && p.state === 'delivered');
  const ready =
    run.catches >= stage.catches &&
    stage.deliveries.every(delivered) &&
    operationActivationsMet(run, stage);
  const dockLabel = (id) => String.fromCharCode(65 + recipe.docks.findIndex((d) => d.id === id));
  const markers = [];
  for (const parcel of recipe.parcels) {
    if (!stage.deliveries.includes(parcel.id)) continue;
    const progress = state.parcels.find((p) => p.id === parcel.id);
    if (progress.state === 'waiting')
      markers.push({ kind: 'parcel', ...parcel.at, label: dockLabel(parcel.dockId) });
    if (progress.state === 'carried') {
      const snake = run.snakes.find((s) => s.id === progress.carrier);
      const index = state.parcels
        .filter((p) => p.state === 'carried' && p.carrier === progress.carrier)
        .findIndex((p) => p.id === parcel.id);
      const at = snake.body[Math.max(1, snake.body.length - 1 - index)];
      markers.push({ kind: 'attached', ...at, label: dockLabel(parcel.dockId) });
    }
  }
  for (const dock of recipe.docks) {
    const parcels = recipe.parcels.filter(
      (p) => p.dockId === dock.id && stage.deliveries.includes(p.id),
    );
    if (parcels.length)
      markers.push({
        kind: 'dock',
        ...dock.at,
        label: dockLabel(dock.id),
        ready: parcels.every((p) => delivered(p.id)),
      });
  }
  for (const group of recipe.switchyards ?? []) {
    const progress = state.switchyards.find((s) => s.id === group.id);
    for (const at of group.switches)
      markers.push({
        kind: 'switch',
        ...at,
        label: String(progress.selection + 1),
        ready: progress.selection === 1,
      });
    markers.push({
      kind: 'junction',
      ...group.routes[0][0],
      label: String(progress.selection + 1),
      ready: true,
    });
  }
  for (const group of recipe.plates ?? []) {
    const progress = state.plates.find((s) => s.id === group.id);
    for (const at of group.pads)
      markers.push({
        kind: 'plate',
        ...at,
        label: progress.held ? '=' : '≡',
        ready: progress.held,
      });
  }
  if (stage.exit) markers.push({ kind: 'exit', ...stage.exit, label: ready ? '→' : '·', ready });
  return markers;
}

export function drawClassicOperation(ctx, run, { unit = 28, palette } = {}) {
  for (const marker of classicOperationMarkers(run)) {
    const x = marker.x * unit,
      y = marker.y * unit;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(unit / 28, unit / 28);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff1c5';
    if (marker.kind === 'parcel' || marker.kind === 'attached') {
      const size = marker.kind === 'attached' ? 14 : 20,
        inset = (28 - size) / 2;
      // Timber parcel, copper straps and a destination letter: no colour-only matching.
      ctx.fillStyle = '#52351e';
      ctx.fillRect(inset, inset, size, size);
      ctx.strokeRect(inset, inset, size, size);
      ctx.fillStyle = '#d49c53';
      ctx.fillRect(inset + 2, inset + 2, size - 4, 3);
      ctx.fillStyle = '#fff1c5';
      ctx.font = `bold ${marker.kind === 'attached' ? 12 : 18}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.label, 14, 16);
    } else {
      ctx.strokeStyle = marker.ready ? palette.safe : palette.accent;
      ctx.setLineDash(marker.kind === 'exit' && !marker.ready ? [3, 3] : []);
      if (['dock', 'junction'].includes(marker.kind)) {
        ctx.beginPath();
        ctx.moveTo(14, 1);
        ctx.lineTo(27, 14);
        ctx.lineTo(14, 27);
        ctx.lineTo(1, 14);
        ctx.closePath();
        ctx.stroke();
      } else if (marker.kind === 'plate') {
        ctx.strokeRect(1, 5, 26, 18);
        for (let x = 4; x < 25; x += 6) {
          ctx.beginPath();
          ctx.moveTo(x, 6);
          ctx.lineTo(x - 2, 10);
          ctx.stroke();
        }
      } else if (marker.kind === 'switch') {
        ctx.strokeRect(3, 3, 22, 22);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(marker.ready ? 17 : 5, 1, 6, 6);
      } else ctx.strokeRect(2, 2, 24, 24);
      // Open floor remains visible through dock brackets and extraction pads.
      ctx.fillStyle = '#101d27';
      ctx.fillRect(7, 7, 14, 14);
      ctx.fillStyle = marker.ready ? '#c1f7cf' : '#ffe3a6';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.kind === 'dock' && marker.ready ? '✓' : marker.label, 14, 14);
    }
    ctx.restore();
  }
}

export function drawClassicOperationLinks(ctx, run, { unit = 28, palette } = {}) {
  if (!run.level.operation) return;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = palette.accent;
  ctx.setLineDash([3, 5]);
  const line = (a, b) => {
    ctx.beginPath();
    ctx.moveTo((a.x + 0.5) * unit, (a.y + 0.5) * unit);
    ctx.lineTo((b.x + 0.5) * unit, (a.y + 0.5) * unit);
    ctx.lineTo((b.x + 0.5) * unit, (b.y + 0.5) * unit);
    ctx.stroke();
  };
  for (const group of run.level.operation.switchyards ?? []) {
    for (const at of group.switches) line(at, group.routes[0][0]);
    const state = run.operation.switchyards.find((s) => s.id === group.id);
    ctx.setLineDash([]);
    ctx.beginPath();
    group.routes[state.selection].forEach((p, i) => {
      if (i) ctx.lineTo((p.x + 0.5) * unit, (p.y + 0.5) * unit);
      else ctx.moveTo((p.x + 0.5) * unit, (p.y + 0.5) * unit);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([3, 5]);
  }
  for (const group of run.level.operation.plates ?? [])
    for (const at of group.pads) line(at, group.gates[0]);
  ctx.restore();
}
