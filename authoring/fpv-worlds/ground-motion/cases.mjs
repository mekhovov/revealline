// Manual deterministic movement cases; no completed flight or authored world claim.
const v = (x, y, z) => ({ x, y, z });
const box = (id, min, max) => ({ id, min: v(...min), max: v(...max) });
export function groundMotionCases() {
  const cases = [];
  for (const type of ['vehicle', 'patrol', 'sentry']) {
    const radius = type === 'vehicle' ? 800 : 300;
    const base = box('deck', [-10000, 0, -2000], [10000, 2000, 22000]);
    const add = (name, obstacles, options = {}) => {
      const y = options.y ?? 2000;
      const actor = {
        id: 'subject',
        type,
        role: 'civilian',
        position: v(0, y, 0),
        path: [v(0, y, 0), v(0, y, 18000)],
        speed: type === 'vehicle' ? 700 : 300,
        radius,
        height: type === 'vehicle' ? 1200 : 1800,
        fireEveryTicks: 0,
        damage: 0,
      };
      cases.push({
        name: `${type}/${name}`,
        expect: options.expect ?? 'travel',
        surface: options.surface ?? 'deck',
        minTravel: options.minTravel ?? (type === 'vehicle' ? 40000 : 17000),
        course: {
          format: 'FlightCourse.v2',
          id: `ground-motion-${cases.length + 1}`,
          revision: 'r1',
          environment: 'container-yard',
          world: { id: 'ground-motion', theme: 'operations', style: 'container-yard' },
          locales: {
            en: {
              title: 'Ground movement diagnostic',
              brief: 'Observe actual actor movement.',
              lesson: 'No completion claim.',
            },
            uk: {
              title: 'Діагностика наземного руху',
              brief: 'Спостерігайте справжній рух актора.',
              lesson: 'Без заяви про завершення.',
            },
          },
          spawn: v(-15000, 250, -8000),
          bounds: { min: v(-20000, 0, -10000), max: v(20000, 20000, 25000) },
          obstacles,
          actors: [actor],
          steps: Object.fromEntries(
            ['self-level', 'acro'].map((mode) => [
              mode,
              [
                {
                  type: 'hold',
                  min: v(-1000, 15000, -1000),
                  max: v(1000, 17000, 1000),
                  ticks: 50,
                  maxSpeed: 500,
                  maxTilt: 1000,
                  minTilt: 0,
                  centred: false,
                  heading: null,
                },
              ],
            ]),
          ),
          rules: { maxTicks: 10000 },
        },
        ...options,
      });
    };
    add('half-space', [], { y: 0, surface: '$floor' });
    add('finite-flat', [base]);
    add('narrow-finite', [box('deck', [-1000, 0, -2000], [1000, 2000, 22000])]);
    add('wall', [base, box('wall', [-2000, 2000, 8000], [2000, 6000, 9000])], {
      expect: 'stop',
      maxZ: 8000 - radius,
      minZ: 7500 - radius,
    });
    add('ledge', [box('deck', [-10000, 0, -2000], [10000, 2000, 9000])], {
      expect: 'stop',
      maxZ: 9000,
      minZ: 8500,
    });
    add(
      'wide-gap',
      [
        box('deck', [-10000, 0, -2000], [10000, 2000, 9000]),
        box('other-deck', [-10000, 0, 11000], [10000, 2000, 22000]),
      ],
      { expect: 'stop', maxZ: 9000, minZ: 8500 },
    );
    const upper = box('upper', [-10000, 5200, -2000], [10000, 5500, 22000]);
    add('stacked-lower', [base, upper]);
    add('stacked-upper', [base, upper], { y: 5500, surface: 'upper' });
    const height = type === 'vehicle' ? radius * 2 : 1800;
    add(
      'tight-ceiling',
      [
        base,
        box('ceiling', [-10000, 2000 + height + 5, -2000], [10000, 2000 + height + 505, 22000]),
      ],
      { expect: 'stop', maxZ: 0, minZ: 0, allowOriginal: true },
    );
    add('step', [base, box('step', [-10000, 2000, 6000], [10000, 2150, 12000])], {
      surface: null,
      minTravel: type === 'vehicle' ? 38000 : 15000,
    });
    add('step-down', [base, box('step', [-10000, 2000, -2000], [10000, 2150, 6000])], {
      y: 2150,
      surface: null,
      minTravel: type === 'vehicle' ? 38000 : 15000,
    });
    cases.at(-1).course.actors[0].path = [v(0, 2150, 0), v(0, 2000, 18000)];
    add(
      'thin-ceiling',
      [base, box('ceiling', [-10000, 2000 + height + 5, -2000], [10000, 2000 + height + 7, 22000])],
      { expect: 'stop', maxZ: 0, minZ: 0, allowOriginal: true },
    );
    add(
      'fast-gap',
      [
        box('deck', [-10000, 0, -2000], [10000, 2000, 9000]),
        box('other-deck', [-10000, 0, 9220], [10000, 2000, 22000]),
      ],
      { expect: 'stop', maxZ: 9000, minZ: 8500 },
    );
    Object.assign(cases.at(-1).course.actors[0], {
      radius: 100,
      height: type === 'vehicle' ? 200 : 1800,
      speed: 15000,
      position: v(0, 2000, 8990),
      path: [v(0, 2000, 8990), v(0, 2000, 18000)],
    });

    for (const angle of [15, 29.9, 30.1]) {
      const radians = (angle * Math.PI) / 180;
      const tangent = Math.tan(radians),
        endY = Math.round(2000 + 24000 * tangent);
      const slope = {
        id: 'ramp',
        type: 'trimesh',
        vertices: [
          -10000,
          2000,
          -2000,
          10000,
          2000,
          -2000,
          -10000,
          endY,
          22000,
          10000,
          endY,
          22000,
        ],
        indices: [0, 2, 1, 1, 2, 3],
      };
      const feet = (z) =>
        Math.ceil(
          2000 + ((z + 2000) * (endY - 2000)) / 24000 + radius / Math.cos(radians) - radius,
        );
      add(`slope-${angle}`, [slope], {
        y: feet(0),
        surface: 'ramp',
        expect: angle > 30 ? 'stop' : 'travel',
        minZ: 0,
        maxZ: 30,
        minTravel: type === 'vehicle' ? 35000 : 14000,
      });
      cases.at(-1).course.actors[0].path = [v(0, feet(0), 0), v(0, feet(18000), 18000)];
      if (angle <= 30) {
        add(`slope-${angle}-downhill`, [slope], {
          y: feet(18000),
          surface: 'ramp',
          minTravel: type === 'vehicle' ? 35000 : 14000,
        });
        let actor = cases.at(-1).course.actors[0];
        actor.position = v(0, feet(18000), 18000);
        actor.path = [{ ...actor.position }, v(0, feet(0), 0)];
        const solid = box('solid-slope', [-10000, 7800, -2000], [10000, 8200, 22000]);
        solid.rotation = [-Math.sin(radians / 2), 0, 0, Math.cos(radians / 2)];
        const solidFeet = (z) =>
          Math.ceil(
            8000 +
              200 / Math.cos(radians) +
              (z - 10000) * tangent +
              radius / Math.cos(radians) -
              radius,
          );
        add(`solid-slope-${angle}`, [solid], {
          y: solidFeet(0),
          surface: 'solid-slope',
          minTravel: type === 'vehicle' ? 35000 : 14000,
        });
        actor = cases.at(-1).course.actors[0];
        actor.path = [v(0, solidFeet(0), 0), v(0, solidFeet(18000), 18000)];
      }
      if (angle <= 30) {
        add(`slope-${angle}-sideways`, [slope], {
          y: feet(10000),
          surface: 'ramp',
          minTravel: type === 'vehicle' ? 39000 : 16000,
        });
        const actor = cases.at(-1).course.actors[0];
        actor.position = v(-8000, feet(10000), 10000);
        actor.path = [{ ...actor.position }, v(8000, feet(10000), 10000)];
      }
    }
  }
  return cases;
}
