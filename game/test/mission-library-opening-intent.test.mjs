import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { trackMissionLibraryOpening } from '../mission-library/opening-intent.mjs';

test('initiating click may bubble before arming; newer input retires without consuming it', async () => {
  const doc = new Document(),
    button = doc.createElement('button');
  doc.body.append(button);
  button.focus();
  let retired = 0,
    clicks = 0;
  button.onclick = () => clicks++;
  const intent = trackMissionLibraryOpening({ document: doc, onRetire: () => retired++ });
  button.click();
  assert.equal(intent.current(), true);
  await Promise.resolve();
  button.click();
  assert.equal(intent.current(), false);
  assert.equal(retired, 1);
  assert.equal(clicks, 2);
  button.click();
  assert.equal(retired, 1);
});

test('disposal before arming leaves no listeners; later menu focus cannot retire accepted opening', async () => {
  const doc = new Document();
  let retired = false;
  const intent = trackMissionLibraryOpening({
    document: doc,
    onRetire: () => {
      retired = true;
    },
  });
  intent.dispose();
  await Promise.resolve();
  doc.emit('keydown', { key: 'Enter' });
  assert.equal(retired, false);
  assert.equal(intent.current(), true);
});

test('claim snapshots an accepted opener before owned asynchronous focus changes', async () => {
  const doc = new Document(),
    opener = doc.createElement('button'),
    installedCard = doc.createElement('button');
  doc.body.append(opener, installedCard);
  opener.focus();
  let retired = 0;
  const intent = trackMissionLibraryOpening({ document: doc, onRetire: () => retired++ });
  await Promise.resolve();
  assert.equal(intent.claim(), true);
  installedCard.focus();
  assert.equal(intent.current(), true);
  assert.equal(retired, 0);
  doc.emit('click');
  assert.equal(retired, 1);
  assert.equal(intent.current(), false);
});
