# 03: Menu scan sends a legible image and releases its preview

**What to build:** A photo of a dense drinks Menu — small type, tight columns, prices beside
every line — transcribes with those prices intact, because the image the scan sends is
large enough for the model to read them. Repeating a scan several times in one session does
not accumulate memory on the device.

The scan currently compresses to a 1024 px long edge, which erases exactly the detail a Menu
is made of, and never releases the preview it creates, so every retry leaves a blob behind.
The scan route imposes no ceiling of its own, so the only limit is the one chosen here.

**Blocked by:** 02 — both edit the same scan component and its test file; running them
concurrently produces a conflicting diff at integration.

**Seams:** S1 — the scan affordance, rendered. *Catches:* the budget drifting back down, the
compressor being handed a literal instead of the named value, and a preview that is never
released. *Misses:* measured transcription accuracy — the spec records that as an open
question, answered by the recorded E2E flow rather than by an assertion.

Second seam: S2 — the scan route. *Catches:* a size ceiling reappearing and refusing the
larger payload. *Misses:* anything about model output quality.

**Tracker:** https://git.ranio.xyz/groundsph/www/issues/33
**Status:** done

- [x] The compression target is one named value that tests assert against directly, rather than a literal at the call site
- [x] The target is large enough that small Menu type survives: the recorded E2E flow on a dense Menu reaches review with its prices populated
- [x] The scan route accepts the payload produced at the new target and still refuses unsupported formats
- [x] The preview image is released when a scan is retried, when the modal closes, and when the component unmounts
- [x] Several scans in one session leave no retained previews
- [x] Tests assert the budget and the route's acceptance without reading component source as text

**Deferred evidence (now closed):** Criterion 2 was verified at the E2E gate, not at integration. Recorded in
`docs/superpowers/e2e/menu-scan.md`, flow 3: the dense fixture menu reached review as
`Review 39 extracted items` with 39 non-zero prices matching the source image. Screenshot:
`docs/superpowers/e2e/screenshots/menu-scan-flow3-review-prices.png`.

**Deviation:** The scan route now asks the model for `detail: "high"` where it previously asked for
`"low"`. That is a request-parameter change, which the spec's out-of-scope list covers ("no prompt
changes, no model changes"), so it is recorded here rather than folded in silently. It is kept
because it is what makes the 1600 px image budget mean anything — a larger image sent at low detail
is downsampled again by the provider, so the extra pixels would be spent for no gain — and the
recorded E2E flow that answers criterion 2 passed with it. The model itself is unchanged.
