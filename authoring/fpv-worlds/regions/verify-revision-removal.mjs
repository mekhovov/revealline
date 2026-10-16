/** Same production transaction scenario as the manual native fixture; in-memory IndexedDB. */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { verifyRevisionRemoval } from './revision-removal-scenario.mjs';
const { IDBFactory } = createRequire(new URL('../package.json', import.meta.url))('fake-indexeddb');
const base = new URL('./urban-bando/delivery-review-r1/', import.meta.url);
const result = await verifyRevisionRemoval({
  indexedDB: new IDBFactory(),
  descriptorBytes: await readFile(new URL('delivery.json', base)),
  readSource: (path) => readFile(new URL(path, base)),
});
console.log(
  JSON.stringify(
    {
      scope:
        'Production APIs; real 38-file immutable fixture; in-memory IndexedDB; no browser/player storage',
      ...result,
    },
    null,
    2,
  ),
);
