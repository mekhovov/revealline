import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createPauseMenu, pauseMusicAction } from '../ui/pause-menu.mjs';

const button = (doc, root, id) => {
  const element = doc.createElement('button');
  element.id = id;
  root.append(element);
  return element;
};

test('shared pause rows retain action identity, order, focus and exact source positions', () => {
  const doc = new Document(),
    root = doc.createElement('div');
  doc.body.append(root);
  const resume = button(doc, root, 'resume'),
    restart = button(doc, root, 'restart'),
    skip = button(doc, root, 'skip'),
    random = button(doc, root, 'random'),
    choose = button(doc, root, 'choose'),
    sound = button(doc, root, 'sound'),
    settings = button(doc, root, 'settings'),
    home = button(doc, root, 'home');
  const original = [...root.children];
  let restarts = 0;
  restart.onclick = () => restarts++;
  skip.disabled = true;
  const menu = createPauseMenu({
    document: doc,
    root,
    resume,
    missions: [restart, skip, random, choose],
    audio: [sound],
    config: [settings],
    home,
  });
  menu.setActive(true);
  assert.equal(menu.root.children[0], resume);
  assert.deepEqual(restart.parentNode.children, [restart, skip, random, choose]);
  assert.equal(sound.closest('[data-pause-group]').dataset.pauseGroup, 'audio');
  assert.equal(settings.closest('[data-pause-group]').dataset.pauseGroup, 'config');
  assert.equal(skip.disabled, true);
  restart.focus();
  menu.setActive(true);
  assert.equal(doc.activeElement, restart);
  restart.click();
  assert.equal(restarts, 1);
  menu.setActive(false);
  assert.deepEqual(
    root.children.filter((element) => element !== menu.root),
    original,
  );
  assert.equal(menu.root.hidden, true);
  menu.destroy();
  assert.deepEqual(root.children, original);
});

test('Next song delegates to the existing soundtrack action and follows its availability', () => {
  const doc = new Document(),
    root = doc.createElement('div');
  doc.body.append(root);
  const shortcut = pauseMusicAction(doc, 'race');
  const menu = createPauseMenu({ document: doc, root, audio: [shortcut] });
  menu.setActive(true);
  assert.equal(shortcut.element.hidden, true);
  const transport = button(doc, doc.body, 'race-music-next');
  let next = 0;
  transport.onclick = () => next++;
  transport.disabled = true;
  menu.setActive(true);
  assert.equal(shortcut.element.hidden, false);
  assert.equal(shortcut.element.disabled, true);
  transport.disabled = false;
  menu.setActive(true);
  shortcut.element.click();
  assert.equal(next, 1);
});
