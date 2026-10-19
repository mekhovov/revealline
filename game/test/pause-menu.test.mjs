import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createPauseMenu, pauseMusicAction } from '../ui/pause-menu.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

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

for (const prefix of ['race', 'coop'])
  test(`${prefix}: detached pause music label follows locale at first admission and retains its existing owner`, (t) => {
    const previous = getLocale();
    setLocale('uk', { persist: false });
    const doc = new Document(),
      root = doc.createElement('div');
    doc.body.append(root);
    const resume = button(doc, root, `${prefix}-resume`),
      sound = button(doc, root, `${prefix}-sound`),
      outside = button(doc, doc.body, `${prefix}-outside`),
      transport = button(doc, doc.body, `${prefix}-music-next`),
      shortcut = pauseMusicAction(doc, prefix);
    const menu = createPauseMenu({ document: doc, root, resume, audio: [sound, shortcut] });
    t.after(() => {
      menu.destroy();
      setLocale(previous, { persist: false });
    });
    const original = [resume.id, sound.id],
      nativeTarget = shortcut.element;
    assert.equal(
      shortcut.element.isConnected,
      false,
      'The shortcut remains detached before actual Pause.',
    );
    assert.equal(shortcut.element.textContent, 'Наступна композиція');
    let next = 0;
    transport.onclick = () => next++;
    outside.focus();
    setLocale('en', { persist: false });
    assert.equal(
      shortcut.element.textContent,
      'Наступна композиція',
      'Global translation deliberately skips detached controls.',
    );
    menu.setActive(true);
    assert.equal(
      shortcut.element.textContent,
      'Next song',
      'Actual admission refreshes the existing binding.',
    );
    assert.equal(shortcut.element.isConnected, true);
    assert.equal(shortcut.element === nativeTarget, true, 'Keep the exact native button.');
    const caption = shortcut.element.firstChild;
    assert.equal(doc.activeElement === outside, true, 'Admission does not move focus.');
    assert.deepEqual(
      sound.parentNode.children.map((node) => node.id),
      [sound.id, shortcut.element.id],
    );
    shortcut.element.focus();
    for (const [locale, label] of [
      ['uk', 'Наступна композиція'],
      ['en', 'Next song'],
    ]) {
      setLocale(locale, { persist: false });
      menu.setActive(true);
      assert.equal(shortcut.element.textContent, label);
      assert.equal(shortcut.element.firstChild === caption, true);
      assert.equal(doc.activeElement === shortcut.element, true);
      assert.equal(next, 0, 'Translation and refresh do not invoke the transport.');
    }
    outside.focus();
    menu.setActive(false);
    assert.deepEqual(
      root.children.filter((node) => node !== menu.root).map((node) => node.id),
      original,
    );
    setLocale('uk', { persist: false });
    transport.disabled = true;
    menu.setActive(true);
    assert.equal(shortcut.element.textContent, 'Наступна композиція');
    assert.equal(shortcut.element.disabled, true);
    assert.equal(doc.activeElement === outside, true);
    transport.disabled = false;
    menu.setActive(true);
    shortcut.element.click();
    assert.equal(next, 1, 'One explicit Next action delegates once to the same transport.');
    transport.remove();
    menu.setActive(true);
    assert.equal(shortcut.element.hidden, true);
    assert.equal(shortcut.element.disabled, true);
    menu.destroy();
    const retired = shortcut.element.textContent;
    setLocale('en', { persist: false });
    assert.equal(shortcut.element.isConnected, false);
    assert.equal(
      shortcut.element.textContent,
      retired,
      'Locale changes cannot revive a retired shortcut.',
    );
    assert.equal(doc.activeElement === outside, true);
    assert.deepEqual(
      root.children.map((node) => node.id),
      original,
    );
    assert.equal(next, 1);
  });
