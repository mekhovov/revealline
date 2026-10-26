/* Visual qualification only. Uses admitted production actor/effect templates. */
(() => {
  const { THREE, owner, pack, renderer, scene, camera, actors, partsRoot,
    createCombatPresentation } = window.__art;
  const prefs = { blood: true, brutal: true, showRemains: true };
  const query = (position, normal, sweep) => {
    if (sweep?.fromMm && sweep?.toMm && sweep.toMm.y > 0) return { clear: true };
    const point = sweep?.toMm ?? position;
    return { position: { x: point.x, y: 0, z: point.z }, normal: { x: 0, y: 1, z: 0 } };
  };
  const effects = createCombatPresentation({ THREE, scene, preferences: () => prefs,
    groundQuery: query, detail: () => 'ultra' });
  if (!effects.setAppearancePartsTemplates(pack.manifest.characters.map((_, index) =>
    owner.createPartsLease(index)))) throw Error('Visual matrix appearance rejected');
  effects.prepareTextures(texture => renderer.initTexture(texture));
  const labels = document.createElement('div');
  labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:17px sans-serif;color:#fff';
  document.body.append(labels);
  const label = (text, position) => {
    const projected = position.clone().project(camera), node = document.createElement('div');
    node.textContent = text;
    node.style.cssText = `position:absolute;left:${(projected.x + 1) * 800}px;top:${(1 - projected.y) * 500}px;transform:translate(-50%,-50%);padding:4px 8px;background:#16202ce6;border-radius:4px;white-space:nowrap`;
    labels.append(node);
  };
  window.__visualMatrix = {
    capture({ cast = 'tactical', offset = 0, blood = true, brutal = true,
      showRemains = true, impact = false } = {}) {
      Object.assign(prefs, { blood, brutal, showRemains });
      labels.replaceChildren(); partsRoot.visible = false;
      const characters = pack.manifest.characters.filter(item => item.cast === cast).slice(offset, offset + 6);
      const bodies = characters.map((item, index) => ({
        id: `visual-${index}`, spawnId: `visual-life-${index}`, sourceId: `visual-source-${index}`,
        type: 'patrol', material: 'organic', radius: 350, height: 1800,
        appearance: { family: item.family, cast, archetype: 'military-trooper' },
        position: { x: (index % 3 - 1) * 5200, y: 0, z: Math.floor(index / 3) * 6100 },
        velocity: { x: 0, y: 0, z: 0 }, status: 'active', health: 100, maxHealth: 100,
      }));
      camera.position.set(8.2, 9.6, -15.8); camera.lookAt(0, .6, 1.8);
      camera.updateMatrixWorld();
      actors.setActors(bodies, { runId: 'visual-matrix', tick: 100 });
      actors.update({ tick: 100, graphicsQuality: 'high', cameraPosition: camera.position,
        enemyHealthDisplay: 'off' });
      effects.reset('visual-matrix');
      effects.observe(bodies.map((body, index) => ({
        type: 'defeat', eventId: `visual-defeat-${index}`, sourceId: body.sourceId,
        spawnId: `defeat-life-${index}`, tick: 100, material: 'organic',
        position: { ...body.position, z: body.position.z - 1900 },
        normal: { x: 0, y: 1, z: 0 }, velocity: { x: 2500, y: 1800, z: -1000 },
        weapon: index % 2 ? 'rocket' : 'precision', severity: 1,
        impactDirection: { x: .5, y: .2, z: -.8 }, radius: body.radius, height: body.height,
        appearance: { ...body.appearance, type: body.type }, seed: index + 4,
        surface: { position: { ...body.position, z: body.position.z - 1900 }, normal: { x: 0, y: 1, z: 0 } },
      })), { runId: 'visual-matrix', tick: 100 });
      const lastTick = impact ? 109 : 500;
      for (let tick = 100; tick <= lastTick; tick++) effects.update({ tick,
        presentationClock: tick / 50, graphicsQuality: 'ultra', cameraPosition: camera.position });
      renderer.render(scene, camera);
      label(`${cast} · Blood ${blood ? 'on' : 'off'} · Brutal ${brutal ? 'on' : 'off'} · Remains ${showRemains ? 'on' : 'off'}${impact ? ' · impact' : ' · settled'}`,
        new THREE.Vector3(0, 4.7, 2));
      bodies.forEach(body => label(body.appearance.family,
        new THREE.Vector3(body.position.x / 1000, 2.2, body.position.z / 1000)));
      return { cast, offset, blood, brutal, showRemains, impact,
        families: characters.map(item => item.family), actors: actors.resources(), effects: effects.resources(),
        renderer: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures },
        records: effects.export().records.length };
    },
    dispose() { effects.dispose(); labels.remove(); },
  };
})();
