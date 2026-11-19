import { ButtonState, EntitySwingSource, HeldItemOption, InputButton, system, TicksPerSecond, world } from '@minecraft/server'
import { getToolResetSettings, onToolResetSettingsChanged, TOOL_SETTINGS_BOOK } from './toolResetSettings.js'

const TOOL_NAMESPACES = ['dorios_atelier', 'utilitycraft']
const TOOL_KIND_BY_SUFFIX = new Map([
	['_chisel', 'chisel'],
	['_furniture_hammer', 'hammer'],
	['_glass_cutter', 'cutter']
])

const LOCK_PREFIX = '§8DA_LOCK:'
const LOCK_LABEL_PREFIX = 'Lock: '
const LOCK_DYNAMIC_PROPERTY_PREFIX = 'dorios_atelier:lock:'
const VIEW_DISTANCE = 8
const TOOL_MEMORY_DEBUG_MARKER = 'DA tool-reset-v2'
const HOLD_RESET_DURATION = 2 * TicksPerSecond
const HOLD_RESET_BAR_LENGTH = 10

const LOCK_RESOLVERS = new Map()
const TOUCH_RESET_SEQUENCE = new Map()
const HOLD_RESET_PLAYERS = new Map()
const HOLD_RESET_PROGRESS = new Map()

const unique = values => Array.from(new Set(values.filter(Boolean)))

const debugToolMemory = (player, message) => {
	if (!getToolResetSettings(player).debug) return
	try {
		player.sendMessage(`§8[§6${TOOL_MEMORY_DEBUG_MARKER}§8] §r${message}`)
	} catch (error) {
		console.warn(`[${TOOL_MEMORY_DEBUG_MARKER}] ${message}; chat error: ${error}`)
	}
}

const describeInputMode = player => {
	try {
		return String(player.inputInfo.lastInputModeUsed)
	} catch (error) {
		return `ERROR: ${error}`
	}
}

const getSelectedSlotIndex = player => {
	if (typeof player?.selectedSlot === 'number') return player.selectedSlot
	if (typeof player?.selectedSlotIndex === 'number') return player.selectedSlotIndex
	return undefined
}

const getHeldItemContext = player => {
	const container = player?.getComponent?.('minecraft:inventory')?.container
	if (!container) return undefined

	const slot = getSelectedSlotIndex(player)
	if (slot === undefined) return undefined

	const stack = container.getItem(slot)
	if (!stack) return undefined

	return { container, slot, stack }
}

const parseToolKind = typeId => {
	if (!typeId) return undefined
	for (const [suffix, kind] of TOOL_KIND_BY_SUFFIX.entries()) {
		if (!typeId.endsWith(suffix)) continue

		const hasKnownNamespace = TOOL_NAMESPACES.some(namespace => typeId.startsWith(`${namespace}:`))
		if (hasKnownNamespace) return kind

		// Compatibility mode: if suffix matches, allow third-party namespaces.
		return kind
	}
	return undefined
}

const stateFromBlockTypeId = typeId => {
	if (!typeId) return 'default'
	const name = typeId.includes(':') ? typeId.split(':')[1] : typeId
	if (name.endsWith('_vertical_slab')) return 'vertical_slab'
	if (name.endsWith('_wall')) return 'wall'
	if (name.endsWith('_stairs')) return 'stairs'
	if (name.endsWith('_slab')) return 'slab'
	return 'default'
}

const getViewedBlock = player => {
	try {
		return player?.getBlockFromViewDirection?.({ maxDistance: VIEW_DISTANCE })?.block
	} catch {
		return undefined
	}
}

const isLookingAtEntity = player => {
	try {
		return Boolean(player?.getEntitiesFromViewDirection?.({ maxDistance: VIEW_DISTANCE })?.length)
	} catch {
		return false
	}
}

const normalizeLock = lock => {
	if (!lock || typeof lock !== 'object') return undefined
	return {
		kind: String(lock.kind ?? ''),
		state: lock.state ? String(lock.state) : undefined,
		variant: lock.variant ? String(lock.variant) : undefined,
		targetId: lock.targetId ? String(lock.targetId) : undefined,
		label: lock.label ? String(lock.label) : undefined
	}
}

const dynamicPropertyIdForKind = kind => `${LOCK_DYNAMIC_PROPERTY_PREFIX}${kind}`

const isSameLockTarget = (a, b) => {
	if (!a || !b || a.kind !== b.kind) return false
	if (a.variant && b.variant) return a.variant === b.variant
	if (a.state && b.state && !a.variant && !b.variant) return a.state === b.state
	if (a.targetId && b.targetId) return a.targetId === b.targetId
	return false
}

const parseLockLine = (line, expectedKind) => {
	if (!line?.startsWith(LOCK_PREFIX)) return undefined
	const payload = line.slice(LOCK_PREFIX.length).trim()

	if (payload.startsWith('{')) {
		try {
			const parsed = JSON.parse(payload)
			if (parsed?.kind !== expectedKind) return undefined
			return normalizeLock(parsed)
		} catch {
			return undefined
		}
	}

	// Legacy format fallback: kind|state|targetId
	const [kind, state, targetId] = payload.split('|')
	if (kind !== expectedKind) return undefined
	if (!state || !targetId) return undefined
	return normalizeLock({ kind, state, targetId, variant: state })
}

const readDynamicLockFromItem = (itemStack, kind) => {
	try {
		const raw = itemStack?.getDynamicProperty?.(dynamicPropertyIdForKind(kind))
		if (typeof raw !== 'string' || !raw) return undefined
		const parsed = JSON.parse(raw)
		if (parsed?.kind !== kind) return undefined
		return normalizeLock(parsed)
	} catch {
		return undefined
	}
}

export const readToolLockFromItem = (itemStack, kind) => {
	const lore = itemStack?.getLore?.() ?? []
	for (const line of lore) {
		const parsed = parseLockLine(line, kind)
		if (parsed) return parsed
	}

	return readDynamicLockFromItem(itemStack, kind)
}

const removeLockLines = (lore, kind) => lore.filter(line => {
	if (line.startsWith(LOCK_PREFIX)) {
		const payload = line.slice(LOCK_PREFIX.length).trim()
		if (payload.startsWith('{')) {
			try {
				if (JSON.parse(payload)?.kind === kind) return false
			} catch {
				// Ignore malformed JSON lock lines and keep them untouched.
			}
		}
		if (payload.startsWith(`${kind}|`)) return false
	}
	const plainLine = String(line ?? '').replace(/§./g, '')
	if (plainLine.startsWith(LOCK_LABEL_PREFIX)) return false
	return true
})

const writeLockToLore = (itemStack, kind, lock) => {
	const lore = itemStack?.getLore?.() ?? []
	const cleaned = removeLockLines(lore, kind)

	if (!lock) {
		itemStack?.setLore?.(cleaned)
		try {
			itemStack?.setDynamicProperty?.(dynamicPropertyIdForKind(kind), undefined)
		} catch {
			// Best-effort cleanup only.
		}
		return
	}

	const normalized = normalizeLock({ ...lock, kind })
	const fallbackLabel = normalized.variant ?? normalized.state ?? normalized.targetId ?? 'custom'
	const labelLine = `§r§6${LOCK_LABEL_PREFIX}§7${normalized.label ?? fallbackLabel}`
	itemStack?.setLore?.([...cleaned, labelLine])

	try {
		itemStack?.setDynamicProperty?.(dynamicPropertyIdForKind(kind), JSON.stringify(normalized))
	} catch {
		// Best-effort dynamic property mirror only.
	}
}

const setToolLock = (context, kind, lock) => {
	const heldKind = parseToolKind(context.stack.typeId)
	if (heldKind !== kind) return false

	writeLockToLore(context.stack, kind, lock)
	context.container.setItem(context.slot, context.stack)
	return true
}

const showMemoryFeedback = (player, message) => {
	try {
		player?.onScreenDisplay?.setActionBar?.(message)
	} catch {
		// Best effort feedback only.
	}
}

const recordViewedBlock = player => {
	const context = getHeldItemContext(player)
	if (!context) return

	const kind = parseToolKind(context.stack.typeId)
	if (!kind) return

	const viewedBlock = getViewedBlock(player)
	if (!viewedBlock) return

	const resolver = LOCK_RESOLVERS.get(kind)
	const nextLock = normalizeLock(
		resolver ? resolver(viewedBlock, player) : {
			kind,
			state: stateFromBlockTypeId(viewedBlock.typeId),
			variant: stateFromBlockTypeId(viewedBlock.typeId),
			targetId: viewedBlock.typeId,
			label: stateFromBlockTypeId(viewedBlock.typeId)
		}
	)

	if (!nextLock) return
	if (isSameLockTarget(readToolLockFromItem(context.stack, kind), nextLock)) return

	const saved = setToolLock(context, kind, nextLock)
	if (!saved) return

	const variant = nextLock.label ?? nextLock.variant ?? nextLock.state ?? 'custom'
	showMemoryFeedback(player, `§6Locked §f${variant} §6variant!`)
	debugToolMemory(player, `LOCK saved: item=${context.stack.typeId}; variant=${variant}; mode=${describeInputMode(player)}`)
}

const clearHeldToolMemory = (player, message = '§6Tool memory cleared!') => {
	const context = getHeldItemContext(player)
	if (!context) return false

	const kind = parseToolKind(context.stack.typeId)
	if (!kind || !readToolLockFromItem(context.stack, kind)) return false
	if (!setToolLock(context, kind, undefined)) return false

	TOUCH_RESET_SEQUENCE.delete(player.id)
	HOLD_RESET_PROGRESS.delete(player.id)
	showMemoryFeedback(player, message)
	if (getToolResetSettings(player).debug) {
		const saved = getHeldItemContext(player)
		debugToolMemory(player, `RESET applied=true; storedLockRemaining=${Boolean(readToolLockFromItem(saved?.stack, kind))}`)
	}
	return true
}

const isLookingIntoAir = player => !player.getBlockFromViewDirection({ maxDistance: VIEW_DISTANCE })?.block
	&& player.getEntitiesFromViewDirection({ maxDistance: VIEW_DISTANCE }).length === 0

export const handleToolUse = ({ source: player, itemStack }) => {
	if (!parseToolKind(itemStack?.typeId)) return
	try {
		const { method } = getToolResetSettings(player)
		if (!['sneak_use', 'air_use'].includes(method)) return
		if (method === 'sneak_use' && !player.isSneaking) return
		if (!isLookingIntoAir(player)) return
		clearHeldToolMemory(player)
	} catch (error) {
		debugToolMemory(player, `ERROR handling tool use: ${error}`)
	}
}

const handleToolSwing = event => {
	const { heldItemStack, player, swingSource } = event ?? {}
	if (!player?.isSneaking || !parseToolKind(heldItemStack?.typeId)) return

	if (swingSource === EntitySwingSource.Mine) {
		recordViewedBlock(player)
		return
	}

	// An attack aimed at an entity is not an air swing and must not clear memory.
	if (swingSource === EntitySwingSource.Attack && !isLookingAtEntity(player)) {
		if (getToolResetSettings(player).method !== 'sneak_attack') return
		clearHeldToolMemory(player)
	}
}

const handleTouchResetInput = ({ player, button, newButtonState }) => {
	try {
		const context = getHeldItemContext(player)
		const kind = parseToolKind(context?.stack.typeId)
		const pending = TOUCH_RESET_SEQUENCE.get(player.id)
		if (!kind && !pending) return

		debugToolMemory(player, `INPUT button=${button}; state=${newButtonState}; mode=${describeInputMode(player)}; item=${context?.stack.typeId ?? 'none'}; slot=${context?.slot ?? 'none'}; armed=${Boolean(pending)}`)
		if (newButtonState !== ButtonState.Pressed) return

		const { method } = getToolResetSettings(player)
		if (method !== 'sneak_jump') {
			TOUCH_RESET_SEQUENCE.delete(player.id)
			debugToolMemory(player, `BLOCKED: selected method is ${method}, not sneak_jump.`)
			return
		}

		const lock = kind ? readToolLockFromItem(context.stack, kind) : undefined
		if (!lock) {
			TOUCH_RESET_SEQUENCE.delete(player.id)
			debugToolMemory(player, `BLOCKED: ${kind ? 'tool has no stored lock' : 'held item is not a supported tool'}.`)
			return
		}

		if (button === InputButton.Sneak) {
			TOUCH_RESET_SEQUENCE.set(player.id, { slot: context.slot, typeId: context.stack.typeId })
			debugToolMemory(player, `ARMED: kind=${kind}; lock=${lock.label ?? lock.variant ?? lock.state ?? lock.targetId}; press Jump next.`)
			return
		}

		if (button === InputButton.Jump) {
			TOUCH_RESET_SEQUENCE.delete(player.id)
			if (pending?.slot !== context.slot || pending.typeId !== context.stack.typeId) {
				debugToolMemory(player, `BLOCKED: ${pending ? 'held tool or slot changed' : 'no preceding Sneak press'}.`)
				return
			}
			clearHeldToolMemory(player)
		}
	} catch (error) {
		TOUCH_RESET_SEQUENCE.delete(player.id)
		debugToolMemory(player, `ERROR handling ${button}/${newButtonState}: ${error}`)
	}
}

const cancelTouchResetSequence = (player, reason) => {
	if (TOUCH_RESET_SEQUENCE.delete(player.id)) debugToolMemory(player, `CANCELLED: ${reason}`)
}

const cancelHoldReset = player => {
	if (HOLD_RESET_PROGRESS.delete(player.id)) showMemoryFeedback(player, '')
}

const synchronizeHoldReset = player => {
	if (getToolResetSettings(player).method === 'hold_sneak') {
		HOLD_RESET_PLAYERS.set(player.id, player)
	} else {
		HOLD_RESET_PLAYERS.delete(player.id)
		cancelHoldReset(player)
	}
}

const updateHoldReset = player => {
	try {
		if (!player.isSneaking) {
			cancelHoldReset(player)
			return
		}
		const context = getHeldItemContext(player)
		const kind = parseToolKind(context?.stack.typeId)
		const lock = kind ? readToolLockFromItem(context.stack, kind) : undefined
		if (!lock || !isLookingIntoAir(player)) {
			cancelHoldReset(player)
			return
		}
		const signature = `${context.slot}:${context.stack.typeId}:${JSON.stringify(lock)}`
		let progress = HOLD_RESET_PROGRESS.get(player.id)
		if (progress?.signature !== signature) {
			progress = { signature, startedAt: system.currentTick, filled: -1 }
			HOLD_RESET_PROGRESS.set(player.id, progress)
		}
		const elapsed = system.currentTick - progress.startedAt
		if (elapsed >= HOLD_RESET_DURATION) {
			clearHeldToolMemory(player, `§a[${'X'.repeat(HOLD_RESET_BAR_LENGTH)}] §6Tool memory cleared!`)
			return
		}
		const filled = Math.floor(elapsed / HOLD_RESET_DURATION * HOLD_RESET_BAR_LENGTH)
		if (filled === progress.filled) return
		progress.filled = filled
		showMemoryFeedback(player, `§6Clearing tool memory... §7[§a${'X'.repeat(filled)}§8${'-'.repeat(HOLD_RESET_BAR_LENGTH - filled)}§7]`)
	} catch (error) {
		cancelHoldReset(player)
		HOLD_RESET_PLAYERS.delete(player.id)
		debugToolMemory(player, `ERROR handling hold reset: ${error}`)
	}
}

const initializeToolMemoryWatchers = () => {
	if (globalThis.__doriosToolLockWatcherInitialized) return
	globalThis.__doriosToolLockWatcherInitialized = true

	world.afterEvents.playerSwingStart.subscribe(handleToolSwing, {
		heldItemOption: HeldItemOption.AnyItem
	})
	world.afterEvents.playerButtonInput.subscribe(handleTouchResetInput, {
		buttons: [InputButton.Sneak, InputButton.Jump]
	})
	world.afterEvents.playerHotbarSelectedSlotChange.subscribe(({ player }) => {
		cancelTouchResetSequence(player, 'hotbar slot changed.')
		cancelHoldReset(player)
	})
	world.afterEvents.playerInputModeChange.subscribe(({ player, previousInputModeUsed, newInputModeUsed }) => {
		if (getToolResetSettings(player).debug) {
			try {
				if (parseToolKind(getHeldItemContext(player)?.stack.typeId)) {
					debugToolMemory(player, `MODE changed: ${previousInputModeUsed} -> ${newInputModeUsed}; current=${describeInputMode(player)}`)
				}
			} catch (error) {
				debugToolMemory(player, `ERROR inspecting mode change: ${error}`)
			}
		}
	})
	world.afterEvents.playerLeave.subscribe(({ playerId }) => {
		TOUCH_RESET_SEQUENCE.delete(playerId)
		HOLD_RESET_PLAYERS.delete(playerId)
		HOLD_RESET_PROGRESS.delete(playerId)
	})
	onToolResetSettingsChanged(player => {
		cancelTouchResetSequence(player, 'reset method changed.')
		cancelHoldReset(player)
		synchronizeHoldReset(player)
	})
	const initializePlayer = player => {
		synchronizeHoldReset(player)
		debugToolMemory(player, `LOADED: method=${getToolResetSettings(player).method}; mode=${describeInputMode(player)}; settingsBook=${TOOL_SETTINGS_BOOK}`)
	}
	world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
		if (initialSpawn) initializePlayer(player)
	})
	system.run(() => {
		for (const player of world.getAllPlayers()) initializePlayer(player)
	})
	system.runInterval(() => {
		for (const player of HOLD_RESET_PLAYERS.values()) updateHoldReset(player)
	}, 2)
}

initializeToolMemoryWatchers()

export const getToolKindFromTypeId = parseToolKind
export const getLockStateFromBlockTypeId = stateFromBlockTypeId
export const registerToolLockResolver = (kind, resolver) => {
	if (!kind || typeof resolver !== 'function') return
	LOCK_RESOLVERS.set(kind, resolver)
}
export const getCompatibleNamespaces = currentNamespace => unique([
	currentNamespace,
	'dorios_atelier',
	'utilitycraft',
	'minecraft'
])
