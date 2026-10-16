const SHA_ASSET_LIMIT = 8_000_000;

const headers = (token, accept) => ({
  Accept: accept,
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

async function readBounded(response, expectedBytes, limit = SHA_ASSET_LIMIT) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) {
      await response.body.cancel().catch(() => {});
      throw new Error('Published qualification exceeds its byte budget.');
    }
    chunks.push(chunk);
  }
  if (size !== expectedBytes)
    throw new Error('Published qualification size does not match its release descriptor.');
  return Buffer.concat(chunks);
}

export async function downloadReleaseAsset({
  repository,
  version,
  name,
  token = process.env.GH_TOKEN,
  fetchImpl = fetch,
  maxBytes = SHA_ASSET_LIMIT,
}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 950_000_000)
    throw new Error('Invalid bounded release asset size.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid release repository.');
  if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version.');
  if (!/^[\w.-]+$/.test(name)) throw new Error('Invalid release asset name.');
  if (!token) throw new Error('GH_TOKEN is required to read private release assets.');

  const releaseResponse = await fetchImpl(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(version)}`,
    {
      headers: headers(token, 'application/vnd.github+json'),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!releaseResponse.ok)
    throw new Error('The selected release metadata is not available to the publisher.');
  const release = await releaseResponse.json();
  const matches = release.assets?.filter((asset) => asset.name === name) ?? [];
  if (
    release.draft ||
    release.prerelease ||
    matches.length !== 1 ||
    matches[0].state !== 'uploaded' ||
    !Number.isSafeInteger(matches[0].size) ||
    matches[0].size < 0 ||
    matches[0].size > maxBytes ||
    !/^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/releases\/assets\/\d+$/.test(
      matches[0].url,
    )
  )
    throw new Error('The selected release does not publish its source qualification.');

  const assetResponse = await fetchImpl(matches[0].url, {
    headers: headers(token, 'application/octet-stream'),
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  });
  if (!assetResponse.ok)
    throw new Error('The selected release does not publish its source qualification.');
  return readBounded(assetResponse, matches[0].size, maxBytes);
}
