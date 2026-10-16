import { BoardPainter, playerPaintSize } from '../../../game/ui/render.mjs';
import { createRun } from '../../../game/core/index.mjs';
import { createCoop } from '../../../game/coop/core.mjs';
import { FIRST_CONNECTION } from '../../../game/coop/first-connection.mjs';
import { createCoopPainter } from '../../../game/couch/coop-view.mjs';
import {
  createAnimationState,
  advanceAnimation,
} from '../../../authoring/motion-lab/animation.mjs';
import { preparedRotorRecipe } from '../../../game/ui/rotor-presentation.mjs';

export const ROSTER_SIZES = Object.freeze([20, 24, 32]);
const directions = ['up', 'right', 'down', 'left'],
  widths = { solo: [360, 472, 1152], team: [360, 480, 1280] };
export function rosterFixture(mode, heading, role) {
  const run =
    mode === 'solo'
      ? createRun({
          version: 'xonix-level.v4',
          id: 'roster-review',
          revision: '1',
          name: 'Roster review fixture',
          width: 72,
          height: 36,
          encounter: null,
          spawn: { x: 36.5, y: 0.5 },
          goal: { coverage: 0.99 },
          classic: { version: 'classic.v1', terrain: [], powerups: [] },
          enemies: [],
          rules: { moveSpeed: 12, lives: 3, stopOnCapture: true },
        })
      : createCoop(FIRST_CONNECTION);
  run.status = 'running';
  run.time = 0;
  run.tick = 0;
  run.events = [];
  run.enemies = [];
  run.cells.fill(0);
  if (mode === 'solo') {
    run.activeClassId = role;
    Object.assign(run.player, {
      x: 36,
      y: 18,
      direction: directions[heading],
      speed: 0,
      graceUntil: 0,
    });
  } else {
    run.strongholds = [];
    run.supportEffects = [];
    for (const player of run.players)
      Object.assign(player, {
        x: 36 + player.id * 12,
        y: 18,
        direction: directions[heading],
        graceUntil: 0,
        cutting: false,
        trail: [],
        status: 'active',
      });
  }
  return run;
}

/** Complete production painter paths over synthetic read-only checkpoints.
 * Native 64px crops are copied 1:1, never resized to manufacture target sizes. */
export function createRosterRenderer({
  presets,
  theme,
  frames,
  makeCanvas = () => document.createElement('canvas'),
}) {
  const canvas = makeCanvas(),
    context = canvas.getContext('2d', { willReadFrequently: true }),
    solid = makeCanvas(),
    painter = new BoardPainter(presets),
    set = presets.characterPresentations.sets.find((s) => s.themeId === 'fpv');
  solid.width = 2;
  solid.height = 1;
  let team = null,
    disposed = false,
    activeImage = null,
    painted = 0;
  const observed = new Proxy(context, {
    get(target, key) {
      const value = target[key];
      if (typeof value !== 'function') return value;
      return (...args) => {
        if (key === 'drawImage' && args[0] === activeImage) painted++;
        return value.apply(target, args);
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  painter.theme = theme;
  painter.background = solid;
  return {
    render({
      role,
      treatment,
      mode,
      sizeIndex,
      heading,
      reduced = false,
      light = false,
      frameIndex = 0,
    }) {
      if (disposed) throw new Error('Roster renderer is disposed.');
      const sprite = frames.get(`player.${role}.${treatment}`);
      if (
        !sprite ||
        !widths[mode] ||
        !ROSTER_SIZES[sizeIndex] ||
        !directions[heading] ||
        !Number.isInteger(frameIndex) ||
        frameIndex < 0 ||
        frameIndex > 2
      )
        throw new Error('Invalid roster render selection.');
      const run = rosterFixture(mode, heading, role),
        before = JSON.stringify(run),
        width = widths[mode][sizeIndex];
      canvas.width = width;
      canvas.height = width / 2;
      const background = light ? '#dcc99b' : '#07111c',
        cell = width / 72;
      activeImage = sprite.image;
      painted = 0;
      let diameter,
        used = 0;
      const snapshot = {
        // Candidate-only adapter; no resolved theme, release pin or approval.
        image(slot) {
          if (
            slot ===
            `player.${mode === 'solo' ? role : 'scout'}.${width < 480 ? 'compact' : 'detailed'}`
          ) {
            used++;
            return sprite;
          }
          return null;
        },
        canvas: { palette: { ...theme.palette, field: background }, motionScale: 1 },
        fonts: { ui: '"Field Kit UI", sans-serif', numeric: '"Field Kit Mono", monospace' },
      };
      if (mode === 'solo') {
        painter.bodyId = set.classBodies[role];
        painter.body = presets.characters[painter.bodyId];
        painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
        painter.setLevel(run.level, { seed: 1 });
        painter.background = solid;
        painter.theme = { ...theme, coverColor: background };
        painter.animation = createAnimationState();
        for (let i = 0; i < frameIndex; i++)
          painter.animation = advanceAnimation(
            painter.animation,
            preparedRotorRecipe(painter.recipe, sprite.geometry),
            { visualSpeed: 0, cruiseSpeed: 12 },
            1 / 60,
            { reducedMotion: reduced },
          );
        painter.heading = (heading * Math.PI) / 2;
        painter.bank = 0;
        painter.speedRatio = 0;
        painter.style = sizeIndex === 1 ? 'props' : 'hybrid';
        const playerScale = sizeIndex === 1 ? (24 * 72 * 16) / (width * 34 * 1.15) : 1;
        diameter =
          (playerPaintSize(painter.body, sprite.image, {
            screenScale: width / 1152,
            canvasCSSWidth: width,
            style: painter.style,
            scale: playerScale,
            geometry: sprite.geometry,
          }).diameter *
            width) /
          1152;
        observed.save();
        observed.scale(cell / 16, cell / 16);
        painter.draw(observed, run, 0, {
          paused: true,
          reduced,
          displayCSSWidth: width,
          playerScale,
          actorAppearance: { style: 'fpv', snapshot },
          backdrop: { image: solid, fit: 'contain' },
        });
        observed.restore();
      } else {
        team?.setPresentation(null);
        team = createCoopPainter({
          width: canvas.width,
          height: canvas.height,
          clientWidth: width,
          getContext: () => observed,
        });
        team.setPresentation(snapshot);
        team.paint(run, { reduced });
        for (let i = 0; i < frameIndex; i++) {
          run.tick++;
          run.time += 1 / 60;
          const checkpoint = JSON.stringify(run);
          team.paint(run, { reduced });
          if (checkpoint !== JSON.stringify(run))
            throw new Error('Team painter mutated its synthetic checkpoint.');
        }
        diameter = (team.actorFrame('pilot', 0).diameter * cell) / 16;
        run.tick = 0;
        run.time = 0;
      }
      if (!used || !painted || Math.abs(diameter - ROSTER_SIZES[sizeIndex]) > 1e-7)
        throw new Error('Exact candidate or actual occupied-size target was not rendered.');
      if (JSON.stringify(run) !== before)
        throw new Error('Painter mutated its synthetic checkpoint.');
      const crop = makeCanvas();
      crop.width = 64;
      crop.height = 64;
      crop.getContext('2d').drawImage(canvas, 32 - width / 2, 32 - canvas.height / 2);
      return {
        canvas: crop,
        diameter,
        used,
        painted,
        mode,
        role,
        treatment,
        heading,
        reduced,
        light,
        actorFrame: mode === 'team' ? team.actorFrame('pilot', 0) : null,
      };
    },
    dispose() {
      disposed = true;
      team?.setPresentation(null);
      painter.loadToken++;
      painter.enemyBodies.clear();
      canvas.width = 0;
      solid.width = 0;
      painter.background = null;
    },
  };
}
