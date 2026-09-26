import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { editionAdmissionFixture } from "./edition-fixture.mjs";
import { EDITION_REVIEW_GATES } from "./edition-promotion.mjs";

import {
  RELEASE_ASSET_NAMES,
  decideReleaseAssets,
  ensureDraftRelease,
  normalizeAssetDigest,
  publishExactRelease,
  reconcileReleaseAssets,
} from "./fastline-release-publisher.mjs";

const sourceSha = "a".repeat(40);
const version = "v1.2.3";
const repository = "example/revealline";
const expected = RELEASE_ASSET_NAMES.map((name, index) => ({
  name,
  size: index + 1,
  digest: `sha256:${String(index).padStart(64, "0")}`,
}));

test("reuses exact assets and creates only missing draft assets", () => {
  const actual = expected.slice(0, 4);
  assert.deepEqual(decideReleaseAssets({ expected, actual }), {
    reused: RELEASE_ASSET_NAMES.slice(0, 4),
    missing: RELEASE_ASSET_NAMES.slice(4),
  });
});

test("fails closed on extra, changed, digestless, and published missing assets", () => {
  assert.throws(
    () =>
      decideReleaseAssets({
        expected,
        actual: [
          ...expected,
          { name: "extra", size: 1, digest: expected[0].digest },
        ],
      }),
    /unexpected release asset/u,
  );
  assert.throws(
    () =>
      decideReleaseAssets({
        expected,
        actual: [{ ...expected[0], size: 99 }],
      }),
    /differs/u,
  );
  assert.throws(() => normalizeAssetDigest(null), /no usable SHA-256/u);
  assert.throws(
    () => decideReleaseAssets({ expected, actual: [], published: true }),
    /never be overwritten/u,
  );
});

test("creates an annotated tag and exact draft once, then reuses it", async () => {
  let state = "absent";
  const calls = [];
  const request = async (pathname, options = {}) => {
    calls.push([pathname, options.method || "GET"]);
    if (pathname.endsWith("/git/tags")) {
      state = "tag-object";
      return { sha: "b".repeat(40) };
    }
    if (pathname.endsWith("/git/refs")) {
      state = "tag";
      return {};
    }
    if (pathname.endsWith("/releases")) {
      state = "draft";
      return {};
    }
    throw new Error(`unexpected ${pathname}`);
  };
  const inspect = async () => {
    if (state === "absent" || state === "tag-object")
      return {
        tagCommit: null,
        tagType: null,
        release: null,
        decision: { action: "create", state: "absent" },
      };
    if (state === "tag")
      return {
        tagCommit: sourceSha,
        tagType: "tag",
        release: null,
        decision: { action: "create-release", state: "tag-only" },
      };
    const release = {
      id: 7,
      tag_name: version,
      target_commitish: sourceSha,
      draft: true,
      prerelease: false,
    };
    return {
      tagCommit: sourceSha,
      tagType: "tag",
      release,
      decision: { action: "reuse", state: "draft" },
    };
  };
  const release = await ensureDraftRelease({
    repository,
    version,
    sourceSha,
    request,
    inspect,
  });
  assert.equal(release.id, 7);
  assert.deepEqual(calls, [
    [`/repos/${repository}/git/tags`, "POST"],
    [`/repos/${repository}/git/refs`, "POST"],
    [`/repos/${repository}/releases`, "POST"],
  ]);
});

test("publishes only an exact complete draft and reuses an exact publication", async () => {
  let draft = true;
  const release = () => ({
    id: 9,
    tag_name: version,
    target_commitish: sourceSha,
    draft,
    prerelease: false,
    published_at: draft ? null : "2026-09-26T00:00:00Z",
  });
  const inspect = async () => ({
    tagCommit: sourceSha,
    tagType: "tag",
    release: release(),
    decision: { action: "reuse", state: draft ? "draft" : "published" },
  });
  const request = async (pathname, options = {}) => {
    if (pathname.includes("/assets")) return expected;
    if (options.method === "PATCH") {
      draft = false;
      return release();
    }
    throw new Error(`unexpected ${pathname}`);
  };
  const first = await publishExactRelease({
    repository,
    version,
    sourceSha,
    expected,
    request,
    inspect,
  });
  assert.equal(first.draft, false);
  const second = await publishExactRelease({
    repository,
    version,
    sourceSha,
    expected,
    request,
    inspect,
  });
  assert.equal(second.published_at, "2026-09-26T00:00:00Z");
});

// Synthetic reviews exercise admission only; they assert no real human approval.
function reviewedEditions() {
  const fixture = editionAdmissionFixture({ version });
  const encode = (value) => Buffer.from(JSON.stringify(value));
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const proof = Buffer.from(
    "Synthetic fixture evidence, not human qualification.",
  );
  fixture.files.set("review-fixture.txt", proof);
  const review = {
    format: "revealline-edition-review.v1",
    version,
    sourceRevision: sourceSha,
    sourceTree: fixture.envelope.sourceTree,
    publication: "public",
    editions: fixture.envelope.editions.map(({ id }) => ({
      id,
      gates: EDITION_REVIEW_GATES.map((gate) => ({
        id: gate,
        status: "passed",
        reviewer: "Synthetic fixture",
        reviewedAt: "2026-09-26T12:00:00.000Z",
        evidence: {
          path: "review-fixture.txt",
          bytes: proof.length,
          sha256: hash(proof),
          publication: "public",
          approved: true,
        },
      })),
    })),
  };
  const rebind = () => {
    const envelope = encode(fixture.envelope);
    review.envelopeSha256 = hash(envelope);
    fixture.files.set("editions.json", envelope);
    fixture.files.set("edition-review.json", encode(review));
  };
  rebind();
  const release = {
    id: 19,
    tag_name: version,
    target_commitish: sourceSha,
    draft: true,
    prerelease: false,
  };
  const actual = () => [
    ...expected,
    ...[...fixture.files].map(([name, bytes], index) => ({
      id: 100 + index,
      name,
      size: bytes.length,
      digest: `sha256:${hash(bytes)}`,
    })),
  ];
  let patches = 0;
  const request = async (url, options = {}) => {
    if (url.endsWith("/assets?per_page=100&page=1")) return actual();
    if (url.endsWith(`/git/commits/${sourceSha}`))
      return { sha: sourceSha, tree: { sha: "b".repeat(40) } };
    if (options.method === "PATCH") {
      patches++;
      return {
        ...release,
        draft: false,
        published_at: "2026-09-26T12:00:00.000Z",
      };
    }
    throw new Error(`unexpected fixture request: ${url}`);
  };
  const options = {
    repository,
    version,
    sourceSha,
    expected,
    release,
    request,
    readAsset: async ({ asset, maxBytes }) => {
      assert.ok(asset.size <= maxBytes);
      return fixture.files.get(asset.name);
    },
    inspect: async () => ({ release }),
  };
  return {
    ...fixture,
    options,
    review,
    rebind,
    encode,
    hash,
    patches: () => patches,
  };
}

test("publishes a complete reviewed additive edition after original ZIP admission", async () => {
  const fixture = reviewedEditions();
  const result = await reconcileReleaseAssets(fixture.options);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.reused, RELEASE_ASSET_NAMES);
  assert.deepEqual(
    result.admittedEditionAssets,
    [...fixture.files.keys()].sort(),
  );
  assert.equal((await publishExactRelease(fixture.options)).draft, false);
  assert.equal(fixture.patches(), 1);
});

test("additive publication rejects incomplete, unreviewed, changed and unrelated bytes before PATCH", async (t) => {
  const cases = [
    [
      "missing envelope",
      (f) => f.files.delete("editions.json"),
      /complete edition envelope/,
    ],
    [
      "missing member",
      (f) => f.files.delete(f.envelope.editions[0].manifest.path),
      /missing or oversized/,
    ],
    [
      "unknown extra",
      (f) => f.files.set("private-note.txt", Buffer.from("must not publish")),
      /outside the admitted/,
    ],
    [
      "pending review",
      (f) => {
        f.review.editions[0].gates[0].status = "pending";
        f.rebind();
      },
      /Every promotion gate/,
    ],
    [
      "foreign source tree",
      (f) => {
        f.envelope.sourceTree = "c".repeat(40);
        f.rebind();
      },
      /source commit and tree/,
    ],
    [
      "foreign version",
      (f) => {
        f.envelope.version = "v9.9.9";
        f.rebind();
      },
      /source commit and tree/,
    ],
    [
      "foreign source commit",
      (f) => {
        f.envelope.sourceRevision = "c".repeat(40);
        f.rebind();
      },
      /source commit and tree/,
    ],
    [
      "changed evidence with a valid server digest",
      (f) => f.files.set("review-fixture.txt", Buffer.from("unreviewed replacement")),
      /evidence bytes changed|missing or oversized/,
    ],
    [
      "changed download",
      (f) => {
        f.options.readAsset = async ({ asset }) =>
          Buffer.concat([f.files.get(asset.name), Buffer.from("changed")]);
      },
      /original bytes differ/,
    ],
    [
      "corrupt ZIP despite rebound outer hash",
      (f) => {
        const descriptor = f.envelope.editions[0].sourceArchive;
        const archive = Buffer.from(f.files.get(descriptor.path));
        archive[50] ^= 1;
        f.files.set(descriptor.path, archive);
        descriptor.sha256 = f.hash(archive);
        f.rebind();
      },
      /ZIP|zip|CRC|member/,
    ],
  ];
  for (const [name, mutate, error] of cases)
    await t.test(name, async () => {
      const fixture = reviewedEditions();
      mutate(fixture);
      await assert.rejects(publishExactRelease(fixture.options), error);
      assert.equal(fixture.patches(), 0);
    });
});

test("duplicate default or additive server names cannot disappear in a map", async () => {
  assert.throws(
    () => decideReleaseAssets({ expected, actual: [...expected, expected[0]] }),
    /duplicate/,
  );
  const fixture = reviewedEditions(),
    request = fixture.options.request;
  fixture.options.request = async (url, options) => {
    const result = await request(url, options);
    return url.includes("/assets?") ? [...result, result.at(-1)] : result;
  };
  await assert.rejects(publishExactRelease(fixture.options), /duplicate/);
  assert.equal(fixture.patches(), 0);
});

test("trusted publisher sparse checkout includes the complete static edition validator closure", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/fastline-release.yml", import.meta.url),
    "utf8",
  );
  const checkout = workflow
    .split("- name: Check out trusted guarded publisher")[1]
    ?.split("- name:")[0];
  assert.ok(checkout);
  for (const file of [
    "publishing/edition-promotion.mjs",
    "publishing/edition-admission.mjs",
    "publishing/edition-zip.mjs",
    "game/edition-context.mjs",
  ])
    assert.ok(checkout.includes(file), file);
});
