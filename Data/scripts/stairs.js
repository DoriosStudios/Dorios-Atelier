import { world } from "@minecraft/server";

const STAIR_SHAPE_STATE = "utilitycraft:stair_shape";
const HALF_STATE = "minecraft:vertical_half";
const FACING_STATE = "minecraft:cardinal_direction";

const STAIR_IDS = new Set([
    "utilitycraft:andesite_bricks_stairs",
    "utilitycraft:andesite_bricks_three_steps_stairs",
    "utilitycraft:andesite_stairs",
    "utilitycraft:andesite_three_steps_stairs",
    "utilitycraft:andesite_tiles_stairs",
    "utilitycraft:andesite_tiles_three_steps_stairs",
    "utilitycraft:basalt_bricks_stairs",
    "utilitycraft:basalt_bricks_three_steps_stairs",
    "utilitycraft:basalt_tiles_stairs",
    "utilitycraft:basalt_tiles_three_steps_stairs",
    "utilitycraft:blackstone_tiles_stairs",
    "utilitycraft:blackstone_tiles_three_steps_stairs",
    "utilitycraft:calcite_bricks_stairs",
    "utilitycraft:calcite_bricks_three_steps_stairs",
    "utilitycraft:calcite_stairs",
    "utilitycraft:calcite_three_steps_stairs",
    "utilitycraft:calcite_tiles_stairs",
    "utilitycraft:calcite_tiles_three_steps_stairs",
    "utilitycraft:chiseled_deepslate_stairs",
    "utilitycraft:chiseled_deepslate_three_steps_stairs",
    "utilitycraft:chiseled_nether_bricks_stairs",
    "utilitycraft:chiseled_nether_bricks_three_steps_stairs",
    "utilitycraft:chiseled_polished_blackstone_stairs",
    "utilitycraft:chiseled_polished_blackstone_three_steps_stairs",
    "utilitycraft:chiseled_stone_bricks_stairs",
    "utilitycraft:chiseled_stone_bricks_three_steps_stairs",
    "utilitycraft:cobbled_deepslate_stairs",
    "utilitycraft:cobbled_deepslate_three_steps_stairs",
    "utilitycraft:cobblestone_stairs",
    "utilitycraft:cobblestone_three_steps_stairs",
    "utilitycraft:cracked_andesite_bricks_stairs",
    "utilitycraft:cracked_andesite_bricks_three_steps_stairs",
    "utilitycraft:cracked_andesite_tiles_stairs",
    "utilitycraft:cracked_andesite_tiles_three_steps_stairs",
    "utilitycraft:cracked_basalt_bricks_stairs",
    "utilitycraft:cracked_basalt_bricks_three_steps_stairs",
    "utilitycraft:cracked_basalt_tiles_stairs",
    "utilitycraft:cracked_basalt_tiles_three_steps_stairs",
    "utilitycraft:cracked_blackstone_tiles_stairs",
    "utilitycraft:cracked_blackstone_tiles_three_steps_stairs",
    "utilitycraft:cracked_calcite_bricks_stairs",
    "utilitycraft:cracked_calcite_bricks_three_steps_stairs",
    "utilitycraft:cracked_calcite_tiles_stairs",
    "utilitycraft:cracked_calcite_tiles_three_steps_stairs",
    "utilitycraft:cracked_deepslate_bricks_stairs",
    "utilitycraft:cracked_deepslate_bricks_three_steps_stairs",
    "utilitycraft:cracked_deepslate_tiles_stairs",
    "utilitycraft:cracked_deepslate_tiles_three_steps_stairs",
    "utilitycraft:cracked_diorite_bricks_stairs",
    "utilitycraft:cracked_diorite_bricks_three_steps_stairs",
    "utilitycraft:cracked_diorite_tiles_stairs",
    "utilitycraft:cracked_diorite_tiles_three_steps_stairs",
    "utilitycraft:cracked_dripstone_bricks_stairs",
    "utilitycraft:cracked_dripstone_bricks_three_steps_stairs",
    "utilitycraft:cracked_dripstone_tiles_stairs",
    "utilitycraft:cracked_dripstone_tiles_three_steps_stairs",
    "utilitycraft:cracked_granite_bricks_stairs",
    "utilitycraft:cracked_granite_bricks_three_steps_stairs",
    "utilitycraft:cracked_granite_tiles_stairs",
    "utilitycraft:cracked_granite_tiles_three_steps_stairs",
    "utilitycraft:cracked_nether_bricks_stairs",
    "utilitycraft:cracked_nether_bricks_three_steps_stairs",
    "utilitycraft:cracked_polished_blackstone_bricks_stairs",
    "utilitycraft:cracked_polished_blackstone_bricks_three_steps_stairs",
    "utilitycraft:cracked_stone_bricks_stairs",
    "utilitycraft:cracked_stone_bricks_three_steps_stairs",
    "utilitycraft:cracked_tuff_bricks_stairs",
    "utilitycraft:cracked_tuff_bricks_three_steps_stairs",
    "utilitycraft:cracked_tuff_tiles_stairs",
    "utilitycraft:cracked_tuff_tiles_three_steps_stairs",
    "utilitycraft:dark_prismarine_stairs",
    "utilitycraft:dark_prismarine_three_steps_stairs",
    "utilitycraft:deepslate_bricks_stairs",
    "utilitycraft:deepslate_bricks_three_steps_stairs",
    "utilitycraft:deepslate_tiles_stairs",
    "utilitycraft:deepslate_tiles_three_steps_stairs",
    "utilitycraft:diorite_bricks_stairs",
    "utilitycraft:diorite_bricks_three_steps_stairs",
    "utilitycraft:diorite_stairs",
    "utilitycraft:diorite_three_steps_stairs",
    "utilitycraft:diorite_tiles_stairs",
    "utilitycraft:diorite_tiles_three_steps_stairs",
    "utilitycraft:dripstone_bricks_stairs",
    "utilitycraft:dripstone_bricks_three_steps_stairs",
    "utilitycraft:dripstone_tiles_stairs",
    "utilitycraft:dripstone_tiles_three_steps_stairs",
    "utilitycraft:gilded_blackstone_stairs",
    "utilitycraft:gilded_blackstone_three_steps_stairs",
    "utilitycraft:glowing_obsidian_stairs",
    "utilitycraft:glowing_obsidian_three_steps_stairs",
    "utilitycraft:granite_bricks_stairs",
    "utilitycraft:granite_bricks_three_steps_stairs",
    "utilitycraft:granite_stairs",
    "utilitycraft:granite_three_steps_stairs",
    "utilitycraft:granite_tiles_stairs",
    "utilitycraft:granite_tiles_three_steps_stairs",
    "utilitycraft:mossy_cobblestone_stairs",
    "utilitycraft:mossy_cobblestone_three_steps_stairs",
    "utilitycraft:mossy_stone_bricks_stairs",
    "utilitycraft:mossy_stone_bricks_three_steps_stairs",
    "utilitycraft:mud_bricks_stairs",
    "utilitycraft:mud_bricks_three_steps_stairs",
    "utilitycraft:netherrack_stairs",
    "utilitycraft:netherrack_three_steps_stairs",
    "utilitycraft:obsidian_bricks_stairs",
    "utilitycraft:obsidian_bricks_three_steps_stairs",
    "utilitycraft:obsidian_tiles_stairs",
    "utilitycraft:obsidian_tiles_three_steps_stairs",
    "utilitycraft:packed_mud_stairs",
    "utilitycraft:packed_mud_three_steps_stairs",
    "utilitycraft:polished_andesite_stairs",
    "utilitycraft:polished_andesite_three_steps_stairs",
    "utilitycraft:polished_blackstone_bricks_stairs",
    "utilitycraft:polished_blackstone_bricks_three_steps_stairs",
    "utilitycraft:polished_blackstone_stairs",
    "utilitycraft:polished_blackstone_three_steps_stairs",
    "utilitycraft:polished_calcite_stairs",
    "utilitycraft:polished_calcite_three_steps_stairs",
    "utilitycraft:polished_deepslate_stairs",
    "utilitycraft:polished_deepslate_three_steps_stairs",
    "utilitycraft:polished_diorite_stairs",
    "utilitycraft:polished_diorite_three_steps_stairs",
    "utilitycraft:polished_dripstone_stairs",
    "utilitycraft:polished_dripstone_three_steps_stairs",
    "utilitycraft:polished_granite_stairs",
    "utilitycraft:polished_granite_three_steps_stairs",
    "utilitycraft:polished_obsidian_stairs",
    "utilitycraft:polished_obsidian_three_steps_stairs",
    "utilitycraft:polished_tuff_stairs",
    "utilitycraft:polished_tuff_three_steps_stairs",
    "utilitycraft:prismarine_bricks_stairs",
    "utilitycraft:prismarine_bricks_three_steps_stairs",
    "utilitycraft:prismarine_stairs",
    "utilitycraft:prismarine_three_steps_stairs",
    "utilitycraft:purpur_block_stairs",
    "utilitycraft:purpur_block_three_steps_stairs",
    "utilitycraft:quartz_bricks_stairs",
    "utilitycraft:quartz_bricks_three_steps_stairs",
    "utilitycraft:smooth_andesite_stairs",
    "utilitycraft:smooth_andesite_three_steps_stairs",
    "utilitycraft:smooth_basalt_stairs",
    "utilitycraft:smooth_basalt_three_steps_stairs",
    "utilitycraft:smooth_blackstone_stairs",
    "utilitycraft:smooth_blackstone_three_steps_stairs",
    "utilitycraft:smooth_calcite_stairs",
    "utilitycraft:smooth_calcite_three_steps_stairs",
    "utilitycraft:smooth_diorite_stairs",
    "utilitycraft:smooth_diorite_three_steps_stairs",
    "utilitycraft:smooth_dripstone_stairs",
    "utilitycraft:smooth_dripstone_three_steps_stairs",
    "utilitycraft:smooth_granite_stairs",
    "utilitycraft:smooth_granite_three_steps_stairs",
    "utilitycraft:smooth_quartz_stairs",
    "utilitycraft:smooth_quartz_three_steps_stairs",
    "utilitycraft:smooth_stone_stairs",
    "utilitycraft:smooth_stone_three_steps_stairs",
    "utilitycraft:smooth_tuff_stairs",
    "utilitycraft:smooth_tuff_three_steps_stairs",
    "utilitycraft:stone_bricks_stairs",
    "utilitycraft:stone_bricks_three_steps_stairs",
    "utilitycraft:stone_stairs",
    "utilitycraft:stone_three_steps_stairs",
    "utilitycraft:tuff_bricks_stairs",
    "utilitycraft:tuff_bricks_three_steps_stairs",
    "utilitycraft:tuff_stairs",
    "utilitycraft:tuff_three_steps_stairs",
    "utilitycraft:tuff_tiles_stairs",
    "utilitycraft:tuff_tiles_three_steps_stairs",
]);

const DIR_OFFSETS = {
    north: { x: 0, y: 0, z: -1 },
    south: { x: 0, y: 0, z: 1 },
    west: { x: -1, y: 0, z: 0 },
    east: { x: 1, y: 0, z: 0 }
};

const LEFT_OF = {
    north: "west",
    south: "east",
    west: "south",
    east: "north"
};

const RIGHT_OF = {
    north: "east",
    south: "west",
    west: "north",
    east: "south"
};

const OPPOSITE = {
    north: "south",
    south: "north",
    west: "east",
    east: "west"
};

const AXIS = {
    north: "z",
    south: "z",
    west: "x",
    east: "x"
};

const getNeighbor = (block, direction) => {
    const offset = DIR_OFFSETS[direction];
    if (!offset) return undefined;

    const target = {
        x: block.location.x + offset.x,
        y: block.location.y + offset.y,
        z: block.location.z + offset.z
    };

    return block.dimension.getBlock(target);
};

const isStair = block => block && STAIR_IDS.has(block.typeId);

const getState = (block, stateName) => block?.permutation?.getState(stateName);

const getFacing = block => {
    const facing = getState(block, FACING_STATE);
    return DIR_OFFSETS[facing] ? facing : undefined;
};

const sameHalf = (block, neighbor) => getState(block, HALF_STATE) === getState(neighbor, HALF_STATE);

const isDifferentStair = (block, direction, facing) => {
    const neighbor = getNeighbor(block, direction);
    if (!isStair(neighbor) || !sameHalf(block, neighbor)) return true;
    return getFacing(neighbor) !== facing;
};

const resolveShape = block => {
    const facing = getFacing(block);
    if (!facing || !DIR_OFFSETS[facing]) return "straight";

    const front = getNeighbor(block, facing);
    if (isStair(front) && sameHalf(block, front)) {
        const frontFacing = getFacing(front);
        if (frontFacing && AXIS[frontFacing] !== AXIS[facing] && isDifferentStair(block, OPPOSITE[frontFacing], facing)) {
            if (frontFacing === LEFT_OF[facing]) return "curved_out_left";
            if (frontFacing === RIGHT_OF[facing]) return "curved_out_right";
        }
    }

    const back = getNeighbor(block, OPPOSITE[facing]);
    if (isStair(back) && sameHalf(block, back)) {
        const backFacing = getFacing(back);
        if (backFacing && AXIS[backFacing] !== AXIS[facing] && isDifferentStair(block, backFacing, facing)) {
            if (backFacing === LEFT_OF[facing]) return "curved_in_left";
            if (backFacing === RIGHT_OF[facing]) return "curved_in_right";
        }
    }

    return "straight";
};

const updateStair = block => {
    if (!isStair(block)) return;

    const shape = resolveShape(block);
    const currentShape = getState(block, STAIR_SHAPE_STATE);
    if (currentShape === shape) return;

    try {
        block.setPermutation(block.permutation.withState(STAIR_SHAPE_STATE, shape));
    } catch {
        return;
    }
};

const updateNeighbors = block => {
    for (const direction of Object.keys(DIR_OFFSETS)) {
        const neighbor = getNeighbor(block, direction);
        if (isStair(neighbor)) updateStair(neighbor);
    }
};

const updateNeighborsAt = (dimension, location) => {
    const fakeBlock = dimension.getBlock(location);
    if (!fakeBlock) return;
    updateNeighbors(fakeBlock);
};

const onPlaced = ({ block }) => {
    if (!block) return;
    updateStair(block);
    updateNeighbors(block);
};

const onBroken = event => {
    const { block, dimension } = event;
    if (block?.dimension && block?.location) {
        updateNeighborsAt(block.dimension, block.location);
        return;
    }

    if (dimension && block?.location) {
        updateNeighborsAt(dimension, block.location);
    }
};

const afterEvents = world.afterEvents;

if (afterEvents.playerPlaceBlock) {
    afterEvents.playerPlaceBlock.subscribe(onPlaced);
} else if (afterEvents.blockPlace) {
    afterEvents.blockPlace.subscribe(onPlaced);
}

if (afterEvents.playerBreakBlock) {
    afterEvents.playerBreakBlock.subscribe(onBroken);
} else if (afterEvents.blockBreak) {
    afterEvents.blockBreak.subscribe(onBroken);
}
