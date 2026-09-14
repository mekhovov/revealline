const COLORS = ['#ffda77', '#8be0ed'];

/** Draw the authoritative board once. Rendering never advances game state. */
export function createCoopPainter(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Relay Rescue needs a browser with Canvas 2D support.');
  function paint(run, { reduced = false } = {}) {
    const unit = canvas.width / run.width;
    ctx.save();
    ctx.scale(unit, unit);
    ctx.fillStyle = '#0a202b';
    ctx.fillRect(0, 0, run.width, run.height);
    for (let y = 0; y < run.height; y++) {
      for (let x = 0; x < run.width; x++) {
        const cell = run.cells[y * run.width + x];
        if (cell === 2) {
          ctx.fillStyle = '#4b6269';
          ctx.fillRect(x, y, 1, 1);
        } else if (cell === 1) {
          // Revealed land reads as a continuous orchard, independent of captor.
          const row = Math.floor(y / 5),
            col = Math.floor(x / 6);
          ctx.fillStyle = (row + col) % 2 ? '#315744' : '#385f4a';
          ctx.fillRect(x, y, 1.01, 1.01);
          if (x === 0 || y === 0 || x === run.width - 1 || y === run.height - 1) {
            ctx.fillStyle = '#66816b';
            ctx.fillRect(x + 0.1, y + 0.1, 0.8, 0.8);
          } else if (x % 6 === 3 && y % 5 === 2) {
            ctx.fillStyle = '#93b37d';
            ctx.beginPath();
            ctx.arc(x + 0.5, y + 0.5, 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = '#23414b';
          ctx.fillRect(x + 0.46, y + 0.46, 0.08, 0.08);
        }
      }
    }
    // Launch markers are anchored landmarks, not compulsory meeting pads.
    for (const effect of run.supportEffects || []) {
      ctx.fillStyle = COLORS[effect.player];
      ctx.globalAlpha = reduced ? 0.06 : 0.1;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = COLORS[effect.player];
      ctx.lineWidth = 0.08;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const stronghold of run.strongholds || []) {
      for (const [i, anchor] of stronghold.anchors.entries()) {
        ctx.strokeStyle = anchor.captured ? '#c9e4a0' : '#ffd279';
        ctx.fillStyle = anchor.captured ? '#315744' : '#604b30';
        ctx.lineWidth = 0.1;
        ctx.fillRect(anchor.x - 0.7, anchor.y - 0.7, 1.4, 1.4);
        ctx.strokeRect(anchor.x - 0.7, anchor.y - 0.7, 1.4, 1.4);
        ctx.fillStyle = '#fff1c8';
        ctx.font = 'bold 0.85px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(anchor.captured ? '✓' : String.fromCharCode(65 + i), anchor.x, anchor.y);
      }
      const core = stronghold.core;
      ctx.fillStyle = stronghold.defeated ? '#a0c887' : '#ffc1a4';
      ctx.strokeStyle = stronghold.shielded ? '#f1b860' : '#f48885';
      ctx.lineWidth = stronghold.shielded ? 0.2 : 0.08;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = core.x + Math.cos(angle) * 1.2,
          y = core.y + Math.sin(angle) * 1.2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(core.x, core.y, 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 0.64px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        stronghold.defeated ? 'SECURED' : stronghold.shielded ? 'SHIELDED' : 'CAPTURE CORE',
        core.x,
        core.y - 1.75,
      );
      const emitter = stronghold.emitter;
      if (emitter?.phase === 'warning' && Number.isInteger(emitter.cellIndex)) {
        const x = (emitter.cellIndex % run.width) + 0.5,
          y = Math.floor(emitter.cellIndex / run.width) + 0.5;
        ctx.strokeStyle = '#ffd279';
        ctx.lineWidth = 0.12;
        ctx.setLineDash([0.35, 0.3]);
        ctx.beginPath();
        ctx.moveTo(core.x, core.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }
    }
    for (const enemy of run.enemies) {
      if (
        enemy.active === false ||
        enemy.type !== 'hunter' ||
        enemy.phase !== 'warning' ||
        !enemy.targetPoint
      )
        continue;
      ctx.strokeStyle = '#ffd279';
      ctx.lineWidth = 0.1;
      ctx.setLineDash([0.25, 0.35]);
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      ctx.lineTo(enemy.targetPoint.x, enemy.targetPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(enemy.targetPoint.x, enemy.targetPoint.y, 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd279';
      ctx.font = 'bold 0.65px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('HUNTER LOCKED', enemy.x, enemy.y - 1.1);
    }
    for (const [i, spawn] of run.level.spawns.entries()) {
      ctx.strokeStyle = COLORS[i];
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(spawn.x, spawn.y, 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const player of run.players) {
      ctx.strokeStyle = COLORS[player.id];
      ctx.fillStyle = COLORS[player.id];
      ctx.lineJoin = 'round';
      ctx.lineWidth = 0.28;
      if (player.trail.length) {
        ctx.globalAlpha = 0.28;
        for (const cell of player.trail) ctx.fillRect(cell.x, cell.y, 1, 1);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        const anchor = player.safeAnchor;
        ctx.moveTo(anchor.x, anchor.y);
        for (const cell of player.trail) ctx.lineTo(cell.x + 0.5, cell.y + 0.5);
        ctx.lineTo(player.x, player.y);
        ctx.stroke();
      }
      const downed = player.status === 'downed';
      ctx.save();
      ctx.translate(player.x, player.y);
      if (!downed && player.graceUntil > run.time) {
        ctx.strokeStyle = '#e6ffcf';
        ctx.lineWidth = 0.12;
        ctx.setLineDash([0.2, 0.18]);
        ctx.beginPath();
        ctx.arc(0, 0, 0.95, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = COLORS[player.id];
      }
      if (!reduced && player.cutting && !downed) {
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(0, 0, 0.85 + Math.sin(run.time * 5) * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#172c34';
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      if (player.id === 0) ctx.arc(0, 0, 0.58, 0, Math.PI * 2);
      else {
        ctx.moveTo(0, -0.72);
        ctx.lineTo(0.67, 0);
        ctx.lineTo(0, 0.72);
        ctx.lineTo(-0.67, 0);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS[player.id];
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 0.66px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelX =
        Math.max(0.5, Math.min(run.width - 0.5, player.x + (player.id === 0 ? -0.8 : 0.8))) -
        player.x;
      const labelY = player.y < 2 ? 1.1 : -1.1;
      ctx.fillText(downed ? '+' : String(player.id + 1), labelX, labelY);
      ctx.restore();
    }
    for (const enemy of run.enemies) {
      if (enemy.active === false) continue;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.fillStyle =
        enemy.phase === 'warning'
          ? '#ffd279'
          : enemy.type === 'hunter' && enemy.phase !== 'commit'
            ? '#849fa4'
            : '#fc786f';
      ctx.strokeStyle = '#ffc0a1';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      if (enemy.type === 'hunter') {
        ctx.moveTo(0, -0.65);
        ctx.lineTo(0.55, 0);
        ctx.lineTo(0, 0.65);
        ctx.lineTo(-0.55, 0);
      } else {
        ctx.moveTo(0, -0.6);
        ctx.lineTo(0.58, 0.42);
        ctx.lineTo(-0.58, 0.42);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#521f2a';
      ctx.fillRect(-0.1, -0.1, 0.2, 0.2);
      if (enemy.type === 'hunter' && enemy.phase !== 'warning') {
        ctx.fillStyle = '#eee7c8';
        ctx.font = 'bold 0.57px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(
          enemy.phase === 'commit' ? 'CHARGE' : enemy.phase === 'recovery' ? 'RECOVER' : 'HUNTER',
          0,
          -1.05,
        );
      }
      ctx.restore();
    }
    for (const impact of run.impacts || []) {
      const x = Number.isFinite(impact.x) ? impact.x : (impact.cellIndex % run.width) + 0.5;
      const y = Number.isFinite(impact.y)
        ? impact.y
        : Math.floor(impact.cellIndex / run.width) + 0.5;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      ctx.fillStyle = '#fff0bc';
      ctx.strokeStyle = '#fc786f';
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.arc(x, y, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  return { paint };
}
