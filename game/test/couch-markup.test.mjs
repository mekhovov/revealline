import test from 'node:test';
import assert from 'node:assert/strict';
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
