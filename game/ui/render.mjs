import { createAnimationState, advanceAnimation } from '../../authoring/motion-lab/animation.mjs';
import { paintCharacter } from '../../authoring/motion-lab/render-character.mjs';

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
  }
  async setLook(theme, bodyId, overrides = {}) {
    const token = ++this.loadToken;
    this.theme = theme;
    this.bodyId = bodyId;
    this.overrides = overrides;
    this.images = {};
    this.background = this.makeArt(theme);
    this.animation = createAnimationState();
    const knownBody = this.presets.characters[bodyId],
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
  makeArt(theme) {
    const c = makeCanvas(384, 288),
      x = c.getContext('2d'),
      p = theme.palette;
    for (let y = 0; y < 288; y += 4) {
      x.fillStyle = colorMix(p.sky, p.land, Math.min(1, y / 250));
      x.fillRect(0, y, 384, 4);
    }
    x.fillStyle = colorMix(p.accent, '#ffffff', 0.4);
    x.fillRect(266, 36, 40, 32);
    x.fillRect(258, 44, 56, 16);
    if (theme.scene === 'dawn' || theme.scene === 'heritage') {
      for (let band = 0; band < 3; band++) {
        const pts = [
          [0, 288],
          [0, 130 + band * 35],
        ];
        for (let col = 0; col <= 384; col += 16)
          pts.push([
            col,
            120 + band * 38 + Math.round((Math.sin(col * 0.021 + band * 2) * 22) / 4) * 4,
          ]);
        pts.push([384, 288]);
        poly(x, pts, colorMix(p.land, p.ink, 0.15 + band * 0.18));
      }
      poly(
        x,
        [
          [203, 146],
          [213, 146],
          [242, 178],
          [228, 200],
          [275, 236],
          [268, 288],
          [179, 288],
          [217, 233],
          [199, 200],
          [222, 178],
        ],
        colorMix(p.safe, p.ink, 0.15),
      );
      for (let i = 0; i < 12; i++) {
        const px = 18 + i * 31,
          py = 180 + (i % 3) * 22;
        x.fillStyle = colorMix(p.land, p.accent, 0.35);
        x.fillRect(px, py, 16, 11);
        poly(
          x,
          [
            [px - 3, py],
            [px + 8, py - 9],
            [px + 19, py],
          ],
          p.ink,
        );
        x.fillStyle = p.accent;
        x.fillRect(px + 6, py + 4, 4, 5);
      }
      for (let y = 242; y < 288; y += 12)
        for (let xx = 0; xx < 160; xx += 12) {
          x.fillStyle = (y + xx) % 24 === 0 ? p.accent : colorMix(p.land, p.accent, 0.4);
          x.fillRect(xx, y, 2, 5);
        }
      if (theme.scene === 'heritage')
        for (let y = 12; y < 288; y += 24)
          for (const xx of [12, 356]) {
            x.fillStyle = p.danger;
            x.fillRect(xx, y, 8, 8);
            x.fillStyle = p.accent;
            x.fillRect(xx - 4, y + 4, 4, 4);
            x.fillRect(xx + 8, y + 4, 4, 4);
          }
    } else {
      x.fillStyle = colorMix(p.ink, p.sky, 0.15);
      x.fillRect(0, 150, 384, 138);
      for (let i = 0; i < 18; i++) {
        const px = i * 23,
          h = 32 + ((i * 29) % 83);
        x.fillStyle = colorMix(p.ink, p.safe, 0.12 + (i % 3) * 0.07);
        x.fillRect(px, 160 - h, 18, h);
        x.fillStyle = i % 2 ? p.accent : p.safe;
        for (let a = px + 4; a < px + 17; a += 6)
          for (let b = 166 - h; b < 152; b += 9) x.fillRect(a, b, 2, 4);
      }
      x.strokeStyle = colorMix(p.safe, p.ink, 0.5);
      x.lineWidth = 1;
      for (let y = 178; y < 288; y += 13) {
        x.beginPath();
        x.moveTo(0, y);
        x.lineTo(384, y);
        x.stroke();
      }
      for (let xx = -300; xx < 700; xx += 50) {
        x.beginPath();
        x.moveTo(192, 160);
        x.lineTo(xx, 288);
        x.stroke();
      }
      for (let i = 0; i < 16; i++) {
        const xx = 28 + ((i * 67) % 330),
          yy = 193 + ((i * 37) % 73);
        x.fillStyle = i % 3 ? p.safe : p.accent;
        x.fillRect(xx, yy, 8, 3);
      }
    }
    return c;
  }
  effectsFor(events = []) {
    for (const e of events) {
      if (
        e.type === 'cut.closed' ||
        e.type === 'cells.claimed' ||
        e.type === 'player.failed' ||
        e.type === 'run.completed'
      )
        this.effects.push({ type: e.type, age: 0 });
    }
    this.effects = this.effects.slice(-8);
  }
  draw(
    ctx,
    state,
    dt,
    { paused = false, reduced = false, showGrid = false, debug = false, fullReveal = false } = {},
  ) {
    if (!this.theme || !state) return;
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
    if (!fullReveal) {
      ctx.fillStyle = p.field;
      ctx.globalAlpha = 0.94;
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
        if (v === 2 && !fullReveal) {
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
        ctx.globalAlpha = 1;
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
      if (!paused) f.age += dt;
      if (!reduced && f.age < 0.6) {
        ctx.strokeStyle = f.type === 'player.failed' ? p.danger : p.accent;
        ctx.globalAlpha = (1 - f.age / 0.6) * 0.55;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, W - 4, H - 4);
        ctx.globalAlpha = 1;
      }
    }
    this.effects = this.effects.filter((f) => f.age < 0.7);
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
