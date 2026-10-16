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
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (!record.active) continue;
    const cell = overflightGridCell(grid, record.x, record.y);
    grid.next[index] = grid.heads[cell];
    grid.heads[cell] = index;
    grid.counts[cell]++;
    grid.sumX[cell] += record.x;
    grid.sumY[cell] += record.y;
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
