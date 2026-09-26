import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { editionAdmissionFixture } from "./edition-fixture.mjs";
import { EDITION_REVIEW_GATES } from "./edition-promotion.mjs";

import {
  RELEASE_ASSET_NAMES,
  decideReleaseAssets,
  createGitHubRequest,
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
      return {
        id: 7,
        tag_name: version,
        target_commitish: sourceSha,
        draft: true,
        prerelease: false,
      };
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

const draft = {
  id: 7,
  tag_name: version,
  target_commitish: sourceSha,
  draft: true,
  prerelease: false,
};
const tagOnly = {
  tagCommit: sourceSha,
  tagType: "tag",
  release: null,
  decision: { action: "create-release", state: "tag-only" },
};
const withRelease = (release = draft) => ({
  ...tagOnly,
  release,
  decision: { action: "reuse", state: release.draft ? "draft" : "published" },
});

test("pins returned release ID despite delayed draft discovery without repeating POST", async () => {
  let reads = 0;
  let posts = 0;
  const delays = [];
  const release = await ensureDraftRelease({
    repository,
    version,
    sourceSha,
    request: async () => {
      posts += 1;
      return draft;
    },
    inspect: async ({ releaseId }) => {
      reads += 1;
      if (reads === 1) return tagOnly;
      assert.equal(releaseId, 7);
      return reads < 4 ? tagOnly : withRelease();
    },
    wait: async (delay) => delays.push(delay),
  });
  assert.equal(release.id, 7);
  assert.equal(posts, 1);
  assert.deepEqual(delays, [1000, 2000]);
});

test("does not swallow genuine 422 validation errors", async () => {
  const error = Object.assign(new Error("GitHub 422: invalid tag"), {
    status: 422,
    codes: ["invalid"],
  });
  let reads = 0;
  await assert.rejects(
    ensureDraftRelease({
      repository,
      version,
      sourceSha,
      inspect: async () => {
        reads += 1;
        return tagOnly;
      },
      request: async () => {
        throw error;
      },
    }),
    (caught) => caught === error,
  );
  assert.equal(reads, 1);
});

for (const failure of [
  { status: 422, codes: ["already_exists"] },
  { ambiguousWrite: true },
  { status: 503 },
]) {
  test(`discovers matching object after ambiguous/conflicting write ${JSON.stringify(failure)}`, async () => {
    let posts = 0;
    let reads = 0;
    const release = await ensureDraftRelease({
      repository,
      version,
      sourceSha,
      inspect: async () => (++reads === 1 ? tagOnly : withRelease()),
      request: async () => {
        posts += 1;
        throw Object.assign(new Error("uncertain outcome"), failure);
      },
    });
    assert.equal(release.id, 7);
    assert.equal(posts, 1);
  });
}

test("absent object after ambiguous write stops with original diagnostic and no second write", async () => {
  let writes = 0;
  await assert.rejects(
    ensureDraftRelease({
      repository,
      version,
      sourceSha,
      inspect: async () => tagOnly,
      request: async () => {
        writes += 1;
        throw Object.assign(new Error("request lost"), {
          ambiguousWrite: true,
        });
      },
      wait: async () => {},
    }),
    /no write was retried: request lost/u,
  );
  assert.equal(writes, 1);
});

test("creation receipt rejects missing ID and mismatched source without recovery writes", async () => {
  for (const returned of [
    { ...draft, id: undefined },
    { ...draft, target_commitish: "b".repeat(40) },
  ]) {
    await assert.rejects(
      ensureDraftRelease({
        repository,
        version,
        sourceSha,
        inspect: async () => tagOnly,
        request: async () => returned,
      }),
      /missing release ID|differs/u,
    );
  }
});

test("discovered mismatched tag fails closed immediately", async () => {
  let reads = 0;
  await assert.rejects(
    ensureDraftRelease({
      repository,
      version,
      sourceSha,
      inspect: async () =>
        ++reads === 1
          ? tagOnly
          : { ...withRelease(), tagCommit: "b".repeat(40) },
      request: async () => draft,
      wait: async () => assert.fail("must not retry a mismatch"),
    }),
    /release tag/u,
  );
});

test("duplicate asset names are rejected rather than collapsed", () => {
  assert.throws(
    () => decideReleaseAssets({ expected, actual: [...expected, expected[0]] }),
    /duplicate/u,
  );
});

test("GET honors Retry-After for 429 and primary-limit reset for 403", async () => {
  for (const [status, headers, delay] of [
    [429, { "retry-after": "2" }, 2000],
    [403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "105" }, 5000],
  ]) {
    let calls = 0;
    const waits = [];
    const request = createGitHubRequest({
      now: () => 100000,
      wait: async (ms) => waits.push(ms),
      fetchImpl: async () =>
        ++calls === 1
          ? new Response('{"message":"rate limit"}', { status, headers })
          : new Response('{"id":7}'),
    });
    assert.deepEqual(await request("/read"), { id: 7 });
    assert.deepEqual(waits, [delay]);
  }
});

test("non-rate-limit 403 and excessive Retry-After stop without immediate retry", async () => {
  for (const [status, headers] of [
    [403, {}],
    [429, { "retry-after": "120" }],
  ]) {
    let calls = 0;
    const request = createGitHubRequest({
      fetchImpl: async () => {
        calls += 1;
        return new Response('{"message":"denied"}', { status, headers });
      },
      wait: async () => assert.fail("must stop"),
    });
    await assert.rejects(request("/read"), /GitHub/u);
    assert.equal(calls, 1);
  }
});

test("writes are never retried by HTTP transport and diagnostics redact credentials", async () => {
  let calls = 0;
  const request = createGitHubRequest({
    token: "secret-token",
    fetchImpl: async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          message: "failed secret-token",
          errors: [{ code: "invalid" }],
        }),
        { status: 422 },
      );
    },
  });
  await assert.rejects(request("/write", { method: "POST" }), (error) => {
    assert.equal(error.status, 422);
    assert.deepEqual(error.codes, ["invalid"]);
    assert.doesNotMatch(error.message, /secret-token/u);
    return true;
  });
  assert.equal(calls, 1);
});

test("lost POST response is classified as ambiguous without automatic resubmission", async () => {
  let calls = 0;
  const request = createGitHubRequest({
    fetchImpl: async () => {
      calls += 1;
      throw new Error("network secret");
    },
  });
  await assert.rejects(
    request("/write", { method: "POST" }),
    (error) =>
      error.ambiguousWrite && !error.message.includes("network secret"),
  );
  assert.equal(calls, 1);
});

test("successful HTTP write with unreadable body is ambiguous, not repeated", async () => {
  for (const response of [
    {
      status: 201,
      ok: true,
      text: async () => {
        throw new Error("stream interrupted");
      },
    },
    new Response("broken JSON", { status: 201 }),
  ]) {
    let calls = 0;
    const request = createGitHubRequest({
      fetchImpl: async () => {
        calls += 1;
        return response;
      },
    });
    await assert.rejects(
      request("/write", { method: "POST" }),
      (error) => error.ambiguousWrite === true,
    );
    assert.equal(calls, 1);
  }
});

test("tag ref conflict can only recover through matching annotated authority", async () => {
  let reads = 0;
  const calls = [];
  await ensureDraftRelease({
    repository,
    version,
    sourceSha,
    inspect: async () =>
      ++reads === 1
        ? {
            tagCommit: null,
            tagType: null,
            release: null,
            decision: { action: "create", state: "absent" },
          }
        : withRelease(),
    request: async (pathname) => {
      calls.push(pathname);
      if (pathname.endsWith("/git/tags")) return { sha: "b".repeat(40) };
      throw Object.assign(new Error("reference exists"), {
        status: 422,
        codes: ["already_exists"],
      });
    },
  });
  assert.deepEqual(calls, [
    `/repos/${repository}/git/tags`,
    `/repos/${repository}/git/refs`,
  ]);
});

for (const status of [409, 422]) {
  for (const authority of ["matching", "missing", "mismatched"]) {
    test(`message-only ref ${status} with ${authority} authority never retries the write`, async () => {
      let reads = 0;
      const writes = [];
      const absent = {
        tagCommit: null,
        tagType: null,
        release: null,
        decision: { action: "create", state: "absent" },
      };
      const request = createGitHubRequest({
        token: "test-token",
        fetchImpl: async (url, options) => {
          writes.push([url, options.method]);
          if (url.endsWith("/git/tags"))
            return new Response(JSON.stringify({ sha: "b".repeat(40) }), {
              status: 201,
            });
          assert.ok(url.endsWith("/git/refs"));
          return new Response(
            JSON.stringify({ message: "Reference already exists" }),
            { status },
          );
        },
      });
      const result = ensureDraftRelease({
        repository,
        version,
        sourceSha,
        request,
        wait: async () => {},
        inspect: async () => {
          reads += 1;
          if (reads === 1 || authority === "missing") return absent;
          if (authority === "mismatched")
            return { ...withRelease(), tagCommit: "c".repeat(40) };
          return withRelease();
        },
      });
      if (authority === "matching") assert.equal((await result).id, draft.id);
      else
        await assert.rejects(
          result,
          authority === "missing"
            ? /Reference already exists/u
            : /resolves to/u,
        );
      assert.equal(writes.length, 2);
      assert.equal(reads, authority === "missing" ? 5 : 2);
    });
  }
}

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
