/** Original opaque station finishes. Metre-scale UVs; no mesh or collision changes. */
const texture = (id, width, height, pixel) => {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      bytes.set(
        [...pixel(x / width, 1 - y / height), 255],
        (y * width + x) * 4,
      );
  return {
    id,
    width,
    height,
    rgbaBase64: Buffer.from(bytes).toString("base64"),
    magFilter: 9729,
    minFilter: 9729,
    wrapS: 10497,
    wrapT: 10497,
  };
};
const noise = (x, y) =>
  (((Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 8) % 13) -
  6;
export function stationTextures() {
  const wall = texture("original-station-wall", 256, 128, (u, v) => {
    const x = u * 8,
      y = v * 14;
    const grain = noise(Math.floor(x * 32), Math.floor(y * 18));
    // A 1.4m masonry plinth anchors the façade; joints are at physical scale.
    if (y < 1.4) {
      const row = Math.floor(y / 0.35);
      const joint = y % 0.35 < 0.035 || (x + (row % 2) * 0.5) % 1 < 0.035;
      return joint ? [65, 68, 65] : [116 + grain, 118 + grain, 111 + grain];
    }
    // Opaque backed panels, not transparent windows or enterable openings.
    if (y > 3.8 && y < 8.2 && x > 1.7 && x < 6.3) {
      const frame =
        y < 4.0 ||
        y > 8.0 ||
        x < 1.9 ||
        x > 6.1 ||
        Math.abs(x - 4) < 0.09 ||
        Math.abs(y - 6) < 0.09;
      return frame ? [196, 170, 119] : [48 + grain, 72 + grain, 80 + grain];
    }
    const board = x % 0.25;
    const seam = board < 0.028 || y > 13.65;
    const tint = (Math.floor(x / 0.25) % 3) * 6;
    return seam
      ? [66, 42, 27]
      : [128 + tint + grain, 87 + tint + grain, 53 + grain];
  });
  const roof = texture("original-station-roof", 128, 128, (u, v) => {
    const x = u * 8,
      z = v * 4;
    const seam = x % 0.5 < 0.04 || z < 0.05;
    const grain = noise(Math.floor(x * 32), Math.floor(z * 32));
    return seam ? [74, 47, 39] : [139 + grain, 62 + grain, 43 + grain];
  });
  return [wall, roof];
}

export function stationFace(points) {
  const inside = (axis, lo, hi) =>
    points.every((p) => p[axis] >= lo && p[axis] <= hi);
  const plane = (axis, value) => points.every((p) => p[axis] === value);
  for (const z of [3068000, 3132000]) {
    if (
      inside(0, 3353000, 3447000) &&
      inside(1, 560000, 574000) &&
      inside(2, z - 12500, z + 12500)
    ) {
      if (plane(2, z - 12500) || plane(2, z + 12500))
        return {
          id: `wall-x-${z}`,
          textureId: "original-station-wall",
          uv: (p) => [(p[0] - 3353000) / 8000, (574000 - p[1]) / 14000],
        };
      if (plane(0, 3353000) || plane(0, 3447000))
        return {
          id: `wall-z-${z}`,
          textureId: "original-station-wall",
          uv: (p) => [(p[2] - z + 12500) / 8000, (574000 - p[1]) / 14000],
        };
    }
    if (
      plane(1, 576000) &&
      inside(0, 3348000, 3452000) &&
      inside(2, z - 15500, z + 15500)
    )
      return {
        id: `roof-${z}`,
        textureId: "original-station-roof",
        uv: (p) => [(p[0] - 3348000) / 8000, (p[2] - z + 15500) / 4000],
      };
  }
  return null;
}

export function detailStationCell(source) {
  const surfaces = [],
    bindings = [],
    usedTextures = new Set();
  let changedTriangles = 0;
  for (const surface of source.cell.surfaces) {
    const binding = source.bindings.find((b) => b.surfaceId === surface.id);
    const groups = new Map();
    for (let i = 0; i < surface.indices.length; i += 3) {
      const indices = surface.indices.slice(i, i + 3);
      const points = indices.map((index) => [
        surface.positionsMm[index * 3] + source.cell.x * 256000,
        surface.positionsMm[index * 3 + 1],
        surface.positionsMm[index * 3 + 2] + source.cell.z * 256000,
      ]);
      const face = binding.collision === "solid" ? stationFace(points) : null;
      const key = face?.id ?? "original";
      if (!groups.has(key)) groups.set(key, { face, indices: [] });
      groups.get(key).indices.push(...indices);
      if (face) changedTriangles++;
    }
    if (groups.size === 1 && groups.has("original")) {
      surfaces.push(surface);
      bindings.push(binding);
      continue;
    }
    for (const [key, group] of groups) {
      const id = key === "original" ? surface.id : `${surface.id}-${key}`;
      const indices = [],
        positionsMm = [],
        normals = [],
        colors = [],
        uvs = [],
        lookup = new Map();
      for (const original of group.indices) {
        if (!lookup.has(original)) {
          lookup.set(original, lookup.size);
          const p = surface.positionsMm.slice(original * 3, original * 3 + 3);
          positionsMm.push(...p);
          normals.push(
            ...binding.normals.slice(original * 3, original * 3 + 3),
          );
          if (group.face) {
            uvs.push(
              ...group.face
                .uv([
                  p[0] + source.cell.x * 256000,
                  p[1],
                  p[2] + source.cell.z * 256000,
                ])
                .map((v) => Math.round(v * 1e6) / 1e6),
            );
          } else {
            uvs.push(...binding.uvs.slice(original * 2, original * 2 + 2));
            if (binding.colors.length)
              colors.push(
                ...binding.colors.slice(original * 4, original * 4 + 4),
              );
          }
        }
        indices.push(lookup.get(original));
      }
      surfaces.push({
        id,
        color: group.face ? [1, 1, 1] : surface.color,
        positionsMm,
        indices,
      });
      bindings.push({
        ...binding,
        surfaceId: id,
        textureId: group.face?.textureId ?? binding.textureId,
        uvs,
        normals,
        colors,
      });
      if (group.face) usedTextures.add(group.face.textureId);
    }
  }
  if (!changedTriangles) return { source, changedTriangles };
  return {
    source: {
      ...source,
      cell: { ...source.cell, surfaces },
      bindings,
      textures: [
        ...source.textures,
        ...stationTextures().filter((t) => usedTextures.has(t.id)),
      ],
    },
    changedTriangles,
  };
}
