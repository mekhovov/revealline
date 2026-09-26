#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  decideReleaseObjects,
  inspectReleaseObjects,
} from "./fastline-release-objects.mjs";
import { verifyEditionReview } from "./edition-promotion.mjs";

const SHA = /^[0-9a-f]{40}$/u;
const VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+$/u;
export const RELEASE_ASSET_NAMES = Object.freeze([
  "distribution.zip",
  "distribution.zip.sha256",
  "manifest.json",
  "qualification-evidence-record.json",
  "release.json",
  "source-qualification-evidence.zip",
  "source-qualification.json",
  "source.tar",
  "verification.json",
]);

function assertRequest({ repository, version, sourceSha }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository || ""))
    throw new Error("invalid repository identity");
  if (!VERSION.test(version || "")) throw new Error("invalid release version");
  if (!SHA.test(sourceSha || "")) throw new Error("invalid source commit");
}

export function normalizeAssetDigest(value) {
  const digest = String(value || "").toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/u.test(digest))
    throw new Error("release asset has no usable SHA-256 digest");
  return digest;
}

export function decideReleaseAssets({ expected, actual, published = false }) {
  const expectedByName = new Map(expected.map((asset) => [asset.name, asset]));
  const actualByName = new Map(actual.map((asset) => [asset.name, asset]));
  if (actualByName.size !== actual.length)
    throw new Error("duplicate release asset names");
  if (expectedByName.size !== RELEASE_ASSET_NAMES.length)
    throw new Error(
      "expected release asset set must contain exactly nine names",
    );
  for (const name of RELEASE_ASSET_NAMES)
    if (!expectedByName.has(name))
      throw new Error(`expected release asset is missing ${name}`);
  for (const name of actualByName.keys())
    if (!expectedByName.has(name))
      throw new Error(`unexpected release asset ${name}`);

  const missing = [];
  const reused = [];
  for (const name of RELEASE_ASSET_NAMES) {
    const wanted = expectedByName.get(name);
    const found = actualByName.get(name);
    if (!found) {
      missing.push(name);
      continue;
    }
    const foundDigest = normalizeAssetDigest(found.digest);
    if (found.size !== wanted.size || foundDigest !== wanted.digest)
      throw new Error(`existing release asset differs: ${name}`);
    reused.push(name);
  }
  if (published && missing.length)
    throw new Error(
      "published release assets are incomplete and must never be overwritten",
    );
  return { missing, reused };
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function inspectLocalAssets(directory) {
  const names = (await fs.readdir(directory)).sort();
  const expectedNames = [...RELEASE_ASSET_NAMES].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames))
    throw new Error(
      `local release assets differ from the exact nine-name contract: ${names.join(", ")}`,
    );
  const assets = [];
  for (const name of RELEASE_ASSET_NAMES) {
    const file = path.join(directory, name);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`release asset is not an ordinary file: ${name}`);
    assets.push({
      name,
      size: stat.size,
      digest: `sha256:${await sha256(file)}`,
    });
  }
  return assets;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGitHubRequest({
  fetchImpl = fetch,
  token = process.env.GH_TOKEN,
  wait = sleep,
  now = Date.now,
} = {}) {
  return async function githubRequest(pathname, options = {}) {
    const method = options.method || "GET";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(`https://api.github.com${pathname}`, {
          ...options,
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-github-api-version": "2022-11-28",
            "user-agent": "revealline-fastline-release-publisher",
            ...options.headers,
          },
        });
      } catch {
        if (method === "GET" && attempt < 2) {
          await wait(1000 * 2 ** attempt);
          continue;
        }
        const error = new Error(
          `GitHub transport outcome unknown: ${method} ${pathname}`,
        );
        error.ambiguousWrite = method !== "GET";
        throw error;
      }
      if (options.allowMissing && response.status === 404) return null;
      let text;
      try {
        text = await response.text();
      } catch {
        const error = new Error(
          `GitHub response body unavailable: ${method} ${pathname}`,
        );
        error.ambiguousWrite = method !== "GET";
        throw error;
      }
      if (!response.ok) {
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          body = {};
        }
        const codes = Array.isArray(body.errors)
          ? body.errors
              .map((entry) => entry?.code)
              .filter(
                (code) =>
                  typeof code === "string" && /^[a-z_]{1,64}$/u.test(code),
              )
          : [];
        const retryAfter = response.headers.get("retry-after");
        const reset = response.headers.get("x-ratelimit-reset");
        const rateLimited =
          response.status === 429 ||
          (response.status === 403 &&
            (retryAfter !== null ||
              response.headers.get("x-ratelimit-remaining") === "0" ||
              /rate limit/iu.test(body.message || "")));
        let delay = 1000 * 2 ** attempt;
        if (rateLimited) {
          delay = 60000;
          if (retryAfter !== null) {
            const seconds = Number(retryAfter);
            delay = Number.isFinite(seconds)
              ? seconds * 1000
              : Date.parse(retryAfter) - now();
          } else if (
            reset !== null &&
            response.headers.get("x-ratelimit-remaining") === "0"
          ) {
            delay = Number(reset) * 1000 - now();
          }
          if (!Number.isFinite(delay)) delay = 60000;
          delay = Math.max(0, delay);
        }
        if (
          method === "GET" &&
          attempt < 2 &&
          delay <= 60000 &&
          (rateLimited || response.status >= 500)
        ) {
          await wait(delay);
          continue;
        }
        let message =
          typeof body.message === "string"
            ? body.message
            : "non-JSON error response";
        if (token) message = message.split(token).join("[REDACTED]");
        message = message
          .replace(/Bearer\s+\S+/giu, "Bearer [REDACTED]")
          .replace(/[\r\n\x00-\x1f]/gu, " ")
          .slice(0, 300);
        const error = new Error(
          `GitHub ${response.status} ${method} ${pathname}: ${message}; codes=${codes.join(",") || "none"}${rateLimited ? `; retryAfterMs=${delay}` : ""}`,
        );
        error.status = response.status;
        error.codes = codes;
        error.rateLimited = rateLimited;
        error.retryAfterMs = rateLimited ? delay : undefined;
        throw error;
      }
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        const error = new Error(
          `GitHub response JSON invalid: ${method} ${pathname}`,
        );
        error.ambiguousWrite = method !== "GET";
        throw error;
      }
    }
    throw new Error("GitHub read retry budget exhausted");
  };
}

const github = (...args) => createGitHubRequest()(...args);

function recoverableWrite(error) {
  return (
    error?.ambiguousWrite ||
    error?.status >= 500 ||
    (error?.status === 422 && error.codes?.includes("already_exists"))
  );
}

async function listReleaseAssets(repository, releaseId, request = github) {
  const assets = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await request(
      `/repos/${repository}/releases/${releaseId}/assets?per_page=100&page=${page}`,
    );
    assets.push(...batch);
    if (batch.length < 100) return assets;
  }
  throw new Error("release asset pagination exceeded its bound");
}

async function readReleaseAsset({ repository, asset, maxBytes }) {
  if (!Number.isSafeInteger(asset.id) || asset.id <= 0)
    throw new Error("invalid edition release asset ID");
  const response = await fetch(
    `https://api.github.com/repos/${repository}/releases/assets/${asset.id}`,
    {
      headers: {
        accept: "application/octet-stream",
        authorization: `Bearer ${process.env.GH_TOKEN}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "revealline-fastline-release-publisher",
      },
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok || !response.body)
    throw new Error(`edition asset download failed: ${asset.name}`);
  const reader = response.body.getReader(),
    chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes || length > asset.size) {
        await reader.cancel();
        throw new Error(`edition asset exceeds reviewed size: ${asset.name}`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

/** Additive assets need their complete original-byte review, never a name allowlist. */
export async function verifyAdditiveEditionAssets({
  repository,
  release,
  version,
  sourceSha,
  actual,
  request = github,
  readAsset = readReleaseAsset,
}) {
  const names = new Set(actual.map((asset) => asset.name));
  if (names.size !== actual.length)
    throw new Error("duplicate release asset name");
  const additions = actual.filter(
    (asset) => !RELEASE_ASSET_NAMES.includes(asset.name),
  );
  if (!additions.length) return [];
  assertRequest({ repository, version, sourceSha });
  if (release.tag_name !== version || release.target_commitish !== sourceSha)
    throw new Error(
      "edition release identity differs from the exact source request",
    );
  const byName = new Map(additions.map((asset) => [asset.name, asset]));
  if (!byName.has("editions.json") || !byName.has("edition-review.json"))
    throw new Error(
      "unexpected release assets lack a complete edition envelope and review",
    );
  let bytesRead = 0;
  const consumed = new Map();
  const read = async (name, limit = 950_000_000) => {
    if (!/^[A-Za-z0-9_.-]+$/u.test(name) || name === "." || name === "..")
      throw new Error("invalid additive edition asset path");
    if (consumed.has(name)) return consumed.get(name);
    const asset = byName.get(name);
    if (
      !asset ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      asset.size > limit
    )
      throw new Error(`missing or oversized edition asset: ${name}`);
    bytesRead += asset.size;
    if (bytesRead > 950_000_000)
      throw new Error("additive edition assets exceed byte budget");
    const digest = normalizeAssetDigest(asset.digest);
    const bytes = await readAsset({
      repository,
      asset,
      maxBytes: Math.min(limit, asset.size),
    });
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.length !== asset.size ||
      `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== digest
    )
      throw new Error(`edition asset original bytes differ: ${name}`);
    consumed.set(name, bytes);
    return bytes;
  };
  const envelopeBytes = await read("editions.json", 8_000_000);
  const envelope = JSON.parse(Buffer.from(envelopeBytes).toString("utf8"));
  const review = JSON.parse(
    Buffer.from(await read("edition-review.json", 8_000_000)).toString("utf8"),
  );
  const commit = await request(`/repos/${repository}/git/commits/${sourceSha}`);
  if (
    commit.sha !== sourceSha ||
    !SHA.test(commit.tree?.sha || "") ||
    envelope.version !== version ||
    envelope.sourceRevision !== sourceSha ||
    envelope.sourceTree !== commit.tree.sha
  )
    throw new Error(
      "edition envelope differs from the exact release source commit and tree",
    );
  await verifyEditionReview(envelopeBytes, review, {
    read: (descriptor) => read(descriptor.path, descriptor.bytes),
  });
  if (consumed.size !== additions.length)
    throw new Error(
      "unexpected release asset outside the admitted edition closure",
    );
  return [...consumed.keys()].sort();
}

export async function ensureDraftRelease({
  repository,
  version,
  sourceSha,
  request = github,
  inspect = inspectReleaseObjects,
  wait = sleep,
}) {
  assertRequest({ repository, version, sourceSha });
  const discover = async (predicate, { releaseId, cause } = {}) => {
    for (const delay of [0, 1000, 2000, 4000]) {
      if (delay) await wait(delay);
      const found = await inspect({
        repository,
        version,
        sourceSha,
        releaseId,
        get: request,
      });
      decideReleaseObjects({ version, sourceSha, ...found });
      if (predicate(found)) return found;
    }
    throw new Error(
      `exact release object not confirmed; no write was retried${cause ? `: ${cause.message}` : ""}`,
      { cause },
    );
  };
  let state = await inspect({ repository, version, sourceSha, get: request });
  if (state.decision.state === "published" || state.release?.draft)
    return state.release;

  if (state.decision.action === "create") {
    let writeError;
    let tag;
    try {
      tag = await request(`/repos/${repository}/git/tags`, {
        method: "POST",
        body: JSON.stringify({
          tag: version,
          message: `Reveal Line ${version}`,
          object: sourceSha,
          type: "commit",
        }),
      });
      if (!SHA.test(tag?.sha || ""))
        throw new Error("invalid annotated tag creation response");
    } catch (error) {
      if (!recoverableWrite(error)) throw error;
      writeError = error;
    }
    if (!writeError) {
      try {
        await request(`/repos/${repository}/git/refs`, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/tags/${version}`, sha: tag.sha }),
        });
      } catch (error) {
        // Ref conflicts need not include structured errors[].code. Only this
        // endpoint permits read-only discovery for an otherwise generic 422.
        if (!recoverableWrite(error) && ![409, 422].includes(error?.status))
          throw error;
        writeError = error;
      }
    }
    state = await discover((found) => found.tagCommit === sourceSha, {
      cause: writeError,
    });
  }

  if (state.decision.action === "create-release") {
    let releaseId;
    let writeError;
    try {
      const created = await request(`/repos/${repository}/releases`, {
        method: "POST",
        body: JSON.stringify({
          tag_name: version,
          target_commitish: sourceSha,
          name: version,
          draft: true,
          prerelease: false,
          generate_release_notes: false,
        }),
      });
      if (!Number.isSafeInteger(created?.id) || created.id <= 0)
        throw new Error("invalid draft creation receipt: missing release ID");
      decideReleaseObjects({
        version,
        sourceSha,
        tagCommit: state.tagCommit,
        tagType: state.tagType,
        release: created,
      });
      if (!created.draft)
        throw new Error("draft creation returned a published release");
      releaseId = created.id;
    } catch (error) {
      if (!recoverableWrite(error)) throw error;
      writeError = error;
    }
    state = await discover(
      (found) =>
        found.release !== null &&
        (releaseId === undefined || found.release.id === releaseId),
      { releaseId, cause: writeError },
    );
  }

  decideReleaseObjects({
    version,
    sourceSha,
    tagCommit: state.tagCommit,
    tagType: state.tagType,
    release: state.release,
  });
  if (!state.release) throw new Error("exact draft release was not created");
  return state.release;
}

export async function reconcileReleaseAssets({
  repository,
  release,
  version,
  sourceSha,
  expected,
  request = github,
  readAsset = readReleaseAsset,
}) {
  const actual = await listReleaseAssets(repository, release.id, request);
  const admitted = await verifyAdditiveEditionAssets({
    repository,
    release,
    version,
    sourceSha,
    actual,
    request,
    readAsset,
  });
  const result = decideReleaseAssets({
    expected,
    actual: actual.filter((asset) => !admitted.includes(asset.name)),
    published: !release.draft,
  });
  return admitted.length
    ? { ...result, admittedEditionAssets: admitted }
    : result;
}

export async function publishExactRelease({
  repository,
  version,
  sourceSha,
  expected,
  request = github,
  inspect = inspectReleaseObjects,
  readAsset = readReleaseAsset,
}) {
  const state = await inspect({ repository, version, sourceSha, get: request });
  if (!state.release) throw new Error("exact release is absent");
  const assets = await reconcileReleaseAssets({
    repository,
    release: state.release,
    version,
    sourceSha,
    expected,
    request,
    readAsset,
  });
  if (assets.missing.length)
    throw new Error(`release assets are missing: ${assets.missing.join(", ")}`);
  if (!state.release.draft) return state.release;
  const published = await request(
    `/repos/${repository}/releases/${state.release.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ draft: false }),
    },
  );
  if (published.draft || !published.published_at)
    throw new Error("GitHub did not publish the exact draft release");
  return published;
}

async function writeOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
}

async function main() {
  if (!process.env.GH_TOKEN) throw new Error("GH_TOKEN is required");
  const repository = process.env.GITHUB_REPOSITORY;
  const version = process.env.VERSION;
  const sourceSha = process.env.SOURCE_SHA;
  const directory = path.resolve(
    process.env.ASSET_DIRECTORY || "release-assets",
  );
  const expected = await inspectLocalAssets(directory);
  const mode = process.argv[2];
  if (mode === "prepare") {
    const release = await ensureDraftRelease({
      repository,
      version,
      sourceSha,
    });
    const assets = await reconcileReleaseAssets({
      repository,
      release,
      version,
      sourceSha,
      expected,
    });
    await writeOutputs({
      release_id: release.id,
      release_state: release.draft ? "draft" : "published",
      missing_json: JSON.stringify(assets.missing),
    });
    process.stdout.write(`${JSON.stringify(assets)}\n`);
    return;
  }
  if (mode === "publish") {
    const release = await publishExactRelease({
      repository,
      version,
      sourceSha,
      expected,
    });
    await writeOutputs({
      release_id: release.id,
      published_at: release.published_at,
    });
    process.stdout.write(
      `${JSON.stringify({ id: release.id, publishedAt: release.published_at })}\n`,
    );
    return;
  }
  throw new Error("usage: fastline-release-publisher.mjs prepare|publish");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
