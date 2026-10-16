# Release queue title convention

The pull-request milestone is the sole authority for scheduling a change into a
product release. A milestone whose title begins with a stable version such as
`v0.116.0` is shown in the pull-request title as:

- `[Target v0.116.0] …` for the canonical release candidate; or
- `[Target v0.126.0 input] …` for one input that still needs a separate
  aggregate candidate.

The target prefix is scheduling metadata. It does not allocate or publish a
release, make a draft ready, or bypass source, build, artifact, deployment, or
public-acceptance gates. Only an explicitly reviewed `Release vX.Y.Z …` title
uses the existing release admission path.

The `Stage unallocated pull requests` workflow mirrors the explicit version
milestone into the title. The `release-aggregate-input` label is the sole
authority for the `input` role. Removing the label removes `input`; removing the
version milestone removes the whole Target prefix. The workflow never chooses
or increments a version. Assign the milestone first, then add the input label
only when the PR is deliberately one part of a future aggregate.

PRs without a version milestone remain unprefixed. Their status comment must
classify them as one of:

- superseded by a named terminal candidate;
- held for a stated maintenance completion condition; or
- not yet reviewed and scheduled.

Do not use a Target prefix for historical components or maintenance holds. Do
not use `release-train-approved` to imply a product version; that label remains
the exceptional bounded-maintenance escape hatch.
