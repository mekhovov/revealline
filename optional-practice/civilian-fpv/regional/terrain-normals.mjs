/** Visual-only normals from the entire validated resident height grid. */
export function createTerrainNormals(cells) {
  const heights = new Map();
  for (const cell of cells)
    for (let z = 0; z <= 32; z++)
      for (let x = 0; x <= 32; x++)
        heights.set(`${cell.x * 32 + x},${cell.z * 32 + z}`, cell.heightsMm[z * 33 + x]);
  return (cell) => {
    const spacingMm = cell.cellSizeMm / 32;
    const normals = new Float32Array(33 * 33 * 3);
    for (let z = 0; z <= 32; z++) {
      for (let x = 0; x <= 32; x++) {
        const gx = cell.x * 32 + x,
          gz = cell.z * 32 + z;
        const h = heights.get(`${gx},${gz}`);
        const left = heights.get(`${gx - 1},${gz}`),
          right = heights.get(`${gx + 1},${gz}`);
        const back = heights.get(`${gx},${gz - 1}`),
          front = heights.get(`${gx},${gz + 1}`);
        const dx =
          ((right ?? h) - (left ?? h)) /
          (left !== undefined && right !== undefined ? 2 * spacingMm : spacingMm);
        const dz =
          ((front ?? h) - (back ?? h)) /
          (back !== undefined && front !== undefined ? 2 * spacingMm : spacingMm);
        const length = Math.hypot(dx, 1, dz),
          offset = (z * 33 + x) * 3;
        normals[offset] = -dx / length;
        normals[offset + 1] = 1 / length;
        normals[offset + 2] = -dz / length;
      }
    }
    return normals;
  };
}
