// Synthetic bounded contract fixture, not a published Harbor course or proof.
export function diagnosticCourse(groundMotion) {
  const actor = {
    id: "deck-guide",
    type: "patrol",
    role: "civilian",
    position: { x: 4000, y: 2000, z: 0 },
    path: [
      { x: 4000, y: 2000, z: 0 },
      { x: 4000, y: 2000, z: 6000 },
    ],
    speed: 700,
    radius: 300,
    height: 1800,
    fireEveryTicks: 0,
  };
  if (groundMotion !== undefined) actor.groundMotion = groundMotion;
  const land = {
    type: "land",
    min: { x: -1000, y: 0, z: -1000 },
    max: { x: 1000, y: 800, z: 1000 },
    ticks: 150,
    maxSpeed: 700,
    maxTilt: 4000,
    minTilt: 0,
    centred: false,
    heading: null,
  };
  return {
    format: "FlightCourse.v2",
    id: "ground-motion-contract",
    revision: "r1",
    environment: "ground-motion-contract",
    world: {
      id: "ground-motion-contract-world",
      theme: "academy",
      style: "warehouse",
    },
    locales: {
      en: {
        title: "Ground movement contract",
        brief: "Remain landed while the guide moves on the deck.",
        lesson: "Diagnostic movement contract; no published world.",
      },
      uk: {
        title: "Контракт наземного руху",
        brief: "Залишайтеся на землі, поки провідник рухається палубою.",
        lesson: "Діагностичний контракт руху; не опублікований світ.",
      },
    },
    spawn: { x: 0, y: 0, z: 0 },
    bounds: {
      min: { x: -12000, y: 0, z: -12000 },
      max: { x: 12000, y: 12000, z: 12000 },
    },
    obstacles: [
      {
        id: "finite-deck",
        min: { x: 2000, y: 0, z: -2000 },
        max: { x: 6000, y: 2000, z: 8000 },
      },
    ],
    actors: [actor],
    steps: { "self-level": [land], acro: [structuredClone(land)] },
    rules: { seed: 1, maxTicks: 500 },
    conditions: { profile: "clear", revision: "r1" },
  };
}
