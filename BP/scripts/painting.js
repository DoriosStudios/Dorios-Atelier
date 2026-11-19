import {BlockPermutation, EquipmentSlot, GameMode, ItemStack, system} from '@minecraft/server';
import {PAINT_COLORS} from './paintingData.js';
import {PAINT_FACE_NORMALS, paintingPositions} from './paintingGeometry.js';
import {resolvePaintTarget} from './paintingResolver.js';

const COLOR_PROPERTY = 'dorios_atelier:paint_color';
const EMPTY_BUCKET = 'dorios_atelier:empty_paint_bucket';
const message = (player, key) => player.onScreenDisplay.setActionBar({translate: `ui.dorios_atelier.paint.${key}`});
const bucketColor = stack => /^dorios_atelier:([a-z_]+)_paint_bucket$/.exec(stack?.typeId ?? '')?.[1];
const isPaintTool = stack => /^dorios_atelier:[a-z]+_(?:paintbrush|paint_roller)$/.test(stack?.typeId ?? '');
const recentUses = new Map();

function heldTool(player, eventStack) {
  const inventory = player.getComponent('minecraft:inventory')?.container;
  const slot = player.selectedSlotIndex;
  const stack = inventory?.getItem(slot);
  // Never find a similarly named tool in another slot after a player switches items.
  if (!stack || stack.typeId !== eventStack?.typeId) return undefined;
  return {inventory, slot, stack};
}

function dip(player, held) {
  const bucket = player.getComponent('minecraft:equippable')?.getEquipment(EquipmentSlot.Offhand);
  const color = bucketColor(bucket);
  if (!PAINT_COLORS[color]) { message(player, 'need_bucket'); return; }
  const dyeable = held.stack.getComponent('minecraft:dyeable');
  if (dyeable) dyeable.color = PAINT_COLORS[color];
  held.stack.setDynamicProperty(COLOR_PROPERTY, color);
  held.stack.setLore([{translate: 'ui.dorios_atelier.paint.loaded_color', with: {
    rawtext: [{translate: `ui.dorios_atelier.paint.color.${color}`}],
  }}]);
  held.inventory.setItem(held.slot, held.stack);
  player.playSound('cauldron.fillwater', {volume: 0.8});
  message(player, 'loaded');
}

function isCleaningTarget(block) {
  if (!block) return false;
  if (block.typeId === 'minecraft:water' || block.typeId === 'minecraft:flowing_water' || block.typeId === 'utilitycraft:sink') return true;
  if (block.typeId !== 'minecraft:cauldron' && block.typeId !== 'minecraft:water_cauldron') return false;
  const states = block.permutation.getAllStates();
  return states.fill_level > 0 && (states.cauldron_liquid ?? 'water') === 'water';
}

function clean(player, held) {
  const dyeable = held.stack.getComponent('minecraft:dyeable');
  if (!held.stack.getDynamicProperty(COLOR_PROPERTY) && dyeable?.color === undefined) {
    message(player, 'already_clean');
    return;
  }
  if (dyeable) dyeable.color = undefined;
  held.stack.setDynamicProperty(COLOR_PROPERTY, undefined);
  held.stack.setLore([]);
  held.inventory.setItem(held.slot, held.stack);
  player.playSound('cauldron.fillwater', {volume: 0.8});
  message(player, 'cleaned');
}

function usePaintTool(event) {
  const {source: player, itemStack, block} = event;
  if (player?.typeId !== 'minecraft:player' || player.getGameMode() === GameMode.Spectator) return;
  const held = heldTool(player, itemStack);
  if (!held) return;
  // One interaction can invoke both item callbacks. Coalesce loading/cleaning
  // with its paired callback, including a callback crossing the tick boundary.
  const previous = recentUses.get(player.id);
  if (previous && previous.slot === held.slot && previous.item === held.stack.typeId && system.currentTick - previous.tick <= 1) return;
  const viewed = player.getBlockFromViewDirection({maxDistance: 6, includeLiquidBlocks: true});
  const wash = isCleaningTarget(block) || isCleaningTarget(viewed?.block);
  const loaded = PAINT_COLORS[held.stack.getDynamicProperty(COLOR_PROPERTY)];
  // Loaded tools paint through onUseOn only; onUse must not paint twice.
  if (!wash && loaded && !block && viewed) return;
  if (recentUses.size >= 256) recentUses.delete(recentUses.keys().next().value);
  recentUses.set(player.id, {slot: held.slot, item: held.stack.typeId, tick: system.currentTick});
  if (wash) { clean(player, held); return; }
  if (!loaded || !block) { dip(player, held); return; }
  paint(event);
}

function usePaintBucket(event) {
  const player = event.source;
  if (player?.typeId !== 'minecraft:player') return;
  const stack = player.getComponent('minecraft:inventory')?.container?.getItem(player.selectedSlotIndex);
  if (isPaintTool(stack)) {
    usePaintTool({source: player, itemStack: stack, block: event.block, blockFace: event.blockFace});
    return;
  }
  message(player, 'need_tool');
}

function recoloredPermutation(block, color) {
  const target = resolvePaintTarget(block.typeId, color);
  if (!target || target === block.typeId) return undefined;
  let permutation = BlockPermutation.resolve(target);
  const supported = permutation.getAllStates();
  for (const [name, value] of Object.entries(block.permutation.getAllStates())) {
    // Legacy vanilla permutations expose their dye color as a state. Copying it
    // would restore the source color after resolving the painted destination.
    if (name === 'color' || name.endsWith(':color')) continue;
    if (Object.prototype.hasOwnProperty.call(supported, name)) permutation = permutation.withState(name, value);
  }
  return permutation;
}

function faceIsCovered(block, normal, eye) {
  const {x, y, z} = block.location;
  const covering = block.dimension.getBlock({x: x + normal.x, y: y + normal.y, z: z + normal.z});
  if (!covering || covering.isAir || covering.isLiquid) return false;
  // Occupying the next cell does not imply a fully covered face. Only these
  // ambiguous cells need a ray; unobstructed cells require no visibility query.
  const offset = {
    x: x + 0.5 + normal.x * 0.501 - eye.x,
    y: y + 0.5 + normal.y * 0.501 - eye.y,
    z: z + 0.5 + normal.z * 0.501 - eye.z,
  };
  const distance = Math.hypot(offset.x, offset.y, offset.z);
  if (!distance) return false;
  const hit = block.dimension.getBlockFromRay(eye, {
    x: offset.x / distance, y: offset.y / distance, z: offset.z / distance,
  }, {maxDistance: distance, includeLiquidBlocks: false, includePassableBlocks: false});
  if (!hit) return false;
  const location = hit.block.location;
  return location.x !== x || location.y !== y || location.z !== z;
}

function paint({source: player, itemStack, block, blockFace}) {
  if (player?.typeId !== 'minecraft:player' || !block || !itemStack) return;
  const mode = player.getGameMode();
  if (mode === GameMode.Adventure || mode === GameMode.Spectator) return;
  const held = heldTool(player, itemStack);
  if (!held) return;
  const color = held.stack.getDynamicProperty(COLOR_PROPERTY);
  if (!PAINT_COLORS[color]) { message(player, 'need_dip'); return; }
  const equipment = player.getComponent('minecraft:equippable');
  const bucket = equipment?.getEquipment(EquipmentSlot.Offhand);
  if (bucketColor(bucket) !== color) { message(player, 'matching_bucket'); return; }
  const bucketDurability = bucket.getComponent('minecraft:durability');
  const toolDurability = held.stack.getComponent('minecraft:durability');
  if (!bucketDurability || !toolDurability) return;
  if (bucketDurability.damage >= bucketDurability.maxDurability || toolDurability.damage >= toolDurability.maxDurability) return;
  const roller = itemStack.typeId.endsWith('_paint_roller');
  const normal = PAINT_FACE_NORMALS[blockFace];
  if (!normal) return;
  const origin = block.location;
  const eye = roller ? player.getHeadLocation() : undefined;
  const changes = [];
  // Resolve all nine cells from the original area before any block update can
  // affect neighboring references or states. Each cell keeps its own material.
  for (const position of paintingPositions(origin, blockFace, roller)) {
    try {
      const candidate = block.dimension.getBlock(position);
      if (!candidate) continue;
      const replacement = recoloredPermutation(candidate, color);
      if (!replacement) continue;
      const isCenter = position.x === origin.x && position.y === origin.y && position.z === origin.z;
      if (!isCenter && faceIsCovered(candidate, normal, eye)) continue;
      changes.push({candidate, replacement});
    } catch {
      // Unsupported state combinations and unloaded/out-of-height cells are skipped.
    }
  }
  let painted = 0;
  for (const {candidate, replacement} of changes) {
    try {
      candidate.setPermutation(replacement);
      painted++;
    } catch {
      // A disappearing or unloaded cell must not cancel the remaining stroke.
    }
  }
  if (!painted) { message(player, 'no_change'); return; }
  if (mode !== GameMode.Creative) {
    // Both tools and the bucket spend ONE use, including a complete 3x3 stroke.
    bucketDurability.damage++;
    toolDurability.damage++;
    equipment.setEquipment(EquipmentSlot.Offhand, bucketDurability.damage >= bucketDurability.maxDurability
      ? new ItemStack(EMPTY_BUCKET) : bucket);
    const broken = toolDurability.damage >= toolDurability.maxDurability;
    held.inventory.setItem(held.slot, broken ? undefined : held.stack);
    if (broken) player.playSound('random.break');
  }
  player.playSound('brush.generic', {volume: 0.7});
}

system.beforeEvents.startup.subscribe(event => {
  event.itemComponentRegistry.registerCustomComponent('dorios_atelier:paint_tool', {
    onUse: usePaintTool,
    onUseOn: usePaintTool,
    onBeforeDurabilityDamage: event => { event.durabilityDamage = 0; },
  });
  event.itemComponentRegistry.registerCustomComponent('dorios_atelier:paint_bucket', {
    onUse: usePaintBucket,
    onUseOn: usePaintBucket,
  });
});
