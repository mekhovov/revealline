export const OVERFLIGHT_FIELD_KIT_IDS = Object.freeze([
  'pickup.salvage-small',
  'pickup.salvage-cluster',
  'pickup.supply-case-closed',
  'pickup.supply-case-open',
  'pickup.support-marker',
  'pickup.module-primary',
  'pickup.module-slow-field',
  'pickup.module-proximity-pulse',
  'pickup.module-side-burst',
  'pickup.module-scanner',
  'pickup.module-shield',
  'pickup.overflight-impact',
  'pickup.overflight-warning',
]);

/** Reusable, original field equipment on a native 16-pixel grid. Neither this
 * artwork nor its Studio slot declares a pickup, damage radius or collision. */
export function overflightFieldKitArt(slotId, { size = 16, tokens = {} } = {}) {
  if (!OVERFLIGHT_FIELD_KIT_IDS.includes(slotId)) return null;
  if (!Number.isInteger(size) || size < 8 || size > 256)
    throw new RangeError('Field equipment artwork needs an 8–256 pixel size.');
  const palette = {
    ink: '#162621',
    steel: '#a4b4ab',
    light: '#e4e6ce',
    olive: '#64784d',
    shade: '#344f3d',
    amber: '#edc363',
    cyan: '#8ce1d3',
    blue: '#527da0',
    rust: '#bc7156',
    ...tokens,
  };
  const rgba = new Uint8ClampedArray(size * size * 4);
  const rect = (x, y, width, height, color) => {
    const hex = palette[color] ?? color;
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new TypeError('Field equipment colors need hex RGB.');
    const pixel = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).concat(255);
    for (let py = Math.floor((y * size) / 16); py < Math.ceil(((y + height) * size) / 16); py++)
      for (let px = Math.floor((x * size) / 16); px < Math.ceil(((x + width) * size) / 16); px++)
        if (px >= 0 && py >= 0 && px < size && py < size) rgba.set(pixel, (py * size + px) * 4);
  };
  const salvage = (x, y) => {
    rect(x + 1, y, 3, 1, 'ink');
    rect(x, y + 1, 5, 4, 'ink');
    rect(x + 1, y + 5, 3, 1, 'ink');
    rect(x + 1, y + 1, 3, 3, 'amber');
    rect(x + 1, y + 1, 2, 1, 'light');
    rect(x + 2, y + 4, 2, 1, 'rust');
  };
  const caseBody = () => {
    rect(2, 4, 12, 9, 'ink');
    rect(3, 5, 10, 7, 'olive');
    rect(3, 5, 10, 1, 'steel');
    rect(3, 10, 10, 2, 'shade');
    rect(5, 4, 2, 9, 'ink');
    rect(10, 4, 1, 9, 'ink');
    rect(6, 7, 4, 2, 'amber');
    rect(7, 7, 2, 1, 'light');
  };
  if (slotId === 'pickup.salvage-small') salvage(5, 5);
  else if (slotId === 'pickup.salvage-cluster') {
    salvage(3, 6);
    salvage(8, 6);
    salvage(6, 2);
  } else if (slotId.startsWith('pickup.supply-case-')) {
    caseBody();
    if (slotId.endsWith('-open')) {
      rect(2, 1, 12, 4, 'ink');
      rect(3, 2, 10, 2, 'shade');
      rect(3, 6, 10, 5, 'ink');
      rect(4, 7, 3, 2, 'cyan');
      rect(9, 7, 3, 2, 'amber');
    }
  } else if (slotId === 'pickup.support-marker') {
    rect(4, 2, 8, 12, 'ink');
    rect(5, 3, 6, 10, 'olive');
    rect(7, 4, 2, 8, 'light');
    rect(5, 7, 6, 2, 'light');
    rect(5, 12, 6, 1, 'shade');
  } else if (slotId === 'pickup.overflight-impact') {
    for (const [x, y, w, h] of [
      [7, 1, 2, 14],
      [1, 7, 14, 2],
      [4, 4, 8, 8],
    ])
      rect(x, y, w, h, 'amber');
    rect(5, 5, 6, 6, 'light');
    rect(7, 6, 2, 4, 'cyan');
  } else if (slotId === 'pickup.overflight-warning') {
    for (let row = 0; row < 11; row++)
      rect(7 - Math.floor(row / 2), 2 + row, 2 + Math.floor(row / 2) * 2, 1, 'ink');
    for (let row = 0; row < 8; row++)
      rect(7 - Math.floor(row / 2), 4 + row, 2 + Math.floor(row / 2) * 2, 1, 'amber');
    rect(7, 5, 2, 4, 'ink');
    rect(7, 10, 2, 1, 'ink');
  } else {
    rect(3, 2, 10, 12, 'ink');
    rect(4, 3, 8, 10, 'shade');
    rect(4, 3, 8, 1, 'steel');
    rect(4, 12, 8, 1, 'olive');
    const id = slotId.slice('pickup.module-'.length);
    if (id === 'primary') {
      rect(7, 5, 2, 5, 'amber');
      rect(6, 10, 4, 1, 'light');
    }
    if (id === 'slow-field') {
      rect(5, 6, 6, 1, 'cyan');
      rect(5, 9, 6, 1, 'cyan');
      rect(7, 5, 2, 6, 'steel');
    }
    if (id === 'proximity-pulse') {
      rect(5, 6, 1, 4, 'cyan');
      rect(10, 6, 1, 4, 'cyan');
      rect(6, 5, 4, 1, 'cyan');
      rect(6, 10, 4, 1, 'cyan');
      rect(7, 7, 2, 2, 'light');
    }
    if (id === 'side-burst') {
      rect(7, 6, 2, 4, 'amber');
      rect(4, 7, 2, 2, 'light');
      rect(10, 7, 2, 2, 'light');
    }
    if (id === 'scanner') {
      rect(7, 7, 2, 4, 'cyan');
      rect(5, 5, 6, 1, 'steel');
      rect(10, 6, 1, 3, 'steel');
      rect(7, 6, 2, 2, 'light');
    }
    if (id === 'shield') {
      rect(5, 5, 6, 4, 'cyan');
      rect(6, 9, 4, 1, 'cyan');
      rect(7, 10, 2, 1, 'cyan');
      rect(7, 6, 2, 3, 'light');
    }
  }
  return { width: size, height: size, rgba };
}
