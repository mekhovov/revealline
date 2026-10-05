/** Data-only practice fixture; not installed in the production catalogue. */
export function momentumPracticeCourse() {
  const point = (x, z) => ({ x, y: 0, z });
  const actor = (id, x, z) => ({
    id,
    type: 'patrol',
    role: 'hostile',
    position: point(x, z),
    path: [point(x + 3000, z), point(x - 3000, z)],
    speed: 750,
    radius: 420,
    height: 2000,
    health: 50,
    fireEveryTicks: 0,
    damage: 0,
  });
  const criterion = {
    type: 'hunt-contact-v1',
    contactPolicy: 'retain-momentum-v1',
    targets: ['runner-01', 'runner-02'],
    ordered: true,
    tail: { linksPerCatch: 0, maxLinks: 0, neckDistance: 4500, radius: 350 },
  };
  return {
    format: 'FlightCourse.v2',
    id: 'momentum-contact-practice-01',
    revision: 'r1',
    environment: 'stadium',
    locales: {
      en: {
        title: 'Keep moving after the catch',
        brief:
          'Touch the two marked fictional runners in order. Successful catches retain momentum.',
        lesson:
          'Use normal manual flight controls. Catch 01 before 02, then keep flying for half a second. Wrong-order targets and solid obstacles still stop the drone. This practice has no weapons or echo tail.',
      },
      uk: {
        title: 'Рух після дотику',
        brief:
          'Торкніться двох позначених вигаданих бігунів по черзі. Успішний дотик зберігає швидкість.',
        lesson:
          'Керуйте звичайними ручними командами. Спіймайте 01 перед 02, потім летіть ще пів секунди. Цілі поза чергою та тверді перешкоди й далі зупиняють дрон. У цій вправі немає зброї та хвоста.',
      },
    },
    spawn: { x: 0, y: 1000, z: 8000 },
    bounds: { min: { x: -20000, y: 0, z: -20000 }, max: { x: 20000, y: 12000, z: 20000 } },
    obstacles: [],
    actors: [actor('runner-01', 0, -4000), actor('runner-02', 8000, -11000)],
    steps: {
      'self-level': [criterion, { type: 'survive', ticks: 25 }],
      acro: [structuredClone(criterion), { type: 'survive', ticks: 25 }],
    },
    world: { id: 'stadium', theme: 'pixel', style: 'stadium' },
    rules: { seed: 9301, maxTicks: 8000, collisionDamage: 7 },
    conditions: { profile: 'clear', revision: 'r1' },
  };
}
