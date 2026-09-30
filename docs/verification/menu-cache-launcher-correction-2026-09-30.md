# Menu artwork cache and launcher dependency correction

The main Pages build and default-capacity inspector share the same offline preparation. The prior 0fc5569 build attempted a 94,324,513-byte mandatory cache, exceeding the unchanged 64 MiB limit.

Menu raster backdrops and the generated icon master are now optional tooling payloads, not mandatory startup bytes. Every original remains in the distribution and is available on Pages; no asset is deleted or recompressed. The existing menu image-error path hides failed imagery and motion while its CSS gradient and controls remain usable offline. Fonts, wordmarks, executable modules, generated install icons, gameplay assets and saved data are unchanged. Optional presentation artwork can still be included through the existing tooling download package. This does not assert a completed full build or physical offline acceptance.

The frozen launcher publisher also copies the controller-profile module imported by its router. The existing exact file-count assertion is retained; the regression checks byte equality and rejects a missing controller-profile dependency rather than masking that failure.
