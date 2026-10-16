import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  comparePagesEvidence,
  validatePagesEvidence,
} from "./pages-capacity-report.mjs";

const hash = (data) => createHash("sha256").update(data).digest("hex");
const row = (path, bytes, content = path) => ({
  path,
  bytes,
  sha256: hash(content),
});
function packet(
  files = [row("index.html", 5)],
  source = "a".repeat(40),
  overhead = 1024,
) {
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const inventoryBytes = Buffer.from(
    JSON.stringify({
      format: "revealline-main-pages-inventory.v1",
      sourceRevision: source,
      completeInventory: true,
      files,
    }),
  );
  return {
    inventoryBytes,
    staged: {
      format: "revealline-main-pages-receipt.v1",
      sourceRevision: source,
      completeInventory: true,
      inventorySha256: hash(inventoryBytes),
      files: files.length,
      bytes,
      maximumBytes: 980000000,
      capacityAccepted: bytes <= 980000000,
      withinCapacity: bytes <= 980000000,
      errors: [],
    },
    archive: {
      format: "revealline-main-pages-archive-receipt.v1",
      sourceRevision: source,
      inventorySha256: hash(inventoryBytes),
      files: files.length,
      stagedBytes: bytes,
      artifactId: "123",
      archiveSha256: hash("fixture archive identity, not actual archive bytes"),
      archiveBytes: bytes + overhead,
      overheadBytes: overhead,
      maximumArchiveBytes: 980000000,
      archiveAccepted: bytes + overhead <= 980000000,
      errors:
        bytes + overhead <= 980000000
          ? []
          : ["Pages archive exceeds its budget"],
    },
  };
}

test("unchanged inputs have zero deltas without claiming merge or queue qualification", () => {
  const report = comparePagesEvidence(packet(), packet());
  assert.equal(report.staged.deltaBytes, 0);
  assert.equal(report.archive.deltaBytes, 0);
  assert.deepEqual(report.changes, []);
  assert.equal(report.mergeAuthorized, false);
  assert.equal(report.qualificationPerformed, false);
  assert.equal(report.combinedQueueForecastPerformed, false);
  assert.match(report.evidenceScope, /not reverified/);
});

test("addition, removal, same-size content change and growth reconcile to exact totals", () => {
  const before = packet([
    row("keep", 5),
    row("removed", 10),
    row("changed", 7),
    row("grown", 2),
  ]);
  const after = packet(
    [
      row("keep", 5),
      row("added", 3),
      row("changed", 7, "new"),
      row("grown", 6),
    ],
    "b".repeat(40),
    2048,
  );
  const report = comparePagesEvidence(before, after);
  assert.deepEqual(
    report.changes.map((change) => [
      change.path,
      change.change,
      change.deltaBytes,
    ]),
    [
      ["added", "added", 3],
      ["changed", "changed", 0],
      ["grown", "changed", 4],
      ["removed", "removed", -10],
    ],
  );
  assert.equal(report.staged.deltaBytes, -3);
  assert.equal(report.archive.deltaBytes, 1021);
  assert.equal(report.afterSource, "b".repeat(40));
});

test("archive overhead controls headroom, independently of smaller raw files", () => {
  const report = comparePagesEvidence(
    packet(),
    packet([row("large", 949999999)], "b".repeat(40), 2),
  );
  const target = report.targets.find((item) => item.budgetBytes === 950000000);
  assert.equal(target.headroomBytes, -1);
  assert.equal(target.reductionNeededBytes, 1);
});

test("a complete over-budget receipt remains useful diagnostics, never an acceptance", () => {
  const report = comparePagesEvidence(
    packet(),
    packet([row("large", 980000000)]),
  );
  assert.equal(report.archive.withinRecordedBudget, false);
  assert.equal(report.targets.at(-1).reductionNeededBytes, 1024);
  assert.equal(report.mergeAuthorized, false);
});

for (const [name, change] of [
  [
    "inventory checksum",
    (p) => {
      p.staged.inventorySha256 = "0".repeat(64);
    },
  ],
  [
    "source binding",
    (p) => {
      p.archive.sourceRevision = "b".repeat(40);
    },
  ],
  [
    "complete staging",
    (p) => {
      p.staged.completeInventory = false;
    },
  ],
  [
    "staged count",
    (p) => {
      p.staged.files++;
    },
  ],
  [
    "staged total",
    (p) => {
      p.staged.bytes++;
    },
  ],
  [
    "archive total",
    (p) => {
      p.archive.stagedBytes++;
    },
  ],
  [
    "archive overhead",
    (p) => {
      p.archive.overheadBytes++;
    },
  ],
  [
    "raw budget",
    (p) => {
      p.staged.maximumBytes++;
    },
  ],
  [
    "archive budget",
    (p) => {
      p.archive.maximumArchiveBytes++;
    },
  ],
  [
    "rejected archive",
    (p) => {
      p.archive.archiveAccepted = false;
    },
  ],
  [
    "archive errors",
    (p) => {
      p.archive.errors.push("Member mismatch");
    },
  ],
  [
    "artifact identity",
    (p) => {
      p.archive.artifactId = "not-an-id";
    },
  ],
])
  test(`refuse inconsistent evidence: ${name}`, () => {
    const input = packet();
    change(input);
    assert.throws(() => validatePagesEvidence(input));
  });

for (const name of [
  "",
  "../outside",
  "/absolute",
  "a//b",
  "a/./b",
  "a\\b",
  "a\0b",
])
  test(`refuse unsafe inventoried path: ${JSON.stringify(name)}`, () => {
    assert.throws(() => validatePagesEvidence(packet([row(name, 1)])));
  });

test("duplicate paths, invalid sizes, unsafe sums, and malformed UTF-8 fail closed", () => {
  for (const files of [
    [row("a", 1), row("a", 1)],
    [row("a", -1)],
    [row("a", Number.MAX_SAFE_INTEGER), row("b", 1)],
  ])
    assert.throws(() => validatePagesEvidence(packet(files)));
  assert.throws(() =>
    validatePagesEvidence({ ...packet(), inventoryBytes: Buffer.from([0xff]) }),
  );
});

test("checksum and source identities reject coercible arrays", () => {
  assert.throws(() =>
    validatePagesEvidence(
      packet([{ ...row("index.html", 5), sha256: [hash("index.html")] }]),
    ),
  );
  const archive = packet();
  archive.archive.archiveSha256 = [archive.archive.archiveSha256];
  assert.throws(() => validatePagesEvidence(archive));
  assert.throws(() =>
    validatePagesEvidence(packet(undefined, ["a".repeat(40)])),
  );
});
