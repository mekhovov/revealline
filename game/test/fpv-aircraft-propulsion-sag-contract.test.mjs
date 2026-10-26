import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSyntheticPropulsionEvidence,
  PROPULSION_EVIDENCE_FIELDS,
} from '../../optional-practice/civilian-fpv/propulsion-evidence.mjs';
import {
  solveStaticQuadCommandDomain,
  STATIC_QUAD_DOMAIN_FORMAT,
} from '../../optional-practice/civilian-fpv/propulsion-domain.mjs';
import {
  evaluateStaticQuadPropulsion,
  STATIC_QUAD_PROPULSION_FORMAT,
} from '../../optional-practice/civilian-fpv/propulsion-quad.mjs';

const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
// Counterexample only: invented static rotor channels T=2cV, Q=T/8,
// I=2c, RPM=10 on c∈[0,1], V∈[0.5,4.5]. Never a real aircraft preset.
function surface() {
  return {
    format: 'PropulsionSurface.v1',
    id: 'invented-sag-counterexample',
    name: 'Invented two-root sag counterexample',
    currentBasis: 'dc-input-at-recorded-voltage',
    paths: [0, 1].map((command) => {
      const path = createSyntheticPropulsionEvidence();
      path.id = `invented-command-${command}`;
      path.components.esc = 'Invented ESC';
      path.components.escFirmware = 'Invented firmware';
      path.domain = { kind: 'one-dimensional-path', axis: 'voltage', intervals: [[0.5, 4.5]] };
      path.samples = [0.5, 4.5].map((voltage) => ({
        values: {
          command,
          voltage,
          airspeed: 0,
          rpm: 10,
          current: 2 * command,
          thrust: 2 * command * voltage,
          torque: (command * voltage) / 4,
        },
        uncertainty: Object.fromEntries(PROPULSION_EVIDENCE_FIELDS.map((field) => [field, null])),
      }));
      return path;
    }),
    cells: [[0, 0]],
  };
}
function requested(voltage) {
  return {
    format: STATIC_QUAD_DOMAIN_FORMAT,
    frame: 'body-x-right-y-up-z-rear-origin-com',
    thrustAxis: 'positive-y',
    torqueBasis: 'steady-shaft-reaction-magnitude',
    units: {
      position: 'm',
      force: 'N',
      torque: 'N*m',
      voltage: 'V',
      current: 'A',
      resistance: 'ohm',
    },
    supply: { kind: 'ideal-fixed-terminal-voltage', voltage },
    rotors: [
      [-0.5, -0.5, 1],
      [0.5, -0.5, -1],
      [0.5, 0.5, 1],
      [-0.5, 0.5, -1],
    ].map(([x, z, reactionDirection], i) => ({
      id: `rotor-${i}`,
      position: { x, y: 0, z },
      reactionDirection,
      commandUnit: 'normalized',
      surface: surface(),
    })),
    target: { force: { x: 0, y: 4, z: 0 }, torque: { x: 0, y: 0, z: 0 } },
  };
}
function batteryForward(input, commands, openVoltage = 5, currentLimit = null) {
  return evaluateStaticQuadPropulsion({
    format: STATIC_QUAD_PROPULSION_FORMAT,
    frame: input.frame,
    thrustAxis: input.thrustAxis,
    torqueBasis: input.torqueBasis,
    units: input.units,
    battery: { openVoltage, resistance: 1, currentLimit },
    rotors: input.rotors.map(({ commandUnit, ...rotor }, index) => ({
      ...rotor,
      command: { value: commands[index].value, unit: commandUnit },
    })),
  });
}

test('one requested wrench and battery admit two distinct interior voltage/command roots', () => {
  // Fy=8cV=4 => c=1/(2V), total I=8c=4/V. V=5−I gives
  // V²−5V+4=(V−1)(V−4)=0. Both roots are strictly inside all cells.
  for (const expected of [
    { voltage: 1, command: 0.5, current: 4, supply: 20, loss: 16 },
    { voltage: 4, command: 0.125, current: 1, supply: 5, loss: 1 },
  ]) {
    const input = requested(expected.voltage),
      inverse = solveStaticQuadCommandDomain(input);
    assert.equal(inverse.status, 'solved');
    inverse.commands.forEach(({ value }) => assert.equal(value, expected.command));
    const forward = batteryForward(input, inverse.commands);
    assert.equal(forward.status, 'solved');
    assert.deepEqual(forward.wrench, input.target);
    assert.equal(forward.load.load.operatingPoint.voltage, expected.voltage);
    assert.equal(forward.load.load.operatingPoint.current, expected.current);
    assert.equal(forward.power.supplyWatts, expected.supply);
    assert.equal(forward.power.electricalWatts, 4);
    assert.equal(forward.power.batteryLossWatts, expected.loss);
    near(forward.power.supplyWatts, forward.power.electricalWatts + forward.power.batteryLossWatts);
    assert.ok(forward.power.shaftWatts < forward.power.electricalWatts);
    assert.equal(forward.flightEligible, false);
    assert.equal(inverse.sources[0].paths[0].source.kind, 'synthetic');
  }
});

test('equal endpoint residual signs do not exclude two valid interior coupled roots', () => {
  const residuals = [0.5, 2, 4.5].map((voltage) => {
    const inverse = solveStaticQuadCommandDomain(requested(voltage));
    assert.equal(inverse.status, 'solved');
    const ideal = inverse.selection.result.forward;
    const current = ideal.load.load.operatingPoint.current;
    near(current, 4 / voltage);
    return voltage + current - 5;
  });
  near(residuals[0], 3.5);
  near(residuals[1], -1);
  near(residuals[2], 7 / 18);
  assert.ok(residuals[0] > 0 && residuals[2] > 0 && residuals[1] < 0);
});

test('a repeated coupled root can be valid without any residual sign crossing', () => {
  // Voc=4 gives (V−2)²=0 after multiplication by positive V.
  const input = requested(2),
    inverse = solveStaticQuadCommandDomain(input);
  assert.equal(inverse.status, 'solved');
  const forward = batteryForward(input, inverse.commands, 4);
  assert.equal(forward.status, 'solved');
  assert.equal(forward.load.load.operatingPoint.voltage, 2);
  assert.equal(forward.load.load.operatingPoint.current, 2);
  assert.deepEqual(forward.wrench, input.target);
  for (const voltage of [0.5, 1, 3, 4.5]) assert.ok(voltage + 4 / voltage - 4 > 0);
  // Reducing Voc to3 has discriminant9−16<0: a future complete inverse
  // must distinguish no roots from an unbracketed repeated or multiple root.
  assert.ok(3 ** 2 - 4 * 4 < 0);
});

test('a current threshold reports an unregulated demand rather than silently selecting another root', () => {
  const low = requested(1),
    high = requested(4);
  const lower = batteryForward(low, solveStaticQuadCommandDomain(low).commands, 5, 3);
  const higher = batteryForward(high, solveStaticQuadCommandDomain(high).commands, 5, 3);
  assert.equal(lower.status, 'limit-exceeded');
  assert.equal(lower.load.load.operatingPoint.voltage, 1);
  assert.equal(lower.load.load.operatingPoint.current, 4);
  assert.deepEqual(lower.wrench, low.target);
  assert.equal(higher.status, 'solved');
  assert.equal(higher.load.load.operatingPoint.voltage, 4);
  assert.equal(higher.load.load.operatingPoint.current, 1);
  assert.equal(lower.power.electricalWatts, higher.power.electricalWatts);
  assert.notEqual(lower.power.batteryLossWatts, higher.power.batteryLossWatts);
});
