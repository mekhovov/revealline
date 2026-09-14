import { paintCharacter } from '../../motion-lab/render-character.mjs';
import { playerPaintSize } from '../../../game/ui/render.mjs';
export { playerPaintSize } from '../../../game/ui/render.mjs';

const CELL = 16;
/** Uses the existing renderer and current compact size opt-in. This paints an
 * authoring specimen only; no run, input, collider, profile or ability is made.
 */
export function paintRole(
  ctx,
  role,
  image,
  animation,
  {
    x = 0,
    y = 0,
    arenaWidth = 294,
    boardWidth = 72,
    heading = 0,
    bank = 0,
    speedRatio = 1,
    reducedMotion = false,
    showWings = true,
    guides = false,
    inspectionPixels = null,
  } = {},
) {
  const screenScale = arenaWidth / (boardWidth * CELL);
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
    recipe: showWings ? role.recipe : { components: [] },
    animation,
    colors: { body: '#f3ecdf', accent: '#e5ba6c' },
    scale: size.scale,
    heading,
    bank,
    speedRatio,
    reducedMotion,
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
    // Unbanked source-coordinate guide; it is never a collision indicator.
    for (const [ax, ay] of role.recipe.components[0].anchors) {
      ctx.strokeStyle = '#00cda8';
      ctx.beginPath();
      ctx.arc(ax * diameterCSS, ay * diameterCSS, Math.max(2, diameterCSS * 0.015), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  return {
    imageBoxCSS: diameterCSS,
    sourceWidth: image?.naturalWidth ?? null,
    sourceHeight: image?.naturalHeight ?? null,
  };
}
