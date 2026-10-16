import * as fs from "node:fs/promises";
import path from "node:path";

const OWNER = "mekhovov";
const BATCH_SIZE = 20;

function repositoryName(admission) {
  if (!/^archive-(?:0?[1-9]|[1-9][0-9]+)$/u.test(admission.id))
    throw new Error("Invalid archive authority id.");
  return `revealline-${admission.id}`;
}

export function authorityQuery(admissions) {
  const selections = admissions.map(
    (admission, index) =>
      `r${index}:repository(owner:${JSON.stringify(OWNER)},name:${JSON.stringify(
        repositoryName(admission),
      )}){defaultBranchRef{target{... on Commit{oid}}}deployments(first:100,environments:["github-pages"],orderBy:{field:CREATED_AT,direction:DESC}){nodes{databaseId commitOid environment latestStatus{state}}}}`,
  );
  return `query ArchiveAuthorities{${selections.join("")}}`;
}

function observation(admission, repository) {
  const deployment = repository?.deployments?.nodes?.find(
    (candidate) => candidate.databaseId === admission.deploymentId,
  );
  if (!repository || !deployment) return null;
  return {
    archiveId: admission.id,
    infrastructureCommit: repository.defaultBranchRef?.target?.oid,
    deploymentId: deployment.databaseId,
    deploymentCommit: deployment.commitOid,
    deploymentEnvironment: deployment.environment,
    deploymentState: deployment.latestStatus?.state?.toLowerCase(),
    authority: "graphql",
  };
}

function assertObservation(admission, value) {
  if (
    value.infrastructureCommit !== admission.infrastructureCommit ||
    value.deploymentCommit !== admission.infrastructureCommit ||
    value.deploymentEnvironment !== "github-pages" ||
    value.deploymentState !== "success" ||
    value.deploymentId !== admission.deploymentId
  )
    throw new Error(
      `Admitted archive changed or is not deployed: ${admission.id}`,
    );
  return value;
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0)
    return Math.min(retryAfter * 1000, 30_000);
  const reset =
    Number(response.headers.get("x-ratelimit-reset")) * 1000 - Date.now();
  if (Number.isFinite(reset) && reset > 0) return Math.min(reset, 30_000);
  return Math.min(1000 * 2 ** attempt, 30_000);
}

async function request(
  url,
  {
    token,
    cache,
    metrics,
    fetchImpl = globalThis.fetch,
    sleepImpl = sleep,
    method = "GET",
    body,
  } = {},
) {
  const cached = cache[url];
  for (let attempt = 0; attempt < 4; attempt++) {
    metrics.restRequests++;
    const response = await fetchImpl(url, {
      method,
      body,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "revealline-pages-authority",
        "x-github-api-version": "2022-11-28",
        ...(method === "GET" && cached?.etag
          ? { "if-none-match": cached.etag }
          : {}),
      },
    });
    if (response.status === 304 && cached?.value) {
      metrics.cacheHits++;
      return cached.value;
    }
    if ([403, 429].includes(response.status) && attempt < 3) {
      metrics.retries++;
      await sleepImpl(retryDelay(response, attempt));
      continue;
    }
    const text = await response.text();
    if (!response.ok)
      throw new Error(
        `GitHub authority ${response.status}: ${text.slice(0, 1000)}`,
      );
    const value = text ? JSON.parse(text) : null;
    if (method === "GET")
      cache[url] = { etag: response.headers.get("etag"), value };
    return value;
  }
  throw new Error("GitHub authority retry budget exhausted.");
}

async function restObservation(admission, context) {
  const base = `https://api.github.com/repos/${OWNER}/${repositoryName(admission)}`;
  // Fallback stays deliberately serial so a GraphQL outage cannot fan out into
  // the secondary-rate-limit pattern this controller is replacing.
  const commit = await request(`${base}/commits/main`, context);
  const deployment = await request(
    `${base}/deployments/${admission.deploymentId}`,
    context,
  );
  const statuses = await request(
    `${base}/deployments/${admission.deploymentId}/statuses`,
    context,
  );
  return {
    archiveId: admission.id,
    infrastructureCommit: commit.sha,
    deploymentId: deployment.id,
    deploymentCommit: deployment.sha,
    deploymentEnvironment: deployment.environment,
    deploymentState: statuses[0]?.state,
    authority: "conditional-rest",
  };
}

async function readCache(cacheFile) {
  try {
    return JSON.parse(await fs.readFile(cacheFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

export async function verifyArchiveAuthorities({
  admissions,
  token,
  cacheFile,
  fetchImpl = globalThis.fetch,
  sleepImpl = sleep,
}) {
  if (!token)
    throw new Error("Archive authority verification requires a GitHub token.");
  const observations = [],
    metrics = { graphqlRequests: 0, restRequests: 0, retries: 0, cacheHits: 0 },
    cache = cacheFile ? await readCache(cacheFile) : {};
  for (let offset = 0; offset < admissions.length; offset += BATCH_SIZE) {
    const batch = admissions.slice(offset, offset + BATCH_SIZE);
    let data = null;
    try {
      metrics.graphqlRequests++;
      const response = await fetchImpl("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "user-agent": "revealline-pages-authority",
        },
        body: JSON.stringify({ query: authorityQuery(batch) }),
      });
      const payload = await response.json();
      if (!response.ok || payload.errors?.length)
        throw new Error(JSON.stringify(payload.errors || payload));
      data = payload.data;
    } catch (error) {
      process.stderr.write(
        `GraphQL authority batch fell back to conditional REST: ${error.message}\n`,
      );
    }
    for (let index = 0; index < batch.length; index++) {
      const admission = batch[index];
      const fromGraphQL = data
        ? observation(admission, data[`r${index}`])
        : null;
      const value =
        fromGraphQL ||
        (await restObservation(admission, {
          token,
          cache,
          metrics,
          fetchImpl,
          sleepImpl,
        }));
      observations.push(assertObservation(admission, value));
    }
  }
  if (cacheFile) {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.writeFile(cacheFile, `${JSON.stringify(cache)}\n`);
  }
  return { observations, metrics };
}
