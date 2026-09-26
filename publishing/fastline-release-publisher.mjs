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

async function github(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "revealline-fastline-release-publisher",
      ...options.headers,
    },
  });
  if (options.allowMissing && response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(
      `GitHub ${response.status} ${pathname}: ${text.slice(0, 1000)}`,
    );
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
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

export async function ensureDraftRelease({
  repository,
  version,
  sourceSha,
  request = github,
  inspect = inspectReleaseObjects,
}) {
  assertRequest({ repository, version, sourceSha });
  let state = await inspect({ repository, version, sourceSha, get: request });
  if (state.decision.state === "published" || state.release?.draft)
    return state.release;

  if (state.decision.action === "create") {
    try {
      const tag = await request(`/repos/${repository}/git/tags`, {
        method: "POST",
        body: JSON.stringify({
          tag: version,
          message: `Reveal Line ${version}`,
          object: sourceSha,
          type: "commit",
        }),
      });
      await request(`/repos/${repository}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/tags/${version}`, sha: tag.sha }),
      });
    } catch (error) {
      if (error?.status !== 422) throw error;
    }
    state = await inspect({ repository, version, sourceSha, get: request });
  }

  if (state.decision.action === "create-release") {
    try {
      await request(`/repos/${repository}/releases`, {
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
    } catch (error) {
      if (error?.status !== 422) throw error;
    }
  }

  state = await inspect({ repository, version, sourceSha, get: request });
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
  expected,
  request = github,
}) {
  const actual = await listReleaseAssets(repository, release.id, request);
  return decideReleaseAssets({
    expected,
    actual,
    published: !release.draft,
  });
}

export async function publishExactRelease({
  repository,
  version,
  sourceSha,
  expected,
  request = github,
  inspect = inspectReleaseObjects,
}) {
  const state = await inspect({ repository, version, sourceSha, get: request });
  if (!state.release) throw new Error("exact release is absent");
  const assets = await reconcileReleaseAssets({
    repository,
    release: state.release,
    expected,
    request,
  });
  if (assets.missing.length)
    throw new Error(`release assets are missing: ${assets.missing.join(", ")}`);
  if (!state.release.draft) return state.release;
  const published = await request(
    `/repos/${repository}/releases/${state.release.id}`,
    { method: "PATCH", body: JSON.stringify({ draft: false }) },
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
