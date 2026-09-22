import test from 'node:test';
import assert from 'node:assert/strict';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

test('finite IDB exact-key count distinguishes absent, undefined and null without writes', async () => {
  const model = managedIndexedDB();
  const db = await new Promise((resolve, reject) => {
    const request = model.indexedDB.open('fixture', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put(undefined, 'undefined');
      tx.objectStore('assets').put(null, 'null');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    const before = model.contents();
    model.allPuts.length = 0;
    const results = await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readonly');
      const requests = ['absent', 'undefined', 'null'].map((key) =>
        tx.objectStore('assets').count(key),
      );
      tx.oncomplete = () => resolve(requests.map((request) => request.result));
      tx.onabort = () => reject(tx.error);
    });
    assert.deepEqual(results, [0, 1, 1]);
    assert.deepEqual(model.allPuts, []);
    assert.deepEqual(model.contents(), before);
  } finally {
    db.close();
  }
});
