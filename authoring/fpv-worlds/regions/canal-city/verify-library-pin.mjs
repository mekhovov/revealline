/** Exact first-party pin; native player and dependency qualification are separate. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CANAL_CITY_LIBRARY_PIN, REGIONAL_LIBRARY_PINS } from '../../../../optional-practice/civilian-fpv/regional-library.mjs';

const pin = CANAL_CITY_LIBRARY_PIN;
assert(REGIONAL_LIBRARY_PINS.includes(pin));
assert.equal(REGIONAL_LIBRARY_PINS.filter(p => p.id === pin.id && p.pin.sha256 === pin.pin.sha256).length, 1);
assert.equal(pin.id, 'canal-city-study');
assert.equal(pin.pin.bytes, 6580);
assert.equal(pin.pin.sha256, '891835944510139a7bed6a99305c0e22b71ba9ccfe84801a07ea6e215ca25c87');
assert.equal(pin.bytes, 6771851);
assert.equal(pin.appearance.terrain, 'plain');
assert.match(pin.pin.url, /\/04b0d9c5db0687d8df2ea9a3ea07b9ca9ddcaa5a\//);
assert(pin.description.en.includes('Water is visual only'));
assert(pin.description.uk.length > 30);
assert(pin.title.en && pin.title.uk);
const bytes = process.argv[2]
  ? await readFile(resolve(process.argv[2], 'delivery.json'))
  : Buffer.from(await (await fetch(pin.pin.url, { redirect: 'error', credentials: 'omit' })).arrayBuffer());
assert.equal(bytes.length, pin.pin.bytes);
assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.pin.sha256);
const descriptor = JSON.parse(bytes);
assert.equal(descriptor.id, pin.id);
assert.equal(descriptor.revision, 'district-r2');
assert.equal(descriptor.totalBytes + bytes.length, pin.bytes);
assert.equal(descriptor.files.length, 38);
assert.equal(Object.keys(pin.startHeadings).length, 6);
assert(Object.values(pin.startHeadings).every(n => Number.isSafeInteger(n) && n >= 0 && n < 36000));
console.log(JSON.stringify({ passed: true, source: process.argv[2] ? 'local exact bundle' : 'immutable GitHub descriptor', descriptor: pin.pin, totalBytes: pin.bytes, declaredHeadings: 6, headingApplicationRequires: 'shared authored-heading helper from #1424', nativePlayerAdmission: false }));
