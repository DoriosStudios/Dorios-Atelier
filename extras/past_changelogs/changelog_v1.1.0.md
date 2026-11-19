This update expands Dorios' Atelier's building palette with new glass styles, colored concrete, wool and decorative shapes, and introduces Glass Cutters, Furniture Hammers, Paintbrushes, Paint Rollers, Paint Buckets and configurable tool memory.

> [!WARNING]
> Content identifiers now use `dorios_atelier:` instead of the legacy `utilitycraft:` namespace. Back up existing worlds before upgrading: this release does not include an automatic identifier migration.
> Some 1.1.0.x previews used higher internal pack versions. Remove those preview or development packs before importing the stable 1.1.0 package, and keep a world backup.

## HIGHLIGHTS

- **Colored Concrete:** Added 22 colors, 110 building blocks and matching dyes.
- **Colored Wool:** Added the 22 extra colors as full blocks, carpets, slabs, stairs and vertical slabs.
- **Glass:** Added 84 decorative glass variants.
- **Painting:** Added 38 paint colors, offhand Paint Buckets, single-block Paintbrushes and planar 3x3 Paint Rollers.
- **Settings Book:** Choose your preferred tool reset controls on any device.
- **Stonework:** Expanded Andesite, Basalt, Deepslate, Dripstone, End Stone and Hardened Netherrack finishes, pillars and shapes.
- **Tool Memory:** Save a model variant on a tool and apply it to other supported blocks.
- **Tools:** Added seven tiers of Glass Cutters, Furniture Hammers, Paintbrushes and Paint Rollers.

## BLOCKS

- Expanded **Andesite, Basalt, Deepslate, Dripstone, End Stone and Hardened Netherrack**, with 76 managed full-block finishes and their supported slabs, stairs, vertical slabs and walls.
    - Includes carved, chiseled, cracked, polished, smooth, brick, tile and pillar finishes across the supported families.
    - Reused existing material/finish identifiers and removed duplicate ornamental block definitions. Retired names are mapped only in scripts.
    - Pillars can be placed along different axes; directional finishes use separate top/base and side textures.
    - The new Netherrack base is named **Hardened Netherrack**.
- Added **Colored Concrete** in 22 colors, each with a full block, slab, stairs, vertical slab and wall.
    - Includes Amber, Aqua, Burgundy, Chartreuse, Copper, Coral, Dusty Purple, Emerald, Forest, Indigo, Ivory, Lavender, Mint, Navy, Olive, Peach, Rose, Sand, Scarlet, Slate, Teal and Wine.
    - These are ordinary stone building materials. Copper Concrete does not oxidize or behave as a metal block.
- Added **Colored Wool** in the same 22 extra colors, with full blocks, carpets, slabs, stairs and vertical slabs: 110 blocks organized in the same color order as the extra concretes.
- Added **Glass Variants** with Clean/Clear, Broadline, Hitch Cross, Stained and Tempered styles.
    - Includes five custom styles for each of the 16 stained-glass colors and four uncolored variants, for 84 custom glass blocks.
    - Matching adjacent glass blocks hide their shared faces.
- Added **Slabs, Stairs, Vertical Slabs and Walls** for supported stone, wood and concrete families.
    - Includes directional placement, stair corners, wall connections and waterlogging for supported shapes.
    - Uses vanilla blocks for base variants that already exist in Minecraft rather than adding duplicate full blocks.

## ITEMS

### Tools

- Added **Furniture Hammers** in Wooden, Stone, Copper, Iron, Golden, Diamond and Netherite tiers.
    - Changes supported blocks between full blocks, stairs, slabs, vertical slabs and walls.
    - Sneaking while using the hammer rotates supported block facing instead of cycling shapes.
- Added **Glass Cutters** in Wooden, Stone, Copper, Iron, Golden, Diamond and Netherite tiers.
    - Cycles supported vanilla and custom glass through the available styles while preserving its color.
    - Successful style changes consume one durability point.
- Added **Paintbrushes** and **Paint Rollers** in Wooden, Stone, Copper, Iron, Golden, Diamond and Netherite tiers.
    - Use a tool in the air with a matching Paint Bucket in the offhand to load its color. The bristles or roller pad visibly take that color while the handle and metal retain their original colors.
    - Brushes paint one eligible block; rollers paint up to nine exposed blocks in a 3x3 plane aligned with the clicked face.
    - Supports registered color-named blocks of any material, including blocks from other add-ons, while preserving compatible block states.
    - Recognizes new compatible color-named finishes and shapes automatically, including matching blocks from other add-ons. Unavailable colors are skipped without consuming paint.
    - Successful painting actions consume one tool durability point, including a full roller stroke.
- Expanded **Chisel** cycles to the new stone finishes, including End Stone and Hardened Netherrack.
- Added **Tool Memory** to Chisels, Furniture Hammers and Glass Cutters.
    - Sneak and begin mining a supported model block to record its variant.
    - The saved variant appears on the tool and guides subsequent transformations.
    - Each tool keeps its own saved variant.

### Equipment

- Added **Paint Buckets** in 38 colors, with 256 painting uses each.
    - Keep the matching bucket in the offhand while painting. Each successful action consumes one bucket use, whether it paints one block or nine.
    - Bucket icons use the original texture for each paint color.
    - Dipping is free. Empty or unchanged strokes consume no durability; depleted buckets become Empty Paint Buckets.
- Added the **Dorios' Atelier Settings Book**.
    - Opens a personal configuration form for tool reset controls and optional debug messages.
    - Granted once per player and available in the creative Nature category.
    - If the inventory is full during delivery, the book drops beside the player.

### Materials

- Added **22 Dyes** matching the new concrete and wool palette.
    - Used to color the new concrete and wool blocks; they do not add native color options to sheep, armor, beds or other vanilla objects.

## RECIPES

### Blocks

- Added **Hardened Netherrack**: craft 4 Netherrack in a 2×2 pattern to obtain 2 hardened blocks.
    - Its decorative finishes stay in the hardened material tier. Resetting one full hardened block or finish returns 2 Netherrack.
- Added **Stonework** cutting and reset recipes for the new finishes and shapes, plus furnace recipes for new smooth and cracked finishes.
- Added **Colored Concrete** recipes: combine 8 White Concrete with 1 matching extra dye to obtain 8 colored blocks.
- Added **Colored Wool** recipes: combine 8 White Wool with 1 matching extra dye to obtain 8 colored blocks; two matching wool blocks make three carpets.
- Added **Stonecutter** conversions for supported decorative shapes and matching recipes to recover their base material.
    - Concrete blocks produce 2 slabs, 2 vertical slabs, 1 stair block or 1 wall; the reverse recipes recover 1 original block with the matching quantities.

### Items

- Added recipes for all seven tiers of **Furniture Hammers**, **Glass Cutters**, **Paintbrushes** and **Paint Rollers**.
- Added the **Empty Paint Bucket** recipe and color-filling recipes using an empty paint bucket, a Water Bucket and a matching dye.
- Added **Dye Mixing** recipes: combine the two specified vanilla dyes to obtain 2 matching extra dyes.
- Added the **Settings Book** recipe using 1 Book and 1 Stick.

## UI/UX

- Added five selectable **Tool Reset Methods**, available with touch, keyboard/mouse and controller input:
    - Sneak + attack in the air.
    - Sneak + use in the air.
    - Use in the air.
    - Hold Sneak for 2 seconds while looking into the air, with an `X`/`-` progress bar.
    - Sneak, then Jump, which is the default.
- Saved **Settings Book** preferences per player in each world; only the selected reset method is active.
- Expanded **Localization** to English, Brazilian Portuguese, European Portuguese, Spanish and Mexican Spanish, including the settings form, book name and configuration messages.
- Reorganized **Creative Inventory** groups for decorative blocks, concrete, wool, dyes and tools.
- Added material-aware **Tool Sounds** and first-person feedback for glove placement.

## BUG FIXES

- **Painting**
    - Fixed vanilla blocks retaining their original color after painting. Shared block states are preserved without copying the source dye color over the destination color.
    - Fixed clicked blocks being rejected when a snow layer or another partial block occupied part of the adjacent face. Roller neighbors still respect covered faces.
- **Stonework**
    - Removed duplicate ornamental block definitions, their loot tables, unused face textures, registrations and redundant conversion recipes. Name mappings remain script-side only.
- **Gloves**
    - Prevented long-range placement from overwriting solid destination blocks.
    - Improved placement into liquids and replaceable vegetation, preserving plant drops when replacing supported plants.

## TECHNICAL CHANGES

- Updated the minimum engine version to **1.26.40** and the declared **Script API** dependency to **2.9.0**.
- Added per-player, opt-in **Tool Reset Diagnostics** for input events, selected methods and saved lock state.
- Standardized release builds through Dorios Workflows, with synchronized BP/RP versions, generated texture lists and development/minified `.mcaddon` downloads.
