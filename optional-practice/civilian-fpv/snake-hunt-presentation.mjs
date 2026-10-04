import { HUNT_PRESENTATION_CATALOG } from '../../game/hunt/presentation-catalog.mjs';
import { createDestructionPreferences } from '../../game/hunt/preferences.mjs';
import { createEncounterDisplayPreferences } from '../../game/encounter-display-preferences.mjs';
import { actorVisual } from '../../game/hunt/actor-catalog.mjs';
import { sharedActorAppearance } from '../../game/hunt/preferences.mjs';
import {
  INDUSTRIAL_SOLDIER_KIT_REVISION,
  INDUSTRIAL_SOLDIER_KITS,
} from '../../game/hunt/industrial-soldier-kit.mjs';
import {
  INDUSTRIAL_MACHINERY_REVISION,
  INDUSTRIAL_MACHINERY_PALETTE,
} from '../../game/presentation/industrial-machinery.mjs';

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
  let disposed = false,
    previousTick = null,
    observedTick = null;
  const vehicleBursts = new Map(),
    soldierBursts = new Map(),
    seenSoldierCatches = new Set();
  let priorSoldierPreferences = null;
  const catchKey = (caught) => `${caught.id}/${caught.tick}`;
  function put(mesh, at, size, tint, angle = 0) {
    if (mesh.count >= mesh.instanceMatrix.count) return false;
    position.set(...at);
    scale.set(...size);
    rotation.setFromEuler(euler.set(angle, angle * 0.7, angle * 0.4));
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(mesh.count, matrix);
    mesh.setColorAt(mesh.count, color.set(tint));
    mesh.count++;
    return true;
  }
  function reset() {
    for (const mesh of pools) mesh.count = 0;
  }
  function kitPiece(mesh, origin, appearance, angle, size = 0.035) {
    const kit = INDUSTRIAL_SOLDIER_KITS[appearance.family];
    if (!kit) return;
    // Render the same accessory's pixel rectangles as shallow native pieces.
    // Each rectangle consumes one instance in the existing pool; no extra pool
    // or hidden particle allowance is introduced for detailed equipment.
    for (const [layer, [role, x, y, width, height]] of kit.rectangles.entries()) {
      const dx = (x + width / 2 - kit.size[0] / 2) * size,
        dz = (y + height / 2 - kit.size[1] / 2) * size;
      if (
        !put(
          mesh,
          [
            origin[0] + Math.cos(angle) * dx - Math.sin(angle) * dz,
            origin[1] + layer * size * 0.02,
            origin[2] + Math.sin(angle) * dx + Math.cos(angle) * dz,
          ],
          [width * size, size * 0.65, height * size],
          appearance.palette[role] ?? role,
          0,
        )
      )
        break;
      // Keep the pixel plate in the same plane; body fragments may tumble.
      if (mesh.count) {
        rotation.setFromEuler(euler.set(0, -angle, 0));
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(mesh.count - 1, matrix);
      }
    }
  }
  return {
    palette,
    reset() {
      reset();
      previousTick = null;
      observedTick = null;
      vehicleBursts.clear();
      soldierBursts.clear();
      seenSoldierCatches.clear();
      priorSoldierPreferences = null;
    },
    // Accepted native simulation steps feed this observer independently of drawing.
    // Restore and seek reconstruct state without replaying historical equipment bursts.
    observe(
      state,
      {
        machineryRevision = null,
        machineryActorIds = [],
        soldierRevision = null,
        soldierActorIds = [],
      } = {},
    ) {
      if (
        disposed ||
        (machineryRevision !== INDUSTRIAL_MACHINERY_REVISION &&
          soldierRevision !== INDUSTRIAL_SOLDIER_KIT_REVISION)
      )
        return;
      if (observedTick !== null && state.ticks < observedTick) {
        vehicleBursts.clear();
        soldierBursts.clear();
        seenSoldierCatches.clear();
        for (const caught of state.hunt?.catches ?? []) seenSoldierCatches.add(catchKey(caught));
      }
      observedTick = state.ticks;
      if (soldierRevision === INDUSTRIAL_SOLDIER_KIT_REVISION) {
        const soldiers = new Set(soldierActorIds);
        for (const event of state.events ?? []) {
          if (event.type !== 'catch' || !soldiers.has(event.actor)) continue;
          // Native catches carry the transaction's starting tick; step() then
          // increments the snapshot clock before publishing the accepted event.
          const caught = state.hunt?.catches.find(
            (entry) => entry.id === event.actor && entry.tick === state.ticks - 1,
          );
          if (caught && !seenSoldierCatches.has(catchKey(caught))) {
            soldierBursts.set(catchKey(caught), state.ticks);
            seenSoldierCatches.add(catchKey(caught));
          }
        }
      }
      const admitted = new Set(
        machineryRevision === INDUSTRIAL_MACHINERY_REVISION ? machineryActorIds : [],
      );
      for (const event of state.events ?? []) {
        if (
          event.type === 'defeat' &&
          admitted.has(event.actor) &&
          state.actors?.some((actor) => actor.id === event.actor && actor.status === 'defeated')
        )
          vehicleBursts.set(event.actor, state.ticks);
      }
    },
    update(
      state,
      {
        reducedMotion = false,
        tailRadius = 350,
        actorDefinitions = [],
        machineryRevision = null,
        machineryActorIds = [],
        soldierRevision = null,
        soldierActorIds = [],
      } = {},
    ) {
      if (disposed) return;
      reset();
      if (!state.hunt && machineryRevision !== INDUSTRIAL_MACHINERY_REVISION) return;
      const prefs = preferences();
      const bloody = prefs.brutal && prefs.blood;
      const catches = state.hunt?.catches.slice(-12) ?? [],
        soldierIds = new Set(
          soldierRevision === INDUSTRIAL_SOLDIER_KIT_REVISION ? soldierActorIds : [],
        );
      if (
        previousTick !== null &&
        (state.ticks < previousTick ||
          (state.ticks > previousTick + 1 && observedTick !== state.ticks))
      )
        soldierBursts.clear();
      const retainedCatches = new Set(catches.map(catchKey));
      for (const [key, tick] of soldierBursts)
        if (!retainedCatches.has(key) || state.ticks - tick > 40) soldierBursts.delete(key);
      for (const key of seenSoldierCatches)
        if (!retainedCatches.has(key)) seenSoldierCatches.delete(key);
      for (const key of retainedCatches) seenSoldierCatches.add(key);
      if (soldierRevision === INDUSTRIAL_SOLDIER_KIT_REVISION) {
        if (
          reducedMotion ||
          (priorSoldierPreferences?.brutal && !prefs.brutal) ||
          (priorSoldierPreferences?.blood && !prefs.blood)
        )
          soldierBursts.clear();
        priorSoldierPreferences = { brutal: prefs.brutal, blood: prefs.blood };
      }
      for (const point of state.hunt?.tail.slice(0, 64) ?? [])
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
          caught.family ?? ((actor?.speed ?? 0) > 0 ? 'patroller' : 'lookout'),
          cast === 'authored' ? 'rivals' : cast,
        );
        const productionKit =
          soldierIds.has(caught.id) && INDUSTRIAL_SOLDIER_KITS[appearance.family];
        if (productionKit && prefs.showRemains !== false)
          kitPiece(
            remains,
            [origin[0], origin[1] + 0.045, origin[2]],
            appearance,
            ((caught.tick ?? 0) % 7) * 0.3,
            0.026,
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
              piece === 1 ? palette.flesh : productionKit ? appearance.palette.skin : palette.skin,
              piece * 0.8,
            );
        }
        if (
          reducedMotion ||
          age < 0 ||
          age > 0.8 ||
          (productionKit && !soldierBursts.has(catchKey(caught))) ||
          bursts++ >= 4
        )
          continue;
        const count = prefs.brutal ? 24 : 8;
        const vx = caught.velocity.x / 1000;
        const vz = caught.velocity.z / 1000;
        const direction = Math.atan2(vz, vx);
        for (let piece = 0; piece < count; piece++) {
          const angle = direction + ((piece * 2.39996) % 3.6) - 1.8;
          const speed = 0.9 + (piece % 5) * 0.4;
          const size = bloody && piece < 6 ? [0.11, 0.26, 0.11] : [0.06, 0.06, 0.06];
          const y = Math.max(0.06, 0.8 + age * (1.5 + (piece % 3) * 0.5) - 4.9 * age * age);
          const at = [
            origin[0] + Math.cos(angle) * age * speed,
            origin[1] + y,
            origin[2] + Math.sin(angle) * age * speed,
          ];
          if (productionKit && piece === (bloody ? 6 : 0)) {
            kitPiece(fragments, at, appearance, angle + age * 2);
            continue;
          }
          put(
            fragments,
            at,
            size,
            bloody
              ? [
                  palette.blood,
                  palette.flesh,
                  productionKit ? appearance.palette.skin : palette.skin,
                  palette.bone,
                ][piece % 4]
              : piece % 2
                ? appearance.palette.coat
                : palette.spark,
            age * ((piece % 4) + 1),
          );
        }
      }
      // Preserve existing humanoid feedback; equipment uses remaining capacity.
      if (machineryRevision === INDUSTRIAL_MACHINERY_REVISION) {
        if (
          previousTick !== null &&
          (state.ticks < previousTick ||
            (state.ticks > previousTick + 1 && observedTick !== state.ticks))
        )
          vehicleBursts.clear();
        const admitted = new Set(machineryActorIds);
        const definitions = new Map(
          actorDefinitions
            .filter((actor) => actor.type === 'vehicle' && admitted.has(actor.id))
            .map((actor) => [actor.id, actor]),
        );
        for (const actor of (state.actors ?? []).slice(0, 20)) {
          const definition = definitions.get(actor.id);
          if (!definition) continue;
          if (actor.status !== 'defeated') {
            vehicleBursts.delete(actor.id);
            continue;
          }
          const origin = [
              actor.position.x / 1000,
              actor.position.y / 1000,
              actor.position.z / 1000,
            ],
            radius = Math.max(0.2, Math.min(2, (definition.radius ?? 900) / 1000)),
            metal = INDUSTRIAL_MACHINERY_PALETTE,
            cargo = definition.vehicleModel === 'cargo-truck',
            tracked = definition.vehicleModel === 'field-tank';
          // Persisted defeated state reconstructs only settled equipment, never
          // historical bursts. Blood preference has no effect on machine material.
          if (prefs.showRemains !== false)
            for (let part = 0; part < 2; part++)
              put(
                remains,
                [
                  origin[0] + (part ? 0.23 : -0.18) * radius,
                  origin[1] + 0.05,
                  origin[2] + part * 0.13 * radius,
                ],
                [radius * (part ? 0.2 : 0.62), radius * 0.1, radius * (tracked ? 0.63 : 0.4)],
                part ? metal.rubber : cargo ? metal.canvas : metal.hull,
                part * 0.7,
              );
          const tick = vehicleBursts.get(actor.id),
            age = tick === undefined ? Infinity : (state.ticks - tick) / 50;
          if (reducedMotion || age < 0 || age > 0.8 || bursts++ >= 4) continue;
          const count = prefs.brutal ? 18 : 6;
          for (let part = 0; part < count; part++) {
            const angle = part * 2.39996,
              distance = age * (prefs.brutal ? 2.8 : 1.2) * radius;
            put(
              fragments,
              [
                origin[0] + Math.cos(angle) * distance,
                origin[1] + Math.max(0.06, radius * 0.4 + age * 1.6 - 4.9 * age * age),
                origin[2] + Math.sin(angle) * distance,
              ],
              [radius * 0.14, radius * 0.07, radius * (part % 3 === 0 ? 0.3 : 0.13)],
              part % 3 === 0
                ? metal.rubber
                : part % 3 === 1
                  ? metal.steel
                  : cargo
                    ? metal.canvas
                    : metal.hull,
              angle + age * 2,
            );
          }
        }
      }
      if (
        machineryRevision === INDUSTRIAL_MACHINERY_REVISION ||
        soldierRevision === INDUSTRIAL_SOLDIER_KIT_REVISION
      )
        previousTick = state.ticks;
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
