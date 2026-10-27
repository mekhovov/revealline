import { aircraftAppearance } from './aircraft-appearance.mjs';

/** Presentation in the same COM-relative coordinates as the physical renderer.
 * Body +x is right and +z is rear, so the nose points up in this top view. */
export function aircraftPreviewGeometry(aircraft) {
  const {
    bodyHalfExtents: half,
    centerOfMass: com,
    propellerRadius: radius,
    rotors,
  } = aircraft.geometry;
  const body = { x: -com.x, z: -com.z, width: half.x * 2, length: half.z * 2 };
  const minX = Math.min(body.x - half.x, ...rotors.map(({ position }) => position.x - radius)),
    maxX = Math.max(body.x + half.x, ...rotors.map(({ position }) => position.x + radius)),
    minZ = Math.min(body.z - half.z, ...rotors.map(({ position }) => position.z - radius)),
    maxZ = Math.max(body.z + half.z, ...rotors.map(({ position }) => position.z + radius));
  return {
    body,
    rotors: rotors.map(({ position }) => ({ x: position.x, z: position.z })),
    radius,
    ducted: aircraft.geometry.ducted,
    width: maxX - minX,
    length: maxZ - minZ,
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
  };
}

/** Static, offline illustration: no animation, events or simulation mutations. */
export function createAircraftPreview({
  document: doc,
  aircraft,
  name,
  wheelbaseMm,
  locale = 'en',
}) {
  const t = (en, uk) => (locale === 'uk' ? uk : en),
    model = aircraftPreviewGeometry(aircraft),
    paint = aircraftAppearance(aircraft.id),
    scale = Math.min(390 / model.width, 220 / model.length),
    x = (value) => 280 + (value - model.center.x) * scale,
    y = (value) => 165 + (value - model.center.z) * scale,
    radius = model.radius * scale,
    figure = doc.createElement('figure');
  figure.className = 'tuning-aircraft-preview';
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 560 330');
  svg.setAttribute('role', 'img');
  svg.setAttribute('focusable', 'false');
  const arrangement = model.ducted
    ? t('Ducted rotors', 'Ротори із захистом')
    : t('Open propellers', 'Відкриті пропелери');
  const dimensions = `${t('Model span', 'Габарити моделі')}: ${(model.width * 1000).toFixed(1)} × ${(model.length * 1000).toFixed(1)} ${t('mm', 'мм')} · ${t('Propellers', 'Пропелери')}: ${(model.radius * 2000).toFixed(1)} ${t('mm', 'мм')} · ${t('Wheelbase', 'База')}: ${wheelbaseMm} ${t('mm', 'мм')}`;
  svg.setAttribute(
    'aria-label',
    `${name}. ${t('Top view, front points up', 'Вигляд згори, передня частина вгорі')}. ${arrangement}. ${dimensions}`,
  );
  const part = (tag, attrs, parent = svg, text) => {
    const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  };
  part('title', {}, svg, name);
  part(
    'text',
    { x: 280, y: 22, fill: '#edf5ff', 'text-anchor': 'middle', 'font-size': 15 },
    svg,
    t('FRONT', 'ПЕРЕД'),
  );
  part('path', {
    d: 'M280 47 V30 M274 36 L280 30 L286 36',
    fill: 'none',
    stroke: '#f1ca72',
    'stroke-width': 2,
  });
  const arms = part('g', {
    'data-preview-part': 'arms',
    stroke: paint.frameColor,
    'stroke-width': Math.max(3, radius * 0.14),
    'stroke-linecap': 'round',
  });
  for (const rotor of model.rotors)
    part(
      'line',
      { x1: x(model.body.x), y1: y(model.body.z), x2: x(rotor.x), y2: y(rotor.z) },
      arms,
    );
  model.rotors.forEach((rotor, index) => {
    const group = part('g', {
      'data-preview-part': 'rotor',
      'data-rotor-index': index,
      transform: `translate(${x(rotor.x)} ${y(rotor.z)})`,
    });
    part(
      'circle',
      {
        'data-preview-part': model.ducted ? 'duct' : 'propeller-sweep',
        r: radius - (model.ducted ? 2 : 0),
        fill: model.ducted ? '#122733' : 'none',
        stroke: model.ducted ? paint.frameColor : '#7695ae',
        'stroke-width': model.ducted ? 4 : 1,
        ...(model.ducted ? {} : { 'stroke-dasharray': '3 4' }),
      },
      group,
    );
    for (let blade = 0; blade < paint.bladeCount; blade++)
      part(
        'ellipse',
        {
          'data-preview-part': 'blade',
          cx: radius * 0.5,
          cy: 0,
          rx: radius * 0.48,
          ry: radius * 0.12,
          fill: paint.propColor,
          opacity: 0.85,
          transform: `rotate(${(blade * 360) / paint.bladeCount + index * 23})`,
        },
        group,
      );
    part(
      'circle',
      { r: radius * 0.14, fill: '#8f9aa3', stroke: '#e2e9ee', 'stroke-width': 1 },
      group,
    );
  });
  const bx = x(model.body.x),
    bz = y(model.body.z),
    bw = model.body.width * scale,
    bl = model.body.length * scale;
  part('rect', {
    'data-preview-part': 'body',
    x: bx - bw / 2,
    y: bz - bl / 2,
    width: bw,
    height: bl,
    rx: Math.min(5, bw * 0.15),
    fill: paint.frameColor,
    stroke: '#a6b8c8',
    'stroke-width': 1,
  });
  part('rect', {
    x: bx - bw * 0.38,
    y: bz - bl * 0.39,
    width: bw * 0.76,
    height: bl * 0.78,
    rx: model.ducted ? bw * 0.3 : 2,
    fill: paint.canopyColor,
  });
  if (!model.ducted)
    for (const offset of [-0.22, 0.22])
      part('rect', {
        x: bx - bw * 0.42,
        y: bz + bl * offset,
        width: bw * 0.84,
        height: bl * 0.08,
        fill: '#17232b',
      });
  part('rect', {
    'data-preview-part': 'camera',
    x: bx - bw * 0.18,
    y: bz - bl * 0.48,
    width: bw * 0.36,
    height: bl * 0.13,
    rx: 2,
    fill: '#07141e',
    stroke: '#dce8f1',
    'stroke-width': 1,
  });
  // A metric scale prevents the fit-to-panel view from implying equal size.
  const targetMm = (100 / scale) * 1000,
    magnitude = 10 ** Math.floor(Math.log10(targetMm)),
    scaleMm = [1, 2, 5]
      .map((n) => n * magnitude)
      .filter((n) => n <= targetMm)
      .at(-1),
    scaleWidth = (scaleMm / 1000) * scale;
  part('path', {
    d: `M24 300 V308 H${24 + scaleWidth} V300`,
    fill: 'none',
    stroke: '#edf5ff',
    'stroke-width': 2,
  });
  part(
    'text',
    { x: 24, y: 324, fill: '#edf5ff', 'font-size': 13 },
    svg,
    `${scaleMm} ${t('mm', 'мм')}`,
  );
  part(
    'text',
    { x: 536, y: 314, fill: '#c4d5e5', 'text-anchor': 'end', 'font-size': 14 },
    svg,
    arrangement,
  );
  figure.append(svg);
  const caption = doc.createElement('figcaption');
  caption.textContent = `${t('Simplified model · top view · scaled to fit. Estimated body shape; rotor spacing and propeller size follow the SIM geometry.', 'Спрощена модель · вигляд згори · масштаб підібрано. Форма корпусу приблизна; розташування роторів і діаметр пропелерів відповідають геометрії SIM.')} ${dimensions}`;
  figure.append(caption);
  return figure;
}
