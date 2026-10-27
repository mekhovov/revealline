# Historical PR #1551 preservation archive

These files preserve exact historical Git objects from the original preservation-only PR. They are evidence and source history, not current gameplay fixes or accepted runtime qualification.

All current main source, tests, workflows, evidence and modes remain unchanged. The 124 original opaque snapshots keep their original paths; differing older source variants live under variants/, with their original locations recorded in source-map.json. The old cold-restore workflow is preserved as recipes/fpv-source-history-cold-restore.yml.txt and is not installed or executable as a GitHub workflow. Its 389 MB recipe is not proof of an accepted cold restore and must not be invoked from this archive.

The complete original 1,090-path map and original 111-node history are preserved. Forty-eight of those history nodes are already on current main; the live current comparison and parent proofs are retained separately. PR #1356 was actually integrated first, preserving its functional changes before associating archival history. The original PR branch and all unique history remain reachable. Git object identity does not claim decoded body, replay, browser, device, release, or cold-restore qualification.
