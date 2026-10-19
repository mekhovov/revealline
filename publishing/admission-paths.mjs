const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const safePath = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 4096 &&
  !/[\u0000-\u001f\u007f\\]/u.test(value) &&
  !value.split('/').some((part) => !part || part === '.' || part === '..');

// The PR-files endpoint returns at most 3,000 records. Larger changes use
// complete Git trees at the exact merge base and head. No candidate code runs.
export async function admissionPaths(pull, api) {
  if (
    !sha(pull.head?.sha) ||
    !sha(pull.base?.sha) ||
    !Number.isSafeInteger(pull.number) ||
    pull.number < 1 ||
    !Number.isSafeInteger(pull.changed_files) ||
    pull.changed_files < 1 ||
    pull.changed_files > 100000
  )
    throw new Error('Invalid changed-file inventory identity or bound.');
  if (pull.changed_files <= 3000) {
    const paths = new Set(),
      names = new Set();
    let count = 0;
    for (let page = 1; page <= 30; page++) {
      const rows = await api(`pulls/${pull.number}/files?per_page=100&page=${page}`);
      if (!Array.isArray(rows) || rows.length > 100) throw new Error('Invalid changed-file page.');
      count += rows.length;
      for (const row of rows) {
        if (
          !safePath(row.filename) ||
          names.has(row.filename) ||
          (row.previous_filename !== undefined && !safePath(row.previous_filename))
        )
          throw new Error('Invalid or duplicate changed-file path.');
        names.add(row.filename);
        paths.add(row.filename);
        if (row.previous_filename) paths.add(row.previous_filename);
      }
      if (rows.length < 100) break;
    }
    if (count !== pull.changed_files) throw new Error('Incomplete changed-file inventory.');
    return [...paths].sort();
  }

  const comparison = await api(`compare/${pull.base.sha}...${pull.head.sha}?per_page=1`);
  if (comparison.base_commit?.sha !== pull.base.sha || !sha(comparison.merge_base_commit?.sha))
    throw new Error('Invalid comparison merge base.');
  const mergeBase = comparison.merge_base_commit.sha;
  const cache = new Map();
  let requests = 0;
  const tree = async (identity, recursive) => {
    const key = `${identity}:${recursive}`;
    if (!cache.has(key)) {
      if (++requests > 128) throw new Error('Changed-tree request bound exceeded.');
      const value = await api(`git/trees/${identity}${recursive ? '?recursive=1' : ''}`);
      if (
        value.sha !== identity ||
        typeof value.truncated !== 'boolean' ||
        !Array.isArray(value.tree) ||
        value.tree.length > 100000 ||
        Buffer.byteLength(JSON.stringify(value)) > 16 * 1024 * 1024
      )
        throw new Error('Invalid or oversized changed-tree response.');
      cache.set(key, value);
    }
    return cache.get(key);
  };
  const inventory = async (commit) => {
    const value = await api(`git/commits/${commit}`);
    if (value.sha !== commit || !sha(value.tree?.sha))
      throw new Error('Changed commit identity mismatch.');
    const files = new Map();
    let entries = 0;
    const walk = async (identity, prefix, ancestors) => {
      if (ancestors.has(identity) || ancestors.size >= 128)
        throw new Error('Invalid changed-tree nesting.');
      const chain = new Set([...ancestors, identity]);
      let response = await tree(identity, true);
      const recursive = !response.truncated;
      if (!recursive) response = await tree(identity, false);
      if (response.truncated) throw new Error('Incomplete changed-tree inventory.');
      const seen = new Set();
      for (const entry of response.tree) {
        if (
          ++entries > 100000 ||
          !safePath(entry.path) ||
          !sha(entry.sha) ||
          seen.has(entry.path) ||
          (!recursive && entry.path.includes('/')) ||
          !(
            (entry.type === 'tree' && entry.mode === '040000') ||
            (entry.type === 'blob' && ['100644', '100755', '120000'].includes(entry.mode)) ||
            (entry.type === 'commit' && entry.mode === '160000')
          )
        )
          throw new Error('Invalid changed-tree entry or inventory bound.');
        seen.add(entry.path);
        const name = prefix + entry.path;
        if (!safePath(name)) throw new Error('Invalid complete changed-tree path.');
        if (entry.type === 'tree') {
          if (!recursive) await walk(entry.sha, `${name}/`, chain);
        } else {
          if (files.has(name)) throw new Error('Duplicate changed-tree leaf.');
          files.set(name, `${entry.mode}:${entry.type}:${entry.sha}`);
        }
      }
    };
    await walk(value.tree.sha, '', new Set());
    return files;
  };
  const before = await inventory(mergeBase),
    after = await inventory(pull.head.sha);
  const paths = [...new Set([...before.keys(), ...after.keys()])]
    .filter((name) => before.get(name) !== after.get(name))
    .sort();
  // A rename is one PR record but has two changed paths. Tree comparison keeps
  // both names without depending on a similarity threshold or reading blobs.
  if (paths.length < pull.changed_files || paths.length > 2 * pull.changed_files)
    throw new Error('Changed-tree inventory disagrees with PR file count.');
  return paths;
}
