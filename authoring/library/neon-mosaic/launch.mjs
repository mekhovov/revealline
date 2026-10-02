import { prepareScenario } from '../../../game/imports.mjs';
const buttons = [...document.querySelectorAll('button[data-level]')];
const allowed = new Set(buttons.map((button) => button.dataset.level));
async function play(id) {
  if (!allowed.has(id)) return;
  buttons.forEach((button) => {
    button.disabled = true;
  });
  const status = document.getElementById('status');
  status.textContent = 'Preparing the level…';
  try {
    const response = await fetch(`./${id}/scenario.json`);
    if (!response.ok) throw new Error(`Level download failed (${response.status}).`);
    const source = await response.json();
    const { scenario } = await prepareScenario(source, { classRecipes: source.classRecipes });
    sessionStorage.setItem('revealline.playground.current', JSON.stringify(scenario));
    location.href = '../../../game/?practice=1&journey=legacy';
  } catch (error) {
    status.textContent = error.message;
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}
buttons.forEach((button) => button.addEventListener('click', () => play(button.dataset.level)));
const selected = new URLSearchParams(location.search).get('level');
if (selected) play(selected);
