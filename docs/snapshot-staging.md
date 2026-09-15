# Snapshot source archive staging

The outer `releaseSnapshot` tool archives a trusted local Git commit, extracts it,
and runs that commit's own frozen build CLI. After the build, it transfers the
source TAR into the fresh private snapshot directory. The transfer first reserves
the fixed `source.tar` name exclusively, so an existing file or symlink is refused.
It then renames the archive on the same filesystem. Only `EXDEV` permits a fallback
copy, followed by unlinking the source after the copy succeeds.

A transfer failure removes its reserved destination and aborts publication. The
snapshot's existing `finally` removes both private directories and its lock. A
later failure before the final snapshot-directory rename also cleans the
transferred TAR. Existing behavior after that final rename is unchanged: a later
version-index write failure can leave the completed immutable release directory.

The source TAR, ZIP and manifest hashes still come from the same buffers. The
release metadata schema, final directory rename and frozen build invocation do
not change. A newer outer tool can therefore snapshot an older exact source
revision without replacing that revision's build implementation.

For disk admission, let `T` be the source TAR, `S` its extracted files, `U` the
complete loose site excluding the ZIP, `Z` the ZIP, `B` any additional build
intermediates, `R` the implementation reserve and `G` a separate log/metadata
allowance. Same-filesystem transfer needs the conservative allowance
`T + S + U + Z + B + R + G`; fallback still needs
`2*T + S + U + Z + B + R + G`. Do not count the ZIP twice if a site measurement
already includes it. The frozen current builder writes its files and ZIP into
one private build directory, then renames it to the previously absent site path;
that directory is the site allowance, not another full site copy. Older frozen
builders may need a different `B`. Existing release directories are retained and
must already be accounted for in measured free space.

Same-filesystem staging removes exactly one redundant TAR body at the transfer
stage. It does not reduce the archive/ZIP buffers in memory or prove that this
stage was the overall resource peak. Before a real snapshot, bind the actual
source and measured or conservatively bounded sizes, filesystem placement and
fresh free space. EXDEV tests use injected operation errors with real small
files; they do not claim testing on a second physical filesystem.
