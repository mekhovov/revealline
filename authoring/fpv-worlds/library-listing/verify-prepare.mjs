import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, lstat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { prepareListingContract, MODULE_SHA256 } from "./prepare.mjs";
const archive = process.env.FPV_LISTING_ORIGINAL_ARCHIVE;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("changed archive refuses without creating an output or changing prior evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "fpv-listing-prepare-negative-"));
  const bad = join(root, "not-original.zip"),
    output = join(root, "new");
  await writeFile(bad, "synthetic not-an-archive");
  await assert.rejects(
    prepareListingContract({ archive: bad, output }),
    /exact original qualified/,
  );
  await assert.rejects(lstat(output), { code: "ENOENT" });
  assert.equal(await readFile(bad, "utf8"), "synthetic not-an-archive");
  await mkdir(output);
  await writeFile(join(output, "sentinel.txt"), "preserve me");
  await assert.rejects(
    prepareListingContract({ archive: bad, output }),
    /must not be overwritten/,
  );
  assert.equal(
    await readFile(join(output, "sentinel.txt"), "utf8"),
    "preserve me",
  );
});
test("in-repository or relative destinations refuse before archive access", async () => {
  const repository = fileURLToPath(new URL("../../../", import.meta.url));
  for (const output of [
    repository,
    join(repository, "tmp-output"),
    join(repository, "..looks-external"),
    "relative-output",
  ])
    await assert.rejects(
      prepareListingContract({ archive: "/not-read.zip", output }),
      /outside the repository|absolute fresh external/,
    );
});
test(
  "original archive preparation reproduces exact native-observed files and refuses repeat overwrite",
  { skip: !archive },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "fpv-listing-prepare-exact-")),
      output = join(root, "stage");
    const { identity } = await prepareListingContract({ archive, output });
    assert.equal(identity.newStageNativeAccepted, false);
    assert.equal(identity.nativeObservedHarnessFilesByteIdentical, true);
    assert.equal(
      sha(await readFile(join(output, "packaged-world-store.mjs"))),
      MODULE_SHA256,
    );
    assert.equal(
      (await readFile(join(output, "packaged-world-store.mjs"))).length,
      17516,
    );
    for (const name of [
      "index.html",
      "style.css",
      "harness.mjs",
      "contract.mjs",
    ])
      assert.deepEqual(
        await readFile(join(output, name)),
        await readFile(new URL(name, import.meta.url)),
      );
    const before = await readFile(join(output, "identity.json"));
    await assert.rejects(
      prepareListingContract({ archive, output }),
      /must not be overwritten/,
    );
    assert.deepEqual(await readFile(join(output, "identity.json")), before);
  },
);
