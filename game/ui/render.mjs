import { drawEncounterLane, drawEncounterCore } from './encounter-view.mjs';
import { createAnimationState, advanceAnimation } from '../../authoring/motion-lab/animation.mjs';
import { paintCharacter } from '../../authoring/motion-lab/render-character.mjs';
import { createSceneArt } from './scene-art.mjs';
import {
  createCelebration,
  advanceCelebration,
  skipCelebration,
  celebrationFrame,
  drawCelebration,
} from './celebration.mjs';

// Simulation uses cells. Everything below is presentation and never mutates a run.
const CELL = 16,
  W = 768,
  H = 576,
  TAU = Math.PI * 2;
const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const poly = (c, points, color) => {
  c.fillStyle = color;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
};
const colorMix = (a, b, t) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const imageLoad = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Artwork could not be loaded.'));
    image.src = src;
  });

export class BoardPainter {
  constructor(presets, { onAsset = () => {} } = {}) {
    this.presets = presets;
    this.onAsset = onAsset;
    this.animation = createAnimationState();
    this.heading = 0;
    this.time = 0;
    this.effects = [];
    this.loadToken = 0;
    this.overrides = {};
    this.images = {};
    this.style = 'hybrid';
    this.levelInfo = {};
    this.artSeed = 0;
    this.celebration = null;
    this._winState = null;
    this._celebrationPrepared = false;
  }
  async setLook(theme, bodyId, overrides = {}) {
    const token = ++this.loadToken;
    this.theme = theme;
    this.bodyId = bodyId;
    this.overrides = overrides;
    this.images = {};
    this.background = this.makeArt(theme);
    this.animation = createAnimationState();
    const knownBody = Object.hasOwn(this.presets.characters, bodyId)
        ? this.presets.characters[bodyId]
        : null,
      body =
        knownBody ||
        this.presets.characters['neutral-marker'] ||
        this.presets.characters['fpv-body'];
    this.body = body;
    this.recipe = this.presets.animationRecipes[body.animationRecipe];
    this.image = null;
    const jobs = [
      [
        'player',
        overrides.player?.dataUrl ||
          (body.src
            ? new URL(`../../authoring/motion-lab/${body.src}`, import.meta.url).href
            : null),
      ],
      ...Object.entries(overrides)
        .filter(([role]) => role !== 'player')
        .map(([role, v]) => [role, v.dataUrl]),
    ];
    const settled = await Promise.allSettled(
      jobs.filter(([, src]) => src).map(async ([role, src]) => [role, await imageLoad(src)]),
    );
    if (token !== this.loadToken) return;
    for (const item of settled)
      if (item.status === 'fulfilled') {
        const [role, img] = item.value;
        this.images[role] = img;
        if (role === 'player') this.image = img;
      }
    this.onAsset(
      [
        !knownBody ? 'The requested body is not registered; a neutral fallback rig is shown.' : '',
        settled.some((x) => x.status === 'rejected')
          ? 'Some artwork is unavailable; a clear fallback is shown.'
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  makeArt(theme, level = this.levelInfo, seed = this.artSeed) {
    return createSceneArt(theme, level, seed, () => makeCanvas(384, 288));
  }
  setLevel(level = {}, { seed = 0 } = {}) {
    this.levelInfo = { id: level.id || 'gallery', revision: level.revision || '1' };
    this.artSeed = seed;
    if (this.theme) this.background = this.makeArt(this.theme);
    this.celebration = null;
    this._winState = null;
    this._celebrationPrepared = false;
    this.effects = [];
    this.heading = 0;
    this.bank = 0;
    this.speedRatio = 0;
    this.time = 0;
  }
  startCelebration({
    levelId = this.levelInfo.id || '',
    seed = this.artSeed,
    reduced = false,
  } = {}) {
    this.celebration = createCelebration({ theme: this.theme, levelId, seed, reduced });
    this._celebrationPrepared = true;
    return this.celebrationStatus;
  }
  skipCelebration() {
    this.celebration = skipCelebration(this.celebration);
    return this.celebrationStatus;
  }
  get celebrationStatus() {
    const { particles, equipment, ...status } = celebrationFrame(this.celebration);
    return status;
  }
  drawGallery(
    ctx,
    {
      theme = this.theme,
      level = this.levelInfo,
      seed = this.artSeed,
      width = ctx.canvas?.width || 768,
      height = ctx.canvas?.height || 576,
      image = null,
      fit = 'cover',
    } = {},
  ) {
    if (!theme) return;
    const source = image || this.makeArt(theme, level, seed);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.palette.field;
    ctx.fillRect(0, 0, width, height);
    const ratio =
      fit === 'contain'
        ? Math.min(width / source.width, height / source.height)
        : Math.max(width / source.width, height / source.height);
    ctx.drawImage(
      source,
      (width - source.width * ratio) / 2,
      (height - source.height * ratio) / 2,
      source.width * ratio,
      source.height * ratio,
    );
    ctx.restore();
  }
  effectsFor(events = []) {
    for (const e of events) {
      if (
        e.type === 'cut.closed' ||
        e.type === 'cells.claimed' ||
        e.type === 'player.failed' ||
        e.type === 'run.completed' ||
        e.type === 'craft.redeployed'
      )
        this.effects.push({ type: e.type, age: 0, x: e.x, y: e.y, radius: e.radius });
    }
    this.effects = this.effects.slice(-8);
  }
  draw(
    ctx,
    state,
    dt,
    {
      paused = false,
      reduced = false,
      showGrid = false,
      debug = false,
      fullReveal = false,
      celebrationPaused = false,
    } = {},
  ) {
    if (!this.theme || !state) return;
    if (fullReveal && state.status === 'won') {
      if (this._winState !== state) {
        if (!this._celebrationPrepared)
          this.startCelebration({ levelId: state.levelId, seed: state.seed, reduced });
        this._winState = state;
        this._celebrationPrepared = false;
      }
      this.celebration = advanceCelebration(this.celebration, dt, {
        paused: celebrationPaused,
        reduced,
      });
    } else if (!fullReveal) {
      this._winState = null;
      this.celebration = null;
    }
    const finale = fullReveal ? celebrationFrame(this.celebration) : null;
    const revealAlpha = fullReveal ? 1 - finale.reveal : 1;
    const p = this.theme.palette,
      t = state.time;
    this.time += paused ? 0 : dt;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const backdrop = this.images.background || this.background;
    const fit = this.overrides.background?.fit || 'cover';
    ctx.fillStyle = p.field;
    ctx.fillRect(0, 0, W, H);
    if (fit === 'contain') {
      const r = Math.min(W / backdrop.width, H / backdrop.height);
      ctx.drawImage(
        backdrop,
        (W - backdrop.width * r) / 2,
        (H - backdrop.height * r) / 2,
        backdrop.width * r,
        backdrop.height * r,
      );
    } else {
      const r = Math.max(W / backdrop.width, H / backdrop.height);
      ctx.drawImage(
        backdrop,
        (W - backdrop.width * r) / 2,
        (H - backdrop.height * r) / 2,
        backdrop.width * r,
        backdrop.height * r,
      );
    }
    if (!fullReveal || revealAlpha > 0) {
      ctx.fillStyle = p.field;
      ctx.globalAlpha = 0.94 * revealAlpha;
      // Horizontal runs keep the reveal mask cheap and deterministic.
      for (let y = 0; y < 36; y++) {
        let start = -1;
        for (let x = 0; x <= 48; x++) {
          const covered = x < 48 && state.cells[y * 48 + x] === 0;
          if (covered && start < 0) start = x;
          if (!covered && start >= 0) {
            ctx.fillRect(start * CELL, y * CELL, (x - start) * CELL, CELL);
            start = -1;
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    for (let y = 0; y < 36; y++)
      for (let x = 0; x < 48; x++) {
        const v = state.cells[y * 48 + x],
          xx = x * CELL,
          yy = y * CELL;
        if (v === 2 && (!fullReveal || revealAlpha > 0)) {
          ctx.save();
          ctx.globalAlpha = revealAlpha;
          ctx.fillStyle = colorMix(p.muted, p.ink, 0.5);
          ctx.fillRect(xx, yy, CELL, CELL);
          if (this.images.wall) ctx.drawImage(this.images.wall, xx, yy, CELL, CELL);
          else if (this.style === 'microtile') {
            ctx.fillStyle = p.muted;
            ctx.fillRect(xx + 2, yy + 2, 4, 4);
            ctx.fillRect(xx + 10, yy + 10, 4, 4);
          } else if (this.style === 'hybrid') {
            ctx.fillStyle = p.muted;
            ctx.fillRect(xx + 2, yy + 2, 12, 2);
            ctx.fillStyle = p.ink;
            ctx.fillRect(xx + 3, yy + 9, 10, 3);
          }
          ctx.restore();
        }
        if (v === 1 && !fullReveal) {
          ctx.strokeStyle = p.safe;
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (y > 0 && state.cells[(y - 1) * 48 + x] === 0) {
            ctx.moveTo(xx, yy);
            ctx.lineTo(xx + CELL, yy);
          }
          if (y < 35 && state.cells[(y + 1) * 48 + x] === 0) {
            ctx.moveTo(xx, yy + CELL);
            ctx.lineTo(xx + CELL, yy + CELL);
          }
          if (x > 0 && state.cells[y * 48 + x - 1] === 0) {
            ctx.moveTo(xx, yy);
            ctx.lineTo(xx, yy + CELL);
          }
          if (x < 47 && state.cells[y * 48 + x + 1] === 0) {
            ctx.moveTo(xx + CELL, yy);
            ctx.lineTo(xx + CELL, yy + CELL);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    if (this.style === 'props' && !fullReveal && !this.images.wall)
      for (const w of state.level.walls || []) {
        const x = w.x * CELL,
          y = w.y * CELL,
          ww = w.w * CELL,
          hh = w.h * CELL;
        ctx.fillStyle = p.muted;
        ctx.fillRect(x + 2, y + 2, ww - 4, Math.min(5, hh - 4));
        ctx.fillStyle = p.ink;
        ctx.fillRect(x + 3, y + hh - 5, ww - 6, 3);
        ctx.strokeStyle = p.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, ww - 2, hh - 2);
        for (let sx = x + 7; sx < x + ww - 4; sx += 24) {
          ctx.fillStyle = p.accent;
          ctx.fillRect(sx, y + hh / 2 - 1, 4, 2);
        }
      }
    if (showGrid && !fullReveal) {
      ctx.strokeStyle = p.grid;
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += CELL) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += CELL) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }
    if (!fullReveal) {
      for (const zone of state.signalZones || []) {
        const suppressed = zone.suppressedUntil > t,
          xx = zone.x * CELL,
          yy = zone.y * CELL,
          ww = zone.w * CELL,
          hh = zone.h * CELL;
        ctx.save();
        ctx.fillStyle = suppressed ? p.safe : p.danger;
        ctx.globalAlpha = suppressed ? 0.025 : 0.08;
        ctx.fillRect(xx, yy, ww, hh);
        ctx.globalAlpha = suppressed ? 0.35 : 0.7;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.setLineDash(suppressed ? [3, 5] : [6, 3]);
        ctx.strokeRect(xx + 0.5, yy + 0.5, ww - 1, hh - 1);
        ctx.setLineDash([]);
        const cx = xx + ww / 2,
          cy = yy + hh / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, TAU);
        ctx.stroke();
        ctx.fillRect(cx - 1, cy - 9, 2, 12);
        ctx.fillRect(cx - 4, cy + 6, 8, 2);
        ctx.restore();
      }
      for (const hangar of state.hangars || []) {
        const x = hangar.x * CELL,
          y = hangar.y * CELL,
          r = (hangar.radius || 2) * CELL;
        ctx.save();
        ctx.strokeStyle = p.safe;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = p.safe;
        ctx.fillRect(x - 7, y - 7, 3, 14);
        ctx.fillRect(x + 4, y - 7, 3, 14);
        ctx.fillRect(x - 4, y - 1, 8, 2);
        ctx.restore();
      }
      for (const e of state.enemies) {
        if (
          e.type === 'lane-boss' &&
          e.bossPhase &&
          e.bossPhase !== 'idle' &&
          e.bossPhase !== 'recovery'
        ) {
          ctx.save();
          ctx.fillStyle = p.danger;
          ctx.globalAlpha =
            e.bossPhase === 'active' ? 0.35 : 0.1 + (reduced ? 0 : Math.sin(t * 8) * 0.03);
          if (e.axis === 'horizontal')
            ctx.fillRect(
              16,
              (e.lane ?? e.y) * CELL - (e.laneWidth || 1) * 8,
              W - 32,
              (e.laneWidth || 1) * 16,
            );
          else
            ctx.fillRect(
              (e.lane ?? e.x) * CELL - (e.laneWidth || 1) * 8,
              16,
              (e.laneWidth || 1) * 16,
              H - 32,
            );
          ctx.restore();
        }
      }
      drawEncounterLane(ctx, state, p);
      for (const pad of state.supplies) {
        if (this.images.supply)
          ctx.drawImage(this.images.supply, pad.x * CELL - 8, pad.y * CELL - 8, 16, 16);
        else {
          ctx.strokeStyle = p.safe;
          ctx.lineWidth = 1;
          ctx.strokeRect(pad.x * CELL - 7, pad.y * CELL - 7, 14, 14);
          ctx.fillStyle = p.safe;
          ctx.fillRect(pad.x * CELL - 3, pad.y * CELL - 1, 6, 2);
          ctx.fillRect(pad.x * CELL - 1, pad.y * CELL - 3, 2, 6);
        }
      }
      for (const o of state.objectives) {
        if (o.captured || (o.hidden && !o.revealed)) continue;
        const x = o.x * CELL,
          y = o.y * CELL;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.restore();
        if (this.images.objective) ctx.drawImage(this.images.objective, x - 8, y - 8, 16, 16);
        else {
          ctx.fillStyle = p.accent;
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
        if (!reduced) {
          ctx.strokeStyle = p.accent;
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(x, y, 12 + Math.sin(t * 3) * 3, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      for (const f of state.ability.fields || []) {
        ctx.fillStyle = p.safe;
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(f.x * CELL, f.y * CELL, (f.radius || 3) * CELL, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = p.safe;
        ctx.stroke();
        if (f.kind === 'impact-pulse' && !reduced) {
          const phase = Math.max(
            0,
            Math.min(1, 1 - (f.until - t) / (state.classRecipe?.duration || 1)),
          );
          ctx.beginPath();
          ctx.arc(f.x * CELL, f.y * CELL, (f.radius || 3) * CELL * phase, 0, TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // Staged-core artwork and brackets sit behind the live cut. Its occupied cell
      // gets a compact marker in the ordinary actor pass afterward.
      for (const e of state.enemies) {
        if (e.type !== 'relay-sentinel' || state.encounter?.defeated) continue;
        const stunned = (e.stunnedUntil || 0) > t;
        ctx.globalAlpha = stunned ? 0.4 : 1;
        this.drawActor(
          ctx,
          this.theme.bossShape || 'core',
          e.x * CELL,
          e.y * CELL,
          32,
          stunned ? p.muted : p.danger,
          this.images.boss,
          t,
          reduced,
        );
        ctx.globalAlpha = 1;
        drawEncounterCore(ctx, state, e, p, reduced);
      }
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.lineCap = 'square';
      ctx.beginPath();
      for (const s of state.trailSegments) {
        ctx.moveTo(s.x1 * CELL, s.y1 * CELL);
        ctx.lineTo(s.x2 * CELL, s.y2 * CELL);
      }
      ctx.stroke();
      for (const point of state.trail) {
        ctx.fillStyle = p.accent;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(Math.floor(point.x) * CELL, Math.floor(point.y) * CELL, CELL, CELL);
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 0.7;
        ctx.strokeRect(
          Math.floor(point.x) * CELL + 0.5,
          Math.floor(point.y) * CELL + 0.5,
          CELL - 1,
          CELL - 1,
        );
        ctx.globalAlpha = 1;
      }
      for (const e of state.enemies) {
        if (e.type === 'relay-sentinel') {
          if (!state.encounter?.defeated) {
            ctx.strokeStyle = p.danger;
            ctx.lineWidth = 2;
            ctx.strokeRect(
              Math.floor(e.x) * CELL + 1,
              Math.floor(e.y) * CELL + 1,
              CELL - 2,
              CELL - 2,
            );
            ctx.fillStyle = p.danger;
            ctx.fillRect(e.x * CELL - 2, e.y * CELL - 2, 4, 4);
          }
          continue;
        }
        const role =
          e.type === 'lane-boss' ? 'boss' : e.type === 'border-patrol' ? 'patrol' : 'enemy';
        const stunned = (e.stunnedUntil || 0) > t,
          slowed = (e.slowUntil || 0) > t;
        ctx.globalAlpha = stunned ? 0.4 : 1;
        const size = role === 'boss' ? 32 : 20;
        this.drawActor(
          ctx,
          this.theme[`${role}Shape`] || 'orb',
          e.x * CELL,
          e.y * CELL,
          size,
          stunned ? p.muted : p.danger,
          this.images[role],
          t,
          reduced,
        );
        ctx.globalAlpha = 1;
        if ((state.ability.scanUntil || 0) > t && e.type === 'bouncer' && !stunned) {
          ctx.strokeStyle = p.accent;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.moveTo(e.x * CELL, e.y * CELL);
          const length = Math.hypot(e.vx, e.vy) || 1;
          ctx.lineTo(
            Math.max(17, Math.min(W - 17, e.x * CELL + (e.vx / length) * 12)),
            Math.max(17, Math.min(H - 17, e.y * CELL + (e.vy / length) * 12)),
          );
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (slowed) {
          ctx.strokeStyle = p.safe;
          ctx.strokeRect(e.x * CELL - 13, e.y * CELL - 13, 26, 26);
        }
      }
      const facing =
        { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[state.player.direction] ??
        this.heading;
      let delta = ((facing - this.heading + Math.PI * 3) % TAU) - Math.PI;
      if (!paused) {
        this.heading += reduced ? delta : Math.sign(delta) * Math.min(Math.abs(delta), dt * 7);
        this.bank = reduced ? 0 : Math.max(-0.16, Math.min(0.16, delta * 0.12));
        this.speedRatio = (state.player.speed || 0) / state.rules.moveSpeed;
      }
      this.animation = advanceAnimation(
        this.animation,
        this.recipe,
        { visualSpeed: state.player.speed || 0, cruiseSpeed: state.rules.moveSpeed },
        dt,
        { paused, reducedMotion: reduced },
      );
      ctx.save();
      ctx.scale(CELL, CELL);
      if (state.status === 'respawning')
        ctx.globalAlpha = reduced ? 0.6 : 0.35 + 0.35 * Math.sin(this.time * 15);
      paintCharacter(ctx, {
        body: this.body,
        image: this.image,
        recipe: this.recipe,
        animation: this.animation,
        colors: { body: p.safe, accent: p.accent },
        scale: 1,
        x: state.player.x,
        y: state.player.y,
        heading: this.heading,
        bank: reduced ? 0 : this.bank || 0,
        speedRatio: this.speedRatio || 0,
        reducedMotion: reduced,
        pixel: 1 / CELL,
      });
      ctx.restore();
      if ((state.ability.shieldUntil || 0) > t || state.player.graceUntil > t) {
        ctx.strokeStyle = p.safe;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(state.player.x * CELL, state.player.y * CELL, 17, 0, TAU);
        ctx.stroke();
      }
      if (debug) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(state.player.x * CELL, state.player.y * CELL, 2.9, 0, TAU);
        ctx.stroke();
      }
      if (state.player.queuedDirection) {
        ctx.fillStyle = p.accent;
        ctx.font = '12px monospace';
        ctx.fillText(
          { up: '↑', right: '→', down: '↓', left: '←' }[state.player.queuedDirection],
          state.player.x * CELL + 13,
          state.player.y * CELL - 12,
        );
      }
    }
    for (const f of this.effects) {
      if (!paused || fullReveal) f.age += dt;
      if (!fullReveal && !reduced && f.type === 'craft.redeployed' && f.age < 0.6) {
        ctx.save();
        ctx.strokeStyle = p.accent;
        ctx.globalAlpha = (1 - f.age / 0.6) * 0.6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          (f.x || 0) * CELL,
          (f.y || 0) * CELL,
          (f.radius || 2) * CELL * Math.min(1, f.age / 0.35),
          0,
          TAU,
        );
        ctx.stroke();
        ctx.restore();
      }
      if (!fullReveal && !reduced && f.type !== 'craft.redeployed' && f.age < 0.6) {
        ctx.strokeStyle = f.type === 'player.failed' ? p.danger : p.accent;
        ctx.globalAlpha = (1 - f.age / 0.6) * 0.55;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, W - 4, H - 4);
        ctx.globalAlpha = 1;
      }
    }
    this.effects = this.effects.filter((f) => f.age < 0.7);
    if (fullReveal) drawCelebration(ctx, finale, p, W, H);
  }
  drawActor(c, shape, x, y, size, color, img, t, reduced) {
    if (img) {
      c.drawImage(img, x - size / 2, y - size / 2, size, size);
      return;
    }
    c.save();
    c.translate(x, y);
    const s = size / 20;
    c.scale(s, s);
    c.fillStyle = color;
    if (shape === 'tank') {
      c.fillRect(-8, -8, 4, 16);
      c.fillRect(4, -8, 4, 16);
      c.fillRect(-5, -6, 10, 12);
      c.fillStyle = this.theme.palette.ink;
      c.fillRect(-3, -3, 6, 6);
      c.fillStyle = color;
      c.fillRect(-1, -12, 2, 10);
    } else if (shape === 'radar') {
      c.fillRect(-9, 1, 18, 8);
      c.fillRect(-8, 9, 4, 3);
      c.fillRect(4, 9, 4, 3);
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, -4, 9, Math.PI, TAU);
      c.stroke();
      c.fillRect(-1, -8, 2, 10);
    } else if (shape === 'drone') {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-7, -7);
      c.lineTo(7, 7);
      c.moveTo(7, -7);
      c.lineTo(-7, 7);
      c.stroke();
      for (const dx of [-7, 7])
        for (const dy of [-7, 7]) {
          c.beginPath();
          c.arc(dx, dy, 3, 0, TAU);
          c.stroke();
        }
      c.fillRect(-3, -4, 6, 8);
    } else if (shape === 'moth') {
      poly(
        c,
        [
          [0, 0],
          [-10, -8],
          [-8, 4],
          [0, 7],
        ],
        color,
      );
      poly(
        c,
        [
          [0, 0],
          [10, -8],
          [8, 4],
          [0, 7],
        ],
        color,
      );
      c.fillStyle = this.theme.palette.ink;
      c.fillRect(-1, -6, 2, 14);
    } else {
      if (!reduced) c.rotate(t * (shape === 'core' ? 0.25 : 0.5));
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.strokeRect(-7, -7, 14, 14);
      c.fillRect(-3, -3, 6, 6);
      if (shape === 'flower' || shape === 'core') {
        c.rotate(Math.PI / 4);
        c.strokeRect(-8, -8, 16, 16);
      }
    }
    c.restore();
  }
}
