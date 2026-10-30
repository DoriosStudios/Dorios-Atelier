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

- `npm run content:dyes:apply` renders 21 individually authored 16x16 pigment layers through Dorios Pixel Art over the unchanged creator wooden plate, preserving the creator's Amber icon and detected manual edits. It also generates the 22 stackable items, creative entries and mixing recipes, and updates concrete recipes to use eight white concrete plus one custom dye. See `content/DYES.md`; `npm run content:dyes:check` verifies existing outputs without needing the skill renderer. `python tools/preview-dye-layers.py` verifies layer composition; `python tools/preview-dye-vanilla.py` compares the refinement against its preserved snapshot and prepares official vanilla reference previews.
- `npm run content:concretes:apply` creates the 22 concrete textures (14 UI colors plus 8 spectrum additions) and their 110 ordinary-stone blocks, the Concrete (Extra) creative group, translations, dyeing recipes and lossless stonecutter conversions. Explicitly retired families are archived recoverably under `builds/retired-concretes`. See `content/CONCRETES.md`; `npm run content:concretes:check` verifies reproducibility.
- `npm run content:traits:apply` rebuilds slabs, stairs, vertical slabs, walls, and the obsidian pillar from the vendored BlocksWithTraits definitions. It installs the original geometry/UV and culling files, uses native placement traits, removes the legacy stair-placement script, and applies full-block redstone conductivity to opaque full cubes.
- `npm run content:glass:apply` generates the glass blocks and registrations from their textures and installs the UtilityCraft-compatible full-cube geometry plus six `same_block` face-culling rules.
- `npm run content:tools:apply` creates all supported glass-cutter tiers, tool recipes, item-atlas entries, translations, catalog entries, and furniture-hammer texture bindings.
- `npm run recipes:variants:apply` guarantees one stonecutter recipe and one lossless reset recipe for every custom subtype marked `generate` in `content/variant-policy.json`.
- `npm run content:generated:check` fails when any generated glass, tool, catalog, localization, or recipe output is stale.

Generated reports live in `tools/generated`. They are derived output and must not be edited manually.

`content:overhaul:apply` is idempotent: immediately running its preview again must report zero deletes and zero writes. It removes custom slabs and stairs that already exist in vanilla, retires all three-step stairs, normalizes duplicate definitions, and generates connection-trait walls for Atelier-owned stone materials.

The older Python generators were retired because they were not aware of `variant-policy.json`. Mutating generation is implemented in MJS and must honor the reviewed policy. The upstream-compatible block, geometry, and culling templates live in `tools/templates/blocks-with-traits`; edit those deliberately if the inherited behavior must ever change.

`@minecraft/vanilla-data` is the source of truth for vanilla block identifiers. `@minecraft/bedrock-schemas` is pinned for editor validation through `.vscode/settings.json`; it supplies schemas and types, not the Bedrock runtime.
