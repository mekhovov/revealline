// Small original block lettering authored as flush geometry, not a runtime font.
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
const glyphs = {
  А: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  В: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  Е: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  К: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  М: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  Н: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  О: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  Р: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  С: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  Т: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  Ц: ['10010', '10010', '10010', '10010', '10010', '11111', '00001'],
  Ч: ['10001', '10001', '10001', '01111', '00001', '00001', '00001'],
  Й: ['01010', '00100', '10001', '10011', '10101', '11001', '10001'],
  Я: ['01111', '10001', '10001', '01111', '00101', '01001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};
export function lettering(art, text, at, height, rotation = [0, 0, 0], role = 'chalk') {
  const positions = [],
    size = height / 7,
    left = (-(text.length * 6 - 1) * size) / 2;
  [...text].forEach((letter, i) => {
    const rows = glyphs[letter];
    if (!rows) throw Error('Unauthored glyph ' + letter);
    rows.forEach((row, y) =>
      [...row].forEach((value, x) => {
        if (value !== '1') return;
        const a = left + (i * 6 + x) * size,
          b = height / 2 - y * size;
        positions.push(
          a,
          b,
          0,
          a,
          b - size,
          0,
          a + size,
          b,
          0,
          a + size,
          b,
          0,
          a,
          b - size,
          0,
          a + size,
          b - size,
          0,
        );
      }),
    );
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  art.add(geometry, role, at, rotation);
}
