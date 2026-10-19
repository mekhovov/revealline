// Presentation only. These illustrative colors and blade counts never enter
// controller configuration, collision geometry, recording hashes or scoring.
// Mobula8 colors follow the civilian Home Pilot product photograph; other
// aircraft use an illustrative SIM palette. Shapes are not manufacturer CAD replicas.
const defaults = Object.freeze({
  frameColor: '#25313b',
  canopyColor: '#60c5e5',
  propColor: '#a1d9e7',
  bladeCount: 3,
  style: 'open',
  underslungBattery: false,
  canopy: false,
});
const whoops = new Set([
  'air65-ii-racing-2026',
  'meteor75-analog-2022',
  'meteor75-pro-matrix',
  'meteor85-analog',
  'pavo20-pro-ii-o4-4s',
  'mobula8-analog-2023',
  'cetus-x-betaflight-2022',
  'protos-16-aio-1-0',
]);
const twoBlades = new Set(['meteor75-analog-2022', 'meteor85-analog', 'holybro-x650-v2']);

export function aircraftAppearance(id) {
  return {
    ...defaults,
    style: whoops.has(id) ? 'whoop' : 'open',
    bladeCount: twoBlades.has(id) ? 2 : 3,
    ...(id === 'mobula8-analog-2023'
      ? {
          frameColor: '#30343b',
          canopyColor: '#f06632',
          propColor: '#bac1c8',
          underslungBattery: true,
          canopy: true,
        }
      : {}),
    ...(id === 'cetus-x-betaflight-2022'
      ? {
          frameColor: '#e5e8e7',
          canopyColor: '#5695bd',
          propColor: '#80bde0',
          bladeCount: 4,
          underslungBattery: true,
          canopy: true,
        }
      : {}),
    ...(id === 'protos-16-aio-1-0'
      ? {
          frameColor: '#d7d9dc',
          canopyColor: '#e8c34d',
          propColor: '#333940',
          canopy: true,
        }
      : {}),
  };
}
