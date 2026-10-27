// Restore-only proof over exact verified render/collision triangles. Never a flight solver.
const EPSILON = 1e-5; // metres; numerical boundary cases are deliberately unavailable.
const MAX_TRIANGLES = 16384;
const MAX_BOUNDS_VERTICES = 131072;
const MAX_PLANE_TESTS = 2000000;
const MAX_CERTIFICATE_BYTES = 512 * 1024;
const unavailable = (reason) => ({ status: 'ambiguous', reason });

async function certificate(meshes, current, column = null) {
  const yieldWork = async () => {
    current();
    await new Promise((resolve) => setTimeout(resolve, 0));
    current();
  };
  if (column) {
    const relevant = [];
    let scanned = 0;
    for (const mesh of meshes) {
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (let index = 0; index < mesh.positions.length; index += 3) {
        if (++scanned > MAX_BOUNDS_VERTICES) return { failure: 'work-budget', bytes: 0 };
        if (scanned % 4096 === 0) await yieldWork();
        const x = mesh.positions[index] + mesh.translation.x,
          y = mesh.positions[index + 1] + mesh.translation.y,
          z = mesh.positions[index + 2] + mesh.translation.z;
        if (![x, y, z].every(Number.isFinite))
          throw new TypeError('Invalid verified triangle position');
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      // Only omit complete meshes proved outside the whole vertical body column.
      // Their triangles cannot intersect its destination sphere or exterior sweep.
      if (
        maxX >= column.minX - EPSILON &&
        minX <= column.maxX + EPSILON &&
        maxZ >= column.minZ - EPSILON &&
        minZ <= column.maxZ + EPSILON
      )
        relevant.push(mesh);
    }
    meshes = relevant;
  }
  let triangles = 0;
  for (const [index, mesh] of meshes.entries()) {
    if (index % 128 === 0) await yieldWork();
    triangles += mesh.indices.length / 3;
  }
  if (!Number.isSafeInteger(triangles) || triangles > MAX_TRIANGLES)
    return { failure: 'work-budget', bytes: 0 };
  const vertices = [],
    welded = new Map(),
    faces = [],
    parent = [],
    edges = new Map();
  const find = (value) => {
    while (parent[value] !== value) {
      parent[value] = parent[parent[value]];
      value = parent[value];
    }
    return value;
  };
  for (const [meshIndex, { positions, indices, translation }] of meshes.entries()) {
    const mapping = new Map();
    const vertex = (index) => {
      if (mapping.has(index)) return mapping.get(index);
      const p = [
        positions[index * 3] + translation.x,
        positions[index * 3 + 1] + translation.y,
        positions[index * 3 + 2] + translation.z,
      ];
      if (!p.every(Number.isFinite)) throw new TypeError('Invalid verified triangle position');
      const key = meshIndex + ':' + p.join(',');
      if (!welded.has(key)) {
        welded.set(key, vertices.length);
        vertices.push(p);
      }
      const id = welded.get(key);
      mapping.set(index, id);
      return id;
    };
    for (let i = 0; i < indices.length; i += 3) {
      if (i % 768 === 0) await yieldWork();
      const face = [vertex(indices[i]), vertex(indices[i + 1]), vertex(indices[i + 2])];
      const id = faces.length;
      parent.push(id);
      faces.push(face);
      for (let edge = 0; edge < 3; edge++) {
        const a = face[edge],
          b = face[(edge + 1) % 3],
          key = `${Math.min(a, b)},${Math.max(a, b)}`;
        const existing = edges.get(key),
          direction = a < b ? 1 : -1;
        if (existing) {
          parent[find(id)] = find(existing.face);
          existing.count++;
          existing.direction += direction;
        } else edges.set(key, { face: id, count: 1, direction });
      }
    }
  }
  const components = new Map();
  for (const [index, face] of faces.entries()) {
    if (index % 256 === 0) await yieldWork();
    const root = find(index);
    if (!components.has(root))
      components.set(root, { faces: [], vertices: new Set(), closed: true });
    const c = components.get(root);
    c.faces.push(face);
    face.forEach((v) => c.vertices.add(v));
  }
  let edgeWork = 0;
  for (const edge of edges.values()) {
    if (++edgeWork % 256 === 0) await yieldWork();
    if (edge.count !== 2 || edge.direction !== 0) components.get(find(edge.face)).closed = false;
  }
  const result = [];
  let work = 0,
    bytes = 0;
  for (const component of components.values()) {
    await yieldWork();
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const id of component.vertices)
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], vertices[id][axis]);
        max[axis] = Math.max(max[axis], vertices[id][axis]);
      }
    const planes = [];
    let orientation = 0,
      convex = component.closed;
    if (convex)
      for (const face of component.faces) {
        const a = vertices[face[0]],
          b = vertices[face[1]],
          c = vertices[face[2]];
        const u = b.map((v, i) => v - a[i]),
          v = c.map((value, i) => value - a[i]);
        const normal = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        const length = Math.hypot(...normal);
        if (length <= EPSILON * EPSILON) {
          convex = false;
          break;
        }
        for (let axis = 0; axis < 3; axis++) normal[axis] /= length;
        const offset = normal.reduce((sum, n, axis) => sum + n * a[axis], 0);
        let side = 0;
        for (const id of component.vertices) {
          if (++work % 2048 === 0) await yieldWork();
          if (work > MAX_PLANE_TESTS) return { failure: 'work-budget', bytes: 0 };
          const distance = normal.reduce((sum, n, axis) => sum + n * vertices[id][axis], -offset);
          if (Math.abs(distance) <= EPSILON) continue;
          const sign = Math.sign(distance);
          if (side && side !== sign) {
            convex = false;
            break;
          }
          side = sign;
        }
        if (!convex || !side || (orientation && orientation !== side)) {
          convex = false;
          break;
        }
        orientation = side;
        planes.push(...normal.map((n) => n * side), offset * side);
      }
    const retained = convex ? new Float64Array(planes) : null;
    const bounds = new Float64Array([...min, ...max]);
    bytes += bounds.byteLength + (retained?.byteLength ?? 0);
    if (bytes > MAX_CERTIFICATE_BYTES) return { failure: 'certificate-budget', bytes: 0 };
    result.push({ bounds, planes: retained });
  }
  return { components: result, bytes, column };
}

/** Lazily certify once per exact owner; references and certificate are released with that owner. */
export function createRestoreContainment(meshes) {
  let source = meshes,
    cached = null,
    pending = null,
    disposed = false;
  const current = () => {
    if (disposed) throw new DOMException('Restore certification cancelled', 'AbortError');
  };
  return Object.freeze({
    snapshot: () => ({
      certificateBytes: cached?.bytes ?? 0,
      certified: Boolean(cached),
      preparing: !disposed && Boolean(pending),
    }),
    async prepare(assertCurrent = () => {}, column = null) {
      current();
      if (cached) return;
      if (
        column &&
        (!['minX', 'maxX', 'minZ', 'maxZ'].every((key) => Number.isFinite(column[key])) ||
          column.minX > column.maxX ||
          column.minZ > column.maxZ)
      )
        throw new TypeError('Invalid restore proof column');
      pending ??= certificate(
        source,
        () => {
          current();
          assertCurrent();
        },
        column && { ...column },
      )
        .then((result) => {
          current();
          cached = result;
          source = null;
        })
        .finally(() => {
          pending = null;
        });
      await pending;
    },
    classify(point, radius = 0) {
      if (disposed) throw new Error('Restore containment disposed');
      if (
        !point ||
        !['x', 'y', 'z'].every((axis) => Number.isFinite(point[axis])) ||
        !Number.isFinite(radius) ||
        radius < 0
      )
        throw new TypeError('Invalid restore containment point');
      if (!cached) return unavailable('certificate-unavailable');
      if (cached.failure) return unavailable(cached.failure);
      if (
        cached.column &&
        (point.x - radius < cached.column.minX - EPSILON ||
          point.x + radius > cached.column.maxX + EPSILON ||
          point.z - radius < cached.column.minZ - EPSILON ||
          point.z + radius > cached.column.maxZ + EPSILON)
      )
        return unavailable('outside-certified-column');
      const p = [point.x, point.y, point.z];
      for (const component of cached.components) {
        if (
          p.some(
            (value, axis) =>
              value < component.bounds[axis] - EPSILON ||
              value > component.bounds[axis + 3] + EPSILON,
          )
        )
          continue;
        if (!component.planes) return unavailable('unverified-solid');
        let outside = false,
          boundary = false;
        for (let i = 0; i < component.planes.length; i += 4) {
          const plane = component.planes;
          const distance =
            p[0] * plane[i] + p[1] * plane[i + 1] + p[2] * plane[i + 2] - plane[i + 3];
          if (distance < -EPSILON) {
            outside = true;
            break;
          }
          if (distance <= EPSILON) boundary = true;
        }
        if (outside) continue;
        if (boundary) return unavailable('solid-boundary');
        return { status: 'inside-solid' };
      }
      return { status: 'outside-solids' };
    },
    exteriorAbove(point, radius) {
      current();
      if (!cached || cached.failure) return null;
      if (
        !point ||
        !['x', 'y', 'z'].every((axis) => Number.isFinite(point[axis])) ||
        !Number.isFinite(radius) ||
        radius <= 0
      )
        throw new TypeError('Invalid exterior clearance query');
      if (
        cached.column &&
        (point.x - radius < cached.column.minX - EPSILON ||
          point.x + radius > cached.column.maxX + EPSILON ||
          point.z - radius < cached.column.minZ - EPSILON ||
          point.z + radius > cached.column.maxZ + EPSILON)
      )
        return null;
      // A full sphere above every verified component is an exterior starting point.
      // This does not certify the destination: its entire connecting sweep must be clear.
      let y = point.y;
      for (const component of cached.components)
        y = Math.max(y, component.bounds[4] + radius + 0.01);
      return { x: point.x, y, z: point.z };
    },
    dispose() {
      disposed = true;
      source = null;
      cached = null;
    },
  });
}

/** Stable reason for localized restore UI; never infer safety by parsing error text. */
export function requireRestoreClearance(result) {
  if (result?.status === 'outside-solids') return;
  const error = new Error('Saved location cannot be verified. Choose a clear starting point.');
  error.code = 'regional-restore-unavailable';
  error.reason = result?.reason ?? (result?.status === 'inside-solid' ? 'inside-solid' : 'unknown');
  throw error;
}
