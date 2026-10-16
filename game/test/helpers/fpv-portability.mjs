// The identical source fixture can run in Node or a served browser module.
// A Node result alone does not establish cross-browser replay compatibility.
import { FLIGHT_COURSES } from '../../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../../optional-practice/civilian-fpv/demonstrations.mjs';
import { createFlight, replayFlight } from '../../../optional-practice/civilian-fpv/model.mjs';
import { dataIdentity } from '../../data-json.mjs';

const expected = [
  [239, 'f341468b6ddfe4f1'],
  [239, 'f341468b6ddfe4f1'],
  [383, '02607361d08faa9e'],
  [383, '02607361d08faa9e'],
  [433, '5233f3822ea55c18'],
  [433, 'bddaadc6a2fbc7ba'],
  [433, '832304a5f23581df'],
  [433, '4632d422e00dec47'],
  [435, '857979ac092e3a09'],
  [435, '4372bef02299461d'],
  [899, 'd65354624117314c'],
  [900, '68ad7ff2fbc001e9'],
  [498, 'fae4edeb1c9ac5a1'],
  [488, '753a209cd959a235'],
  [491, '74133c751750d5d9'],
  [491, 'c1a1aa25c933ab47'],
  [638, 'b867452ffd5d3320'],
  [638, '5f3ac5d8a56a2bc4'],
  [610, '7ea234657e0dbed0'],
  [610, '842cc2e198180367'],
  [1243, '72cf29cc67a42031'],
  [1243, '5259432f4393c02f'],
  [1126, '296fb251c5ca3606'],
  [1126, 'f4e138242fdf28c2'],
];
export function runFlightDemonstrationFixtures() {
  if (FLIGHT_COURSES.length !== 12 || FLIGHT_DEMONSTRATIONS.length !== 24)
    throw new Error('Expected twelve exact courses in both modes.');
  return FLIGHT_DEMONSTRATIONS.map((proof, index) => {
    const courseId = `flight-${String(Math.floor(index / 2) + 1).padStart(2, '0')}`;
    if (
      proof.course !== courseId ||
      proof.mode !== (index % 2 ? 'acro' : 'self-level') ||
      proof.session !== 'demonstration'
    )
      throw new Error('Golden proof identity differs.');
    const result = replayFlight(
        FLIGHT_COURSES.find((course) => course.id === proof.course),
        proof,
      ),
      checkpoint = dataIdentity(result.state);
    if (
      result.state.status !== 'complete' ||
      result.state.contacts !== 0 ||
      result.state.ticks !== expected[index][0] ||
      checkpoint !== expected[index][1]
    )
      throw new Error(`Golden replay differs: ${proof.course}/${proof.mode}`);
    return { course: proof.course, mode: proof.mode, ticks: result.state.ticks, checkpoint };
  });
}

// This synthetic, unfinishable fixture exercises the authority only. It is not
// an authored drill, a successful attempt, or evidence eligible for progress.
function stressCourse() {
  const course = structuredClone(FLIGHT_COURSES[0]);
  course.id = 'portability-stress';
  course.bounds = { min: { x: -4000, y: 0, z: -4000 }, max: { x: 4000, y: 6000, z: 4000 } };
  course.obstacles = [
    { id: 'wall', min: { x: -3000, y: 0, z: -2200 }, max: { x: 3000, y: 3000, z: -2000 } },
    { id: 'pillar', min: { x: 1500, y: 0, z: 500 }, max: { x: 2200, y: 4500, z: 1200 } },
  ];
  const unreachable = {
    type: 'hold',
    min: { x: -100, y: 7000, z: -100 },
    max: { x: 100, y: 8000, z: 100 },
    ticks: 500,
    maxSpeed: 0,
    maxTilt: 0,
    minTilt: 0,
    centred: true,
    heading: 0,
  };
  course.steps = { 'self-level': [unreachable], acro: [unreachable] };
  return course;
}
function stressControl(tick) {
  if (tick < 200) return [0, 0, 0, 1000];
  if (tick < 700) return [1000, 0, 0, 850];
  if (tick < 1200) return [0, 1000, 1000, 900];
  if (tick < 1450) return [0, 0, 0, 0];
  if (tick < 1950) return [-1000, -1000, -1000, 1000];
  if (tick < 2450) return [0, -1000, 700, 1000];
  const sign = Math.floor((tick - 2450) / 50) % 2 ? -1 : 1;
  return [sign * 1000, -sign * 700, sign * 350, tick < 2850 ? 800 : 0];
}
const stressExpected = {
  'self-level': [
    '3a93877a2ceadd72',
    'bb9aaa2c08d351a2',
    '04ca4bb7ae09ac08',
    'e095fbff104c3ea9',
    '7f1e8d47781c3c43',
    '160def8362c067ed',
    '8e41bf42a40aca08',
    'b82ee0a1286d7591',
    'b78c40926c08624e',
    '94cbedd81107c4a1',
    'a7c1564c9f72f968',
    '33546351f864f1df',
  ],
  acro: [
    'd26dd10cdb5b83da',
    '5696242ee5b41548',
    'e33e9afac28b51a1',
    '594979fc5538e6a0',
    '1ccc855da33158aa',
    'e91dd1092bb62c41',
    '71f03dc0e84beb0f',
    '1555237b853d3e82',
    '5b896e6310d6d97e',
    '7dfc72649fabc016',
    'e0f0ead4d87698e3',
    '9ea68ceaf5c3edaa',
  ],
};
export function runFlightStressFixtures() {
  return ['self-level', 'acro'].map((mode) => {
    const course = stressCourse(),
      flight = createFlight({ course, mode }),
      checkpoints = [],
      coverage = {
        invertedTicks: 0,
        groundedTicks: 0,
        boundaryTicks: 0,
        contacts: 0,
        yawQuadrants: [],
      },
      quadrants = new Set();
    flight.arm();
    for (let tick = 0; tick < 3000; tick++) {
      const frame = stressControl(tick),
        state = flight.step(
          Object.fromEntries(['roll', 'pitch', 'yaw', 'throttle'].map((key, i) => [key, frame[i]])),
          { quantized: true },
        );
      if (state.status !== 'active' || state.ticks !== tick + 1)
        throw new Error('Stress fixture must remain active at every fixed tick.');
      coverage.invertedTicks += Number(state.attitude.up.y < 0);
      coverage.groundedTicks += Number(state.position.y === 0);
      coverage.boundaryTicks += Number(
        ['x', 'y', 'z'].some(
          (axis) =>
            state.position[axis] === course.bounds.max[axis] ||
            (axis !== 'y' && state.position[axis] === course.bounds.min[axis]),
        ),
      );
      coverage.contacts = state.contacts;
      quadrants.add(Math.floor((((state.attitude.yaw % 36000) + 36000) % 36000) / 9000));
      if ((tick + 1) % 250 === 0) {
        const checkpoint = dataIdentity(state);
        if (checkpoint !== stressExpected[mode][checkpoints.length])
          throw new Error(`Stress checkpoint differs: ${mode}/${tick + 1}`);
        checkpoints.push({ tick: tick + 1, checkpoint });
      }
    }
    coverage.yawQuadrants = [...quadrants].sort();
    if (
      !coverage.groundedTicks ||
      !coverage.boundaryTicks ||
      !coverage.contacts ||
      quadrants.size !== 4 ||
      (mode === 'acro' && !coverage.invertedTicks)
    )
      throw new Error('Stress orientation/contact coverage is incomplete.');
    return { course: course.id, mode, ticks: 3000, checkpoints, coverage };
  });
}
export function runFlightGoldenFixtures() {
  return [...runFlightDemonstrationFixtures(), ...runFlightStressFixtures()];
}
