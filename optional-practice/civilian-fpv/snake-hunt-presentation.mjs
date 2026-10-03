import { HUNT_PRESENTATION_CATALOG } from '../../game/hunt/presentation-catalog.mjs';
import { createDestructionPreferences } from '../../game/hunt/preferences.mjs';
import { createEncounterDisplayPreferences } from '../../game/encounter-display-preferences.mjs';
import { actorVisual } from '../../game/hunt/actor-catalog.mjs';
import { sharedActorAppearance } from '../../game/hunt/preferences.mjs';

export function mountSnakeHuntPresentationControls({
  document,
  window,
  container,
  storage,
  locale,
}) {
  const preferences = createDestructionPreferences({ window, getStorage: () => storage });
  const display = createEncounterDisplayPreferences({ window, getStorage: () => storage });
  const snapshot = () => ({
    ...preferences.snapshot(),
    showRemains: display.snapshot().showRemains,
    durable: preferences.snapshot().durable && display.snapshot().durable,
  });
  const root = document.createElement('fieldset');
  const legend = document.createElement('legend');
  const help = document.createElement('p');
  const saving = document.createElement('p');
  const fields = {};
  root.append(legend);
  for (const key of ['brutal', 'blood', 'showRemains']) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    const caption = document.createElement('span');
    input.type = 'checkbox';
    input.dataset.huntPresentation = key;
    input.addEventListener('change', () =>
      key === 'showRemains'
        ? display.set(input.checked)
        : preferences.set({ [key]: input.checked }),
    );
    label.append(input, caption);
    root.append(label);
    fields[key] = { input, caption };
  }
  root.append(help, saving);
  container.append(root);
  const refresh = () => {
    const uk = locale() === 'uk';
    const state = snapshot();
    legend.textContent = uk ? 'Вигляд полювання' : 'Hunt presentation';
    fields.brutal.caption.textContent = uk
      ? 'Жорстоке знищення гуманоїдів'
      : 'Brutal humanoid destruction';
    fields.blood.caption.textContent = uk ? 'Кров і частини тіл' : 'Blood and body parts';
    fields.showRemains.caption.textContent = uk
      ? 'Показувати рештки ворогів'
      : 'Show enemy remains';
    for (const [key, { input }] of Object.entries(fields)) input.checked = state[key];
    help.textContent = uk
      ? 'Спільні налаштування з аркадою. Вимкнене жорстоке знищення дає чисті ефекти. Приховані рештки не прибирають коротких ефектів дотику. Тверді сліди, цілі та фізика не змінюються.'
      : 'Shared with the arcade. Brutal off uses clean catch effects. Hiding remains keeps brief catch feedback. Solid echo trails, targets and flight physics stay the same.';
    saving.textContent = state.durable
      ? ''
      : uk
        ? 'Вибір діє в цьому сеансі; збереження недоступне.'
        : 'Active for this session; saving is unavailable.';
    saving.hidden = state.durable;
  };
  const unsubscribe = preferences.subscribe(refresh);
  const unsubscribeDisplay = display.subscribe(refresh);
  return {
    preferences: Object.freeze({ snapshot }),
    refresh,
    dispose() {
      unsubscribe();
      unsubscribeDisplay();
      preferences.dispose();
      display.dispose();
      root.remove();
    },
  };
}

/** Original procedural 3D presentation; never supplies contacts, tail geometry
 * or objective state. Every pose is derived from the current recorded tick. */
export function createSnakeHuntPresentation({ THREE, scene, preferences }) {
  const root = new THREE.Group();
  root.name = 'snake-hunt-presentation';
  scene.add(root);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  const color = new THREE.Color();
  const palette = HUNT_PRESENTATION_CATALOG.palette;
  const pools = [];
  function pool(name, geometry, limit, paint) {
    const material = new THREE.MeshStandardMaterial(paint);
    const mesh = new THREE.InstancedMesh(geometry, material, limit);
    mesh.name = name;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(mesh);
    pools.push(mesh);
    return mesh;
  }
  const tail = pool('solid-echo-tail', new THREE.IcosahedronGeometry(1, 0), 64, {
    color: 0xffc36c,
    emissive: 0xb34e10,
    emissiveIntensity: 0.55,
    roughness: 0.8,
  });
  const fragments = pool('hunt-cosmetic-fragments', new THREE.BoxGeometry(1, 1, 1), 128, {
    color: 0xffffff,
    roughness: 0.88,
  });
  const remains = pool('hunt-settled-remains', new THREE.BoxGeometry(1, 1, 1), 48, {
    color: 0xffffff,
    roughness: 0.98,
  });
  let disposed = false;
  function put(mesh, at, size, tint, angle = 0) {
    if (mesh.count >= mesh.instanceMatrix.count) return;
    position.set(...at);
    scale.set(...size);
    rotation.setFromEuler(euler.set(angle, angle * 0.7, angle * 0.4));
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(mesh.count, matrix);
    mesh.setColorAt(mesh.count, color.set(tint));
    mesh.count++;
  }
  function reset() {
    for (const mesh of pools) mesh.count = 0;
  }
  return {
    palette,
    reset,
    update(state, { reducedMotion = false, tailRadius = 350, actorDefinitions = [] } = {}) {
      if (disposed) return;
      reset();
      if (!state.hunt) return;
      const prefs = preferences();
      const bloody = prefs.brutal && prefs.blood;
      const catches = state.hunt.catches.slice(-12);
      for (const point of state.hunt.tail.slice(0, 64))
        put(
          tail,
          [point.x / 1000, point.y / 1000, point.z / 1000],
          Array(3).fill(tailRadius / 1000),
          '#ffc36c',
        );
      let bursts = 0;
      for (const caught of [...catches].reverse()) {
        const age = Math.max(0, (state.ticks - caught.tick) / 50);
        const at = caught.position;
        const origin = [at.x / 1000, at.y / 1000, at.z / 1000];
        const actor = actorDefinitions.find((entry) => entry.id === caught.id);
        const cast = sharedActorAppearance().snapshot().cast;
        const appearance = actorVisual(
          (actor?.speed ?? 0) > 0 ? 'patroller' : 'lookout',
          cast === 'authored' ? 'rivals' : cast,
        );
        // Clean feedback remains visible for a short moment. Graphic remains
        // require the independent shared Brutal, Blood and Remains settings.
        if (bloody && prefs.showRemains !== false) {
          put(
            remains,
            [origin[0], origin[1] + 0.025, origin[2]],
            [0.65, 0.035, 0.5],
            palette.blood,
          );
          for (let piece = 0; piece < 3; piece++)
            put(
              remains,
              [origin[0] + (piece - 1) * 0.22, origin[1] + 0.07, origin[2] + (piece % 2) * 0.18],
              [0.15, 0.11, piece === 1 ? 0.32 : 0.22],
              piece === 1 ? palette.flesh : palette.skin,
              piece * 0.8,
            );
        }
        if (reducedMotion || age > 0.8 || bursts++ >= 4) continue;
        const count = prefs.brutal ? 24 : 8;
        const vx = caught.velocity.x / 1000;
        const vz = caught.velocity.z / 1000;
        const direction = Math.atan2(vz, vx);
        for (let piece = 0; piece < count; piece++) {
          const angle = direction + ((piece * 2.39996) % 3.6) - 1.8;
          const speed = 0.9 + (piece % 5) * 0.4;
          const size = bloody && piece < 6 ? [0.11, 0.26, 0.11] : [0.06, 0.06, 0.06];
          const y = Math.max(0.06, 0.8 + age * (1.5 + (piece % 3) * 0.5) - 4.9 * age * age);
          put(
            fragments,
            [
              origin[0] + Math.cos(angle) * age * speed,
              origin[1] + y,
              origin[2] + Math.sin(angle) * age * speed,
            ],
            size,
            bloody
              ? [palette.blood, palette.flesh, palette.skin, palette.bone][piece % 4]
              : piece % 2
                ? appearance.palette.coat
                : palette.spark,
            age * ((piece % 4) + 1),
          );
        }
      }
      for (const mesh of pools) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    resources: () => ({
      tailLinks: tail.count,
      cosmeticParticles: fragments.count,
      settledPieces: remains.count,
      maxParticles: 128,
      maxBursts: 4,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const mesh of pools) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.dispose();
      }
    },
  };
}
