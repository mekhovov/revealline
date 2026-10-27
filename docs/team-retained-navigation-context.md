# Retained Team navigation context

Team navigation captions retain their original native Arena selector when the page retires. A later language change must not read another page's same-ID selector or require the retired page's browser globals.

The host captures its existing `coop-level` element once. The accepted pack lookup and first-level fallback stay unchanged. No launch, input, progression, persistence, localization registry, or global DOM helper changes are included.

The complete original localization host file reproduced 3 passing cases and 1 failing Team retirement case on captured main `cdbda99ac881eb9cac62d536543d9078b92ac081`. The failure reads the absent global `document` through `selectedLevel` while translating a retained navigation caption. This is also reproduced on the earlier fixture prerequisite `d5a346ebbb541787f27a2ccb625551ea196f5501` and preserved F10 candidate `b452f46d3651bc2855b46781640d24cf3d8640da`; it is not introduced by that Duel feature.

The existing four cases remain intact, including retained release verification URL translation after browser globals disappear. A fifth case supplies another document with a conflicting legal Arena selection and checks that repeated English/Ukrainian refreshes retain the original page's caption and both pages' selection values.

The original complete four-case file on captured main finished with three passes and one failure in 12,762.748 ms. After the reviewed capture and added regression, the complete five-case file passed 5/5 in 12,900.314 ms. Both ran in fresh Node 22 processes without skips or changed case timeouts. The green source was frozen at manifest `c69acfc9099ebf3725f5274aa7b81eb5d7c92e0c3f75f337f8552ba4b9f50e9d` before this receipt-only documentation update; the 69-path source audit was identical before and after execution.

Both attempts used a 1536 MiB V8 old-space limit, a 2048 MiB process-group RSS guard, a 180-second wall guard, and a 2 GiB free-disk floor. The green attempt peaked at 631.1 MiB sampled group RSS, finished in 14.717 seconds wall time, and triggered no guard. Formatting, changed-file lint, and whitespace checks pass.

Full repository gates and browser review are pending. Native checks model DOM ownership and language changes; they do not qualify browser rendering or physical devices. These checks do not turn the separate F10 candidate's historical 135-pass/1-failure scope into an all-green run.
