import { fittedBodySize, paintCharacter } from '../../motion-lab/render-character.mjs';
import { actorDiameter } from '../../../game/ui/actor-presentation.mjs';

const CELL = 16;
// Exact pure sizing function from game/ui/render.mjs at the pinned base.
function playerPaintSize(body, image, { screenScale, canvasCSSWidth, style, scale }) {
  const s = Math.max(0.1, Math.min(4, screenScale)),
    fitted = fittedBodySize(body, image),
    // Keep the contained source rectangle and all attachment anchors intact.
    // The current drone art includes transparent margins: a 24/16 CSS-pixel
    // image box gives its visible silhouette roughly 18/12 pixels of span.
    extent = image
      ? Math.max(fitted.width, fitted.height)
      : Math.max(fitted.width * 0.54, fitted.height * 0.66),
    minimum = canvasCSSWidth >= 480 ? 24 : 16,
    desired = actorDiameter({ screenScale: s, canvasCSSWidth, style, scale }) * 1.15,
    diameter = Math.max(18, Math.min(64, 32 / s, Math.max(minimum / s, desired)));
  return { diameter, scale: diameter / (extent * CELL) };
}

/** Code rendering only. It neither edits source art nor enters a game/session. */
export function paintRole(
  ctx,
  role,
  image,
  animation,
  {
    x = 0,
    y = 0,
    arenaWidth = 294,
    heading = 0,
    bank = 0,
    speedRatio = 1,
    reducedMotion = false,
    showRotors = true,
    guides = false,
    inspectionPixels = null,
  } = {},
) {
  const screenScale = arenaWidth / 1152;
  const size = playerPaintSize(role.body, image, {
    screenScale,
    canvasCSSWidth: arenaWidth,
    style: 'hybrid',
    scale: 1,
  });
  const factor = inspectionPixels === null ? screenScale : inspectionPixels / size.diameter;
  const diameterCSS = size.diameter * factor;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(CELL * factor, CELL * factor);
  paintCharacter(ctx, {
    body: role.body,
    image,
    recipe: role.recipe,
    animation,
    colors: { body: '#c5dde2', accent: '#f3c94f' },
    scale: size.scale,
    heading,
    bank,
    speedRatio,
    reducedMotion,
    showRotors,
    pixel: 1 / CELL,
  });
  ctx.restore();
  if (guides) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.strokeStyle = '#fe5faa';
    ctx.lineWidth = 1;
    ctx.strokeRect(-diameterCSS / 2, -diameterCSS / 2, diameterCSS, diameterCSS);
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 5);
    ctx.stroke();
    // Guides intentionally omit bank: inspect hub alignment in the north, unbanked pose.
    for (const anchor of role.body.rotors) {
      ctx.strokeStyle = '#00cda8';
      ctx.beginPath();
      ctx.arc(
        anchor.x * diameterCSS,
        anchor.y * diameterCSS,
        Math.max(2, diameterCSS * 0.015),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }
  return {
    imageBoxCSS: diameterCSS,
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
  };
}
