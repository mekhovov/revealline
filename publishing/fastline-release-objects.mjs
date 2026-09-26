#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA = /^[0-9a-f]{40}$/u;
const VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+$/u;

export function decideReleaseObjects({
  version,
  sourceSha,
  tagCommit = null,
  tagType = "tag",
  release = null,
}) {
  if (!VERSION.test(version || "")) throw new Error("invalid release version");
  if (!SHA.test(sourceSha || "")) throw new Error("invalid source commit");
  if (tagCommit !== null && !SHA.test(tagCommit))
    throw new Error("invalid resolved tag commit");
  if (tagCommit !== null && tagType !== "tag")
    throw new Error("stable fastline release requires an annotated tag");

  if (tagCommit !== null && tagCommit !== sourceSha)
    throw new Error(
      `release tag ${version} resolves to ${tagCommit}, not ${sourceSha}`,
    );

  if (release !== null) {
    if (
      release.tag_name !== version ||
      release.target_commitish !== sourceSha ||
      typeof release.draft !== "boolean" ||
      typeof release.prerelease !== "boolean"
    )
      throw new Error("existing release differs from the exact source request");
    if (tagCommit === null)
      throw new Error("existing release has no matching immutable tag");
    if (release.prerelease)
      throw new Error("stable fastline release cannot reuse a prerelease");
    return {
      action: "reuse",
      state: release.draft ? "draft" : "published",
      reason: `exact ${release.draft ? "draft" : "published"} release exists`,
    };
  }

  if (tagCommit !== null)
    return {
      action: "create-release",
      state: "tag-only",
      reason: "exact annotated tag exists and the release is absent",
    };

  return {
    action: "create",
    state: "absent",
    reason: "tag and release are absent",
  };
}

async function request(pathname, { allowMissing = false } = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "revealline-fastline-release-object-guard",
    },
  });
  if (allowMissing && response.status === 404) return null;
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `GitHub ${response.status} ${pathname}: ${text.slice(0, 1000)}`,
    );
  return text ? JSON.parse(text) : null;
}

export async function resolveTagAuthority({
  repository,
  version,
  get = request,
}) {
  const ref = await get(`/repos/${repository}/git/ref/tags/${version}`, {
    allowMissing: true,
  });
  if (ref === null) return { commit: null, type: null };
  if (ref.ref !== `refs/tags/${version}` || !ref.object)
    throw new Error("release tag reference differs");

  let object = ref.object;
  const seen = new Set();
  for (let depth = 0; depth < 8; depth += 1) {
    if (object.type === "commit" && SHA.test(object.sha || ""))
      return { commit: object.sha, type: ref.object.type };
    if (
      object.type !== "tag" ||
      !SHA.test(object.sha || "") ||
      seen.has(object.sha)
    )
      throw new Error("invalid or cyclic annotated release tag");
    seen.add(object.sha);
    const tag = await get(`/repos/${repository}/git/tags/${object.sha}`);
    if (!tag || tag.sha !== object.sha || !tag.object)
      throw new Error("annotated release tag object differs");
    object = tag.object;
  }
  throw new Error("annotated release tag chain exceeded bound");
}

export async function resolveTagCommit(options) {
  return (await resolveTagAuthority(options)).commit;
}

export async function resolveRelease({
  repository,
  version,
  releaseId,
  get = request,
}) {
  if (releaseId !== undefined) {
    if (!Number.isSafeInteger(releaseId) || releaseId <= 0)
      throw new Error("invalid release ID");
    const release = await get(`/repos/${repository}/releases/${releaseId}`, {
      allowMissing: true,
    });
    if (release !== null && release.id !== releaseId)
      throw new Error("release ID differs from the creation receipt");
    return release;
  }
  const published = await get(`/repos/${repository}/releases/tags/${version}`, {
    allowMissing: true,
  });
  if (published !== null) return published;

  const matches = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await get(
      `/repos/${repository}/releases?per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch) || batch.length > 100)
      throw new Error("invalid release listing");
    matches.push(...batch.filter((release) => release?.tag_name === version));
    if (batch.length < 100) {
      if (matches.length > 1)
        throw new Error("multiple releases use the requested tag");
      return matches[0] || null;
    }
  }
  throw new Error("release pagination exceeded its bound");
}

export async function inspectReleaseObjects({
  repository,
  version,
  sourceSha,
  releaseId,
  get = request,
}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository || ""))
    throw new Error("invalid repository identity");
  const [tag, release] = await Promise.all([
    resolveTagAuthority({ repository, version, get }),
    resolveRelease({ repository, version, releaseId, get }),
  ]);
  return {
    tagCommit: tag.commit,
    tagType: tag.type,
    release,
    decision: decideReleaseObjects({
      version,
      sourceSha,
      tagCommit: tag.commit,
      tagType: tag.type,
      release,
    }),
  };
}

async function main() {
  const result = await inspectReleaseObjects({
    repository: process.env.GITHUB_REPOSITORY,
    version: process.env.VERSION,
    sourceSha: process.env.SOURCE_SHA,
  });
  const lines = [
    `object_action=${result.decision.action}`,
    `object_state=${result.decision.state}`,
    `tag_commit=${result.tagCommit || ""}`,
    `release_id=${result.release?.id || ""}`,
    "",
  ];
  if (process.env.GITHUB_OUTPUT)
    await fs.appendFile(process.env.GITHUB_OUTPUT, lines.join("\n"));
  process.stdout.write(`${JSON.stringify(result.decision)}\n`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
