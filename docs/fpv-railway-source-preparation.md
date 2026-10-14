# Railway Valley source preparation

The active plan places Industrial Railway Valley in P3. This increment prepares six exact licensed models and their local palette texture for a bounded future composition; it does not add a playable world or close the representative P2 art gate.

[Kenney Train Kit](https://kenney.nl/assets/train-kit) identifies version 1.1 and the CC0 licence. The exact archive is 5,266,588 bytes, SHA-256 `cf50d77e8cbacbf38dd50826d4bce5392db8e4f67373d3c4e583b0ed0e474475`. The bundled licence credits Kenney, Guus Vermeulen and Tony Schaer. Selected source files, unchanged licence and texture total 575,958 bytes and are retained under authoring only.

| Model              | Triangles | Intended role                             |
| ------------------ | --------: | ----------------------------------------- |
| Straight track     |       376 | Readable longitudinal flight line         |
| Broad track corner |       568 | Curved approach into a different district |
| Diesel locomotive  |     1,742 | Recognizable yard landmark                |
| Coal carriage      |     1,184 | Contrasting open-top freight silhouette   |
| Tank carriage      |     1,146 | Rounded obstacle profile                  |
| Timber flatbed     |     1,094 | Low cargo profile and height variation    |

All six models validate with zero glTF errors/warnings and load through NodeIO with the complete local texture closure. Hashes, byte lengths, finite transformed bounds, static animation state and a 10,000-triangle/model intake bound are checked by `verify-source.mjs`. The track source uses a -1 unit Y offset; assembly must normalize it explicitly rather than burying rails or shifting train placement. The source is stylized and cannot establish photorealistic quality.

## Intended bounded composition

Prepare a 384 × 384 m pilot sector with a raised trestle crossing, switching yard, freight lane, maintenance approach, shallow cutting and an open recovery field. Use original terrain and architecture around the licensed rolling stock. Retain clear routes above track, under the trestle and between parked carriages; measure both openings and solid impacts using the same mesh triangles. Keep the palette resource complete during conversion rather than silently replacing textured source models with white shapes.

This is a design target, not generated content. The next increment must supply exact manifests, render/collision agreement, deterministic outputs, reachable clearances and native review. The larger 4 km region, moving trains, gameplay objectives, default catalogue admission and offline/package qualification are unimplemented.
