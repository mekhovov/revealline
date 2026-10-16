/** Shared cosmetic motion only. Damage and warning deadlines stay in simulation. */
export const OVERFLIGHT_MOTION_PROFILE = Object.freeze({
  id: 'overflight-field-kit-motion',
  revision: 1,
});
export function overflightEffectPose({ kind, age, life, reducedEffects = false }) {
  const progress = Math.max(0, Math.min(1, life > 0 ? age / life : 1));
  if (kind === 'arrival' || kind === 'warning')
    return { scale: 1, alpha: kind === 'arrival' ? 0.65 : 0.95 };
  if (kind === 'slow' || kind === 'slow-field')
    return { scale: 1, alpha: (1 - progress) * (reducedEffects ? 0.035 : 0.06) };
  if (kind === 'hostile-impact')
    return { scale: 0.6 + progress * 0.4, alpha: (1 - progress) * 0.8 };
  if (kind === 'chain') return { scale: 1, alpha: 1 - progress };
  return {
    scale: kind === 'bell' || reducedEffects ? 1 : 0.6 + progress * 0.4,
    alpha: (1 - progress) * (reducedEffects ? 0.2 : 0.38),
  };
}

/** Complete cosmetic composition, expressed in logical pixels around an
 * effect's origin. Studio and WebGL consume these same layers; no layer grants
 * a hit, changes a radius in simulation, or owns a warning deadline. */
export function overflightEffectLayers({
  kind,
  age = 0,
  life = 1,
  radius = 32,
  x = 0,
  y = 0,
  x2 = x,
  y2 = y,
  reducedEffects = false,
}) {
  const pose = overflightEffectPose({ kind, age, life, reducedEffects });
  const progress = Math.max(0, Math.min(1, life > 0 ? age / life : 1));
  const layers = [];
  const add = (frame, width, height, tint, alpha, priority = false, dx = 0, dy = 0, rotation = 0) =>
    layers.push({ frame, width, height, tint, alpha, priority, dx, dy, rotation });
  if (kind === 'arrival' || kind === 'warning') {
    add('ring', radius * 2, radius * 2, kind === 'arrival' ? 0xf4c765 : 0xf9a275, pose.alpha, true);
    if (kind === 'warning') add('pickup.overflight-warning', 16, 16, 0xffffff, 1, true);
    return layers;
  }
  const impact = ['drop', 'scatter', 'impact', 'side-burst'].includes(kind);
  const hostile = kind === 'hostile-impact';
  const tint = hostile ? 0xf9a275 : impact ? 0xffde97 : 0x9aebda;
  if (kind === 'chain') {
    const dx = x2 - x,
      dy = y2 - y;
    add(
      'line',
      Math.hypot(dx, dy),
      24,
      tint,
      pose.alpha,
      false,
      dx / 2,
      dy / 2,
      Math.atan2(dy, dx),
    );
  } else {
    const diameter = radius * 2 * pose.scale;
    add(
      kind === 'slow-field' || kind === 'slow' ? 'disc' : 'ring',
      diameter,
      diameter,
      tint,
      pose.alpha,
      hostile,
    );
    if (!reducedEffects && impact) {
      const size = Math.max(14, 34 * (1 - progress));
      add('pickup.overflight-impact', size, size, 0xffffff, 1 - progress);
    }
  }
  return layers;
}

/** The exact static 48-pixel templates used by both the once-baked GPU atlas
 * and Motion Lab. Returns false for frames owned by other source painters. */
export function paintOverflightEffectGeometry(ctx, frame, { size = 48, color = '#ffffff' } = {}) {
  if (!['ring', 'disc', 'line'].includes(frame)) return false;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (frame === 'line') ctx.fillRect(0, size / 2 - 1, size, 2);
  else {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    if (frame === 'disc') ctx.fill();
    else ctx.stroke();
  }
  ctx.restore();
  return true;
}
