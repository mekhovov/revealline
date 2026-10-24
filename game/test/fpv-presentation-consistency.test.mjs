import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  flightInstrumentReadings,
  mountFlightInstruments,
} from '../../optional-practice/civilian-fpv/sim-presentation.mjs';

const flight = (patch = {}) => ({
  status: 'active',
  ticks: 100,
  attitude: { yaw: -4500 },
  velocity: { x: 3000, y: 7000, z: 4000 },
  position: { x: 0, y: 12500, z: 0 },
  ...patch,
});
test('flight instruments use actual heading, horizontal speed and map-relative height', () => {
  assert.deepEqual(flightInstrumentReadings(flight()), {
    heading: 315,
    horizontalSpeed: 5,
    mapHeight: 12.5,
  });
  assert.deepEqual(flightInstrumentReadings({}), {
    heading: null,
    horizontalSpeed: null,
    mapHeight: null,
  });
});
test('instruments stay independent of lesson guidance and do not invent battery telemetry', () => {
  const doc = new Document(),
    parent = doc.createElement('div');
  doc.body.append(parent);
  const view = mountFlightInstruments({ container: parent });
  view.update(flight(), {
    preferences: { guidanceVisible: false, showFpvProps: false, extraTelemetry: true },
  });
  const root = parent.querySelector('.sim-flight-instruments');
  assert.equal(root.hidden, false);
  assert.match(
    parent.querySelector('.sim-flight-readouts').textContent,
    /Speed 5.0 m\/s.*Height · map 12.5 m/,
  );
  assert.equal(parent.querySelector('.sim-flight-extra').hidden, true);
  view.update(
    flight({
      advancedTelemetry: { voltage: 23.1, current: 9.2, usedAh: 0.15 },
      encounter: { activity: 'survival' },
    }),
    { preferences: { extraTelemetry: true } },
  );
  assert.equal(root.dataset.combat, 'true');
  assert.equal(parent.querySelector('.sim-flight-extra').textContent, '23.10 V · 9.20 A · 0.15 Ah');
  view.update(flight(), { preferences: { flightInstruments: false } });
  assert.equal(parent.querySelector('.sim-flight-readouts').hidden, true);
  assert.equal(parent.querySelector('.sim-flight-compass').hidden, true);
  view.destroy();
  assert.equal(parent.querySelector('.sim-flight-instruments'), null);
});
test('replacement warnings use accepted ticks and take priority over missing route trails', () => {
  const doc = new Document(),
    parent = doc.createElement('div');
  const view = mountFlightInstruments({ container: parent });
  const warning = () => parent.querySelector('.sim-flight-notice');
  view.update(flight({ actors: [{ replacementTick: 350 }] }), {
    preferences: { routeGuideVisible: true },
    routeUnavailable: 'No checked route',
  });
  assert.equal(warning().textContent, 'Replacing lesson target');
  view.update(flight({ ticks: 350, actors: [{ replacementTick: 350 }] }));
  assert.equal(warning().textContent, 'Replacement waiting for a clear area');
  view.update(flight(), {
    preferences: { routeGuideVisible: true },
    routeUnavailable: 'No checked route',
  });
  assert.equal(warning().textContent, 'No checked route');
  view.update(flight());
  assert.equal(warning().hidden, true);
  view.update(flight(), { visible: false });
  assert.equal(parent.querySelector('.sim-flight-instruments').hidden, true);
  view.destroy();
});
