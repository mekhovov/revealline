import { geometryForLevel } from '../core/geometry.mjs';
import { boardPaintSizeForLevel } from '../ui/render.mjs';
import { createRun } from '../core/index.mjs';
import { drawClassicTerrain, drawClassicPickups, drawClassicEnemy } from '../ui/classic-view.mjs';
import { foundationCompatibleView as classicView } from '../ui/foundation-view.mjs';
import { drawRelayGates, relayView } from '../ui/relay-view.mjs';

export function paintEditorMap(canvas, current) {
  const { width, height } = boardPaintSizeForLevel(current.level);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const c = canvas.getContext('2d'),
    s = 16;
  const run = ['xonix-level.v4', 'xonix-level.v5', 'xonix-level.v6'].includes(current.level.version)
    ? createRun(current.level, { ...current.settings, classRecipes: current.classRecipes })
    : null;
  const classic = run ? classicView(run) : null;
  c.fillStyle = current.theme.palette.field;
  c.fillRect(0, 0, width, height);
  c.fillStyle = current.theme.palette.safe;
  c.fillRect(0, 0, width, s);
  c.fillRect(0, height - s, width, s);
  c.fillRect(0, 0, s, height);
  c.fillRect(width - s, 0, s, height);
  for (const foundation of current.level.foundations ?? [])
    c.fillRect(foundation.x * s, foundation.y * s, foundation.w * s, foundation.h * s);
  c.strokeStyle = current.theme.palette.grid;
  c.lineWidth = 0.6;
  for (let x = 0; x <= width; x += s) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, height);
    c.stroke();
  }
  for (let y = 0; y <= height; y += s) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(width, y);
    c.stroke();
  }
  for (const zone of current.level.signalZones ?? []) {
    c.fillStyle = '#a875ce35';
    c.fillRect(zone.x * s, zone.y * s, zone.w * s, zone.h * s);
    c.strokeStyle = '#bb86d7';
    c.lineWidth = 2;
    c.setLineDash([4, 4]);
    c.strokeRect(zone.x * s, zone.y * s, zone.w * s, zone.h * s);
    c.setLineDash([]);
  }
  const hangars = current.level.hangars ?? [{ ...current.level.spawn, radius: 2 }];
  for (const h of hangars) {
    c.strokeStyle = '#7cdfb0';
    c.lineWidth = 2;
    c.strokeRect(h.x * s - 7, h.y * s - 7, 14, 14);
    // A diamond frame keeps the hangar distinct from square objectives without
    // baking host text into the scaled map. It does not represent collision.
    c.beginPath();
    c.moveTo(h.x * s, h.y * s - 11);
    c.lineTo(h.x * s + 11, h.y * s);
    c.lineTo(h.x * s, h.y * s + 11);
    c.lineTo(h.x * s - 11, h.y * s);
    c.closePath();
    c.stroke();
  }
  c.fillStyle = '#849496';
  for (const w of current.level.walls) c.fillRect(w.x * s, w.y * s, w.w * s, w.h * s);
  for (const gate of current.level.relayGates?.gates ?? [])
    c.fillRect(gate.x * s, gate.y * s, gate.w * s, gate.h * s);
  if (run) drawRelayGates(c, relayView(run), current.theme.palette, s);
  drawClassicTerrain(c, classic, current.theme.palette);
  drawClassicPickups(c, classic, current.theme.palette);
  for (const e of current.level.enemies) {
    if (
      drawClassicEnemy(
        c,
        classic?.enemies.find((enemy) => enemy.id === e.id),
        current.theme.palette,
      )
    )
      continue;
    c.fillStyle = current.theme.palette.danger;
    c.beginPath();
    c.arc(e.x * s, e.y * s, e.type === 'lane-boss' ? 12 : 6, 0, Math.PI * 2);
    c.fill();
  }
  for (const o of current.level.objectives) {
    c.strokeStyle = current.theme.palette.accent;
    c.lineWidth = 2;
    c.strokeRect(o.x * s - 5, o.y * s - 5, 10, 10);
  }
  for (const p of current.level.supplies) {
    c.fillStyle = '#ffffff';
    c.fillRect(p.x * s - 3, p.y * s - 1, 6, 2);
    c.fillRect(p.x * s - 1, p.y * s - 3, 2, 6);
  }
  c.fillStyle = current.theme.palette.accent;
  c.beginPath();
  c.arc(current.level.spawn.x * s, current.level.spawn.y * s, 6, 0, Math.PI * 2);
  c.fill();
  return { width, height, hangarCount: hangars.length };
}

/** Map the canvas content box (including any CSS scale, excluding its border) to cells. */
export function editorCellFromPointer(level, canvas, clientX, clientY) {
  const { width, height } = geometryForLevel(level);
  const rect = canvas.getBoundingClientRect();
  if (
    ![
      clientX,
      clientY,
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      canvas.offsetWidth,
      canvas.offsetHeight,
      canvas.clientWidth,
      canvas.clientHeight,
      canvas.clientLeft,
      canvas.clientTop,
    ].every(Number.isFinite) ||
    Math.min(
      rect.width,
      rect.height,
      canvas.offsetWidth,
      canvas.offsetHeight,
      canvas.clientWidth,
      canvas.clientHeight,
    ) <= 0
  )
    return null;
  const sx = rect.width / canvas.offsetWidth,
    sy = rect.height / canvas.offsetHeight;
  const x = (clientX - rect.left - canvas.clientLeft * sx) / (canvas.clientWidth * sx);
  const y = (clientY - rect.top - canvas.clientTop * sy) / (canvas.clientHeight * sy);
  if (x < 0 || y < 0 || x >= 1 || y >= 1) return null;
  return { x: Math.floor(x * width), y: Math.floor(y * height) };
}
