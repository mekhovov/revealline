import { prepareScenario } from '../../../game/imports.mjs';

const button = document.getElementById('play');
button.addEventListener('click', async () => {
  button.disabled = true;
  const status = document.getElementById('status');
  status.textContent = 'Preparing the level…';
  try {
    const response = await fetch('./scenario.json');
    if (!response.ok) throw new Error(`Level download failed (${response.status}).`);
    const source = await response.json();
    source.settings.turnPolicy = document.getElementById('turn').value;
    const { scenario } = await prepareScenario(source, { classRecipes: source.classRecipes });
    sessionStorage.setItem('revealline.playground.current', JSON.stringify(scenario));
    location.href = '../../../game/?practice=1&journey=legacy';
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});
