import * as THREE from './vendor/three.module.js';

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

/** Camera-peripheral presentation in metres, centred on invisible prop pivots.
 * Only blade sweeps and the upper edge of the frame enter the camera crop.
 * The host positions these independently. This never replaces physical
 * aircraft geometry, hitboxes, loadout rules or the configuration's mass. */
export function buildFpvAircraftVisual({
  parent,
  mesh,
  material,
  configuration = null,
  kind = 'racer',
  quality = 'balanced',
  color = null,
}) {
  const paint = aircraftAppearance(configuration?.id),
    detail = quality === 'high',
    segments = quality === 'low' ? 16 : detail ? 40 : 28,
    radius = 0.127,
    bladeCount = 3,
    ducted = configuration?.geometry
      ? Boolean(configuration.geometry.ducted)
      : paint.style === 'whoop' || kind === 'utility',
    root = new THREE.Group(),
    nose = new THREE.Group(),
    sides = [],
    rotors = [],
    blurMaterials = [],
    armorGroups = [],
    weaponGroups = [],
    templates = new Set();
  root.name = 'fpv-front-aircraft';
  root.userData.modelRole = 'fpv-peripheral-aircraft';
  root.userData.aircraftId = configuration?.id ?? kind;
  parent.add(root);
  nose.name = 'fpv-cropped-frame-lip';
  nose.userData.modelRole = 'fpv-canopy';
  root.add(nose);
  const tintColor =
      color ?? (kind === 'pixel' ? 0xf3a870 : kind === 'utility' ? 0xaec8af : paint.canopyColor),
    makePaint = (value, extras = {}) => material(value, { fog: false, roughness: 0.56, ...extras }),
    carbon = makePaint(paint.frameColor, { roughness: 0.68 }),
    edge = makePaint(0x53616b, { roughness: 0.45, metalness: 0.12 }),
    alloy = makePaint(0x9ba6b0, { roughness: 0.29, metalness: 0.78 }),
    bellPaint = makePaint(0x34424e, { roughness: 0.32, metalness: 0.66 }),
    tint = makePaint(tintColor, { roughness: 0.42, metalness: 0.08 }),
    // Camera-only black ten-inch props. The complete aircraft retains its
    // configured propeller appearance and blade count.
    propColor = new THREE.Color(0x0b0e12),
    propPaint = makePaint(propColor, {
      roughness: 0.44,
      metalness: 0.08,
      emissive: 0x18202b,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    flashPaint = makePaint(0xffdc8c, {
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      emissive: 0xff9f35,
      emissiveIntensity: 3,
      side: THREE.DoubleSide,
    });
  root.userData.ownedMaterials = [carbon, edge, alloy, bellPaint, tint, propPaint, flashPaint];
  const shape = (geometry) => {
      templates.add(geometry);
      return geometry;
    },
    cylinder = (r, h, n = 16) => shape(new THREE.CylinderGeometry(r, r, h, n)),
    box = (x, y, z) => shape(new THREE.BoxGeometry(x, y, z)),
    ring = (r, tube, n = segments) => shape(new THREE.TorusGeometry(r, tube, 5, n)),
    plate = (points, thickness) => {
      const outline = new THREE.Shape();
      points.forEach(([x, z], index) => (index ? outline.lineTo(x, z) : outline.moveTo(x, z)));
      outline.closePath();
      return shape(
        new THREE.ExtrudeGeometry(outline, {
          depth: thickness,
          bevelEnabled: false,
          curveSegments: detail ? 8 : 5,
        })
          .rotateX(Math.PI / 2)
          .translate(0, thickness / 2, 0),
      );
    };
  // Merge the frame lip and equipment by material. Every emitted mesh uses
  // the host's ownership callback, including the separate blade-only groups.
  function batch(group, role) {
    const parts = new Map();
    return {
      add(geometry, surface, at = [0, 0, 0], rotate = [0, 0, 0]) {
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(...at),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotate)),
          new THREE.Vector3(1, 1, 1),
        );
        const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        copy.applyMatrix4(matrix);
        if (!parts.has(surface)) parts.set(surface, []);
        parts.get(surface).push(copy);
      },
      finish() {
        for (const [surface, list] of parts) {
          const merged = new THREE.BufferGeometry();
          for (const [name, size] of [
            ['position', 3],
            ['normal', 3],
            ['uv', 2],
          ]) {
            const count = list.reduce((sum, item) => sum + item.attributes.position.count, 0),
              data = new Float32Array(count * size);
            let offset = 0;
            for (const item of list) {
              const values = item.getAttribute(name)?.array;
              if (values) data.set(values, offset);
              offset += item.attributes.position.count * size;
            }
            merged.setAttribute(name, new THREE.BufferAttribute(data, size));
          }
          merged.computeBoundingSphere();
          const item = mesh(merged, surface, group);
          item.name = role;
          item.userData.modelRole = role;
          item.castShadow = item.receiveShadow = false;
          for (const source of list) source.dispose();
        }
      },
    };
  }
  const hex = cylinder(0.0027, 0.002, 6),
    frontRotors = [...(configuration?.geometry?.rotors ?? [])]
      .sort((a, b) => a.position.z - b.position.z)
      .slice(0, 2)
      .sort((a, b) => a.position.x - b.position.x);
  function blades(hand) {
    const outline = new THREE.Shape();
    outline.moveTo(0.013, -hand * 0.004);
    outline.bezierCurveTo(0.031, -hand * 0.006, 0.072, hand * 0.003, 0.106, hand * 0.017);
    outline.quadraticCurveTo(0.111, hand * 0.021, 0.104, hand * 0.026);
    outline.bezierCurveTo(0.074, hand * 0.024, 0.039, hand * 0.016, 0.014, hand * 0.005);
    outline.closePath();
    const geometry = shape(
      new THREE.ExtrudeGeometry(outline, {
        depth: 0.0016,
        bevelEnabled: quality !== 'low',
        bevelThickness: 0.0003,
        bevelSize: 0.0004,
        bevelSegments: 1,
        curveSegments: detail ? 12 : 7,
      })
        .rotateX(Math.PI / 2)
        .scale(radius / 0.11, 1, radius / 0.11),
    );
    // Original swept, pitched section: a thick root and thin curved tip rather
    // than a rectangle. Handedness follows the actual front motor reaction spin.
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const u = positions.getX(i) / radius,
        pitch = (1 - Math.max(0, Math.min(1, u))) * 0.22;
      positions.setY(i, positions.getY(i) + positions.getZ(i) * pitch * hand);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  const bladeShapes = new Map([
    [-1, blades(-1)],
    [1, blades(1)],
  ]);
  // Feathered exposure streaks retain a sense of rotation without an opaque
  // disk or rapidly flashing blade tips. One tiny shared texture, no extra pass.
  const blurPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const u = (x + 0.5) / 32 - 1,
        v = (y + 0.5) / 32 - 1,
        r = Math.hypot(u, v),
        angle = Math.atan2(v, u),
        feather = Math.max(0, Math.min(1, (r - 0.19) * 7, (1 - r) * 10)),
        streak = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(angle * bladeCount - r * 5)) ** 3,
        offset = (y * 64 + x) * 4;
      blurPixels.set([255, 255, 255, Math.round(feather * streak * 255)], offset);
    }
  const blurTexture = new THREE.DataTexture(blurPixels, 64, 64);
  blurTexture.magFilter = blurTexture.minFilter = THREE.LinearFilter;
  blurTexture.needsUpdate = true;
  // The camera sees a shallow slice of its own frame, not a miniature model.
  // Broad surfaces give the nose scale; its rear and mounting hardware stay
  // below the crop. Ducted craft retain a softer profile, utility a wider one.
  const cowl = batch(nose, 'fpv-canopy-shell'),
    shellWidth = kind === 'utility' ? 0.205 : ducted ? 0.185 : 0.17,
    shellHeight = ducted ? 0.014 : 0.009,
    shellDepth = 0.15,
    surfaceHeight = (x, z) =>
      shellHeight * Math.sqrt(Math.max(0, 1 - (x / shellWidth) ** 2 - (z / shellDepth) ** 2)),
    shell = shape(
      new THREE.SphereGeometry(1, segments, detail ? 12 : 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(
        shellWidth,
        shellHeight,
        shellDepth,
      ),
    ),
    rimOutline = [
      [-shellWidth * 0.55, -0.148],
      [shellWidth * 0.55, -0.148],
      [shellWidth, -0.035],
      [shellWidth * 0.9, 0.14],
      [-shellWidth * 0.9, 0.14],
      [-shellWidth, -0.035],
    ];
  cowl.add(plate(rimOutline, 0.006), edge, [0, -0.005, 0]);
  cowl.add(shell, carbon);
  const surfacePatch = (cx, width, depth, lift) => {
    const patch = shape(new THREE.PlaneGeometry(width, depth, 4, 8).rotateX(-Math.PI / 2)),
      positions = patch.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i),
        x = cx + positions.getX(i) * (1 - 0.2 * (Math.abs(z) / (depth / 2)) ** 4);
      positions.setXYZ(i, x, surfaceHeight(x, z) + lift, z);
    }
    patch.computeVertexNormals();
    return patch;
  };
  // One subdued strip retains the selected aircraft's colour without tiny
  // vents, exposed screws or a floating camera-head silhouette.
  cowl.add(surfacePatch(0, shellWidth * 0.22, 0.27, 0.0008), tint);
  cowl.finish();
  nose.userData.shellWidth = shellWidth;
  const knife = new THREE.Group(),
    knifeParts = batch(knife, 'fpv-cosmetic-knife');
  knife.name = 'fpv-nose-knife';
  knife.userData.cosmeticOnly = true;
  knife.visible = false;
  // A substantial forward blade on the centreline, clamped to the canopy.
  // Presentation only: its tip stays in the lower foreground crop.
  knife.position.set(0, 0.022, 0.025);
  nose.add(knife);
  // Two mounting saddles, a dark grip and a broad guard connect it visibly
  // to the nose instead of leaving a miniature blade beside the equipment.
  for (const z of [0.022, 0.075]) knifeParts.add(box(0.057, 0.013, 0.016), edge, [0, -0.014, z]);
  knifeParts.add(box(0.026, 0.018, 0.078), carbon, [0, 0, 0.048]);
  knifeParts.add(box(0.069, 0.012, 0.016), edge, [0, 0, 0]);
  knifeParts.add(
    plate(
      [
        [-0.022, -0.008],
        [0.022, -0.008],
        [0.019, -0.15],
        [0, -0.235],
        [-0.019, -0.15],
      ],
      0.004,
    ),
    alloy,
  );
  // Raised central facets catch light along the blade's spine at FPV angles.
  const bladeRidge = shape(new THREE.BufferGeometry());
  bladeRidge.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -0.022, 0.002, -0.008, 0, 0.009, -0.008, -0.019, 0.002, -0.15, -0.019, 0.002, -0.15, 0,
        0.009, -0.008, 0, 0.006, -0.15, -0.019, 0.002, -0.15, 0, 0.006, -0.15, 0, 0.002, -0.235,
        0.022, 0.002, -0.008, 0.019, 0.002, -0.15, 0, 0.009, -0.008, 0.019, 0.002, -0.15, 0, 0.006,
        -0.15, 0, 0.009, -0.008, 0.019, 0.002, -0.15, 0, 0.002, -0.235, 0, 0.006, -0.15,
      ],
      3,
    ),
  );
  bladeRidge.computeVertexNormals();
  knifeParts.add(bladeRidge, alloy);
  knifeParts.finish();
  const combatCowl = new THREE.Group(),
    plating = batch(combatCowl, 'fpv-equipment-cowl');
  combatCowl.name = 'fpv-combat-nose-plating';
  combatCowl.visible = false;
  nose.add(combatCowl);
  for (const sign of [-1, 1])
    plating.add(surfacePatch(sign * shellWidth * 0.39, shellWidth * 0.54, 0.245, 0.003), bellPaint);
  plating.finish();
  for (let side = 0; side < 2; side++) {
    const inward = side === 0 ? 1 : -1,
      group = new THREE.Group(),
      spinner = new THREE.Group(),
      rotating = batch(spinner, 'fpv-swept-propeller-blades'),
      hand =
        frontRotors[side]?.spin === undefined ? (side === 0 ? -1 : 1) : -frontRotors[side].spin;
    group.name = side === 0 ? 'fpv-front-left' : 'fpv-front-right';
    group.userData.side = side === 0 ? 'left' : 'right';
    group.userData.modelRole = 'fpv-peripheral-propeller';
    root.add(group);
    sides.push(group);
    // Motors, hubs, nuts, arms and stationary guards are deliberately absent
    // from this camera-only layer. The complete aircraft still has them.
    for (let blade = 0; blade < bladeCount; blade++)
      rotating.add(
        bladeShapes.get(hand),
        propPaint,
        [0, 0, 0],
        [0, (blade * Math.PI * 2) / bladeCount, 0],
      );
    spinner.name = 'fpv-front-propeller';
    spinner.userData.spin = hand;
    spinner.userData.radius = radius;
    spinner.userData.bladeCount = bladeCount;
    group.add(spinner);
    rotors.push(spinner);
    rotating.finish();
    const blurPaint = makePaint(propColor, {
        emissive: 0x18202b,
        emissiveIntensity: 0.08,
        transparent: true,
        opacity: 0,
        map: blurTexture,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      blur = mesh(new THREE.CircleGeometry(radius, segments), blurPaint, spinner);
    blur.name = 'fpv-propeller-motion-blur';
    blur.rotation.x = -Math.PI / 2;
    blur.position.y = 0.0005;
    blurMaterials.push(blurPaint);
    const weapons = {};
    for (const id of ['autocannon', 'scatter', 'precision', 'rocket']) {
      const pod = new THREE.Group(),
        metal = batch(pod, `fpv-${id}-pod`),
        barrelLength = id === 'precision' ? 0.074 : id === 'autocannon' ? 0.052 : 0.038,
        barrelRadius = id === 'rocket' ? 0.012 : id === 'scatter' ? 0.0065 : 0.0045;
      pod.name = `fpv-weapon-${id}`;
      pod.userData.modelRole = 'equipped-weapon-presentation';
      pod.userData.weaponId = id;
      // Keep the mount under the shell, with the barrel and flash beyond its
      // leading edge so widening the cowl cannot hide firing feedback.
      pod.position.set(-inward * shellWidth * 0.68, -0.012, -0.12);
      pod.visible = false;
      nose.add(pod);
      metal.add(box(0.025, 0.018, 0.025), carbon, [0, 0, 0.007]);
      metal.add(box(0.027, 0.004, 0.009), tint, [0, 0.004, 0.012]);
      // The loadout bracket sits underneath the cropped frame lip.
      metal.add(box(0.028, 0.008, 0.016), edge, [inward * 0.008, -0.008, 0.014]);
      metal.add(hex, alloy, [0, 0.012, 0.01]);
      const bores = id === 'scatter' ? [-0.007, 0.007] : [0];
      for (const x of bores) {
        metal.add(
          cylinder(barrelRadius, barrelLength, segments),
          alloy,
          [x, 0, -barrelLength / 2],
          [Math.PI / 2, 0, 0],
        );
        metal.add(
          cylinder(barrelRadius * 0.72, 0.001, 12),
          carbon,
          [x, 0, -barrelLength - 0.0006],
          [Math.PI / 2, 0, 0],
        );
        metal.add(ring(barrelRadius * 1.06, 0.0013, 16), carbon, [x, 0, -barrelLength * 0.75]);
      }
      if (id === 'precision') metal.add(box(0.006, 0.005, 0.026), carbon, [0, 0.011, -0.009]);
      if (id === 'rocket')
        for (const x of [-0.012, 0.012]) metal.add(box(0.003, 0.017, 0.016), tint, [x, 0, 0.009]);
      metal.finish();
      const flash = mesh(new THREE.ConeGeometry(barrelRadius * 2, 0.028, 6), flashPaint, pod);
      flash.name = 'muzzle-flash';
      flash.position.set(0, 0, -barrelLength - 0.014);
      flash.rotation.x = -Math.PI / 2;
      flash.visible = false;
      weapons[id] = pod;
    }
    weaponGroups.push(weapons);
  }
  for (const geometry of templates) geometry.dispose();
  return {
    root,
    nose,
    combatCowl,
    sides,
    rotors,
    blurMaterials,
    propPaint,
    knife,
    armorGroups,
    weaponGroups,
    tint,
  };
}
