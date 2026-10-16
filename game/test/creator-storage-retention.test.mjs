import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { mountCreatorStorageRetention } from '../creator/storage-retention.mjs';

const flush = () => new Promise(setImmediate);
async function fixture(t, page, storage) {
  const doc = new Document();
  const win = doc.defaultView;
  doc.parentNode = win;
  win.navigator = { storage };
  const tree = parse(await readFile(new URL(`../creator/${page}`, import.meta.url), 'utf8'));
  const append = (parent, source) => {
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs) {
      node.setAttribute(name, value);
      if (['id', 'type', 'value'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'open'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes ?? []) append(node, child);
  };
  const body = tree.childNodes
    .find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  for (const child of body.childNodes) append(doc.body, child);
  const $ = (id) => doc.getElementById(id);
  assert.equal($('creator-retention-button').disabled, true);
  const owner = mountCreatorStorageRetention({ document: doc, window: win });
  t.after(() => owner.destroy());
  return {
    doc,
    win,
    $,
    owner,
    panel: $('creator-retention'),
    button: $('creator-retention-button'),
    status: $('creator-retention-status'),
  };
}

for (const page of ['index.html', 'team.html']) {
  test(`${page}: retention is explicit and independent of editable campaign controls`, async (t) => {
    let checks = 0,
      requests = 0,
      resolve;
    const h = await fixture(t, page, {
      persisted: async () => (++checks, false),
      persist: () => {
        requests++;
        return new Promise((answer) => {
          resolve = answer;
        });
      },
      get estimate() {
        throw new Error('Retention must not infer a grant from quota.');
      },
    });
    assert.equal(checks + requests, 0, 'Closed creation page never requests retention.');
    assert.equal(h.button.disabled, false);
    assert.equal(
      h.panel.closest('#team-creator-form'),
      null,
      'Busy Team controls do not own retention.',
    );
    const title = h.$(page === 'team.html' ? 'campaign-name' : 'name');
    title.value = 'Unchanged local draft';
    const approve = h.$('approve');
    approve.disabled = true;
    h.panel.open = true;
    h.panel.emit('toggle');
    await flush();
    assert.equal(checks, 1);
    assert.equal(requests, 0);
    h.button.focus();
    h.button.click();
    h.button.click();
    assert.equal(requests, 1);
    assert.equal(h.doc.activeElement, h.button);
    assert.equal(h.button.disabled, false);
    assert.equal(h.button.getAttribute('aria-busy'), 'true');
    h.panel.open = false;
    h.panel.emit('toggle');
    const closed = h.status.textContent;
    resolve(true);
    await flush();
    assert.equal(
      h.status.textContent,
      closed,
      'Late browser answer cannot repaint a closed visit.',
    );
    assert.equal(title.value, 'Unchanged local draft');
    assert.equal(approve.disabled, true, 'Retention cannot approve campaign content.');
  });

  test(`${page}: page departure and hidden views retire requests; reopening refreshes truthfully`, async (t) => {
    let requests = 0,
      checks = 0,
      resolve;
    const h = await fixture(t, page, {
      persisted: async () => (++checks, false),
      persist: () => {
        requests++;
        return new Promise((answer) => {
          resolve = answer;
        });
      },
    });
    h.panel.open = true;
    h.panel.emit('toggle');
    await flush();
    h.button.click();
    h.win.emit('pagehide');
    const departed = h.status.textContent;
    resolve(false);
    await flush();
    assert.equal(h.status.textContent, departed);
    h.button.click();
    assert.equal(requests, 1);
    h.win.emit('pageshow');
    await flush();
    assert.match(h.status.textContent, /not enabled/);
    assert.equal(checks, 2);
    h.doc.hidden = true;
    h.doc.emit('visibilitychange');
    h.button.click();
    assert.equal(requests, 1);
    h.doc.hidden = false;
    h.doc.emit('visibilitychange');
    await flush();
    assert.equal(checks, 3);
    h.owner.destroy();
    h.button.click();
    h.panel.emit('toggle');
    h.win.emit('pageshow');
    assert.equal(requests, 1);
    assert.equal(checks, 3);
  });
}
