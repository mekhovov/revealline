# Neon Words & Symbols

38 playable tile designs in their own **Neon Words & Symbols** pack (#291–328). The eight screenshot reconstructions remain in Neon Reference Pack (#285–290 and #329–330).

## Designs

291. **FPV**.
292. **UKRAINE**.
293. **DRONE AID**.
294. **COUPA**.
295. **SOCIAL DRONE**.
296. **SDUA**.
297. **VICTORY DRONES**.
298. **VD**.
299. **FPV LINE**.
300. **REVEAL**.
301. **FLY FREE**.
302. **FPV Drone** — a quadrotor silhouette with four circular rotors, a squashed-X frame, a camera and central fuselage.
303. **Ukrainian Trident** — a stylized Ukrainian tryzub with a central spear and interwoven side prongs.
304. **Vyshyvanka Diamonds** — a vyshyvanka-inspired sequence of embroidered diamonds with cross-shaped centers.
305. **Eight-Point Ruzha** — an eight-point geometric rosette inspired by Ukrainian embroidery.
306. **Kalyna** — a kalyna branch with clustered berries and paired leaves.
307. **Tree of Life** — a branching tree-of-life motif inspired by Ukrainian embroidery.
308. **Pysanka** — a closed pysanka egg outline with a central diamond and staggered ornamental stitches.
309. **Barvinok** — five-petal periwinkle flowers on a curling branch.
310. **Wheat Sheaf** — three grain ears with paired kernels and a tied stalk.
311. **Vinok** — a floral wreath with flowing ribbons.
312. **Didukh** — a branched harvest sheaf tied above a spreading base.
313. **Rushnyk** — a hanging ritual textile with geometric embroidery and fringed ends.
314. **Bandura** — an asymmetric bandura body, neck and fan of strings.
315. **Trembita** — a long tapered Carpathian horn with a flared bell.
316. **Tsymbaly** — a trapezoidal hammered dulcimer with strings and paired beaters.
317. **Kosiv Pitcher** — a handled ceramic pitcher with a floral ornament inspired by Kosiv.
318. **Opishnia Ram** — a ceramic ram silhouette with a large curled horn inspired by Opishne toys.
319. **Petrykivka Flower** — a fan-petalled flower with a curved stem and paired leaves.
320. **Oak and Acorns** — lobed oak leaves and two capped acorns.
321. **Stork** — a long-legged bird in profile with a pointed beak.
322. **Swallow** — a flying bird with swept wings and a forked tail.
323. **Pysanka Horse** — a prancing horse in profile with mane and flowing tail.
324. **Pysanka Deer** — a deer in profile with branching antlers.
325. **Pysanka Fish** — a fish in profile with fins, scales and a split tail.
326. **Berehynia Motif** — a geometric raised-arm figure inspired by pysanka motifs.
327. **Bezkonechnyk** — a continuous closed meander inspired by pysanka eternity bands.
328. **Crimean Tatar Ornek Tulip** — a tulip with curling paired leaves inspired by Crimean Tatar Ornek.

## Whole-arena variety

The foreground word or motif is protected from scenery edits. Each identity deterministically selects terrain composition, horizontal motif placement, side refuges, short wall gates, lower island shapes and enemy starts. There are eight upper arena families and eight independently cycled lower families. Pools, clear channels, sparse fields, staggered terraces, coves and slalom gates change the whole route, not just its bottom. Fixed seeds keep replays and previews reproducible; this is authored per-level variety, not rerolling on each play.

Yellow bouncers vary from three to five. Two outer cyan patrols start at distinct positions, while contour patrols follow each level's actual safe refuges. The player starts on the bottom safe rail. Red tiles remain lethal until captured; blue terrain slows movement; foundations are safe return surfaces. The screenshot's long horizontal hazard bars are omitted.

## Research and adaptation

The linked museum, UNESCO, instrument-maker and pysanka references are recorded with design applications in [references.json](references.json). These are original low-resolution interpretations, not copied works, official emblems or exact regional embroidery patterns. Botanical and animal forms also occur in other cultures. The Ornek level is explicitly identified as Crimean Tatar. Game terrain colours preserve mechanical meaning instead of attempting to reproduce ceramic glazes or textile colours. Bird levels are original stork/swallow silhouettes within the broader documented bird-motif tradition.

Custom reveal artwork and Ukrainian translation are deferred. These are playable tile mosaics, not newly generated background images.

## Rebuild and review

Run `node scripts/build-neon-mosaic.mjs`, then `node scripts/build-neon-mosaic-pack.mjs`. The gallery launches editable scenarios using the normal practice importer. Metadata generation for the main catalog runs separately.

Validation: all 38 scenarios and single-level packs validate; both the eight-level reference pack and 38-level words/symbols pack validate. All 38 surrounding layouts and all 38 lower layouts are unique. Archive and Current rules each initialize and run a 120-tick idle smoke check. Unit tests were not run, as requested. Full-clear balance is not qualified.
