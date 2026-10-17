import test from 'node:test';
import assert from 'node:assert/strict';
import { runAircraftTimingQualification } from './helpers/fpv-aircraft-qualification.mjs';
import { createAdvancedSimulation } from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

test('full Rapier aircraft catalog qualifies its frozen 500 Hz backend against 2 kHz', async () => {
  const result = await runAircraftTimingQualification({ repetitions: 2 });
  assert.equal(result.aircraft.length, listAircraftPresets().length);
  assert.equal(result.selectedHzOnThisRuntime, 500);
  for (const aircraft of result.aircraft) {
    const selected = aircraft.candidates.find((candidate) => candidate.frequency === 500);
    assert.equal(selected.accuracyPass, true, aircraft.preset);
    assert.equal(selected.contactsPass, true, aircraft.preset);
    assert.equal(selected.capacityPass, true, aircraft.preset);
    assert.equal(selected.repetitionPass, true, aircraft.preset);
  }
  const sim = createAdvancedSimulation(createPresetConfiguration('meteor75-analog-2022'));
  try {
    assert.equal(sim.telemetry().frequency, result.selectedHzOnThisRuntime);
  } finally {
    sim.dispose();
  }
});
