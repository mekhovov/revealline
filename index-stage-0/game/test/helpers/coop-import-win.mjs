import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { page } from './coop-host.mjs';

export const importedRoute = JSON.parse(
  await readFile(new URL('../fixtures/coop-import-route.json', import.meta.url)),
);
export const importedCoverageRoute = JSON.parse(
  await readFile(new URL('../fixtures/coop-import-coverage-route.json', import.meta.url)),
);

// Recorded sparse key events earn ordinary captures through the actual host.
// No hidden simulation state is assigned. DOM and Canvas remain modeled.
export function playImportedRoute(f, fixture = importedRoute) {
  const objectives = [f.$('coop-objective').textContent];
  const emit = ({ code, down }) => {
    const key = code.startsWith('Key')
      ? code.slice(3).toLowerCase()
      : code.startsWith('Shift')
        ? 'Shift'
        : code;
    f.doc.activeElement.emit(down ? 'keydown' : 'keyup', { key, code, repeat: false });
  };
  const afterStep = (gesture) =>
    gesture.reason.startsWith('physical release after ') || gesture.reason === 'cleanup';
  f.tick(2);
  let replayed = 0;
  for (let row = 0; row < fixture.metrics.ticksReplayed; row++) {
    const gestures = fixture.gestures.filter((gesture) => gesture.row === row);
    gestures.filter((gesture) => !afterStep(gesture)).forEach(emit);
    f.tick();
    replayed++;
    gestures.filter(afterStep).forEach(emit);
    const objective = f.$('coop-objective').textContent;
    if (objective !== objectives.at(-1)) objectives.push(objective);
    if (!f.$('coop-overlay').hidden) break;
  }
  for (const code of ['ShiftLeft', 'ShiftRight']) emit({ code, down: false });
  assert.equal(
    f.$('coop-overlay-kicker').textContent,
    'A WORLD YOU REVEALED TOGETHER',
    JSON.stringify({ replayed, objectives, message: f.$('coop-message').textContent }),
  );
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  return { replayed, objectives };
}

export async function winImported(t, { pack = importedRoute.authoredPack, ...options } = {}) {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true, ...options });
  f.$('coop-pack-file').focus();
  await f.selectFile(JSON.stringify(pack));
  f.$('coop-difficulty').value = 'gentle';
  f.$('coop-experiment').value = 'full';
  f.$('coop-start').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  const route = playImportedRoute(f);
  assert.ok(route.objectives.some((text) => /Relays 1 \/ 2 · Relay 3/.test(text)));
  assert.equal(f.$('coop-objective').textContent, 'Strongholds secured together');
  assert.equal(f.$('coop-reserves').textContent, '5 reserves');
  return f;
}

export const importedResult = (f) =>
  ['coop-stage', 'coop-objective', 'coop-coverage', 'coop-clock', 'coop-message'].map(
    (id) => f.$(id).textContent,
  );
