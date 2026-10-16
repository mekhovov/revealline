# v0.97 main selector and v0.96 preservation

This publishing candidate selects the already published v0.97.0 and preserves
v0.96.0 at Archive65. It does not rebuild either game or claim a new gameplay
qualification. This selector is integrated on main
`3828ff4f2678a2c4bbf9837e0bfa65ce6e4a4ece`, which already contains the reviewed
archive-capacity limit and mandatory publisher infrastructure tests on PRs.
Neither prerequisite is included as a selector feature change.

## Original identities

- Published v0.97 release: `395252920`.
- Annotated tag: `2a65f2917d2ed86a273d1fb2e45f25de232e3563`.
- Game source: `1518e15e248b59c6470cc6931023eaf6f1ac363c`.
- Game tree: `c618b5d01fd0742a5dfc8c55c9d851d1d21d58e8`.
- Qualification SHA-256:
  `dcea76d94239d0aab2306979cd4f98346074a04c0ee7fec2a5d24dfc8a05ca7c`.

The existing `sync-release-metadata.mjs` contract fetched the four small original
published metadata/qualification bodies. Their lengths and hashes match the
original GitHub Release descriptors and the independently retained Archive66
preparation originals. The original historical v0.97 test-waiver record is
retained unchanged; the publisher tests below do not establish a passing v0.97
gameplay suite.

Archive65 preserves v0.96 at infrastructure
`cca5acb23db5d0c7991255ddd08884d2a12634ca`, run `35959521293`, deployment
`6630815744` and successful status `18766139595`. Its complete HTTP audit checked
all **1,120 files / 594,895,002 bytes** with no failures or retries. The 43 retained
evidence files are copied unchanged from
`e9efe3db4d7a6dea7403539b5bff64c97afda2a9`.

The browser admission covers bounded historical online route, artwork and
keyboard session checks. The actual observation remains `PASS_WITH_LIMITS`:
the test computer's full physical disk prevented IndexedDB persistence. No
persistence, backup, offline, successful storage recovery, exhaustive Solo
progression, physical controller/touch, responsive/zoom or audio acceptance is
claimed. See [the original observation](../evidence/archive-65-v0960/native-observation.json)
and [complete reconciliation](../evidence/archive-65-v0960/final-reconciliation.json).

## Preparation verification

All 140 earlier catalogue rows, 64 earlier allocations and 64 earlier admissions
remain identical. The candidate has 141 catalogue releases and 65 archive
admissions. Existing metadata, evidence, release assets and immutable tags are
preserved. The capacity prerequisite changes only the bounded archive count;
the 800 MB per-archive and 950 MB main budgets remain unchanged.

The original preparation used macOS arm64, a real temporary RAM filesystem and
no filesystem mocks. That preparation preceded the merged PR-test guard:

- Node 22.22.2: `node --test publishing/test-policy.test.mjs publishing/pages-controller/*.test.mjs`
  — **63 passed**, no failures, skips, cancellations or todos.
- Python 3.14.4: `python3 -m unittest discover -s publishing/pages-controller -p 'test_*.py' -v`
  — **5 passed**.
- The unchanged `loadCatalog` validated all 141 release metadata chains.
- The unchanged `validateAdmissions` validated all 65 admissions in bounded
  batches using each archive's complete release metadata, exact evidence bytes,
  global allocation registry and the selected current qualification. The
  largest temporary batch was 5,913,062 bytes. This was necessary because the
  complete retained admission input set exceeds the available RAM volume.

The batch validation is not a full committed publisher preview. The independent
source review also confirmed the new browser admission retains every limitation.

The merged infrastructure prerequisite PR337 separately passed its complete
hosted publisher suites: **64 Node 22.22.2 tests and 5 Python tests**, including
the new PR-test guard regression. Its artifact assembly and ordinary source
build also passed. The final selector PR must run those 64/5 hosted tests and
its own complete preview; the earlier 63-test preparation proof is not
relabeled as that final run.

After integration, the exact merged publisher guard and regression were also
materialized in the bounded native workspace: **64/64 Node tests passed**, with
no failures, skips, cancellations or todos. The five Python checks were unchanged.
This native result remains distinct from the final selector hosted preview.

The full staged whitespace check reports only literal blank context spaces in
two immutable historical `helper-origins/*.py.diff` evidence originals. Their
committed hashes are preserved; every other proposed file passes the whitespace
check. The evidence files are never reformatted.

## Required next gates

1. Review the 52-file selector feature through the normal PR pipeline on the
   merged main above. The capacity and test-guard prerequisites are already
   inherited. Preserve intervening changes and all immutable earlier records.
2. Complete the hosted publisher tests and committed preview, including all tag
   identities, current qualification, archive authorities, artifact extraction,
   byte budgets and independent output reread.
3. Recheck the highest published stable release before deployment. If v0.98 is
   published first, reuse the v0.97 catalogue/Archive65 preservation preparation
   in its successor selector; do not deploy an obsolete v0.97 default or invent
   a v0.98 qualification.
4. The sole release owner deploys Pages from main, then verifies the public root,
   canonical version/source, affected asset bytes and actual native play. The
   existing local persistence/offline limitation remains explicit.

No push, PR, merge, tag, release-asset upload or Pages deployment is established
by this preparation record.
