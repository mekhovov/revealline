// Surface accents only. The immutable body, contact cues and simulation stay unchanged.
export function drawEnemyBodyMotion(ctx, frame, record, diameter) {
  if (!record || frame.reduced || !Number.isFinite(diameter) || diameter <= 0) return;
  for (const part of record.motion) {
    const phase = part.kind === 'travel-glint' ? frame.travelPhase : frame.phase;
    if (!Number.isFinite(phase)) continue;
    // Locked frames retain their existing phase; no independent clock advances here.
    const unit = (((phase * part.rate) % 1) + 1) % 1;
    const width = part.width * diameter;
    const height = part.height * diameter;
    const x = (part.x - 0.5) * diameter;
    const y = (part.y - 0.5) * diameter;
    ctx.save();
    ctx.fillStyle = part.color;
    ctx.globalAlpha *= 0.55;
    if (part.kind === 'travel-glint') {
      const mark = Math.min(height, Math.max(1, height * 0.2));
      ctx.fillRect(x - width / 2, y - height / 2 + unit * (height - mark), width, mark);
    } else {
      const mark = Math.min(width, Math.max(1, width * 0.12));
      ctx.fillRect(x - width / 2 + unit * (width - mark), y - height / 2, mark, height);
    }
    ctx.restore();
  }
}
