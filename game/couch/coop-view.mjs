import { canvasTextFonts } from '../text-face.mjs';
import { createCoopActorPresentation } from './coop-actor-presentation.mjs';
import { coopCueScale, placeCoopCue } from './coop-actor-layout.mjs';
import { drawCoopActiveTrail, drawCoopWall, prepareCoopWall } from './coop-terrain-trail.mjs';
import { paintMaterialMarker } from '../content-design/material-markers.mjs';

const THEME_FONTS = Object.freeze({
  ui: '"Field Kit UI", "Field Kit Mono", system-ui, sans-serif',
  numeric: '"Field Kit Mono", ui-monospace, monospace',
});
const COLORS = ['#ffda77', '#8be0ed'];

/** Draw the authoritative board once. Rendering never advances game state. */
export function createCoopPainter(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Relay Rescue needs a browser with Canvas 2D support.');
  const actors = createCoopActorPresentation();
  let presentation = null,
    look = null,
    wall = null;
  function setPresentation(snapshot) {
    let next = null;
    if (snapshot != null) {
      const palette = {};
      for (const key of [
        'ink',
        'paper',
        'muted',
        'accent',
        'safe',
        'danger',
        'field',
        'grid',
        'sky',
        'land',
      ]) {
        const value = snapshot.canvas?.palette?.[key];
        if (typeof value !== 'string' || !/^#[a-f0-9]{6}$/i.test(value))
          throw new TypeError('Team presentation needs a validated canvas palette.');
        palette[key] = value;
      }
      const motionScale = snapshot.canvas?.motionScale;
      if (!Number.isFinite(motionScale) || motionScale < 0 || motionScale > 1)
        throw new TypeError('Team presentation needs a bounded motion scale.');
      const fonts = {};
      for (const key of ['ui', 'numeric']) {
        const value = snapshot.fonts?.[key];
        if (typeof value !== 'string' || !value.length || value.length > 512)
          throw new TypeError('Team presentation needs its prepared font roles.');
        fonts[key] = value;
      }
      next = { palette, motionScale, fonts };
    }
    // Keep the page lease's exact snapshot identity while capturing its display
    // values. The painter never changes or disposes shared presentation assets.
    const nextWall = prepareCoopWall(snapshot);
    actors.setPresentation(snapshot ?? null);
    presentation = snapshot ?? null;
    look = next;
    wall = nextWall;
  }
  function paint(
    run,
    { reduced = false, textFace = 'pixel', picture = null, actorStyle = 'hybrid' } = {},
  ) {
    // This is a defensive arena guard, not full content-hash authority. The
    // picture lease verifies the pack/level hashes; the host owns attempt intent.
    if (picture !== null) {
      if (
        picture.snapshot !== presentation ||
        !presentation ||
        picture.choice?.levelId !== run.level.id ||
        picture.choice?.levelRevision !== run.level.revision ||
        picture.fit !== 'contain' ||
        picture.sampling !== 'nearest' ||
        run.width !== 72 ||
        run.height !== 36 ||
        !['image', 'procedural'].includes(picture.choice.kind) ||
        (picture.choice.kind === 'procedural' ? picture.image !== null : !picture.image)
      )
        throw new TypeError('Team picture does not match this prepared arena presentation.');
      if (
        picture.image &&
        ((picture.image.naturalWidth ?? picture.image.width) !== 1152 ||
          (picture.image.naturalHeight ?? picture.image.height) !== 576)
      )
        throw new TypeError('Team picture must retain its complete 1152×576 decoded frame.');
    }
    const fonts = canvasTextFonts(textFace, look?.fonts ?? THEME_FONTS);
    const palette = look?.palette;
    const colors = palette ? [palette.accent, palette.safe] : COLORS;
    const motionScale = reduced ? 0 : (look?.motionScale ?? 1);
    reduced ||= motionScale === 0;
    actors.update(run, {
      reduced,
      motionScale,
      canvasCSSWidth: canvas.clientWidth,
      style: actorStyle,
    });
    const unit = canvas.width / run.width;
    const cueScale = coopCueScale(canvas.clientWidth, run.width),
      cssCell = cueScale.cell,
      occupied = [],
      heads = run.players.map((player) => {
        const radius = player.radius * cssCell + 2;
        return {
          left: player.x * cssCell - radius,
          right: player.x * cssCell + radius,
          top: player.y * cssCell - radius,
          bottom: player.y * cssCell + radius,
        };
      });
    const place = (x, y, width, height) => {
      const rect = placeCoopCue({
        x: x * cssCell,
        y: y * cssCell,
        width,
        height,
        arenaWidth: cueScale.width,
        arenaHeight: run.height * cssCell,
        heads,
        occupied,
      });
      if (rect) occupied.push(rect);
      return rect;
    };
    ctx.save();
    try {
      ctx.scale(unit, unit);
      if (picture?.image) {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = palette?.field ?? '#0a202b';
      ctx.fillRect(0, 0, run.width, run.height);
      if (picture?.image) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(picture.image, 0, 0, 1152, 576, 0, 0, run.width, run.height);
        // The accepted original is the victory reward. Keep the actual captured
        // cells and score intact while retiring the live arena's concealment/cues.
        if (run.status === 'won') return;
      }
      for (let y = 0; y < run.height; y++) {
        for (let x = 0; x < run.width; x++) {
          const cell = run.cells[y * run.width + x];
          if (cell === 2) {
            ctx.fillStyle = palette?.muted ?? '#4b6269';
            ctx.fillRect(x, y, 1, 1);
            drawCoopWall(ctx, wall, x, y);
          } else if (cell === 1) {
            if (picture?.image) continue;
            // Revealed land reads as a continuous orchard, independent of captor.
            const row = Math.floor(y / 5),
              col = Math.floor(x / 6);
            ctx.fillStyle = palette?.land ?? ((row + col) % 2 ? '#315744' : '#385f4a');
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
            if (picture?.image) {
              // Required picture concealment is opaque black in every theme.
              ctx.fillStyle = '#000000';
              ctx.fillRect(x, y, 1, 1);
            }
            ctx.fillStyle = palette?.grid ?? '#23414b';
            ctx.fillRect(x + 0.46, y + 0.46, 0.08, 0.08);
            const material = run.terrain?.[y * run.width + x];
            if (material === 1 || material === 2) {
              ctx.save();
              ctx.scale(1 / 16, 1 / 16);
              paintMaterialMarker(ctx, material, x * 16, y * 16, 16);
              ctx.restore();
            }
          }
        }
      }
      // Launch markers are anchored landmarks, not compulsory meeting pads.
      for (const effect of run.supportEffects || []) {
        ctx.fillStyle = colors[effect.player];
        ctx.globalAlpha = reduced ? 0.06 : 0.1;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = colors[effect.player];
        ctx.lineWidth = 0.08;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Paint every cosmetic body before functional markers and labels. Larger
      // sprites must never cover another actor's warning or a stronghold anchor.
      const bodies = new Set();
      const body = (kind, id) => bodies.has(`${kind}:${id}`);
      for (const [kind, list] of [
        ['core', run.strongholds || []],
        ['pilot', run.players],
        ['enemy', run.enemies.filter((enemy) => enemy.active !== false)],
      ])
        for (const actor of list)
          if (actors.draw(ctx, kind, actor.id, palette)) bodies.add(`${kind}:${actor.id}`);
      const clearance = (kind, id, minimum) =>
        body(kind, id)
          ? Math.max(minimum, actors.frame(kind, id).diameter / 32 + 9 / cssCell)
          : minimum;
      function cue(text, x, y, size, font, backed = false, color = '#f1f7ed', minimum = 12) {
        ctx.save();
        size = cueScale.font(size, minimum, 18);
        ctx.font = `600 ${size}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const measured = ctx.measureText(text)?.width;
        const width =
          (Number.isFinite(measured) ? measured : size * text.length * 0.7) * cssCell + 6;
        const rect = place(x, y, width, size * cssCell * 1.4);
        if (rect) {
          if (backed) {
            ctx.fillStyle = '#07111c';
            ctx.fillRect(
              rect.left / cssCell,
              rect.top / cssCell,
              rect.width / cssCell,
              rect.height / cssCell,
            );
          }
          ctx.fillStyle = color;
          ctx.fillText(text, rect.x / cssCell, rect.y / cssCell);
        }
        ctx.restore();
      }
      function pilotBadge(player, pilotBody) {
        const frame = actors.frame('pilot', player.id),
          offset = frame?.bodyOffset,
          x = player.x + (offset?.x ?? 0) / 16,
          y = player.y + (offset?.y ?? 0) / 16,
          shape = player.id === 0 ? 20 : 24,
          downed = player.status === 'downed',
          width = shape + (downed ? 10 : 0),
          rect = place(
            x,
            y - (frame ? frame.diameter / 32 : 0.7) - (shape / 2 + 3) / cssCell,
            width,
            shape,
          );
        if (!rect) return;
        const cx = (rect.left + shape / 2) / cssCell,
          cy = rect.y / cssCell,
          radius = shape / 2 / cssCell;
        ctx.save();
        ctx.fillStyle = '#07111c';
        ctx.strokeStyle = colors[player.id];
        ctx.lineWidth = 1.5 / cssCell;
        if (!downed && player.graceUntil > run.time) ctx.setLineDash([2 / cssCell, 2 / cssCell]);
        ctx.beginPath();
        if (player.id === 0) ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        else {
          ctx.moveTo(cx, cy - radius);
          ctx.lineTo(cx + radius, cy);
          ctx.lineTo(cx, cy + radius);
          ctx.lineTo(cx - radius, cy);
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `600 ${cueScale.font(0.66, 14, 18)}px ${fonts.numeric}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f1f7ed';
        ctx.fillText(String(player.id + 1), cx, cy);
        if (downed) {
          ctx.fillStyle = '#07111c';
          ctx.fillRect(
            (rect.right - 10) / cssCell,
            (rect.y - 8) / cssCell,
            10 / cssCell,
            16 / cssCell,
          );
          ctx.fillStyle = '#f1f7ed';
          ctx.font = `600 ${12 / cssCell}px ${fonts.numeric}`;
          ctx.fillText('+', (rect.right - 5) / cssCell, cy);
        }
        if (pilotBody && offset && (offset.x !== 0 || offset.y !== 0)) {
          // Dashed cosmetic tether ends at the true cutting head; it is not a trail.
          ctx.strokeStyle = '#07111c';
          ctx.lineWidth = 3 / cssCell;
          ctx.beginPath();
          ctx.moveTo(player.x, player.y);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.strokeStyle = '#f1f7ed';
          ctx.lineWidth = 1 / cssCell;
          ctx.setLineDash([2 / cssCell, 2 / cssCell]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
        if (frame?.pilotState === 'rescuing' && Number.isInteger(frame.rescueTarget))
          cue(
            `RESCUE ${frame.rescueTarget + 1}`,
            x,
            (rect.bottom + 12) / cssCell,
            0.66,
            fonts.ui,
            true,
            '#f1f7ed',
            14,
          );
      }
      for (const stronghold of run.strongholds || []) {
        const coreBody = body('core', stronghold.id);
        const relayLabel =
          run.strongholds.length > 1 ? `${run.strongholds.indexOf(stronghold) + 1}` : '';
        for (const [i, anchor] of stronghold.anchors.entries()) {
          ctx.strokeStyle = anchor.captured ? '#c9e4a0' : '#ffd279';
          ctx.fillStyle = anchor.captured ? '#315744' : '#604b30';
          ctx.lineWidth = 0.1;
          ctx.fillRect(anchor.x - 0.7, anchor.y - 0.7, 1.4, 1.4);
          ctx.strokeRect(anchor.x - 0.7, anchor.y - 0.7, 1.4, 1.4);
          ctx.fillStyle = '#fff1c8';
          ctx.font = `600 0.85px ${fonts.ui}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          cue(
            anchor.captured ? '✓' : `${relayLabel}${String.fromCharCode(65 + i)}`,
            anchor.x,
            anchor.y,
            0.85,
            fonts.ui,
            true,
            '#fff1c8',
          );
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
        cue(
          `${relayLabel ? `${relayLabel} ` : ''}${stronghold.defeated ? 'SECURED' : stronghold.shielded ? 'SHIELD' : 'CAPTURE'}`,
          core.x,
          Math.max(0.6, core.y - clearance('core', stronghold.id, 1.75)),
          0.64,
          fonts.ui,
          coreBody,
          stronghold.defeated ? '#a0c887' : '#ffc1a4',
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
        ctx.font = `600 0.65px ${fonts.ui}`;
        ctx.textAlign = 'center';
        cue(
          `LOCK ${enemy.target + 1}`,
          enemy.x,
          Math.max(0.6, enemy.y - clearance('enemy', enemy.id, 1.1)),
          0.65,
          fonts.ui,
          body('enemy', enemy.id),
          '#ffd279',
        );
      }
      for (const [i, spawn] of run.level.spawns.entries()) {
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.arc(spawn.x, spawn.y, 0.9, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const player of run.players) {
        ctx.strokeStyle = colors[player.id];
        ctx.fillStyle = colors[player.id];
        ctx.lineJoin = 'round';
        ctx.lineWidth = 0.28;
        if (presentation) {
          drawCoopActiveTrail(ctx, player, colors[player.id], {
            time: run.time * motionScale,
            reduced,
            cssCell,
          });
        } else if (player.trail.length) {
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
        const downed = player.status === 'downed',
          pilotBody = body('pilot', player.id);
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
          ctx.strokeStyle = colors[player.id];
        }
        if (!reduced && player.cutting && !downed) {
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.arc(0, 0, 0.85 + Math.sin(run.time * 5 * motionScale) * 0.08, 0, Math.PI * 2);
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
        if (!pilotBody) ctx.fill();
        ctx.stroke();
        ctx.fillStyle = colors[player.id];
        ctx.beginPath();
        ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        pilotBadge(player, pilotBody);
      }
      for (const enemy of run.enemies) {
        if (enemy.active === false) continue;
        const enemyBody = body('enemy', enemy.id);
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        if (enemyBody) {
          // Shared body drawing includes a contact cue, but later body images
          // can cover it. Restore the actual footprint in this final overlay.
          ctx.strokeStyle = '#07111c';
          ctx.lineWidth = 3 / 16;
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = '#f1f7ed';
          ctx.lineWidth = 1 / 16;
          ctx.stroke();
          ctx.fillStyle = '#07111c';
          ctx.fillRect(-2 / 16, -2 / 16, 4 / 16, 4 / 16);
          ctx.fillStyle = '#f1f7ed';
          ctx.fillRect(-1 / 16, -1 / 16, 2 / 16, 2 / 16);
        }
        if (!enemyBody) {
          ctx.fillStyle =
            enemy.phase === 'warning' || enemy.rover?.mode === 'warning'
              ? '#ffd279'
              : (enemy.type === 'hunter' && enemy.phase !== 'commit') ||
                  (enemy.type === 'claimed-rover' && enemy.rover?.mode !== 'active')
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
          } else if (enemy.type === 'claimed-rover') {
            ctx.rect(-0.48, -0.4, 0.96, 0.8);
            ctx.fillRect(-0.65, -0.55, 0.2, 1.1);
            ctx.fillRect(0.45, -0.55, 0.2, 1.1);
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
        }
        if (enemy.type === 'hunter' && enemy.phase !== 'warning') {
          ctx.fillStyle = '#eee7c8';
          ctx.font = `600 0.57px ${fonts.ui}`;
          ctx.textAlign = 'center';
          ctx.restore();
          cue(
            enemy.phase === 'commit' ? 'CHARGE' : enemy.phase === 'recovery' ? 'RECOVER' : 'HUNTER',
            enemy.x,
            Math.max(0.6, enemy.y - clearance('enemy', enemy.id, 1.05)),
            0.57,
            fonts.ui,
            enemyBody,
            '#eee7c8',
          );
          ctx.save();
          ctx.translate(enemy.x, enemy.y);
        }
        if (enemy.type === 'claimed-rover') {
          ctx.restore();
          cue(
            enemy.rover?.mode === 'warning'
              ? 'WAKING'
              : enemy.rover?.mode === 'active'
                ? 'ROAMER'
                : 'DORMANT',
            enemy.x,
            Math.max(0.6, enemy.y - clearance('enemy', enemy.id, 1.05)),
            0.57,
            fonts.ui,
            enemyBody,
            '#f1f7ed',
          );
          ctx.save();
          ctx.translate(enemy.x, enemy.y);
        }
        // Authoritative active time keeps this cue visible through pause and reduced effects.
        if (enemy.speedScale < 1 && enemy.slowUntil > run.time) {
          ctx.strokeStyle = '#e6f8ff';
          ctx.lineWidth = 0.11;
          ctx.setLineDash([0.16, 0.12]);
          ctx.beginPath();
          ctx.arc(0, 0, 0.88, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#e6f8ff';
          ctx.font = `600 0.6px ${fonts.ui}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.restore();
          cue(
            'SLOWED',
            enemy.x,
            Math.min(run.height - 0.6, enemy.y + clearance('enemy', enemy.id, 1.25)),
            0.6,
            fonts.ui,
            enemyBody,
            '#e6f8ff',
          );
          ctx.save();
          ctx.translate(enemy.x, enemy.y);
        }
        ctx.restore();
      }
      for (const player of run.players) {
        ctx.fillStyle = colors[player.id];
        ctx.strokeStyle = '#07111c';
        ctx.lineWidth = 1 / cssCell;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
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
    } finally {
      ctx.restore();
    }
  }
  return {
    paint,
    setPresentation,
    get presentation() {
      return presentation;
    },
  };
}
