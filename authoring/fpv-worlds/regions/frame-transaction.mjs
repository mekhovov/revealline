/** Trusted host presentation transaction; never supplied by imported region data. */
export function validateFrameTransaction(value) {
  if (value === null) return null;
  if (
    !value ||
    Object.keys(value).length !== 2 ||
    !["commit", "rollback"].every(
      (key) =>
        Object.hasOwn(value, key) &&
        typeof value[key] === "function" &&
        value[key].constructor.name === "Function",
    )
  )
    throw new TypeError(
      "Frame transaction needs synchronous commit and rollback functions",
    );
  // Retain exact callbacks even if the host changes its options during transport.
  return Object.freeze({ commit: value.commit, rollback: value.rollback });
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
