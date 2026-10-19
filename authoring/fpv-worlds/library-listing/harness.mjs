import { createContract, TEST_DB_NAME } from './contract.mjs';
const contract = createContract(indexedDB);
const output = document.querySelector('#report');
const state = document.querySelector('#status');
const buttons = [...document.querySelectorAll('button[data-action]')];
document.querySelector('#database').textContent = TEST_DB_NAME;
function render() {
  const report = contract.snapshot();
  output.textContent = JSON.stringify({ ...report, browser: navigator.userAgent, origin: location.origin }, null, 2);
  buttons.find((button) => button.dataset.action === 'seed').disabled = report.ready;
  for (const button of buttons) if (button.dataset.action !== 'seed') button.disabled = !report.ready;
}
for (const button of buttons) button.addEventListener('click', async () => {
  for (const item of buttons) item.disabled = true;
  state.textContent = 'Running this explicit fixture action…';
  try {
    const result = await contract[button.dataset.action]();
    state.textContent = `${result.action}: ${result.accepted ? 'PASS' : 'FAIL'}${result.error ? ` — ${result.error}` : ''}`;
  } catch (error) { state.textContent = `Harness action failed: ${error.message}`; }
  render();
});
document.querySelector('#export').addEventListener('click', () => {
  const blob = new Blob([output.textContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'native-library-listing-bc9-contract.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
addEventListener('pagehide', () => { try { contract.close(); } catch {} }, { once: true });
render();
