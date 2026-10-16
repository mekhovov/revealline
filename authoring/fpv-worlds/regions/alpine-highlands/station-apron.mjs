/** Ground the existing station gap with its existing terrain triangles. No new support. */
export const STATION_APRON = Object.freeze({
  minX: 3296000,
  maxX: 3504000,
  minZ: 3080000,
  maxZ: 3120000,
  surfaceY: 560003,
  color: Object.freeze([0.29, 0.29, 0.27]),
});

export function isStationApronTriangle(points) {
  return (
    points.length === 3 &&
    points.every(
      ([x, y, z]) =>
        x >= STATION_APRON.minX &&
        x <= STATION_APRON.maxX &&
        y === STATION_APRON.surfaceY &&
        z >= STATION_APRON.minZ &&
        z <= STATION_APRON.maxZ,
    )
  );
}

/** Rebind complete original snow triangles; retain their geometry, UVs and collision. */
export function stationApronCell(source) {
  const surfaces = [],
    bindings = [];
  let changedTriangles = 0;
  for (const surface of source.cell.surfaces) {
    const binding = source.bindings.find((candidate) => candidate.surfaceId === surface.id);
    const eligible =
      binding.collision === 'visual-only' &&
      binding.textureId === 'original-white' &&
      binding.alphaMode === 'OPAQUE' &&
      binding.doubleSided &&
      !binding.colors.length &&
      [0.9, 0.94, 0.96].every((value, axis) => surface.color[axis] === value);
    const groups = new Map();
    for (let i = 0; i < surface.indices.length; i += 3) {
      const triangle = surface.indices.slice(i, i + 3);
      const points = triangle.map((index) => [
        surface.positionsMm[index * 3] + source.cell.x * 256000,
        surface.positionsMm[index * 3 + 1],
        surface.positionsMm[index * 3 + 2] + source.cell.z * 256000,
      ]);
      const apron = eligible && isStationApronTriangle(points);
      const key = apron ? 'station-apron' : 'original';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(...triangle);
      if (apron) changedTriangles++;
    }
    if (groups.size === 1 && groups.has('original')) {
      surfaces.push(surface);
      bindings.push(binding);
      continue;
    }
    for (const [key, originalIndices] of groups) {
      const id = key === 'original' ? surface.id : `${surface.id}-station-apron`;
      const positionsMm = [],
        indices = [],
        normals = [],
        uvs = [],
        colors = [],
        lookup = new Map();
      for (const original of originalIndices) {
        if (!lookup.has(original)) {
          lookup.set(original, lookup.size);
          positionsMm.push(...surface.positionsMm.slice(original * 3, original * 3 + 3));
          normals.push(...binding.normals.slice(original * 3, original * 3 + 3));
          uvs.push(...binding.uvs.slice(original * 2, original * 2 + 2));
          if (binding.colors.length)
            colors.push(...binding.colors.slice(original * 4, original * 4 + 4));
        }
        indices.push(lookup.get(original));
      }
      surfaces.push({
        id,
        color: key === 'station-apron' ? [...STATION_APRON.color] : surface.color,
        positionsMm,
        indices,
      });
      bindings.push({ ...binding, surfaceId: id, normals, uvs, colors });
    }
  }
  if (!changedTriangles) return { source, changedTriangles };
  return {
    source: { ...source, cell: { ...source.cell, surfaces }, bindings },
    changedTriangles,
  };
}
