import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountCouch } from './helpers/couch-host.mjs';
import { Document } from './helpers/couch-dom.mjs';

for (const [name, opening, closing] of [
  ['bare body', '<body>', '</body>'],
  ['body attributes', '<body class="couch" data-mode="race">', '</body>'],
  ['quoted delimiters and case', '<BODY\n data-label=\'A > B\' class="couch">', '</BODY >'],
]) {
  test(`couch markup mounts controls with ${name}`, () => {
    const doc = new Document();
    mountCouch(
      doc,
      `<html><head><title>Outside</title></head>${opening}<main id="play"><button id="start" data-mode="coop">Together</button></main>${closing}</html>`,
    );
    assert.equal(doc.body.children.length, 1);
    assert.equal(doc.getElementById('play').parentNode, doc.body);
    const button = doc.getElementById('start');
    assert.equal(button.parentNode, doc.getElementById('play'));
    assert.equal(button.textContent, 'Together');
    assert.equal(button.dataset.mode, 'coop');
    assert.equal(doc.querySelectorAll('title').length, 0);
  });
}

test('couch markup rejects a missing or incomplete body with a controlled error', () => {
  for (const html of [
    '<html><main>No body</main></html>',
    '<body class="couch"><main>No closing body</main>',
    '<body-preview><main>Not a body</main></body>',
  ]) {
    const doc = new Document();
    assert.throws(
      () => mountCouch(doc, html),
      /Couch test markup requires a complete <body> element/,
    );
    assert.equal(doc.body.children.length, 0);
  }
});

test('appending parsed text preserves nested boot and game controls', () => {
  const doc = new Document();
  mountCouch(
    doc,
    '<body>\n<p id="boot">\n<span>Loading</span>…\n</p>\n<main id="game"><button id="go">Start</button>\n<p>Details</p></main>\n</body>',
  );
  assert.equal(doc.getElementById('boot').querySelector('span').textContent, 'Loading');
  assert.equal(doc.getElementById('go').textContent, 'Start');
  assert.equal(doc.getElementById('go').parentElement.id, 'game');
});

for (const [route, boot, back] of [
  ['../couch/index.html', 'boot-status', 'boot-return'],
  ['../couch/relay-rescue.html', 'coop-boot', 'coop-race'],
  ['../replay-theater/index.html', 'boot-status', 'replay-game-home'],
]) {
  test(`${route} has a visible static loading signal and a reachable exit before modules load`, async () => {
    const doc = new Document();
    mountCouch(doc, await readFile(new URL(route, import.meta.url), 'utf8'));
    const status = doc.getElementById(boot);
    assert.equal(status.dataset.state, 'busy');
    assert.match(status.textContent, /Preparing|Loading/);
    assert.equal(status.querySelectorAll('i').length, 3);
    assert.equal(status.closest('[hidden]'), null);
    assert.equal(doc.getElementById(back).closest('[inert]'), null);
    assert.equal(doc.getElementById(back).closest('[hidden]'), null);
    if (route === '../replay-theater/index.html') {
      const home = doc.getElementById(back);
      assert.equal(home.getAttribute('href'), '../');
      assert.equal(home.textContent, 'Game home');
      assert.equal(home.getAttribute('aria-disabled'), null);
      assert.ok(doc.getElementById('return-game').hasAttribute('inert'));
      for (const prefix of [
        'http://localhost/',
        'https://example.test/releases/v0.70.0/site/',
        'https://example.test/archive/releases/v0.68.2/site/',
      ])
        assert.equal(
          new URL(home.getAttribute('href'), `${prefix}game/replay-theater/`).href,
          `${prefix}game/`,
          'The static exit stays inside its own build without adopting launch hints.',
        );
    }
  });
}
