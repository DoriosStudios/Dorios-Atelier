# Atelier content automation

The MJS tools in this directory own the content inventory, reviewed variant policy, and repeatable stone-variant overhaul.

## Review workflow

1. Run `npm run content:audit` to refresh duplicate, format-version, and culling reports.
2. Run `npm run variants:policy:init` once to create `content/variant-policy.json`.
3. Review every variant decision in that policy:
   - `pending`: not reviewed yet;
   - `generate`: the Atelier should own this custom variant;
   - `skip`: no variant should be generated;
   - `use_vanilla`: use the equivalent vanilla block instead of an Atelier duplicate.
4. Run `npm run variants:audit` to refresh the Markdown, CSV, and JSON review matrices.
5. Run `npm run content:overhaul` for a non-mutating preview.
6. Run `npm run content:overhaul:apply` to apply the reviewed policy.
7. Run `npm run content:check -- --require-decisions` as the release gate.

Additional deterministic generators:

- `python tools/import-atelier-assets.py --source "PATH" --write` imports updated creator artwork. Stone names map to canonical material/finish IDs; identical top/side pixels reuse a texture and cannot create another finish. Retired ornamental names are recorded only for script-side mapping and removal of old generated files. Paint item assets are normalized into `RP/textures/items/painting`; elevator art stays reserved under `Upcoming/assets/elevators`.
- `npm run content:stones:apply` generates the 76 managed finishes across Andesite, Basalt, Deepslate, Dripstone, End Stone and Hardened Netherrack from `content/stone-families.json`, along with supported structural shapes, native-axis pillars, recipes, creative entries, chisel cycles and all five localizations. Atlas processing extracts the occupied upper/lower 16x16 faces from each 32x32 source and rejects identical finishes in the same material family. Existing canonical blocks are reused. Duplicate ornamental block definitions, their loot tables, face textures, atlas entries and translations are deleted; retired-name mappings exist only in scripts. Redundant recipes are removed. `npm run content:stones:check` checks reproducibility. Stonework ordering stays automatic through `tools/lib/stonework-order.mjs`, with each material's finishes together. Hardened Netherrack keeps its four-to-two hardening recipe and hardened-only chisel cycle.
- `npm run content:wool:apply` generates the 22 extra wool colors in five formats (110 blocks), shared tinted weave, Wool (Extra) group in concrete color order, recipes, translations and the painting palette. See `content/WOOL.md`; `npm run content:wool:check` checks reproducibility.
- `npm run content:painting:apply` derives 14 selectively dyeable TGA icons and binds each bucket directly to its existing colored PNG while preserving the original artwork, then generates the seven tiers of Paintbrushes and Paint Rollers, 38 colored Paint Buckets, an Empty Paint Bucket, recipes, the Painting creative group, translations and the runtime RGB palette. Painting destinations adapt to color-prefixed block names and the live registry, with no material whitelist or enumerated block table. Bucket durability is spent once per successful painting action, including a whole 3x3 stroke. See `content/PAINTING.md`; `npm run content:painting:check` checks reproducibility.

- `npm run content:dyes:apply` renders 21 individually authored 16x16 pigment layers through Dorios Pixel Art over the unchanged creator wooden plate, preserving the creator's Amber icon and detected manual edits. It also generates the 22 stackable items, creative entries and mixing recipes, and updates concrete recipes to use eight white concrete plus one custom dye. See `content/DYES.md`; `npm run content:dyes:check` verifies existing outputs without needing the skill renderer. `python tools/preview-dye-layers.py` verifies layer composition; `python tools/preview-dye-vanilla.py` compares the refinement against its preserved snapshot and prepares official vanilla reference previews.
- `npm run content:concretes:apply` creates the 22 concrete textures (14 UI colors plus 8 spectrum additions) and their 110 ordinary-stone blocks, the Concrete (Extra) creative group, translations, dyeing recipes and lossless stonecutter conversions. Explicitly retired families are archived recoverably under `builds/retired-concretes`. See `content/CONCRETES.md`; `npm run content:concretes:check` verifies reproducibility.
- `npm run content:traits:apply` rebuilds slabs, stairs, vertical slabs, walls, and the obsidian pillar from the vendored BlocksWithTraits definitions. It installs the original geometry/UV and culling files, uses native placement traits, removes the legacy stair-placement script, and applies full-block redstone conductivity to opaque full cubes.
- `npm run content:glass:apply` generates the glass blocks and registrations from their textures and installs the UtilityCraft-compatible full-cube geometry plus six `same_block` face-culling rules.
- `npm run content:tools:apply` creates all supported glass-cutter tiers, tool recipes, item-atlas entries, translations, catalog entries, and furniture-hammer texture bindings.
- `npm run recipes:variants:apply` guarantees one stonecutter recipe and one lossless reset recipe for every custom subtype marked `generate` in `content/variant-policy.json`.
- `npm run content:generated:check` fails when any generated glass, tool, catalog, localization, or recipe output is stale.

Generated reports live in `tools/generated`. They are derived output and must not be edited manually.

Use the Dorios' Atelier Settings book (`dorios_atelier:settings`) to choose a tool reset method in a native form. Each player receives the book once; replacement books can be crafted with one book and one stick, or found in the creative Nature category. The book replaces the former `/atelier:tools` command. The choice is saved per player in the world and applies to chisels, furniture hammers, and glass cutters with touch, keyboard/mouse, or controller input. Available methods are Sneak + attack in the air, Sneak + use in the air, use in the air, hold Sneak in the air for two seconds, and Sneak followed by Jump (the default).

Only the selected method can clear a lock, on every device. The hold method uses an actionbar with `X` for filled segments and `-` for empty segments; standing up, changing slots or method, or aiming at a block or entity cancels its countdown. Only players who selected this method enter the periodic hold check. The tool generator preserves native touch use buttons for the two use methods. Input-mode information is used for diagnostics only and never gates a reset.

The form title, method choices, labels, buttons, book name, and configuration messages use client-side translation keys in all five supported locales. The form also enables per-player chat diagnostics, off by default. Messages tagged `[DA tool-reset-v2]` show input events, mode changes, sequence rejection reasons, and the stored lock after a reset. If another screen is open, the form retries briefly; explicitly closing the form leaves settings unchanged.

Run `regolith run` for a full development-pack build. Release automation follows Ascendant Technology through `DoriosStudios/Dorios-Workflows@v1.0.2`, configured in `.github/dorios-release.json`. The **Build & Attach MCAddon** workflow runs when a release is published, or manually to target the latest stable release (the default), latest prerelease, any latest release, a specific tag (including drafts), or workflow artifacts only. Manual runs accept a source branch, tag or SHA and an explicit option to replace existing assets. Each run produces exactly two `.mcaddon` files: readable development output (`_dev`) and bundled/minified release output. The Regolith profiles `buildDev` and `buildMinify` export to `build/`; the shared packager writes to `.dorios-release/artifacts/`. Texture lists are generated in both profiles. After bundling scripts, `buildMinify` also compacts every `.json` file in BP and RP, including manifests and the generated texture list, by removing formatting whitespace and JSONC comments while preserving string contents and number representations. Source files and development builds remain formatted. No separate `.mcpack` or packs ZIP downloads are produced.

`content:overhaul:apply` is idempotent: immediately running its preview again must report zero deletes and zero writes. It removes custom slabs and stairs that already exist in vanilla, retires all three-step stairs, normalizes duplicate definitions, and generates connection-trait walls for Atelier-owned stone materials.

The older Python generators were retired because they were not aware of `variant-policy.json`. Mutating generation is implemented in MJS and must honor the reviewed policy. The upstream-compatible block, geometry, and culling templates live in `tools/templates/blocks-with-traits`; edit those deliberately if the inherited behavior must ever change.

`@minecraft/vanilla-data` is the source of truth for vanilla block identifiers. `@minecraft/bedrock-schemas` is pinned for editor validation through `.vscode/settings.json`; it supplies schemas and types, not the Bedrock runtime.
