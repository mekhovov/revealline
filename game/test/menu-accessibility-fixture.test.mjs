import test from 'node:test';
import assert from 'node:assert/strict';
import { fontResponseMode } from './manual/accessibility/font-delay-worker.mjs';
import { controlName } from './manual/accessibility/measure.mjs';

const scope = 'http://localhost:8983/game/test/manual/accessibility/';
const font = 'http://localhost:8983/game/ui/fonts/departure-mono/DepartureMono-Regular.woff2';
test('font fault injection is restricted to its test client and exact local font paths', () => {
  assert.equal(fontResponseMode(`${scope}pane.html?fonts=delayed`, font, scope), 'delayed');
  assert.equal(fontResponseMode(`${scope}pane.html?fonts=blocked`, font, scope), 'blocked');
  for (const client of [
    'http://localhost:8983/game/?fonts=blocked',
    'http://localhost:8983/game/creator/player.html?fonts=delayed',
    'http://localhost:8983/authoring/asset-studio/?fonts=delayed',
    'https://example.test/game/test/manual/accessibility/pane.html?fonts=blocked',
    `${scope}pane.html?fonts=unknown`,
  ])
    assert.equal(fontResponseMode(client, font, scope), 'normal');
  for (const resource of [
    'http://localhost:8983/game/app.mjs',
    'http://localhost:8983/game/ui/art/menu-scenes/fpv.webp',
    'https://example.test/game/ui/fonts/departure-mono/DepartureMono-Regular.woff2',
  ])
    assert.equal(fontResponseMode(`${scope}pane.html?fonts=blocked`, resource, scope), 'normal');
});

test('rendered name checks use associated labels rather than a select option or input value', () => {
  const node = {
    tagName: 'SELECT',
    textContent: 'English Українська',
    getAttribute: () => null,
    labels: [],
  };
  assert.equal(controlName(node, {}), '', 'option text does not name its select');
  node.labels = [{ textContent: 'Мова' }];
  assert.equal(controlName(node, {}), 'Мова');
  assert.equal(
    controlName({ ...node, tagName: 'INPUT', type: 'text', value: 'filled', labels: [] }, {}),
    '',
  );
});

test('rendered name checks honor referenced labels and native action text', () => {
  const node = {
    tagName: 'BUTTON',
    textContent: 'Visible action',
    getAttribute: (key) =>
      ({ 'aria-labelledby': 'label detail', 'aria-label': 'Override' })[key] ?? null,
  };
  assert.equal(
    controlName(node, {
      getElementById: (id) => ({ textContent: id === 'label' ? 'Далі' : 'Місія' }),
    }),
    'Далі Місія',
  );
  assert.equal(controlName({ ...node, getAttribute: () => null }, {}), 'Visible action');
});
