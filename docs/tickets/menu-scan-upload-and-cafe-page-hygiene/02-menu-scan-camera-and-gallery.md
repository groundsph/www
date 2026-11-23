# 02: Menu scan offers camera and gallery, and honours its stated limits

**What to build:** A visitor taps Scan Menu on any device and is offered two named ways to
choose a photo — one that asks for the camera, one that does not. A file outside the limits
the tile states is refused with a readable reason instead of failing silently. Choosing the
same photo a second time starts a scan.

The scan step today presents a single hidden file input that requests the rear camera, so on
a phone the gallery is unreachable and the tile's promise of "take a photo or select an
image" is false. The tile also states a size and format the app never checks.

One component serves every surface that opens the scan — the Cafe page, the Cafe Menu page,
the owner Menu editor and the new-Cafe form — so the two choices appear on all four.

**Blocked by:** None (can start immediately)

**Seams:** S1 — the scan affordance, rendered. *Catches:* a regression that returns to
camera-only, an unenforced limit, and a repeated selection that does nothing. *Misses:*
whether a real handset offers the gallery — the E2E playbook covers that — and whether the
transcription is accurate, which no unit test covers.

**Tracker:** https://git.ranio.xyz/groundsph/www/issues/31
**Status:** done

- [x] The scan step offers two distinct labelled ways to choose a photo: one requests the camera, one does not
- [x] On a device that honours the camera request, the first opens the camera; the second never requests it
- [x] Both choices feed the same scan, so nothing downstream behaves differently by path
- [x] A file whose format is outside those the tile lists is refused before any compression, with a readable message, and the scan stays on the upload step
- [x] A file larger than the size the tile states is refused the same way
- [x] The formats the tile lists are exactly the formats the app accepts
- [x] Choosing the same photo twice in a row starts a scan both times
- [x] Tests cover both refusals, the acceptable case, and the repeated selection
