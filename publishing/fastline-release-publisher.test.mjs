import assert from "node:assert/strict";
import test from "node:test";

import {
  RELEASE_ASSET_NAMES,
  decideReleaseAssets,
  ensureDraftRelease,
  normalizeAssetDigest,
  publishExactRelease,
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
