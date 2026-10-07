import test from 'node:test';
import assert from 'node:assert/strict';
import { renderModeChoices, GAME_MODE_ORDER } from '../ui/mode-choice-view.mjs';
import { setMenuIcon } from '../ui/native-menu-icons.mjs';
import { Document } from './helpers/couch-dom.mjs';

for (const current of GAME_MODE_ORDER) {
  test(`${current} shares one active mode, compact labels and unchanged destination handlers`, () => {
    const document = new Document(),
      root = document.createElement('nav');
    document.body.append(root);
    let visits = 0;
    const actions = Object.fromEntries(
      GAME_MODE_ORDER.map((id) => {
        const link = document.createElement('a');
        link.href = `https://example.test/${id}`;
        link.classList.add('race-primary', 'selected');
        link.setAttribute('aria-current', 'page');
        link.addEventListener('click', () => visits++);
        return [id, link];
      }),
    );
    const view = renderModeChoices({ root, current, actions, setMenuIcon });
    assert.deepEqual(
      [...root.children].map((item) => item.dataset.gameMode),
      GAME_MODE_ORDER,
    );
    assert.equal(root.querySelectorAll('[aria-current="page"]').length, 1);
    assert.equal(view.choices[current].getAttribute('aria-current'), 'page');
    for (const [id, action] of Object.entries(actions)) {
      assert.equal(view.choices[id], action);
      assert.equal(action.classList.contains('race-primary'), false);
      assert.equal(action.classList.contains('selected'), false);
    }
    assert.equal(actions.snake.dataset.menuIcon, 'snake');
    assert.equal(actions.simulator.querySelector('.game-mode-badge').textContent, 'beta');
    actions.team.click();
    assert.equal(visits, 1);
    view.refresh('uk');
    assert.equal(actions.team.querySelector('strong').textContent, 'Разом');
    assert.equal(actions.snake.querySelector('strong').textContent, 'Змійка');
    assert.equal(root.getAttribute('aria-label'), 'Режим гри');
    assert.equal(actions.solo.getAttribute('aria-label'), '1P Соло');
    assert.equal(root.querySelectorAll('[aria-current="page"]').length, 1);
    assert.equal(actions.solo.dataset.menuRight.split(' ')[0], actions.team.id);
    assert.equal(actions.solo.dataset.menuLeft.split(' ')[0], actions.simulator.id);
    assert.equal(actions.simulator.dataset.menuRight.split(' ')[0], actions.solo.id);
  });
}
