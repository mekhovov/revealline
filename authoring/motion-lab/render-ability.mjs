import { abilityReadout } from './ability.mjs';
import { createAbilityLabelPainter, describeAbilityLabels } from './ability-labels.mjs';
const TAU = Math.PI * 2;
const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
};
const label = createAbilityLabelPainter();

export function paintAbilityStage(
  ctx,
  state,
  config,
  player,
  {
    colors,
    pixels,
    family,
    reducedMotion = false,
    labelFont = '"Field Kit UI", "Field Kit Mono", sans-serif',
    labelPixels = 14,
  },
) {
  const readout = abilityReadout(state, config, player);
  const labels = new Map(
    describeAbilityLabels(state, config, family).map((item) => [item.key, item]),
  );
  const labelStyle = { family: labelFont, minimum: labelPixels };
  ctx.save();
  ctx.lineWidth = Math.max(0.035, 1 / pixels);
  for (const [index, area] of config.stage.haze.entries()) {
    ctx.fillStyle = colors.slow;
    ctx.globalAlpha = 0.075;
    ctx.fillRect(area.x, area.y, area.width, area.height);
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = colors.slow;
    ctx.setLineDash([0.3, 0.25]);
    ctx.strokeRect(area.x, area.y, area.width, area.height);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.75;
    label(ctx, labels.get(`haze:${index}`), pixels, colors.slow, labelStyle);
  }
  ctx.globalAlpha = 1;
  for (const pad of config.stage.supplyPads) {
    ctx.strokeStyle = colors.wall;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([0.2, 0.2]);
    circle(ctx, pad.x, pad.y, pad.radius);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(pad.x - 0.5, pad.y - 0.45, 1, 0.9);
    ctx.fillStyle = colors.wall;
    ctx.fillRect(pad.x - 0.28, pad.y - 0.09, 0.56, 0.18);
    ctx.fillRect(pad.x - 0.09, pad.y - 0.28, 0.18, 0.56);
    label(ctx, labels.get(`pad:${pad.id}`), pixels, colors.wall, labelStyle);
  }
  if (readout.equipment.budgetCapacity) {
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = state.budget > 0 ? colors.accent : colors.danger;
    ctx.setLineDash([0.16, 0.14]);
    ctx.beginPath();
    ctx.moveTo(state.tetherAnchor.x, state.tetherAnchor.y);
    ctx.lineTo(player.x, player.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  if (!reducedMotion)
    for (const point of state.wake) {
      ctx.globalAlpha = Math.max(0, (point.until - state.time) / point.duration) * 0.3;
      ctx.fillStyle = colors.accent;
      ctx.fillRect(point.x - 0.05, point.y - 0.05, 0.1, 0.1);
    }
  ctx.globalAlpha = 1;
  for (const target of state.targets) {
    const active = target.status === 'ready',
      revealed = target.revealedUntil > state.time;
    ctx.globalAlpha = active ? 1 : 0.36;
    ctx.strokeStyle = active ? (target.kind === 'air' ? colors.accent : colors.wall) : colors.slow;
    ctx.fillStyle = colors.arena;
    if (target.kind === 'delivery') {
      ctx.strokeRect(target.x - 0.65, target.y - 0.65, 1.3, 1.3);
      ctx.strokeRect(target.x - 0.32, target.y - 0.32, 0.64, 0.64);
    } else if (target.kind === 'relay') {
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 0.65);
      ctx.lineTo(target.x + 0.5, target.y);
      ctx.lineTo(target.x, target.y + 0.65);
      ctx.lineTo(target.x - 0.5, target.y);
      ctx.closePath();
      ctx.stroke();
    } else {
      circle(ctx, target.x, target.y, target.kind === 'note' ? 0.36 : 0.43);
      ctx.fill();
      ctx.stroke();
    }
    if (!active) {
      ctx.beginPath();
      ctx.moveTo(target.x - 0.18, target.y);
      ctx.lineTo(target.x - 0.02, target.y + 0.14);
      ctx.lineTo(target.x + 0.22, target.y - 0.18);
      ctx.stroke();
    }
    if (target.netProgress > 0 && active) {
      ctx.strokeStyle = colors.slow;
      circle(ctx, target.x, target.y, 0.64);
      ctx.stroke();
    }
    label(
      ctx,
      labels.get(`target:${target.id}`),
      pixels,
      revealed ? colors.accent : colors.body,
      labelStyle,
    );
  }
  ctx.globalAlpha = 1;
  for (const field of state.fields) {
    ctx.save();
    circle(ctx, field.x, field.y, field.radius);
    ctx.clip();
    ctx.strokeStyle = colors.slow;
    ctx.globalAlpha = 0.35;
    for (let x = field.x - field.radius; x <= field.x + field.radius; x += 0.4) {
      ctx.beginPath();
      ctx.moveTo(x, field.y - field.radius);
      ctx.lineTo(x, field.y + field.radius);
      ctx.stroke();
    }
    for (let y = field.y - field.radius; y <= field.y + field.radius; y += 0.4) {
      ctx.beginPath();
      ctx.moveTo(field.x - field.radius, y);
      ctx.lineTo(field.x + field.radius, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = colors.slow;
    circle(ctx, field.x, field.y, field.radius);
    ctx.stroke();
  }
  for (const effect of state.effects) {
    ctx.globalAlpha = reducedMotion ? 0.5 : Math.min(0.8, Math.max(0.1, effect.until - state.time));
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = Math.max(0.06, 1.5 / pixels);
    if (effect.type === 'dash') {
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.toX, effect.toY);
      ctx.stroke();
    } else {
      circle(ctx, effect.x, effect.y, effect.radius);
      ctx.stroke();
      if (effect.type === 'drop') {
        ctx.strokeRect(effect.x - 0.22, effect.y - 0.22, 0.44, 0.44);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.accent;
  for (const dot of state.projectiles) {
    const size = Math.max(0.2, 2 / pixels);
    ctx.fillRect(dot.x - size / 2, dot.y - size / 2, size, size);
  }
  ctx.restore();
}
