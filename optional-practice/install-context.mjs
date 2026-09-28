const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const versionPattern = /^v\d+\.\d+\.\d+$/;
export function optionalInstallationKey(id, root) {
  if (!idPattern.test(id) || id.length > 64)
    throw new TypeError('Invalid optional package identity.');
  if (typeof root !== 'string' || !new RegExp(`^/(?:[A-Za-z0-9_-]+/)*practice/${id}/$`).test(root))
    throw new TypeError('Invalid optional installation root.');
  return `revealline.optional-installed.${id}.${encodeURIComponent(root)}.v1`;
}
export function validateOptionalInstallationReference(value, { packageId, root, baseURL }) {
  optionalInstallationKey(packageId, root);
  if (
    !value ||
    value.id !== packageId ||
    !versionPattern.test(value.version) ||
    value.entry !== `optional-practice/${packageId}/index.html` ||
    typeof value.scope !== 'string' ||
    value.scope.length > 2048 ||
    !new RegExp(`^/(?:[A-Za-z0-9_-]+/)*practice/${packageId}/$`).test(root)
  )
    throw new TypeError('Optional installation reference differs.');
  const base = new URL(baseURL),
    scope = new URL(value.scope, base);
  if (
    !/^https?:$/.test(base.protocol) ||
    scope.origin !== base.origin ||
    scope.username ||
    scope.password ||
    scope.search ||
    scope.hash ||
    scope.pathname !== `${root}releases/${value.version}/site/`
  )
    throw new TypeError('Optional installation must use its exact published package path.');
  return Object.freeze({
    id: packageId,
    version: value.version,
    scope: scope.href,
    entry: value.entry,
  });
}
export function recordOptionalInstallation({
  packageId,
  location = globalThis.location,
  storage = globalThis.localStorage,
}) {
  if (!idPattern.test(packageId) || packageId.length > 64)
    throw new TypeError('Invalid optional package identity.');
  const base = new URL(location.href);
  const match = new RegExp(
    `^(/(?:[A-Za-z0-9_-]+/)*practice/${packageId}/)releases/(v\\d+\\.\\d+\\.\\d+)/site/optional-practice/${packageId}/(?:index\\.html)?$`,
  ).exec(base.pathname);
  if (!match) return false;
  const context = { packageId, root: match[1], baseURL: base.href };
  const active = validateOptionalInstallationReference(
    {
      id: packageId,
      version: match[2],
      scope: `${match[1]}releases/${match[2]}/site/`,
      entry: `optional-practice/${packageId}/index.html`,
    },
    context,
  );
  let state = {};
  try {
    state = JSON.parse(storage.getItem(optionalInstallationKey(packageId, match[1])) ?? '{}');
  } catch {
    /* A malformed local pointer cannot authorize another path. */
  }
  let previous;
  try {
    previous = validateOptionalInstallationReference(state.active, context);
  } catch {
    /* No verified previous pointer. */
  }
  if (previous?.scope === active.scope) return true;
  storage.setItem(
    optionalInstallationKey(packageId, match[1]),
    JSON.stringify({ active, ...(previous ? { previous } : {}) }),
  );
  return true;
}

export function removeOptionalInstallation({
  packageId,
  location = globalThis.location,
  storage = globalThis.localStorage,
}) {
  if (!idPattern.test(packageId) || packageId.length > 64)
    throw new TypeError('Invalid optional package identity.');
  const base = new URL(location.href);
  const match = new RegExp(
    `^(/(?:[A-Za-z0-9_-]+/)*practice/${packageId}/)releases/(v\\d+\\.\\d+\\.\\d+)/site/optional-practice/${packageId}/(?:index\\.html)?$`,
  ).exec(base.pathname);
  if (!match) return false;
  const key = optionalInstallationKey(packageId, match[1]);
  const context = { packageId, root: match[1], baseURL: base.href };
  let state;
  try {
    state = JSON.parse(storage.getItem(key) ?? '{}');
  } catch {
    return false;
  }
  const retained = {};
  for (const [name, value] of Object.entries(state)) {
    if (!['active', 'previous'].includes(name)) continue;
    try {
      const reference = validateOptionalInstallationReference(value, context);
      if (reference.version !== match[2]) retained[name] = reference;
    } catch {
      /* Unrelated or malformed pointers cannot be retained. */
    }
  }
  if (!retained.active && retained.previous) {
    retained.active = retained.previous;
    delete retained.previous;
  }
  storage.setItem(key, JSON.stringify(retained));
  return true;
}
