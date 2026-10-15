/** Trusted host presentation transaction; never supplied by imported region data. */
export function validateFrameTransaction(value) {
  if (value === null) return null;
  if (
    !value ||
    Object.keys(value).some(
      (key) => !["commit", "rollback", "readPose", "prepare"].includes(key),
    ) ||
    !["commit", "rollback"].every(
      (key) =>
        Object.hasOwn(value, key) &&
        typeof value[key] === "function" &&
        value[key].constructor.name === "Function",
    ) ||
    (Object.hasOwn(value, "readPose") &&
      (typeof value.readPose !== "function" ||
        value.readPose.constructor.name !== "Function")) ||
    (Object.hasOwn(value, "prepare") && typeof value.prepare !== "function")
  )
    throw new TypeError(
      "Frame transaction needs synchronous commit and rollback functions",
    );
  // Retain exact callbacks even if the host changes its options during transport.
  return Object.freeze({
    commit: value.commit,
    rollback: value.rollback,
    ...(value.readPose ? { readPose: value.readPose } : {}),
    ...(value.prepare ? { prepare: value.prepare } : {}),
  });
}

/** Detached presentation preparation may await; source ownership has not committed yet. */
export async function prepareVerifiedFrame(transaction, group, current) {
  current();
  if ((await transaction.prepare({ group })) !== undefined)
    throw new TypeError(
      "Frame preparation must not replace the verified candidate",
    );
  current();
}

/** Read only at the final synchronous adoption boundary, after all asynchronous preparation. */
export function readFramePose(transaction, fallback, planner) {
  if (!transaction?.readPose) return fallback;
  const value = transaction.readPose(),
    point = value?.positionMm;
  if (
    !value ||
    Object.keys(value).length !== 2 ||
    !point ||
    Object.keys(point).length !== 3 ||
    !["x", "y", "z"].every((key) => Number.isSafeInteger(point[key])) ||
    !Number.isSafeInteger(value.radiusMm) ||
    value.radiusMm <= 0 ||
    value.radiusMm > 2000
  )
    throw new TypeError("Invalid live frame support pose");
  planner(point);
  return { positionMm: { ...point }, radiusMm: value.radiusMm };
}

export function adoptVerifiedFrame(transaction, candidate, current) {
  current();
  if (!transaction) return;
  try {
    if (transaction.commit(candidate) !== undefined)
      throw new TypeError(
        "Frame commit must finish synchronously without a return value",
      );
    // Three group listeners can cancel or replace a flight while commit attaches its group.
    current();
  } catch (error) {
    try {
      if (transaction.rollback() !== undefined)
        throw new TypeError(
          "Frame rollback must finish synchronously without a return value",
        );
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Frame adoption and rollback failed",
      );
    }
    throw error;
  }
}
