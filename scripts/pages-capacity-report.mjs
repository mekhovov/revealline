/** Read-only comparison of two complete publisher evidence packets.
 * This validates receipt consistency, not archive bodies or GitHub provenance.
 * It never authorizes a merge, promotion, removal, or deployment.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAXIMUM = 980000000;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const validBytes = (value) => Number.isSafeInteger(value) && value >= 0;
const hash = /^[a-f0-9]{64}$/u;
const commit = /^[a-f0-9]{40}$/u;
const decode = (bytes) =>
  JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));

export function validatePagesEvidence({ inventoryBytes, staged, archive }) {
  assert.ok(
    inventoryBytes instanceof Uint8Array,
    "Missing exact inventory bytes",
  );
  assert.ok(
    inventoryBytes.byteLength <= 16 * 1024 * 1024,
    "Oversized inventory",
  );
  const inventory = decode(inventoryBytes);
  assert.equal(inventory.format, "revealline-main-pages-inventory.v1");
  assert.equal(staged?.format, "revealline-main-pages-receipt.v1");
  assert.equal(archive?.format, "revealline-main-pages-archive-receipt.v1");
  assert.ok(
    typeof inventory.sourceRevision === "string" &&
      commit.test(inventory.sourceRevision),
    "Invalid source identity",
  );
  assert.equal(
    staged.sourceRevision,
    inventory.sourceRevision,
    "Staging source differs",
  );
  assert.equal(
    archive.sourceRevision,
    inventory.sourceRevision,
    "Archive source differs",
  );
  assert.equal(inventory.completeInventory, true, "Incomplete inventory");
  assert.equal(staged.completeInventory, true, "Incomplete staging");
  assert.equal(
    staged.inventorySha256,
    sha256(inventoryBytes),
    "Inventory checksum differs",
  );
  assert.equal(
    archive.inventorySha256,
    staged.inventorySha256,
    "Archive inventory differs",
  );
  assert.ok(
    Array.isArray(inventory.files) && inventory.files.length > 0,
    "Empty inventory",
  );
  const files = new Map();
  for (const row of inventory.files) {
    assert.ok(
      typeof row.path === "string" &&
        row.path.length <= 4096 &&
        !/[\\\u0000-\u001f]/u.test(row.path) &&
        row.path
          .split("/")
          .every((part) => part && part !== "." && part !== ".."),
      "Unsafe inventory path",
    );
    assert.ok(!files.has(row.path), "Duplicate inventory path");
    assert.ok(
      validBytes(row.bytes) &&
        typeof row.sha256 === "string" &&
        hash.test(row.sha256),
      "Invalid file descriptor",
    );
    files.set(row.path, row);
  }
  const total = [...files.values()].reduce((sum, row) => sum + row.bytes, 0);
  assert.ok(validBytes(total), "Unsafe total");
  assert.equal(staged.files, files.size, "Staged count differs");
  assert.equal(archive.files, files.size, "Archive count differs");
  assert.equal(staged.bytes, total, "Staged total differs");
  assert.equal(archive.stagedBytes, total, "Archive staged total differs");
  assert.ok(
    validBytes(staged.maximumBytes) && staged.maximumBytes <= MAXIMUM,
    "Broadened raw budget",
  );
  assert.ok(
    validBytes(archive.maximumArchiveBytes) &&
      archive.maximumArchiveBytes <= MAXIMUM,
    "Broadened archive budget",
  );
  assert.ok(
    validBytes(archive.archiveBytes) && archive.archiveBytes >= total,
    "Invalid archive size",
  );
  assert.equal(
    archive.overheadBytes,
    archive.archiveBytes - total,
    "Archive overhead differs",
  );
  assert.ok(
    typeof archive.archiveSha256 === "string" &&
      hash.test(archive.archiveSha256),
    "Invalid archive checksum",
  );
  assert.match(
    archive.artifactId,
    /^[1-9][0-9]*$/u,
    "Invalid artifact identity",
  );
  assert.deepEqual(staged.errors, [], "Staging inspection failed");
  assert.equal(
    staged.capacityAccepted,
    total <= staged.maximumBytes,
    "Raw acceptance differs",
  );
  assert.equal(
    staged.withinCapacity,
    staged.capacityAccepted,
    "Raw capacity result differs",
  );
  const archiveFits = archive.archiveBytes <= archive.maximumArchiveBytes;
  assert.equal(
    archive.archiveAccepted,
    archiveFits,
    "Archive acceptance differs",
  );
  assert.ok(Array.isArray(archive.errors), "Missing archive errors");
  assert.equal(
    archive.errors.length === 0,
    archiveFits,
    "Archive diagnostics differ",
  );
  return {
    sourceRevision: inventory.sourceRevision,
    files,
    stagedBytes: total,
    archive,
  };
}

export function comparePagesEvidence(beforePacket, afterPacket) {
  const before = validatePagesEvidence(beforePacket);
  const after = validatePagesEvidence(afterPacket);
  const changes = [];
  for (const name of [
    ...new Set([...before.files.keys(), ...after.files.keys()]),
  ].sort()) {
    const old = before.files.get(name);
    const next = after.files.get(name);
    if (old && next && old.bytes === next.bytes && old.sha256 === next.sha256)
      continue;
    changes.push({
      path: name,
      change: !old ? "added" : !next ? "removed" : "changed",
      beforeBytes: old?.bytes ?? 0,
      afterBytes: next?.bytes ?? 0,
      deltaBytes: (next?.bytes ?? 0) - (old?.bytes ?? 0),
    });
  }
  const delta = changes.reduce((sum, row) => sum + row.deltaBytes, 0);
  assert.equal(
    delta,
    after.stagedBytes - before.stagedBytes,
    "Change accounting differs",
  );
  return {
    format: "revealline-pages-capacity-comparison.v1",
    beforeSource: before.sourceRevision,
    afterSource: after.sourceRevision,
    evidenceScope:
      "Publisher receipt consistency only; archive bodies and GitHub provenance are not reverified.",
    mergeAuthorized: false,
    qualificationPerformed: false,
    combinedQueueForecastPerformed: false,
    attribution:
      "Observed source-to-source difference; not proof of an isolated PR contribution.",
    staged: {
      beforeBytes: before.stagedBytes,
      afterBytes: after.stagedBytes,
      deltaBytes: delta,
    },
    archive: {
      beforeBytes: before.archive.archiveBytes,
      afterBytes: after.archive.archiveBytes,
      deltaBytes: after.archive.archiveBytes - before.archive.archiveBytes,
      beforeSha256: before.archive.archiveSha256,
      afterSha256: after.archive.archiveSha256,
      withinRecordedBudget: after.archive.archiveAccepted,
    },
    targets: [800000000, 900000000, 950000000, MAXIMUM].map((budgetBytes) => ({
      budgetBytes,
      headroomBytes: budgetBytes - after.archive.archiveBytes,
      reductionNeededBytes: Math.max(
        0,
        after.archive.archiveBytes - budgetBytes,
      ),
    })),
    changes,
  };
}

export async function readPagesEvidence(directory) {
  const read = async (name) => {
    const file = path.join(directory, name);
    const info = await lstat(file);
    assert.ok(
      info.isFile() && !info.isSymbolicLink() && info.size <= 16 * 1024 * 1024,
      "Invalid evidence file",
    );
    return readFile(file);
  };
  return {
    inventoryBytes: await read("main-pages-inventory.json"),
    staged: decode(await read("main-pages-receipt.json")),
    archive: decode(await read("main-pages-archive-receipt.json")),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    4,
    "Usage: node scripts/pages-capacity-report.mjs BEFORE_DIRECTORY AFTER_DIRECTORY",
  );
  const result = comparePagesEvidence(
    await readPagesEvidence(process.argv[2]),
    await readPagesEvidence(process.argv[3]),
  );
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
