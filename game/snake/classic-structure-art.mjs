/** Original editable 28px construction kit. Draw commands are the source art;
 * shared material textures remain supplied by classic-scenes. No bitmap cache,
 * randomness, simulation mutation or decoration outside accepted wall cells. */
export const CLASSIC_STRUCTURE_REVISION = 'modular-dioramas-v1';
export const CLASSIC_STRUCTURE_FAMILIES = Object.freeze({
  orchard: Object.freeze(['glasshouse', 'planter', 'irrigator']),
  freight: Object.freeze(['container', 'platform', 'dispatch']),
  workshop: Object.freeze(['boiler', 'coolant', 'pressure']),
  harbor: Object.freeze(['pump', 'floodgate', 'dock']),
  relay: Object.freeze(['antenna', 'shelter', 'receiver']),
  quarry: Object.freeze(['terrace', 'excavation', 'reclaimer']),
});
const aliases = { crane: 'platform', masonry: 'terrace', wall: 'excavation' };
const box = (c, ink, x, y, w, h) => {
  c.fillStyle = ink;
  c.fillRect(x, y, w, h);
};

export function classicStructureModule(wall, scene, { structure, composition = {} } = {}) {
  const families = CLASSIC_STRUCTURE_FAMILIES[scene] ?? CLASSIC_STRUCTURE_FAMILIES.quarry;
  const requested =
    composition.assembly?.family ?? aliases[composition.structure] ?? composition.structure;
  const bounds = structure ?? { ...wall, width: 1, height: 1 };
  const family = families.includes(requested)
    ? requested
    : families[
        Math.min(bounds.width, bounds.height) === 1 ? 1 : bounds.width > bounds.height ? 0 : 2
      ];
  const focus = composition.assembly?.footprint;
  const landmarkBounds = focus
    ? { x: focus[0], y: focus[1], width: focus[2], height: focus[3] }
    : bounds;
  return {
    family,
    column: wall.x - bounds.x,
    row: wall.y - bounds.y,
    width: bounds.width,
    height: bounds.height,
    landmarkX:
      composition.assembly?.anchor?.[0] ??
      landmarkBounds.x + Math.floor((landmarkBounds.width - 2) / 2),
    landmarkY:
      composition.assembly?.anchor?.[1] ??
      landmarkBounds.y + Math.floor((landmarkBounds.height - 2) / 2),
    landmark:
      (!composition.assembly || !!focus) && landmarkBounds.width >= 2 && landmarkBounds.height >= 2,
  };
}

/** Only native cell dimensions are used. A long container repeats ribs; it
 * never stretches a bolt or a window to the full component bounding rectangle. */
export function drawClassicStructureModule(ctx, wall, scene, options = {}) {
  const { treatment = 'living-circuit', composition = {}, occupied = new Set(), palette } = options;
  const m = classicStructureModule(wall, scene, options);
  const night = treatment === 'night-arcade',
    toy = treatment === 'toybox',
    ruin = treatment === 'atmospheric-ruins';
  const dark = night ? '#142434' : ruin ? '#34413b' : '#293e3b';
  const light = night ? '#7ae3dc' : toy ? '#fff0bf' : '#d3d6b4';
  const metal = night ? '#476e83' : toy ? '#d09160' : '#8ea9a0';
  const copper = night ? '#e29dac' : '#c48a56';
  const green = night ? '#406c61' : '#6c9359';
  const put = (ink, x, y, w, h) => box(ctx, ink, x, y, w, h);
  // Repeating panels join across the cell seam; external caps are drawn by caller.
  if (toy) {
    drawToyConstruction(ctx, scene, m);
  } else if (m.family === 'glasshouse') {
    // A continuous roof with native-sized rafters, never a grid of tiny houses.
    const lower = m.row >= Math.ceil(m.height / 2);
    put(night ? '#264754' : lower ? '#658777' : '#8ba391', 0, 0, 28, 28);
    if (m.column % 2 === 0) put(metal, 13, 0, 2, 28);
    if (m.row === Math.floor(m.height / 2)) {
      put(light, 0, 0, 28, 2);
      put('#526e66', 0, 2, 28, 1);
    }
    if (m.row === 0) put('#bdcfb0', 3, 4, 18, 2);
    if (m.row === m.height - 1 && m.column % 2 === 1) put('#47673f', 5, 19, 16, 5);
  } else if (m.family === 'planter') {
    put(toy ? '#ab6845' : '#77523a', 1, 1, 26, 26);
    put('#354b31', 4, 4, 20, 20);
    for (const y of [6, 16])
      for (const x of [6, 16]) {
        put('#46663c', x, y, 7, 7);
        put(green, x + 1, y, 5, 4);
        put('#baca7e', x + 2, y, 2, 2);
        put('#e8b35c', x + 3, y + 4, 2, 2);
      }
  } else if (m.family === 'pump') {
    // One connected pump house, not a control unit stamped on every wall cell.
    // The single 2×2 landmark below is its focal pump; quieter casing and one
    // continuous intake trunk let the entire island read at mobile cell sizes.
    put(night ? '#264b56' : ruin ? '#65766d' : '#789f95', 0, 0, 28, 28);
    if (m.row >= Math.ceil(m.height / 2))
      put(night ? '#203d4b' : ruin ? '#55665f' : '#5d817b', 0, 0, 28, 28);
    if (m.row === 0) put(light, 0, 2, 28, 3);
    if (m.row === m.height - 1) put(dark, 0, 24, 28, 3);
    if (m.column === 0) put(metal, 2, 0, 3, 28);
    if (m.column === m.width - 1) put(dark, 24, 0, 3, 28);
    const intakeRow = m.landmark ? m.landmarkY - (wall.y - m.row) + 1 : Math.floor(m.height / 2);
    if (m.row === intakeRow) {
      put('#36595b', 0, 11, 28, 8);
      put('#a5c3ae', 0, 11, 28, 2);
    }
    if (!m.landmark && m.column === Math.floor(m.width / 2) && m.row === intakeRow) {
      put(copper, 8, 7, 12, 15);
      put(dark, 10, 9, 8, 11);
      put(light, 11, 10, 6, 2);
    }
  } else if (['irrigator', 'coolant'].includes(m.family)) {
    put(dark, 2, 2, 24, 24);
    put('#467e77', 0, 10, 28, 8);
    put('#a5c3ae', 0, 10, 28, 2);
    put(metal, 11, 0, 6, 28);
    put(light, 11, 0, 1, 28);
    put(copper, 9, 8, 10, 12);
    put(dark, 11, 10, 6, 8);
    put(light, 12, 11, 4, 2);
    put(copper, 12, 16, 4, 2);
  } else if (m.family === 'container') {
    put(night ? '#293d59' : '#9e5746', 1, 1, 26, 26);
    for (let x = 4; x < 26; x += 6) {
      put('#643f39', x, 0, 2, 28);
      put(copper, x + 2, 0, 1, 28);
    }
    if (m.column === 0) {
      put(metal, 3, 3, 3, 22);
      put(light, 4, 9, 6, 2);
    }
    if (m.column === m.width - 1) {
      put(metal, 22, 3, 3, 22);
      put(light, 18, 18, 6, 2);
    }
  } else if (['platform', 'dock'].includes(m.family)) {
    put(metal, 2, 2, 24, 24);
    put(dark, 4, 4, 20, 20);
    for (let y = 6; y < 24; y += 5) {
      put('#7a9792', 4, y, 20, 2);
      put(light, 4, y, 20, 1);
    }
    put(m.family === 'dock' ? '#ca8370' : '#d5b567', 1, 1, 5, 5);
    put(dark, 2, 2, 2, 2);
    put(dark, 23, 23, 2, 2);
  } else if (['dispatch', 'shelter', 'receiver'].includes(m.family)) {
    put(m.family === 'dispatch' ? copper : light, 2, 2, 24, 24);
    put(dark, 5, 5, 18, 11);
    put('#6f99a1', 7, 6, 14, 8);
    put(light, 8, 7, 5, 2);
    put(metal, 13, 5, 2, 11);
    for (let x = 6; x < 22; x += 4) put(dark, x, 20, 2, 4);
    put('#d8b45c', 22, 18, 3, 4);
  } else if (m.family === 'boiler' || m.family === 'pressure') {
    // One joined pressure assembly: quiet sheet metal inside, external ribs
    // and a single inspection port. Never a tiny boiler repeated in every cell.
    put(night ? '#513f4e' : ruin ? '#786b56' : '#b77e50', 0, 0, 28, 28);
    if (m.column === 0) {
      put('#e6b581', 2, 0, 3, 28);
      put(metal, 0, 0, 2, 28);
    }
    if (m.column === m.width - 1) {
      put('#7b5442', 23, 0, 3, 28);
      put(metal, 26, 0, 2, 28);
    }
    if (m.row === 0 || m.row === m.height - 1) {
      const y = m.row === 0 ? 1 : 24;
      put(metal, 0, y, 28, 3);
      put(light, 0, y, 28, 1);
    }
    if (m.row === Math.floor(m.height / 2)) {
      put('#8f6145', 0, 13, 28, 2);
      if (m.family === 'pressure') put(metal, 0, 11, 28, 2);
      if (m.column === Math.floor(m.width / 2)) {
        put(dark, 9, 7, 12, 13);
        put(light, 11, 9, 8, 8);
        put('#a65f46', 14, 9, 2, 6);
      }
    }
  } else if (m.family === 'floodgate') {
    put(dark, 2, 2, 24, 24);
    for (let x = 4; x < 25; x += 5) {
      put(metal, x, 0, 3, 28);
      put(light, x, 0, 1, 28);
    }
    put('#bd7963', 0, 11, 28, 5);
    put(copper, 0, 11, 28, 1);
  } else if (m.family === 'antenna') {
    put(dark, 2, 2, 24, 24);
    put(metal, 12, 0, 4, 28);
    put(metal, 0, 12, 28, 4);
    put(light, 10, 10, 8, 8);
    put('#b98650', 12, 12, 4, 4);
    for (const x of [4, 21]) {
      put(light, x, 4, 2, 5);
      put(light, x, 19, 2, 5);
    }
  } else if (m.family === 'reclaimer') {
    put(dark, 2, 2, 24, 24);
    put('#768569', 4, 4, 20, 20);
    put(copper, 5, 8, 18, 4);
    put(metal, 8, 5, 4, 18);
    put('#303f38', 13, 14, 9, 8);
    put(green, 17, 18, 7, 6);
  } else {
    put('#909e88', 2, 2, 24, 24);
    put('#46534b', 0, 13, 28, 2);
    put(light, 0, 2, 28, 1);
    put('#46534b', m.row % 2 ? 18 : 9, 0, 2, 13);
    put('#46534b', m.row % 2 ? 9 : 18, 15, 2, 13);
    if (m.family === 'terrace') {
      put(green, 4, 17, 8, 7);
      put('#a3b581', 5, 17, 5, 2);
    } else {
      put('#b8a37e', 17, 17, 6, 6);
      put('#e2cba1', 18, 18, 3, 2);
    }
  }
  if (treatment === 'theme' || treatment === 'retro') {
    put(treatment === 'retro' ? '#aac693' : '#c4d2c5', 3, 3, 8, 1);
    put(dark, 23, 19, 2, 6);
  }
  if (toy) {
    // Fittings only at exposed component corners, avoiding tiny repeated frames.
    const left = !occupied.has(`${wall.x - 1},${wall.y}`);
    const right = !occupied.has(`${wall.x + 1},${wall.y}`);
    const top = !occupied.has(`${wall.x},${wall.y - 1}`);
    const bottom = !occupied.has(`${wall.x},${wall.y + 1}`);
    for (const [a, b, visible] of [
      [3, 3, left && top],
      [22, 3, right && top],
      [3, 22, left && bottom],
      [22, 22, right && bottom],
    ])
      if (visible) {
        put('#ffedbd', a, b, 3, 3);
        put('#856e4a', a + 1, b + 1, 1, 1);
      }
  } else if (ruin) {
    put('#243c35', 17, 3, 2, 5);
    put('#243c35', 15, 7, 3, 2);
    put('#243c35', 14, 9, 2, 5);
    put('#42664c', 2, 19, 5, 7);
    put('#87a071', 3, 21, 3, 3);
  } else if (night) {
    put(palette?.accent ?? '#91e1d0', 3, 3, 7, 1);
    put('#d9a0d3', 24, 18, 1, 7);
  }
  // A true fixed-scale 2×2 assembly, only on four contiguous solid cells.
  // Irregular holes cannot accidentally receive floating equipment.
  if (
    m.landmark &&
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ].every(([x, y]) => occupied.has(`${m.landmarkX + x},${m.landmarkY + y}`))
  ) {
    ctx.save();
    ctx.translate((m.landmarkX - wall.x) * 28, (m.landmarkY - wall.y) * 28);
    const focal = Math.abs(wall.x - m.landmarkX) <= 1 && Math.abs(wall.y - m.landmarkY) <= 1;
    if (focal)
      drawLandmark(
        ctx,
        scene,
        { dark, light, metal, copper, green, night, toy, ruin },
        composition,
      );
    ctx.restore();
  }
}

function drawToyConstruction(ctx, scene, m) {
  const paint = (ink, x, y, w, h) => box(ctx, ink, x, y, w, h);
  const tones = {
    orchard: ['#689b92', '#8db9a4', '#e8d2a1'],
    freight: ['#d08068', '#e5a084', '#edd4a4'],
    workshop: ['#bd9362', '#dab47b', '#759f9c'],
    harbor: ['#69a3a0', '#90c3b4', '#efd0a3'],
    relay: ['#859eb3', '#acbdc8', '#edcc8f'],
    quarry: ['#8da38a', '#b9c5a4', '#dbbc8a'],
  }[scene] ?? ['#859c99', '#b6c6b1', '#dec492'];
  paint(m.row < Math.ceil(m.height / 2) ? tones[1] : tones[0], 0, 0, 28, 28);
  if (m.row === Math.floor(m.height / 2)) paint(tones[2], 0, 0, 28, 3);
  if (m.column === 0) paint('#e5c58e', 2, 0, 3, 28);
  if (m.column === m.width - 1) paint('#ab7953', 24, 0, 2, 28);
  if (m.row === 0) paint('#f4ddac', 0, 2, 28, 2);
  if (m.row === m.height - 1) paint('#9e7554', 0, 24, 28, 2);
  if (m.width === 1 || m.height === 1) {
    paint(tones[2], 8, 9, 12, 10);
    paint('#fbefd0', 9, 10, 9, 2);
    if (['irrigator', 'coolant', 'pump', 'floodgate'].includes(m.family))
      paint('#527b7a', 12, 0, 4, 28);
    else if (m.family === 'planter') {
      paint('#526e49', 8, 8, 12, 12);
      paint('#a4bf76', 10, 9, 8, 4);
    } else paint('#8a7557', 12, 14, 4, 3);
  }
}

function drawLandmark(c, scene, p) {
  const r = (ink, x, y, w, h) => box(c, ink, x, y, w, h);
  // Coordinates always span 56 native pixels, never a scaled component box.
  if (p.toy) {
    const colors = {
      orchard: ['#e8d7ad', '#57968b'],
      freight: ['#f2cca0', '#bd6e60'],
      workshop: ['#efd4a0', '#bc9569'],
      harbor: ['#f0dcb6', '#6ba49d'],
      relay: ['#f2d6a6', '#829daf'],
      quarry: ['#dbd4b1', '#8eaa7d'],
    }[scene] ?? ['#e8d7ad', '#57968b'];
    r('#79583c', 10, 10, 36, 38);
    r(colors[0], 9, 8, 38, 38);
    r(colors[1], 13, 12, 30, 30);
    r('#fff1cd', 10, 9, 35, 3);
    if (scene === 'orchard') {
      r('#b8d3bd', 16, 15, 24, 11);
      r(colors[0], 26, 12, 3, 30);
      r(colors[0], 13, 27, 30, 3);
    } else if (scene === 'relay') {
      r(colors[0], 17, 17, 22, 5);
      r(colors[0], 17, 34, 22, 5);
      r(colors[0], 17, 22, 5, 12);
      r(colors[0], 34, 22, 5, 12);
      r('#eab65e', 25, 25, 6, 6);
    } else if (scene === 'workshop') {
      r('#eac98a', 18, 14, 20, 26);
      r('#577d79', 13, 20, 30, 5);
      r('#eef0c9', 25, 26, 10, 9);
      r('#a57654', 29, 27, 2, 6);
    } else if (scene === 'harbor') {
      for (const y of [16, 24, 32]) r('#c4dfc5', 17, y, 23, 4);
      r('#d89174', 13, 25, 30, 4);
    } else if (scene === 'freight') {
      r('#eeb899', 17, 17, 10, 22);
      r('#efc6a5', 30, 17, 10, 22);
      r('#ffefc9', 18, 19, 6, 3);
    } else {
      r('#ccd8a9', 17, 17, 22, 22);
      r('#6f8b62', 22, 22, 12, 12);
      r('#aecd8b', 24, 24, 8, 3);
    }
    return;
  }
  if (scene === 'orchard') {
    r(p.dark, 8, 8, 40, 40);
    r('#698f78', 11, 11, 34, 34);
    for (const x of [11, 27, 43]) r(p.light, x, 9, 2, 38);
    for (const y of [11, 27, 43]) r(p.metal, 9, y, 38, 2);
    r('#b7cfad', 14, 14, 10, 3);
    r('#496640', 15, 34, 8, 8);
    r('#deb65c', 18, 35, 3, 3);
  } else if (scene === 'freight') {
    r(p.dark, 8, 8, 40, 40);
    r(p.copper, 10, 10, 36, 12);
    r(p.light, 12, 12, 32, 2);
    r('#678990', 12, 26, 14, 18);
    r('#415b63', 30, 26, 14, 18);
    r('#cfb475', 10, 23, 36, 2);
    r('#dbe0c8', 16, 29, 6, 3);
    r('#dbe0c8', 34, 29, 6, 3);
  } else if (scene === 'workshop') {
    r(p.dark, 8, 8, 40, 40);
    r(p.copper, 13, 8, 30, 40);
    r('#e4bb88', 15, 11, 4, 32);
    r(p.metal, 9, 17, 38, 5);
    r(p.metal, 9, 37, 38, 5);
    r(p.dark, 24, 23, 14, 12);
    r(p.light, 26, 25, 10, 8);
    r('#a76648', 30, 25, 2, 6);
  } else if (scene === 'harbor') {
    r(p.dark, 8, 8, 40, 40);
    r('#6caa9b', 11, 11, 34, 34);
    for (let y = 15; y < 43; y += 7) {
      r('#36595b', 15, y, 26, 4);
      r(p.light, 15, y, 26, 1);
    }
    r('#db9881', 7, 25, 42, 6);
    r('#e6b194', 9, 25, 38, 2);
  } else if (scene === 'relay') {
    r(p.dark, 8, 8, 40, 40);
    r(p.metal, 25, 9, 6, 38);
    r(p.metal, 9, 25, 38, 6);
    r(p.light, 14, 14, 28, 5);
    r(p.light, 14, 37, 28, 5);
    r(p.light, 14, 19, 5, 18);
    r(p.light, 37, 19, 5, 18);
    r('#bd995d', 23, 23, 10, 10);
    r('#e2c782', 25, 25, 6, 6);
  } else {
    r('#ccd0b1', 8, 8, 40, 40);
    r('#4b6351', 12, 12, 32, 32);
    r('#a4b291', 16, 16, 24, 24);
    r('#354a40', 20, 20, 16, 16);
    r(p.green, 23, 23, 10, 10);
    r('#acc282', 24, 24, 7, 3);
  }
  if (p.toy) {
    r('#fff1be', 9, 9, 38, 2);
    r('#ac6a47', 9, 45, 38, 2);
  }
  if (p.ruin) {
    r('#263b35', 37, 10, 3, 10);
    r('#263b35', 34, 18, 5, 3);
    r('#7d9868', 9, 37, 8, 10);
  }
  if (p.night) {
    r('#85ded8', 10, 9, 24, 1);
    r('#d198c7', 46, 27, 1, 19);
  }
}
