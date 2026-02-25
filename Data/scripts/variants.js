// variants.js
// Apenas constantes exportadas: MATERIAL_CYCLES e BLOCK_ALIAS
const BASE_CYCLES = [
  [
    // Andesite
    "minecraft:polished_andesite",
    "utilitycraft:andesite_bricks",
    "utilitycraft:andesite_tiles",
    "utilitycraft:chiseled_andesite",
    "utilitycraft:chiseled_andesite_bricks"
  ],
  [
    // Basalt
    "minecraft:polished_basalt",
    "utilitycraft:basalt_bricks",
    "utilitycraft:basalt_tiles",
    "utilitycraft:chiseled_basalt",
    "utilitycraft:carved_basalt"
  ],
  [
    // Blackstone
    "minecraft:polished_blackstone",
    "minecraft:polished_blackstone_bricks",
    "utilitycraft:blackstone_tiles",
    "utilitycraft:chiseled_blackstone"
  ],
  [
    // Calcite
    "utilitycraft:polished_calcite",
    "utilitycraft:calcite_bricks",
    "utilitycraft:calcite_tiles",
    "utilitycraft:chiseled_calcite",
    "utilitycraft:chiseled_calcite_bricks"
  ],
  [
    // Deepslate
    "polished_deepslate",
    "minecraft:deepslate_bricks",
    "minecraft:deepslate_tiles",
    "minecraft:chiseled_deepslate"
  ],
  [
    // Diorite
    "minecraft:polished_diorite",
    "utilitycraft:diorite_bricks",
    "utilitycraft:diorite_tiles",
    "utilitycraft:chiseled_diorite",
    "utilitycraft:chiseled_diorite_bricks"
  ],
  [
    // Dripstone
    "utilitycraft:polished_dripstone",
    "utilitycraft:dripstone_bricks",
    "utilitycraft:dripstone_tiles",
    "utilitycraft:chiseled_dripstone",
    "utilitycraft:chiseled_dripstone_bricks"
  ],
  [
    // Granite
    "minecraft:polished_granite",
    "utilitycraft:granite_bricks",
    "utilitycraft:granite_tiles",
    "utilitycraft:chiseled_granite"
  ],
  [
    // Stone
    "minecraft:stone_bricks",
    "minecraft:chiseled_stone_bricks"
  ],
  [
    // Tuff
    "minecraft:polished_tuff",
    "minecraft:tuff_bricks",
    "utilitycraft:tuff_tiles",
    "minecraft:chiseled_tuff",
    "minecraft:chiseled_tuff_bricks"
  ],
  [
    // Grass
    "dirt",
    "utilitycraft:snowy_grass_block"
  ]
];

const OBSIDIAN_CYCLE = [
  "minecraft:obsidian",
  "utilitycraft:polished_obsidian",
  "utilitycraft:obsidian_bricks",
  "utilitycraft:obsidian_tiles",
  "utilitycraft:obsidian_pillar",
  "utilitycraft:chiseled_obsidian",
  "utilitycraft:glowing_obsidian"
];

const WOOD_VARIANTS = [
  {
    log: "minecraft:stripped_acacia_log",
    wood: "minecraft:stripped_acacia_wood",
    sanded: "utilitycraft:sanded_acacia_wood"
  },
  {
    log: "minecraft:stripped_bamboo_block",
    wood: "minecraft:stripped_bamboo_block",
    sanded: "utilitycraft:sanded_bamboo_wood"
  },
  {
    log: "minecraft:stripped_birch_log",
    wood: "minecraft:stripped_birch_wood",
    sanded: "utilitycraft:sanded_birch_wood"
  },
  {
    log: "minecraft:stripped_cherry_log",
    wood: "minecraft:stripped_cherry_wood",
    sanded: "utilitycraft:sanded_cherry_wood"
  },
  {
    log: "minecraft:stripped_crimson_stem",
    wood: "minecraft:stripped_crimson_hyphae",
    sanded: "utilitycraft:sanded_crimson_wood"
  },
  {
    log: "minecraft:stripped_dark_oak_log",
    wood: "minecraft:stripped_dark_oak_wood",
    sanded: "utilitycraft:sanded_dark_oak_wood"
  },
  {
    log: "minecraft:stripped_jungle_log",
    wood: "minecraft:stripped_jungle_wood",
    sanded: "utilitycraft:sanded_jungle_wood"
  },
  {
    log: "minecraft:stripped_mangrove_log",
    wood: "minecraft:stripped_mangrove_wood",
    sanded: "utilitycraft:sanded_mangrove_wood"
  },
  {
    log: "minecraft:stripped_oak_log",
    wood: "minecraft:stripped_oak_wood",
    sanded: "utilitycraft:sanded_oak_wood"
  },
  {
    log: "minecraft:stripped_pale_oak_log",
    wood: "minecraft:stripped_pale_oak_wood",
    sanded: "utilitycraft:sanded_pale_oak_wood"
  },
  {
    log: "minecraft:stripped_spruce_log",
    wood: "minecraft:stripped_spruce_wood",
    sanded: "utilitycraft:sanded_spruce_wood"
  },
  {
    log: "minecraft:stripped_warped_stem",
    wood: "minecraft:stripped_warped_hyphae",
    sanded: "utilitycraft:sanded_warped_wood"
  }
];

const WOOD_CYCLES = WOOD_VARIANTS.map(({ log, wood, sanded }) => [log, wood, sanded]);

export const MATERIAL_CYCLES = [...BASE_CYCLES, OBSIDIAN_CYCLE, ...WOOD_CYCLES];

export const BLOCK_ALIAS = new Map([
  ["minecraft:calcite", "utilitycraft:polished_calcite"],
  ["minecraft:dripstone_block", "utilitycraft:polished_dripstone"],
  ["minecraft:tuff", "minecraft:polished_tuff"],
  ["minecraft:tuff_bricks", "utilitycraft:tuff_bricks"],
  ["utilitycraft:tuff_tiles", "utilitycraft:tuff_tiles"],
  ["minecraft:chiseled_tuff", "utilitycraft:chiseled_tuff"],
  ["minecraft:chiseled_polished_blackstone", "utilitycraft:chiseled_blackstone"]
]);
