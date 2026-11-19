# Extra wool colors

The 22 colors in `content/concrete-colors.json` also provide wool in five formats: full blocks, carpets, slabs, stairs and vertical slabs. These 110 blocks appear in **Wool (Extra)** immediately after **Concrete (Extra)**, following the same color order. Within each color, the five formats stay together. Wool walls are not generated.

All colors share the pinned Mojang white wool weave in `tools/references/mojang/wool_colored_white.png`. The terrain atlas applies each palette color through `tint_color`; the generator preserves the original 16×16 weave and does not duplicate it into 22 recolored files. Wool uses cloth sounds and flammability; structural shapes retain those material properties. Carpets have a one-pixel-high model and collision box.

Craft eight colored wool blocks from eight White Wool and one matching Atelier dye. Two matching colored wool blocks in a horizontal row make three carpets. Slabs, stairs and vertical slabs follow Atelier's existing stonecutter conversion and material-recovery recipes. Painting supports each available wool color and format, including vanilla carpets.

Run `npm run content:wool:apply` after changing the palette, wool specification or concrete order. It generates wool and shape recipes and synchronizes the painting palette. Painting discovers compatible wool blocks by name at runtime. `npm run content:wool:check` checks reproducibility. `content/wool.json` records the supported formats, creative group and pinned texture source.
