/** A bounded, allocation-free broad phase. Damage queries never truncate candidates. */
export function createOverflightGrid(width, height, capacity, cellSize = 64) {
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  return {
    width,
    height,
    cellSize,
    columns,
    rows,
    heads: new Int32Array(columns * rows).fill(-1),
    next: new Int32Array(capacity).fill(-1),
    counts: new Uint32Array(columns * rows),
    sumX: new Float64Array(columns * rows),
    sumY: new Float64Array(columns * rows),
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    maxRadius: 0,
    local: null,
    records: null,
  };
}

export function overflightGridCell(grid, x, y) {
  const column = Math.max(0, Math.min(grid.columns - 1, Math.floor(x / grid.cellSize)));
  const row = Math.max(0, Math.min(grid.rows - 1, Math.floor(y / grid.cellSize)));
  return row * grid.columns + column;
}

export function rebuildOverflightGrid(grid, records) {
  if (records.length > grid.next.length) throw new RangeError('Enemy pool exceeds grid capacity.');
  grid.records = records;
  grid.heads.fill(-1);
  grid.counts.fill(0);
  grid.sumX.fill(0);
  grid.sumY.fill(0);
  grid.maxRadius = 0;
  if (grid.local) grid.local.heads.fill(-1);
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (!record.active) continue;
    grid.x[index] = record.x;
    grid.y[index] = record.y;
    grid.maxRadius = Math.max(grid.maxRadius, record.radius ?? 0);
    const cell = overflightGridCell(grid, record.x, record.y);
    grid.next[index] = grid.heads[cell];
    grid.heads[cell] = index;
    grid.counts[cell]++;
    grid.sumX[cell] += record.x;
    grid.sumY[cell] += record.y;
    if (grid.local) insertLocal(grid.local, index, record.x, record.y);
  }
  return grid;
}

/** Visitors apply their own exact shape test; this includes every intersecting cell. */
export function visitOverflightGrid(grid, x, y, radius, visitor) {
  if (!grid.records) return 0;
  const firstColumn = Math.max(0, Math.floor((x - radius) / grid.cellSize));
  const lastColumn = Math.min(grid.columns - 1, Math.floor((x + radius) / grid.cellSize));
  const firstRow = Math.max(0, Math.floor((y - radius) / grid.cellSize));
  const lastRow = Math.min(grid.rows - 1, Math.floor((y + radius) / grid.cellSize));
  let visited = 0;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      let index = grid.heads[row * grid.columns + column];
      while (index !== -1) {
        // A visitor may retire this record, but may not change the linked list.
        const next = grid.next[index];
        const record = grid.records[index];
        if (record.active) {
          visitor(record, index);
          visited++;
        }
        index = next;
      }
    }
  }
  return visited;
}

// The horde's exact-query grid keeps its existing size/order. Only experimental
// spacing uses this finer, lazily allocated index over the same frozen positions.
function insertLocal(local, index, x, y) {
  const cell = overflightGridCell(local, x, y);
  local.next[index] = local.heads[cell];
  local.heads[cell] = index;
}
function prepareLocal(grid) {
  const cellSize = 16;
  const columns = Math.ceil(grid.width / cellSize),
    rows = Math.ceil(grid.height / cellSize);
  const local = {
    cellSize,
    columns,
    rows,
    heads: new Int32Array(columns * rows).fill(-1),
    next: new Int32Array(grid.next.length),
  };
  for (let index = 0; index < grid.records.length; index++)
    if (grid.records[index].active) insertLocal(local, index, grid.x[index], grid.y[index]);
  grid.local = local;
  return local;
}

/** Smooth local steering from the frozen grid snapshot. Exact damage queries are separate. */
export function overflightCrowdSeparation(grid, index, maxRadius, output) {
  output.x = 0;
  output.y = 0;
  const source = grid.records?.[index];
  if (!source?.active) return output;
  const local = grid.local ?? prepareLocal(grid);
  const x = grid.x[index],
    y = grid.y[index];
  const range = source.radius + maxRadius + 8;
  const firstColumn = Math.max(0, Math.floor((x - range) / local.cellSize));
  const lastColumn = Math.min(local.columns - 1, Math.floor((x + range) / local.cellSize));
  const firstRow = Math.max(0, Math.floor((y - range) / local.cellSize));
  const lastRow = Math.min(local.rows - 1, Math.floor((y + range) / local.cellSize));
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      let otherIndex = local.heads[row * local.columns + column];
      while (otherIndex !== -1) {
        const other = grid.records[otherIndex];
        if (otherIndex !== index && other.active) {
          let dx = x - grid.x[otherIndex],
            dy = y - grid.y[otherIndex];
          const cutoff = source.radius + other.radius + 8;
          const squared = dx * dx + dy * dy;
          if (squared < cutoff * cutoff) {
            let distance = Math.sqrt(squared);
            if (distance < 1e-9) {
              const low = Math.min(source.id, other.id),
                high = Math.max(source.id, other.id);
              const angle = (((low * 73856093) ^ (high * 19349663)) >>> 0) * 0.000001;
              const sign = source.id < other.id ? 1 : -1;
              dx = Math.cos(angle) * sign;
              dy = Math.sin(angle) * sign;
              distance = 1;
            }
            const weight = (1 - Math.sqrt(squared) / cutoff) / distance;
            output.x += dx * weight;
            output.y += dy * weight;
          }
        }
        otherIndex = local.next[otherIndex];
      }
    }
  }
  const length = Math.hypot(output.x, output.y);
  if (length > 0.65) {
    output.x *= 0.65 / length;
    output.y *= 0.65 / length;
  }
  return output;
}
