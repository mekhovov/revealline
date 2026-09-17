# Exact existing after-HTTP sequence

Run only after the full `complete-1` report is PASS. From `/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p03-settings-public-audit-9c89f997`:

```sh
python3 -B review-public.py 59734515e8a427bb68ac13bbdd71fff3a9abbf62 complete-1
python3 -B observe-hosted.failure-retention.py after-1 59734515e8a427bb68ac13bbdd71fff3a9abbf62 54c9d0c0601549d86b905785f15b43af81e45941 35283812853
```

The observer must finish after `report.finishedAt`; it must retain the same successful deployment6513676774/status18499160007 and current main identity. Use a fresh label if `after-1` already exists; do not overwrite an earlier attempt.

Fill a separate actual refresh request under the existing strict schema. Each pin has only `{path, bytes, sha256}` and uses these **safe relative** paths:

- binding: `tools/inputs/59734515e8a427bb68ac13bbdd71fff3a9abbf62/binding.json` (root-approved original, not the unreviewed draft)
- report: `tools/runs/complete-1/report.json`
- rowReview: `public-row-review-complete-1.json`
- hostedObservation: `hosted-observation-after-1/record.json`
- publishedRelease: `published-release.actual.json`

Keep format `revealline-public-refresh-request.v1`; use a fresh outputLabel such as `main-1`. Root reviews the five actual pins and request body before setting `reviewed:true` in a separate `refresh-request.reviewed.json`. Then the required command is:

```sh
python3 -B refresh-after-http.py /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p03-settings-public-audit-9c89f997/refresh-request.reviewed.json ROOT_REVIEWED_EXACT_REQUEST_SHA256
```

The SHA must be the exact root-reviewed request digest. The helper rejects partial auditing, mismatched report/row-review bindings, stale after-observation and changed release/tag/source/deployment. Expected successful output is `after-http-authorities-main-1/result.json`, status `PASS_LIVE_AUTHORITIES_UNCHANGED_AFTER_FULL_AUDIT`. This sequence was identified only, not executed by the independent binding reviewer.
