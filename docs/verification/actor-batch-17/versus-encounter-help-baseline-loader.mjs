import { execFileSync } from 'node:child_process';
export async function load(url, context, nextLoad) {
  const root = '/Users/oleksandr.mekhovov/.codex/worktrees/actor-loader-regression/go_test/';
  if (new URL(url).pathname === `${root}game/couch/couch.mjs`)
    return { format: 'module', shortCircuit: true, source: execFileSync('git', ['show', 'HEAD:game/couch/couch.mjs'], {
      cwd: root, env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8',
    }) };
  return nextLoad(url, context);
}
