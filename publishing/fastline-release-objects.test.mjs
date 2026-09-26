import assert from "node:assert/strict";
import test from "node:test";
import {
  decideReleaseObjects,
  inspectReleaseObjects,
  resolveTagCommit,
} from "./fastline-release-objects.mjs";

const sourceSha = "a".repeat(40);
const tagObject = "b".repeat(40);
const repository = "example/revealline";
const version = "v1.2.3";

test("creates only missing objects and reuses only exact objects", () => {
  assert.equal(decideReleaseObjects({ version, sourceSha }).action, "create");
  assert.equal(
    decideReleaseObjects({ version, sourceSha, tagCommit: sourceSha }).action,
    "create-release",
  );
  assert.deepEqual(
    decideReleaseObjects({
      version,
      sourceSha,
      tagCommit: sourceSha,
      release: {
        tag_name: version,
        target_commitish: sourceSha,
        draft: true,
        prerelease: false,
      },
    }),
    {
      action: "reuse",
      state: "draft",
      reason: "exact draft release exists",
    },
  );
});

test("fails closed on tag, release, or stable-channel drift", () => {
  assert.throws(
    () =>
      decideReleaseObjects({
        version,
        sourceSha,
        tagCommit: "c".repeat(40),
      }),
    /resolves to/u,
  );
  for (const release of [
    {
      tag_name: version,
      target_commitish: "c".repeat(40),
      draft: true,
      prerelease: false,
    },
    {
      tag_name: version,
      target_commitish: sourceSha,
      draft: true,
      prerelease: true,
    },
  ])
    assert.throws(() =>
      decideReleaseObjects({
        version,
        sourceSha,
        tagCommit: sourceSha,
        release,
      }),
    );
  assert.throws(
    () =>
      decideReleaseObjects({
        version,
        sourceSha,
        release: {
          tag_name: version,
          target_commitish: sourceSha,
          draft: true,
          prerelease: false,
        },
      }),
    /no matching immutable tag/u,
  );
});

test("resolves a bounded annotated tag chain to the exact commit", async () => {
  const get = async (pathname) => {
    if (pathname.endsWith(`/git/ref/tags/${version}`))
      return {
        ref: `refs/tags/${version}`,
        object: { type: "tag", sha: tagObject },
      };
    if (pathname.endsWith(`/git/tags/${tagObject}`))
      return {
        sha: tagObject,
        object: { type: "commit", sha: sourceSha },
      };
    throw new Error(`unexpected ${pathname}`);
  };
  assert.equal(await resolveTagCommit({ repository, version, get }), sourceSha);
});

test("inspection compares the tag and draft in one fail-closed decision", async () => {
  const get = async (pathname) => {
    if (pathname.endsWith(`/git/ref/tags/${version}`))
      return {
        ref: `refs/tags/${version}`,
        object: { type: "commit", sha: sourceSha },
      };
    if (pathname.endsWith(`/releases/tags/${version}`))
      return {
        id: 19,
        tag_name: version,
        target_commitish: sourceSha,
        draft: false,
        prerelease: false,
      };
    throw new Error(`unexpected ${pathname}`);
  };
  const result = await inspectReleaseObjects({
    repository,
    version,
    sourceSha,
    get,
  });
  assert.deepEqual(result.decision, {
    action: "reuse",
    state: "published",
    reason: "exact published release exists",
  });
});
