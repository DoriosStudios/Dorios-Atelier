This beta expands the building palette with new stone finishes, colored concrete and wool, decorative glass, and tools for reshaping and repainting blocks directly in the world. It also introduces personal tool-reset settings and improves placement and painting behavior.

> [!WARNING]
> Back up existing worlds before updating. Content identifiers now use `dorios_atelier:` instead of the legacy `utilitycraft:` namespace, and older identifiers are not automatically migrated.
> This beta uses new pack and module UUIDs and internal pack version 1.0.04. Replace the previous Atelier BP/RP pair together; avoid activating both generations in the same world. Requires Minecraft Bedrock 1.26.40 or newer.

## HIGHLIGHTS

- **Colored Concrete:** Added 22 colors with five building shapes and matching dyes.
- **Colored Wool:** Added the same 22 extra colors as blocks, carpets, slabs, stairs and vertical slabs.
- **Glass:** Added 84 decorative glass variants and seven tiers of Glass Cutters.
- **Painting:** Added 38 paint colors, offhand Paint Buckets, Paintbrushes and planar 3×3 Paint Rollers.
- **Settings Book:** Choose your preferred tool-reset controls on any device.
- **Stonework:** Expanded six material families with new finishes, pillars and structural shapes.
- **Tool Memory:** Save a variant on a Chisel, Furniture Hammer or Glass Cutter and repeat it on compatible blocks.

## BLOCKS

- Added **Colored Concrete** in 22 colors, each with a full block, slab, stairs, vertical slab and wall: 110 building blocks.
    - These are ordinary concrete building materials; Copper Concrete does not oxidize or behave as metal.
- Added **Colored Wool** in the same 22 colors, with full blocks, carpets, slabs, stairs and vertical slabs: 110 blocks.
    - Grouped by color and format in Wool (Extra), following the same color order as Concrete (Extra).
    - Retains the wool weave, cloth sounds and flammability.
- Added **Decorative Glass** in Clean/Clear, Broadline, Hitch Cross, Stained and Tempered styles.
    - Includes five styles for each of the 16 stained-glass colors and four uncolored variants, for 84 custom blocks.
    - Matching adjacent glass blocks hide their shared faces.
- Expanded **Stonework** across Andesite, Basalt, Deepslate, Dripstone, End Stone and Hardened Netherrack, with 76 managed full-block finishes and their supported shapes.
    - Includes carved, chiseled, cracked, polished, smooth, brick, tile and pillar finishes across the supported families.
    - Pillars support placement along different axes; directional finishes have distinct top/base and side textures.
    - Renamed Cobbled Netherrack to **Hardened Netherrack**.
- Reworked supported **Slabs, Stairs, Vertical Slabs and Walls** with native placement traits, stair corners, wall connections and waterlogging where supported.
    - Reuses vanilla blocks when the equivalent shape already exists.
- Removed **Duplicate Ornamental Families**, retaining the canonical material and finish definitions.

## ITEMS

### Tools

- Added **Furniture Hammers** in Wooden, Stone, Copper, Iron, Golden, Diamond and Netherite tiers.
    - Changes supported blocks between their available full-block, stair, slab, vertical-slab and wall shapes.
    - Sneaking while using the hammer rotates supported facing instead of cycling shapes.
- Added **Glass Cutters** in all seven material tiers.
    - Cycles supported glass through its available styles while preserving color.
    - Successful style changes consume one durability point.
- Added **Paintbrushes** and **Paint Rollers** in all seven material tiers.
    - With a Paint Bucket in the offhand, the first use of a clean tool loads its color, including when clicking an otherwise incompatible block. That interaction only loads the tool; it does not paint the block.
    - Wash paint off in water, a water-filled cauldron or a UtilityCraft Sink. Cleaning clears the tool's paint color, tint and color label without tool durability loss.
    - The bristles or roller pad visibly take the loaded color while handles and metal parts retain their original appearance.
    - A brush paints one block. A roller paints up to nine exposed blocks in a 3×3 plane aligned with the clicked face, without wrapping around corners or onto an adjacent floor.
    - Recognizes color-named blocks of any material when a matching destination exists, including compatible blocks from other add-ons.
    - Preserves compatible orientation and shape states. Missing colors and unchanged strokes consume no durability.
    - A successful action consumes one tool durability point, including a complete roller stroke.
- Expanded **Chisel** cycles to the new stone finishes, including End Stone and Hardened Netherrack.
- Added **Tool Memory** to Chisels, Furniture Hammers and Glass Cutters.
    - Sneak and begin mining a supported model block to save its variant on the held tool.
    - Subsequent transformations follow that selection; each tool keeps its own saved choice.

### Equipment

- Added the **Dorios' Atelier Settings Book**.
    - Opens a personal form for selecting tool-reset controls and optional diagnostics.
    - Granted once per player and available in the creative Nature category. If the inventory is full during delivery, it drops beside the player.
- Added **Paint Buckets** in 38 colors, with 256 painting uses each, plus an Empty Paint Bucket.
    - Keep the matching color in the offhand while painting.
    - Each successful action consumes one bucket use, whether it changes one block or nine. Dipping and unchanged strokes are free.
    - Depleted buckets become Empty Paint Buckets.
    - Each bucket uses its original colored texture.
    - Using a bucket without a painting tool shows localized guidance for equipping a brush or roller in the main hand and the bucket in the offhand.

### Materials

- Added **22 Dyes** matching the extra concrete and wool palette.
    - Used in the new coloring and paint recipes; these do not add native color options to sheep, beds or armor.

## RECIPES

### Blocks

- Added **Colored Concrete** recipes: 8 White Concrete and 1 matching extra dye produce 8 colored blocks.
- Added **Colored Wool** recipes: 8 White Wool and 1 matching extra dye produce 8 colored blocks. Two matching wool blocks in a horizontal row produce 3 carpets.
- Added **Hardened Netherrack**: 4 Netherrack in a 2×2 pattern produce 2 hardened blocks.
    - Its decorative finishes stay within the hardened material family. Resetting a full hardened block or finish returns 2 Netherrack.
- Added **Stonecutter** conversions and matching material-recovery recipes for supported shapes and stone finishes.
    - Concrete blocks produce 2 slabs, 2 vertical slabs, 1 stair block or 1 wall, with matching reverse recipes.
- Added **Stonework** furnace recipes for supported smooth and cracked finishes.

### Items

- Added **Dye Mixing** recipes: the specified pair of vanilla dyes produces 2 matching extra dyes.
- Added the **Empty Paint Bucket** recipe using 3 Iron Ingots and 2 Sticks, plus filling recipes with a Water Bucket and a matching dye.
- Added recipes for all seven tiers of **Furniture Hammers**, **Glass Cutters**, **Paintbrushes** and **Paint Rollers**.
- Added the **Settings Book** recipe using 1 Book and 1 Stick.

## UI/UX

- Added five **Tool Reset Methods**, available with touch, keyboard/mouse and controller input.
    - Sneak + attack in the air.
    - Sneak + use in the air.
    - Use in the air.
    - Hold Sneak for 2 seconds while looking into the air, with an `X`/`-` progress bar.
    - Sneak, then Jump, which is the default.
- Saved **Settings Book** preferences per player in each world; only the chosen reset method is active.
- Expanded **Localization** to English, Brazilian Portuguese, European Portuguese, Spanish and Mexican Spanish, including the settings form and painting messages.
- Reorganized **Creative Inventory** entries so material families and their available finishes and formats stay together, including the new Stonework and wool entries.
- Added material-aware **Tool Sounds** and first-person feedback for glove placement.

## BUG FIXES

- **Gloves**
    - Prevented long-range placement from overwriting solid destination blocks.
    - Improved placement into liquids and replaceable vegetation, preserving supported plant drops.
- **Painting**
    - Improved Paint Rollers to process every position in their 3×3 area independently, including mixed colors and centers without a matching destination. Partial neighboring blocks no longer automatically exclude visible faces.
    - Fixed vanilla blocks retaining their original dye color after painting.
    - Fixed clicked blocks being rejected when snow layers or other partial blocks occupied part of the adjacent face. Additional roller cells still respect covered faces.
- **Stonework**
    - Removed duplicate ornamental blocks and redundant conversions while retaining canonical variants.

## TECHNICAL CHANGES

- Updated the minimum engine version to **1.26.40** and the declared Script API dependency to **2.9.0**.
- Assigned new BP/RP and module UUIDs, with synchronized internal version **1.0.04** and matching pack dependencies.
- Added per-player, opt-in **Tool Reset Diagnostics** for input events, selected methods and saved locks.
- Standardized release automation through Dorios Workflows, producing development and minified `.mcaddon` downloads. Release builds also minify JSON formatting.

## THIRD-PARTY / INTEGRATION

- **Painting** recognizes compatible color-prefixed block identifiers within another add-on's namespace, without a material whitelist or an exhaustive block list.
    - The matching colored block must exist. Unrelated naming schemes or colors represented only by custom states are not inferred automatically.

Contributors: @Kauziin
