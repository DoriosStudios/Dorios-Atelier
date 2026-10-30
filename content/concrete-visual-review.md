# Concrete texture visual review

Status: model_reviewed. Evaluator: Codex. Human approval: not recorded.

Inspected the original Mojang `concrete_white.png` and
`tools/generated/concrete-preview.png` at native resolution, integer nearest
enlargement and repeated tiles. Also inspected the expansion-only preview. The
full preview contains all 22 final textures; the expansion preview contains 8.

Full preview size: 1848×960. SHA-256 of decoded row-major RGBA pixel bytes:
`77eeb135f1edd875cafc834554b0c31a7995981a18cbb40868ff84a6523398ca`.
Expansion preview size: 1848×480. SHA-256 of decoded RGBA pixel bytes:
`50e9e6c84c32349dbd54e4ffe8a910a2d28c3fdd2288c3ac4f64a00c7aa94ec5`.
These observations apply only to that pixel digest; regenerate and inspect again
if any texture or preview pixels change.

Observations:

- Full opaque tiles retain the subtle concrete grain, with six closely spaced
  native tones per color. No resampling, UI borders, metallic highlights or new
  noise were added to the production textures.
- Copper/amber/sand, burgundy/lavender/dusty purple, olive/forest/mint and
  indigo/slate/navy/teal/aqua remain distinguishable in the sheet.
- Repeated previews show restrained granularity and no introduced edge frame.
- Direct pixel sampling of all fourteen Ascendant Technology source panels
  matches the dominant colors configured for their concrete counterparts.
- Expansion colors keep the same six-tone concrete grain. Scarlet and coral add
  stronger and lighter warm reds; peach and ivory offer warm pale surfaces.
  Chartreuse and emerald fill yellow-green and vivid green intervals. Wine adds
  a warm deep red, visibly redder than the original muted purple burgundy; deep
  rose completes the pink range. Cobalt, periwinkle, violet and turquoise were
  removed; mauve was replaced by wine. These are visual selections based on
  the supplied palette image, not a claim of measured complete spectral coverage.

Automated checks establish opaque 16×16 output, the pinned source hash, preserved
native grain and an exact dominant-color match. They do not establish in-game
appearance under lighting, geometry placement, drops or runtime behavior.
