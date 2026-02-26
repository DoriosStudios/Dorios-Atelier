import { BlockPermutation, world } from '@minecraft/server'

const GLOVE_OFFHAND_IDS = new Set([
	'utilitycraft:wooden_glove',
	'utilitycraft:stone_glove',
	'utilitycraft:iron_glove',
	'utilitycraft:copper_glove',
	'utilitycraft:golden_glove',
	'utilitycraft:diamond_glove',
	'utilitycraft:netherite_glove'
])

const FACE_OFFSETS = {
	North: { x: 0, y: 0, z: -1 },
	South: { x: 0, y: 0, z: 1 },
	East: { x: 1, y: 0, z: 0 },
	West: { x: -1, y: 0, z: 0 },
	Up: { x: 0, y: 1, z: 0 },
	Down: { x: 0, y: -1, z: 0 }
}

const MIN_RANGE = 5

const GLOVE_MAX_DISTANCE = new Map([
	['utilitycraft:wooden_glove', 8],
	['utilitycraft:stone_glove', 10],
	['utilitycraft:copper_glove', 12],
	['utilitycraft:iron_glove', 16],
	['utilitycraft:golden_glove', 20],
	['utilitycraft:diamond_glove', 24],
	['utilitycraft:netherite_glove', 32]
])

const GLOVE_PLACE_SOUND = 'item.armor.equip_leather'

const getEquipment = (player, slot) => {
	const equippable = player.getComponent?.('minecraft:equippable')
	if (equippable?.getEquipment) {
		return equippable.getEquipment(slot)
	}
	if (typeof player.getEquipment === 'function') {
		return player.getEquipment(slot)
	}
	return undefined
}

const getSelectedSlot = player =>
	typeof player.selectedSlot === 'number'
		? player.selectedSlot
		: (typeof player.selectedSlotIndex === 'number' ? player.selectedSlotIndex : undefined)

const consumeItem = (player, typeId) => {
	const container = player.getComponent?.('minecraft:inventory')?.container
	if (!container) return false

	const trySlot = index => {
		if (index === undefined) return false
		const stack = container.getItem(index)
		if (!stack || stack.typeId !== typeId) return false
		if (stack.amount <= 1) {
			container.setItem(index)
		} else {
			stack.amount -= 1
			container.setItem(index, stack)
		}
		return true
	}

	const selected = getSelectedSlot(player)
	if (trySlot(selected)) return true

	for (let i = 0; i < container.size; i += 1) {
		if (i === selected) continue
		if (trySlot(i)) return true
	}

	return false
}

const LOCAL_REPLACEABLE_MAP = new Map([
	['plants', [
		'minecraft:short_grass',
		'minecraft:tallgrass',
		'minecraft:fern',
		'minecraft:deadbush',
		'minecraft:dandelion',
		'minecraft:poppy',
		'minecraft:blue_orchid',
		'minecraft:allium',
		'minecraft:azure_bluet',
		'minecraft:red_tulip',
		'minecraft:orange_tulip',
		'minecraft:white_tulip',
		'minecraft:pink_tulip',
		'minecraft:oxeye_daisy',
		'minecraft:cornflower',
		'minecraft:lily_of_the_valley',
		'minecraft:wither_rose',
		'minecraft:pink_petals'
	]],
	['snowLayer', ['minecraft:snow_layer']],
	['carpet', [
		'minecraft:white_carpet',
		'minecraft:light_gray_carpet',
		'minecraft:gray_carpet',
		'minecraft:black_carpet',
		'minecraft:brown_carpet',
		'minecraft:red_carpet',
		'minecraft:orange_carpet',
		'minecraft:yellow_carpet',
		'minecraft:lime_carpet',
		'minecraft:green_carpet',
		'minecraft:cyan_carpet',
		'minecraft:light_blue_carpet',
		'minecraft:blue_carpet',
		'minecraft:purple_carpet',
		'minecraft:magenta_carpet',
		'minecraft:pink_carpet',
		'minecraft:moss_carpet'
	]]
])

const LOCAL_REPLACEABLE_BLOCKS = new Set([...LOCAL_REPLACEABLE_MAP.values()].flat())
const PATCHED_ITEM_USE_SIGNALS = new WeakSet()

const hasReplaceableComponent = block => {
	try {
		return Boolean(block?.getComponent?.('minecraft:replaceable'))
	} catch {
		return false
	}
}

const shouldDropBeforePlace = block =>
	Boolean(block) && (LOCAL_REPLACEABLE_BLOCKS.has(block.typeId) || hasReplaceableComponent(block))

const breakBlockWithDrops = block => {
	if (!block?.dimension?.runCommand) return false
	const { x, y, z } = block.location
	try {
		block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`)
		return true
	} catch {
		return false
	}
}

const tryHandleReplaceablePlacement = event => {
	const { source: player, itemStack } = event ?? {}
	if (!player || player.typeId !== 'minecraft:player' || !itemStack) return false

	const offhand = getEquipment(player, 'Offhand') ?? player.getComponent?.('equippable')?.getEquipment?.('Offhand')
	if (!offhand || !GLOVE_OFFHAND_IDS.has(offhand.typeId)) return false

	const maxDistance = GLOVE_MAX_DISTANCE.get(offhand.typeId) ?? 8
	const hit = player.getBlockFromViewDirection?.({ maxDistance })
	if (!hit?.block) return false

	const offset = FACE_OFFSETS[hit.face]
	if (!offset) return false

	const distance = distanceBetween(player.location, hit.block.location)
	if (distance < MIN_RANGE || distance > maxDistance) return false

	const targetPos = {
		x: hit.block.location.x + offset.x,
		y: hit.block.location.y + offset.y,
		z: hit.block.location.z + offset.z
	}

	const targetBlock = hit.block.dimension.getBlock(targetPos)
	if (!targetBlock || targetBlock.typeId === itemStack.typeId) return true
	if (!shouldDropBeforePlace(targetBlock)) return false

	let permutation
	try {
		permutation = BlockPermutation.resolve(itemStack.typeId)
	} catch {
		return true
	}

	if (!breakBlockWithDrops(targetBlock)) return true

	const placementBlock = hit.block.dimension.getBlock(targetPos)
	if (!placementBlock) return true

	try {
		placementBlock.setPermutation(permutation)
	} catch {
		return true
	}

	try {
		const location = { x: targetPos.x + 0.5, y: targetPos.y + 0.5, z: targetPos.z + 0.5 }
		placementBlock.dimension?.playSound?.(GLOVE_PLACE_SOUND, location, { volume: 0.7, pitch: 1 })
	} catch {
		try {
			player.playSound?.(GLOVE_PLACE_SOUND)
		} catch {}
	}

	const gameMode = player.getGameMode?.()
	const isCreative = player.isInCreative?.() ?? (typeof gameMode === 'string' && gameMode.toLowerCase() === 'creative')
	if (!isCreative) consumeItem(player, itemStack.typeId)

	return true
}

const patchItemUseSubscribe = () => {
	const itemUseSignal = world.afterEvents?.itemUse
	if (!itemUseSignal?.subscribe || PATCHED_ITEM_USE_SIGNALS.has(itemUseSignal)) return

	const originalSubscribe = itemUseSignal.subscribe.bind(itemUseSignal)
	itemUseSignal.subscribe = callback =>
		originalSubscribe(event => {
			if (tryHandleReplaceablePlacement(event)) return
			callback(event)
		})

	PATCHED_ITEM_USE_SIGNALS.add(itemUseSignal)
}

patchItemUseSubscribe()

{
}

const distanceBetween = (a, b) =>
	DoriosAPI?.math?.distanceBetween
		? DoriosAPI.math.distanceBetween(a, b)
		: Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

world.afterEvents.itemUse.subscribe(event => {
	const { source: player, itemStack } = event
	if (!player || player.typeId !== 'minecraft:player' || !itemStack) return

	const offhand = player.getEquipment?.('Offhand') ?? player.getComponent?.('equippable')?.getEquipment('Offhand')
	if (!offhand || !GLOVE_OFFHAND_IDS.has(offhand.typeId)) return

	const maxDistance = GLOVE_MAX_DISTANCE.get(offhand.typeId) ?? 8
	const hit = player.getBlockFromViewDirection({ maxDistance })
	if (!hit?.block) return

	const offset = FACE_OFFSETS[hit.face]
	if (!offset) return

	const distance = distanceBetween(player.location, hit.block.location)
	if (distance < MIN_RANGE || distance > maxDistance) return

	let permutation
	try {
		permutation = BlockPermutation.resolve(itemStack.typeId)
	} catch {
		return
	}

	const targetPos = {
		x: hit.block.location.x + offset.x,
		y: hit.block.location.y + offset.y,
		z: hit.block.location.z + offset.z
	}

	const targetBlock = hit.block.dimension.getBlock(targetPos)
	if (!targetBlock || targetBlock.typeId === itemStack.typeId) return

	try {
		targetBlock.setPermutation(permutation)
	} catch {
		return
	}

	try {
		const location = {
			x: targetPos.x + 0.5,
			y: targetPos.y + 0.5,
			z: targetPos.z + 0.5
		}
		targetBlock.dimension?.playSound?.(GLOVE_PLACE_SOUND, location, { volume: 0.7, pitch: 1 })
	} catch {
		try {
			player.playSound?.(GLOVE_PLACE_SOUND)
		} catch {}
	}

	const gameMode = player.getGameMode?.()
	const isCreative = player.isInCreative?.() ?? (typeof gameMode === 'string' && gameMode.toLowerCase() === 'creative')
	if (isCreative) return

	consumeItem(player, itemStack.typeId)
})
