import assert from 'node:assert/strict';
import { Document } from '../../../game/test/helpers/couch-dom.mjs';
import { mountDroneResponse } from '../../../optional-practice/civilian-fpv/sim-presentation.mjs';
import { createFlight } from '../../../optional-practice/civilian-fpv/model.mjs';
import { FLIGHT_COURSES } from '../../../optional-practice/civilian-fpv/catalogue.mjs';
import { Q } from '../../../optional-practice/civilian-fpv/math.mjs';

// Actual flight lifecycle and presentation, deterministic DOM/clock boundary.
// No browser layout, screen-reader speech, renderer or saved-player-store claim.
const doc = new Document();
doc.createElementNS = (_namespace, tag) => doc.createElement(tag);
const root = doc.createElement('div');
doc.body.append(root);
let time = -1000;
const ui = mountDroneResponse({ root, window: { performance: { now: () => time } } });
const flight = createFlight({ course: FLIGHT_COURSES[0], unscoredPractice: true });
const status = () => root.querySelector('[role="status"]').textContent;
const update = (overrides = {}) => {
  const before = flight.snapshot();
  ui.update({ state: before, ...overrides });
  assert.deepEqual(flight.snapshot(), before, 'Presentation must not mutate flight');
};
update();
time = -350;
update();
assert.match(status(), /Motors off/);
flight.arm();
flight.step({ throttle: 0.7, pitch: 0, roll: 0, yaw: 0 });
assert.equal(flight.snapshot().status, 'active');
time = 1;
update();
assert(!/Motors off|Paused/.test(status()), 'Actual arming must clear stale phase immediately');
flight.pause();
time = 2;
update();
assert.match(status(), /Paused/);
time = 3;
update({ unavailable: true });
assert.match(status(), /Radio unavailable/);
time = 4;
update({ unavailable: true, locale: 'uk' });
assert.match(status(), /Пульт недоступний/);
time = 5;
update({ locale: 'uk' });
assert.match(status(), /Пауза/);
flight.arm();
time = 6;
update({ locale: 'uk' });
assert(!/Пауза|Мотори вимкнено/.test(status()));
time = 7;
update({ guideOpen: true });
assert.match(status(), /Paused/);
time = 8;
update();
assert(!status().includes('Paused'));

// An observed brief inverted pose must not chatter; phase/locale changes may
// announce immediately but must not prematurely accept pending inversion.
const inverted = { ...flight.snapshot(), orientation: [Q, 0, 0, 0] };
time = 100;
update({ state: inverted });
assert.equal(root.dataset.inverted, 'true');
assert.match(status(), /Drone upright/);
time = 200;
update();
time = 900;
update();
assert.match(status(), /Drone upright/);
time = 1000;
update({ state: inverted });
time = 1100;
update({ state: inverted, guideOpen: true });
assert.match(status(), /Paused.*Drone upright/);
time = 1200;
update({ state: inverted, guideOpen: true, locale: 'uk' });
assert.match(status(), /Пауза.*Дрон у прямому положенні/);
time = 1649;
update({ state: inverted, guideOpen: true, locale: 'uk' });
assert.match(status(), /Дрон у прямому положенні/);
time = 1650;
update({ state: inverted, guideOpen: true, locale: 'uk' });
assert.match(status(), /Дрон догори дном/);
time = 1700;
update({ guideOpen: true, locale: 'uk' });
assert.match(status(), /Дрон догори дном/);
time = 2350;
update({ guideOpen: true, locale: 'uk' });
assert.match(status(), /Дрон у прямому положенні/);
flight.reset();
time = 2351;
update();
assert.match(status(), /Motors off/);
ui.dispose();
update();
assert.equal(root.children.length, 0);
console.log(
  'PASS actual arm/pause/reset, unavailable/reconnect, locale, guide, inversion debounce and disposal; flight snapshots unchanged',
);
