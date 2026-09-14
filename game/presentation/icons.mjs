/** Original Field Kit semantic icon recipes. Integer pixels only; no fonts,
 * external assets, clock, DOM, storage or simulation input. */
export const FIELD_KIT_ICON_VERSION = 1;
const meanings = {
  'icon.menu': 'Three horizontal bars: open the main menu.',
  'icon.back': 'Left arrow: return to the previous screen.',
  'icon.close': 'Diagonal cross: close this surface.',
  'icon.play': 'Right triangle: start or resume play.',
  'icon.pause': 'Two upright bars: pause the current session.',
  'icon.retry': 'Circular return arrow: restart with the current setup.',
  'icon.settings': 'Stepped cog with a clear center: settings.',
  'icon.audio': 'Speaker and sound waves: sound effects.',
  'icon.music': 'Paired musical notes: music.',
  'icon.fullscreen': 'Four outward corners: fullscreen.',
  'icon.save': 'Storage disk with label and write area: save a local record.',
  'icon.load': 'Open folder with inward arrow: load an existing record.',
  'icon.download': 'Arrow into a tray: download or export.',
  'icon.upload': 'Arrow out of a tray: upload or import.',
  'icon.copy': 'Overlapping sheets: copy the selected content.',
  'icon.check': 'Unframed check: confirmed or valid state.',
  'icon.warning': 'Stepped warning triangle with punctuation: attention required.',
  'icon.info': 'Framed information mark: additional explanation.',
  'icon.lock': 'Closed shackle: unavailable or locked content.',
  'icon.offline': 'Separated plug and cable: offline connection.',
  'icon.trash': 'Lidded bin with two ribs: remove an item.',
  'icon.undo': 'Bent left arrow: undo one authoring operation.',
  'icon.redo': 'Bent right arrow: redo one authoring operation.',
  'icon.keyboard': 'Key rows and long space bar: keyboard input.',
  'icon.controller': 'Two-grip gamepad, direction cross and two buttons: controller input.',
  'icon.touch': 'Raised index finger with tap rays: touch input.',
  'hud.life': 'Heart: remaining lives.',
  'hud.score': 'Four-point score spark: score value.',
  'hud.time': 'Clock face and hands: the labelled time value.',
  'hud.coverage': 'Partly filled cell frame: revealed coverage.',
  'hud.signal': 'Three rising bars: an existing labelled signal status only.',
  'hud.connection': 'Two linked rectangular loops: connection status.',
  'reward.gold': 'Ribbon medal with three cut rank marks: gold award.',
  'reward.silver': 'Ribbon medal with two cut rank marks: silver award.',
  'reward.bronze': 'Ribbon medal with one cut rank mark: bronze award.',
  'reward.mastery': 'Winged trophy and crown: mastery award.',
  'reward.unlock': 'Open shackle and discovery spark: newly unlocked content.',
  'control.up': 'Up arrow: current upward movement binding.',
  'control.right': 'Right arrow: current rightward movement binding.',
  'control.down': 'Down arrow: current downward movement binding.',
  'control.left': 'Left arrow: current leftward movement binding.',
  'control.boost': 'Two forward chevrons and a thrust bar: boost binding.',
  'control.ability': 'Brackets around an active diamond: class ability binding.',
  'control.confirm': 'Check inside a key frame: confirm binding.',
  'control.cancel': 'Cross inside a key frame: cancel binding.',
};
export const FIELD_KIT_ICON_DESCRIPTIONS = Object.freeze(meanings);
export const FIELD_KIT_ICON_IDS = Object.freeze(Object.keys(meanings));
export const FIELD_KIT_ICON_SIZES = Object.freeze(
  Object.fromEntries(
    FIELD_KIT_ICON_IDS.map((id) => [
      id,
      id.startsWith('hud.') ? 16 : id.startsWith('reward.') ? 32 : 24,
    ]),
  ),
);
const defaults = {
  text: '#f3f0db',
  ink: '#070b12',
  cyan: '#78dce8',
  amber: '#f4bf62',
  muted: '#a5b2bb',
  hazard: '#f07879',
  success: '#9dbb7a',
};

function pixels(grid, palette) {
  const rgba = new Uint8ClampedArray(grid * grid * 4);
  const colors = Object.fromEntries(
    Object.entries(palette).map(([key, hex]) => [
      key,
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255),
    ]),
  );
  const put = (x, y, color) => {
    if (x >= 0 && y >= 0 && x < grid && y < grid)
      rgba.set(color ? colors[color] : [0, 0, 0, 0], (y * grid + x) * 4);
  };
  const rect = (x, y, width, height, color = 'text') => {
    for (let py = y; py < y + height; py++)
      for (let px = x; px < x + width; px++) put(px, py, color);
  };
  const line = (x0, y0, x1, y1, color = 'text', thick = 2) => {
    const dx = Math.abs(x1 - x0),
      sx = x0 < x1 ? 1 : -1,
      dy = -Math.abs(y1 - y0),
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      rect(x0, y0, thick, thick, color);
      if (x0 === x1 && y0 === y1) break;
      const twice = err * 2;
      if (twice >= dy) {
        err += dy;
        x0 += sx;
      }
      if (twice <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };
  const outline = (x, y, width, height, color = 'text', thick = 2) => {
    rect(x, y, width, thick, color);
    rect(x, y + height - thick, width, thick, color);
    rect(x, y, thick, height, color);
    rect(x + width - thick, y, thick, height, color);
  };
  const poly = (points, color = 'text') => {
    for (let y = 0; y < grid; y++)
      for (let x = 0; x < grid; x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [ax, ay] = points[i],
            [bx, by] = points[j];
          if (
            ay > y + 0.5 !== by > y + 0.5 &&
            x + 0.5 < ((bx - ax) * (y + 0.5 - ay)) / (by - ay) + ax
          )
            inside = !inside;
        }
        if (inside) put(x, y, color);
      }
  };
  return { rgba, rect, line, outline, poly };
}
const check = (p, x = 5, y = 12, color = 'success') => {
  p.line(x, y, x + 4, y + 4, color);
  p.line(x + 4, y + 4, x + 12, y - 4, color);
};
const cross = (p, x = 6, y = 6, width = 10, color = 'text') => {
  p.line(x, y, x + width, y + width, color);
  p.line(x + width, y, x, y + width, color);
};
const upArrow = (p, y = 4, color = 'text') => {
  p.line(11, y, 4, y + 7, color);
  p.line(11, y, 18, y + 7, color);
  p.rect(11, y + 2, 2, 15, color);
};
const folder = (p) => {
  p.rect(3, 6, 7, 2, 'cyan');
  p.rect(3, 8, 17, 2);
  p.rect(3, 8, 2, 12);
  p.rect(3, 18, 18, 2);
  p.rect(19, 10, 2, 10);
};
const shackle = (p, x, y, open = false, color = 'text') => {
  p.rect(x + 2, y, 6, 2, color);
  p.rect(x, y + 2, 2, 7, color);
  p.rect(x + 8, y + 2, 2, open ? 3 : 7, color);
};
function regular(p, name) {
  switch (name) {
    case 'menu':
      p.rect(4, 5, 16, 2);
      p.rect(4, 11, 16, 2);
      p.rect(4, 17, 12, 2, 'cyan');
      break;
    case 'back':
      p.line(4, 11, 11, 4);
      p.line(4, 11, 11, 18);
      p.rect(5, 11, 15, 2);
      break;
    case 'close':
      cross(p);
      break;
    case 'play':
      p.poly(
        [
          [6, 3],
          [21, 12],
          [6, 21],
        ],
        'cyan',
      );
      break;
    case 'pause':
      p.rect(6, 4, 4, 16);
      p.rect(14, 4, 4, 16);
      break;
    case 'retry':
      p.line(7, 5, 16, 5);
      p.line(16, 5, 19, 8);
      p.rect(19, 8, 2, 9);
      p.line(19, 16, 16, 19);
      p.rect(6, 19, 11, 2);
      p.line(4, 15, 7, 19);
      p.poly(
        [
          [3, 3],
          [3, 11],
          [11, 11],
        ],
        'cyan',
      );
      break;
    case 'settings':
      p.outline(5, 5, 14, 14);
      p.rect(10, 2, 4, 4);
      p.rect(10, 18, 4, 4);
      p.rect(2, 10, 4, 4);
      p.rect(18, 10, 4, 4);
      p.rect(4, 4, 4, 4);
      p.rect(16, 4, 4, 4);
      p.rect(4, 16, 4, 4);
      p.rect(16, 16, 4, 4);
      p.outline(9, 9, 6, 6, 'cyan');
      break;
    case 'audio':
      p.rect(3, 9, 4, 6);
      p.poly([
        [6, 9],
        [12, 4],
        [12, 20],
        [6, 15],
      ]);
      p.line(15, 8, 17, 10, 'cyan');
      p.line(17, 10, 17, 13, 'cyan');
      p.line(17, 13, 15, 15, 'cyan');
      p.line(19, 5, 21, 8);
      p.rect(21, 8, 1, 8);
      p.line(21, 15, 19, 18, 'text', 1);
      break;
    case 'music':
      p.rect(8, 5, 2, 13);
      p.rect(18, 3, 2, 13);
      p.rect(8, 3, 12, 3, 'cyan');
      p.rect(3, 16, 7, 4);
      p.rect(13, 14, 7, 4);
      break;
    case 'fullscreen':
      for (const x of [3, 14])
        for (const y of [3, 14]) {
          p.rect(x, y === 3 ? 3 : 19, 7, 2);
          p.rect(x === 3 ? 3 : 19, y, 2, 7);
        }
      break;
    case 'save':
      p.outline(4, 3, 16, 18);
      p.rect(7, 3, 9, 6, 'cyan');
      p.rect(13, 4, 2, 4, 'ink');
      p.outline(7, 13, 10, 8);
      break;
    case 'load':
      folder(p);
      p.rect(8, 12, 7, 2, 'cyan');
      p.line(12, 9, 16, 12, 'cyan');
      p.line(16, 12, 12, 15, 'cyan');
      break;
    case 'download':
      p.rect(11, 3, 2, 11, 'cyan');
      p.line(6, 9, 11, 14, 'cyan');
      p.line(11, 14, 16, 9, 'cyan');
      p.rect(3, 15, 2, 6);
      p.rect(19, 15, 2, 6);
      p.rect(3, 19, 18, 2);
      break;
    case 'upload':
      p.rect(11, 4, 2, 11, 'cyan');
      p.line(6, 9, 11, 4, 'cyan');
      p.line(11, 4, 16, 9, 'cyan');
      p.rect(3, 15, 2, 6);
      p.rect(19, 15, 2, 6);
      p.rect(3, 19, 18, 2);
      break;
    case 'copy':
      p.outline(3, 3, 12, 15, 'cyan');
      p.rect(8, 7, 13, 15, null);
      p.outline(8, 7, 13, 15);
      break;
    case 'check':
      check(p);
      break;
    case 'warning':
      p.poly(
        [
          [12, 2],
          [23, 21],
          [1, 21],
        ],
        'amber',
      );
      p.rect(11, 8, 2, 6, 'ink');
      p.rect(11, 17, 2, 2, 'ink');
      break;
    case 'info':
      p.outline(3, 3, 18, 18, 'cyan');
      p.rect(11, 6, 2, 2);
      p.rect(11, 11, 2, 7);
      p.rect(9, 16, 6, 2);
      break;
    case 'lock':
      shackle(p, 7, 3);
      p.rect(5, 10, 14, 11);
      p.rect(11, 13, 2, 5, 'ink');
      break;
    case 'offline':
      p.rect(2, 8, 5, 2);
      p.rect(5, 5, 5, 9);
      p.rect(10, 7, 2, 2);
      p.rect(10, 11, 2, 2);
      p.rect(16, 14, 6, 2);
      p.rect(14, 11, 4, 9);
      p.line(11, 19, 16, 4, 'hazard');
      break;
    case 'trash':
      p.rect(8, 3, 8, 2);
      p.rect(3, 6, 18, 2);
      p.outline(5, 9, 14, 12);
      p.rect(9, 11, 2, 7);
      p.rect(13, 11, 2, 7);
      break;
    case 'undo':
      p.rect(5, 7, 10, 2);
      p.line(14, 7, 19, 12);
      p.rect(19, 12, 2, 6);
      p.rect(13, 18, 8, 2);
      p.line(3, 7, 8, 2, 'cyan');
      p.line(3, 7, 8, 12, 'cyan');
      break;
    case 'redo':
      regular(p, 'undo');
      break;
    case 'keyboard':
      p.outline(2, 5, 20, 15);
      for (const y of [8, 12]) for (const x of [5, 9, 13, 17]) p.rect(x, y, 2, 2);
      p.rect(7, 16, 10, 2, 'cyan');
      break;
    case 'controller':
      p.poly([
        [5, 5],
        [19, 5],
        [22, 9],
        [23, 18],
        [19, 20],
        [15, 16],
        [9, 16],
        [5, 20],
        [1, 18],
        [2, 9],
      ]);
      p.rect(5, 10, 6, 2, 'ink');
      p.rect(7, 8, 2, 6, 'ink');
      p.rect(16, 8, 2, 2, 'ink');
      p.rect(19, 11, 2, 2, 'ink');
      p.rect(11, 8, 3, 2, 'cyan');
      break;
    case 'touch':
      p.poly([
        [10, 5],
        [13, 5],
        [13, 11],
        [19, 12],
        [19, 18],
        [16, 22],
        [10, 22],
        [5, 15],
        [7, 13],
        [10, 16],
      ]);
      p.rect(10, 1, 3, 2, 'cyan');
      p.rect(5, 4, 2, 3, 'cyan');
      p.rect(16, 4, 2, 3, 'cyan');
      break;
  }
}
function hud(p, name) {
  switch (name) {
    case 'life':
      p.poly(
        [
          [2, 3],
          [6, 3],
          [8, 5],
          [10, 3],
          [14, 3],
          [15, 7],
          [8, 14],
          [1, 7],
        ],
        'hazard',
      );
      break;
    case 'score':
      p.poly(
        [
          [8, 1],
          [10, 6],
          [15, 8],
          [10, 10],
          [8, 15],
          [6, 10],
          [1, 8],
          [6, 6],
        ],
        'amber',
      );
      p.rect(7, 7, 2, 2, 'ink');
      break;
    case 'time':
      p.outline(2, 2, 12, 12);
      p.rect(7, 4, 2, 5, 'cyan');
      p.rect(7, 7, 4, 2, 'cyan');
      break;
    case 'coverage':
      p.outline(1, 1, 14, 14);
      p.rect(4, 4, 3, 3, 'cyan');
      p.rect(9, 4, 3, 3, 'cyan');
      p.rect(4, 9, 3, 3, 'cyan');
      break;
    case 'signal':
      p.rect(2, 10, 3, 4, 'cyan');
      p.rect(7, 6, 3, 8, 'cyan');
      p.rect(12, 2, 3, 12, 'cyan');
      break;
    case 'connection':
      p.outline(1, 5, 7, 8);
      p.outline(8, 3, 7, 8);
      p.rect(5, 7, 6, 2, 'cyan');
      break;
  }
}
function reward(p, name) {
  if (['gold', 'silver', 'bronze'].includes(name)) {
    const rank = { gold: 3, silver: 2, bronze: 1 }[name],
      color = { gold: 'amber', silver: 'muted', bronze: 'bronze' }[name];
    p.poly(
      [
        [6, 2],
        [13, 2],
        [16, 12],
        [10, 14],
      ],
      'cyan',
    );
    p.poly(
      [
        [19, 2],
        [26, 2],
        [22, 14],
        [16, 12],
      ],
      'cyan',
    );
    p.poly(
      [
        [10, 10],
        [22, 10],
        [28, 16],
        [28, 24],
        [22, 30],
        [10, 30],
        [4, 24],
        [4, 16],
      ],
      color,
    );
    p.outline(10, 15, 12, 11, 'ink', 1);
    for (let i = 0; i < rank; i++) p.rect(12 + i * 3, 18, 2, 5, 'ink');
    return;
  }
  if (name === 'mastery') {
    p.rect(3, 10, 6, 3, 'cyan');
    p.rect(5, 15, 5, 3, 'cyan');
    p.rect(23, 10, 6, 3, 'cyan');
    p.rect(22, 15, 5, 3, 'cyan');
    p.poly(
      [
        [10, 7],
        [22, 7],
        [22, 18],
        [18, 22],
        [18, 26],
        [23, 26],
        [23, 29],
        [9, 29],
        [9, 26],
        [14, 26],
        [14, 22],
        [10, 18],
      ],
      'amber',
    );
    p.rect(13, 11, 6, 3, 'ink');
    p.rect(11, 3, 2, 3, 'amber');
    p.rect(15, 1, 2, 5, 'amber');
    p.rect(19, 3, 2, 3, 'amber');
  } else {
    shackle(p, 11, 7, true, 'cyan');
    p.rect(8, 15, 16, 14, 'amber');
    p.rect(15, 19, 2, 6, 'ink');
    p.line(25, 3, 25, 7, 'success', 1);
    p.line(23, 5, 27, 5, 'success', 1);
    p.rect(4, 11, 2, 2, 'success');
  }
}
function control(p, name) {
  if (['up', 'right', 'down', 'left'].includes(name)) upArrow(p);
  else if (name === 'boost') {
    p.line(5, 6, 11, 12, 'amber');
    p.line(11, 12, 5, 18, 'amber');
    p.line(12, 6, 18, 12, 'amber');
    p.line(18, 12, 12, 18, 'amber');
    p.rect(3, 2, 12, 2);
  } else if (name === 'ability') {
    p.poly(
      [
        [12, 5],
        [19, 12],
        [12, 19],
        [5, 12],
      ],
      'cyan',
    );
    p.rect(10, 10, 4, 4, 'ink');
    for (const x of [2, 18])
      for (const y of [2, 18]) {
        p.rect(x, y === 2 ? 2 : 20, 4, 2);
        p.rect(x === 2 ? 2 : 20, y, 2, 4);
      }
  } else {
    p.outline(2, 2, 20, 20);
    if (name === 'confirm') {
      p.line(6, 12, 10, 16, 'success');
      p.line(10, 16, 17, 9, 'success');
    } else cross(p, 7, 7, 8, 'hazard');
  }
}
/** Each result owns its RGBA buffer. Optional 16/24/32 previews use nearest
 * integer pixel placement, never Canvas/vector antialiasing. Native frames
 * remain the registered size. Callers own labels, states and input bindings. */
export function iconForSlot(slotId, { size = FIELD_KIT_ICON_SIZES[slotId], tokens = {} } = {}) {
  if (!Object.hasOwn(FIELD_KIT_ICON_SIZES, slotId))
    throw new Error(`No authored Field Kit icon for ${slotId}.`);
  if (![16, 24, 32].includes(size)) throw new Error('Icon size must be 16, 24 or 32 pixels.');
  const palette = { ...defaults };
  for (const key of Object.keys(defaults))
    if (Object.hasOwn(tokens, key)) {
      if (typeof tokens[key] !== 'string' || !/^#[a-f0-9]{6}$/i.test(tokens[key]))
        throw new Error(`Invalid icon palette token ${key}.`);
      palette[key] = tokens[key];
    }
  // Bronze is a quiet shade of the theme amber, never a danger cue.
  palette.bronze =
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(palette.amber.slice(i, i + 2), 16) * 0.66 +
            parseInt(palette.ink.slice(i, i + 2), 16) * 0.34,
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  const native = FIELD_KIT_ICON_SIZES[slotId],
    p = pixels(native, palette),
    [group, name] = slotId.split('.');
  if (group === 'icon') regular(p, name);
  else if (group === 'hud') hud(p, name);
  else if (group === 'reward') reward(p, name);
  else control(p, name);
  const rgba = new Uint8ClampedArray(size * size * 4),
    turns = group === 'control' ? ({ up: 0, right: 1, down: 2, left: 3 }[name] ?? 0) : 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let sx = Math.floor((x * native) / size),
        sy = Math.floor((y * native) / size);
      for (let i = 0; i < turns; i++) [sx, sy] = [sy, native - 1 - sx];
      if (name === 'redo' && group === 'icon') sx = native - 1 - sx;
      const from = (sy * native + sx) * 4;
      rgba.set(p.rgba.subarray(from, from + 4), (y * size + x) * 4);
    }
  return { width: size, height: size, rgba };
}
