import { JOURNEY_ACTOR_MATERIALS, drawJourneyActorMaterial } from './journey-actor-materials.mjs';
import { ENEMY_CATALOG } from '../enemy-catalog.mjs';
import { roleColor, PRESENTATION_INK, PRESENTATION_PLATE } from '../ui/actor-presentation.mjs';

const studies = document.getElementById('studies');
const sizeControl = document.getElementById('body-size');
const surfaceControl = document.getElementById('surface');
const status = document.getElementById('review-status');
const specimens = [];
// Author at native integer coordinates once, then use nearest-neighbor sampling.
// Scaling fillRect geometry directly to16/24px introduces antialiased half pixels.
const nativeBody = (material, enemy) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 28;
  const ctx = canvas.getContext('2d');
  ctx.translate(14, 14);
  drawJourneyActorMaterial(
    ctx,
    { journeyMaterial: material.id, type: enemy.type },
    {
      dark: PRESENTATION_PLATE,
      body: roleColor(enemy.type),
      trim: '#ffd27b',
      light: PRESENTATION_INK,
    },
  );
  return canvas;
};
for (const material of JOURNEY_ACTOR_MATERIALS) {
  const card = document.createElement('section');
  card.className = 'study';
  const heading = document.createElement('h2');
  heading.textContent = material.name;
  const description = document.createElement('p');
  description.className = 'material';
  description.textContent = material.material;
  const roles = document.createElement('div');
  roles.className = 'roles';
  for (const enemy of ENEMY_CATALOG) {
    const figure = document.createElement('figure');
    const surface = document.createElement('div');
    surface.className = 'surface';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      `${material.name}: ${enemy.label}, ${enemy.domain}. Body-only candidate.`,
    );
    const label = document.createElement('figcaption');
    label.textContent = enemy.label;
    surface.append(canvas);
    figure.append(surface, label);
    roles.append(figure);
    specimens.push({ canvas, body: nativeBody(material, enemy) });
  }
  card.append(heading, description, roles);
  studies.append(card);
}
function render() {
  const size = Number(sizeControl.value);
  if (![16, 24, 32].includes(size)) return;
  studies.className = `studies ${['dark', 'light', 'grey'].includes(surfaceControl.value) ? surfaceControl.value : 'dark'}`;
  for (const { canvas, body } of specimens) {
    canvas.width = canvas.height = size;
    canvas.style.width = canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(body, 0, 0, size, size);
  }
  status.textContent = `84 body studies · ${size} px · static, silent, unpublished. Recognition and live-board testing remain pending.`;
}
sizeControl.addEventListener('change', render);
surfaceControl.addEventListener('change', render);
render();
