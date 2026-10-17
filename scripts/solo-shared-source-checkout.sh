#!/usr/bin/env bash
# One hosted-job source store; independent exact, full source worktrees.
set -euo pipefail
test "$#" -eq 4
baseline_revision=$1
baseline_tree=$2
candidate_revision=$3
candidate_tree=$4
for value in "$@"; do
  [[ "$value" =~ ^[a-f0-9]{40}$ ]]
done
test "$baseline_revision" != "$candidate_revision"
test -n "${GITHUB_TOKEN:-}"
test -n "${GITHUB_WORKSPACE:-}"
test "$(realpath "$GITHUB_WORKSPACE")" = "$GITHUB_WORKSPACE"
baseline="$GITHUB_WORKSPACE/baseline"
candidate="$GITHUB_WORKSPACE/candidate"
test "$(realpath "$baseline")" = "$baseline"
test ! -e "$candidate"
test ! -L "$candidate"
test -d "$baseline/.git"
test ! -L "$baseline/.git"

# Do not inherit Git path overrides, tracing or persistent credential helpers.
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY
unset GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_INDEX_FILE GIT_CONFIG GIT_CONFIG_PARAMETERS
unset GIT_CONFIG_COUNT GIT_TRACE GIT_TRACE_PACKET GIT_TRACE_SETUP GIT_TRACE_CURL
unset GIT_TRACE_CURL_NO_DATA GIT_CURL_VERBOSE GIT_TRACE2 GIT_TRACE2_EVENT GIT_TRACE2_PERF
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0
phase=identity-before
trap 'status=$?; if test "$status" -ne 0; then printf "Shared source checkout failed at %s (exit %s)\n" "$phase" "$status" >&2; fi' EXIT
git_safe() {
  git -c core.hooksPath=/dev/null -c core.fsmonitor=false -c credential.helper= "$@"
}
identity() {
  local status_output file_flags
  test "$(git_safe -C "$1" rev-parse --show-toplevel)" = "$1"
  test "$(git_safe -C "$1" rev-parse HEAD)" = "$2"
  test "$(git_safe -C "$1" rev-parse 'HEAD^{tree}')" = "$3"
  status_output=$(git_safe -C "$1" status --porcelain=v1 --untracked-files=normal) || return 1
  test -z "$status_output"
  case "$(git_safe -C "$1" config --bool core.sparseCheckout || true)" in
    ''|false) ;;
    *) return 1 ;;
  esac
  file_flags=$(git_safe -C "$1" ls-files -t) || return 1
  if printf '%s\n' "$file_flags" | awk '/^S / { missing=1 } END { exit !missing }'; then
    return 1
  fi
}
identity "$baseline" "$baseline_revision" "$baseline_tree"
test "$(git_safe -C "$baseline" rev-parse --absolute-git-dir)" = "$baseline/.git"
test "$(git_safe -C "$baseline" remote get-url origin)" = https://github.com/mekhovov/revealline
phase=fetch-candidate
# The token exists only in this fetch child's environment, never Git config or argv.
authorization="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')"
GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0=http.https://github.com/.extraheader \
GIT_CONFIG_VALUE_0="$authorization" \
  git_safe -C "$baseline" fetch --quiet --no-tags --no-recurse-submodules \
    --depth=1 --no-write-fetch-head origin "$candidate_revision"
unset authorization
test "$(git_safe -C "$baseline" rev-parse "$candidate_revision^{commit}")" = "$candidate_revision"
test "$(git_safe -C "$baseline" rev-parse "$candidate_revision^{tree}")" = "$candidate_tree"
phase=materialize-candidate
git_safe -C "$baseline" worktree add --quiet --detach "$candidate" "$candidate_revision"
phase=identity-after
test "$(realpath "$candidate")" = "$candidate"
test -f "$candidate/.git"
test ! -L "$candidate/.git"
identity "$baseline" "$baseline_revision" "$baseline_tree"
identity "$candidate" "$candidate_revision" "$candidate_tree"
test "$(git_safe -C "$candidate" rev-parse --path-format=absolute --git-common-dir)" = "$baseline/.git"
printf '{"format":"SoloSharedSourceCheckoutV1","status":"passed","baselineRevision":"%s","baselineTree":"%s","candidateRevision":"%s","candidateTree":"%s","distinctFullWorktrees":true,"sharedJobObjectStore":true,"credentialPersistence":false}\n' \
  "$baseline_revision" "$baseline_tree" "$candidate_revision" "$candidate_tree"
