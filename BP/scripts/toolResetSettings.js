import { ItemStack, system, world } from '@minecraft/server'
import { FormCancelationReason, ModalFormData } from '@minecraft/server-ui'

export const TOOL_SETTINGS_BOOK = 'dorios_atelier:settings'
const SETTINGS_GRANTED_TAG = 'dorios_atelier:settings_granted'
const localized = key => ({ translate: `ui.dorios_atelier.tool_reset.${key}` })
export const TOOL_RESET_METHODS = Object.freeze([
	{ id: 'sneak_attack', label: localized('method.sneak_attack') },
	{ id: 'sneak_use', label: localized('method.sneak_use') },
	{ id: 'air_use', label: localized('method.air_use') },
	{ id: 'hold_sneak', label: localized('method.hold_sneak') },
	{ id: 'sneak_jump', label: localized('method.sneak_jump') }
])

const SETTINGS_PROPERTY = 'dorios_atelier:tool_reset_settings'
const DEFAULT_SETTINGS = Object.freeze({ method: 'sneak_jump', debug: false })
const SETTINGS_CACHE = new Map()
const SETTINGS_LISTENERS = new Set()
const OPEN_FORMS = new Set()

export const getToolResetSettings = player => {
	if (SETTINGS_CACHE.has(player.id)) return SETTINGS_CACHE.get(player.id)
	let settings = DEFAULT_SETTINGS
	try {
		const raw = player.getDynamicProperty(SETTINGS_PROPERTY)
		const saved = typeof raw === 'string' ? JSON.parse(raw) : undefined
		if (TOOL_RESET_METHODS.some(method => method.id === saved?.method)) {
			settings = Object.freeze({ method: saved.method, debug: saved.debug === true })
		}
	} catch {
		// Invalid or unavailable preferences use the default without changing saved data.
	}
	SETTINGS_CACHE.set(player.id, settings)
	return settings
}

export const onToolResetSettingsChanged = listener => SETTINGS_LISTENERS.add(listener)

export const setToolResetSettings = (player, settings) => {
	if (!TOOL_RESET_METHODS.some(method => method.id === settings.method)) return false
	const next = Object.freeze({ method: settings.method, debug: settings.debug === true })
	player.setDynamicProperty(SETTINGS_PROPERTY, JSON.stringify(next))
	SETTINGS_CACHE.set(player.id, next)
	for (const listener of SETTINGS_LISTENERS) listener(player)
	return true
}

const sendSettingsMessage = (player, message) => {
	try {
		player.sendMessage(message)
	} catch {
		// A player can disconnect while the form is open.
	}
}

const showToolResetSettings = async player => {
	if (OPEN_FORMS.has(player.id)) return
	OPEN_FORMS.add(player.id)
	try {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const settings = getToolResetSettings(player)
			const response = await new ModalFormData()
				.title(localized('title'))
				.dropdown(localized('method_label'), TOOL_RESET_METHODS.map(method => method.label), {
					defaultValueIndex: TOOL_RESET_METHODS.findIndex(method => method.id === settings.method)
				})
				.toggle(localized('debug_label'), { defaultValue: settings.debug })
				.submitButton(localized('save'))
				.show(player)

			if (response.canceled) {
				if (response.cancelationReason !== FormCancelationReason.UserBusy) return
				await new Promise(resolve => system.runTimeout(resolve, 10))
				continue
			}
			const [index, debug] = response.formValues ?? []
			if (!Number.isInteger(index) || !TOOL_RESET_METHODS[index] || typeof debug !== 'boolean') return
			const selected = TOOL_RESET_METHODS[index]
			setToolResetSettings(player, { method: selected.id, debug })
			sendSettingsMessage(player, { rawtext: [
				localized('saved_method'), selected.label,
				{ text: '\n' }, localized('saved_debug'), localized(debug ? 'on' : 'off')
			] })
			return
		}
		sendSettingsMessage(player, localized('busy'))
	} catch (error) {
		console.warn(`[DA tool-reset] Settings form failed: ${error}`)
		sendSettingsMessage(player, localized('error'))
	} finally {
		OPEN_FORMS.delete(player.id)
	}
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
	itemComponentRegistry.registerCustomComponent(TOOL_SETTINGS_BOOK, {
		onUse({ source: player }) {
			if (player?.typeId === 'minecraft:player') {
				system.run(() => { void showToolResetSettings(player) })
			}
		}
	})
})

const grantSettingsBook = player => {
	try {
		if (player.hasTag(SETTINGS_GRANTED_TAG)) return
		const container = player.getComponent('minecraft:inventory')?.container
		if (!container) return
		const remaining = container.addItem(new ItemStack(TOOL_SETTINGS_BOOK))
		if (remaining) player.dimension.spawnItem(remaining, player.location)
		player.addTag(SETTINGS_GRANTED_TAG)
	} catch (error) {
		console.warn(`[DA tool-reset] Settings book delivery failed: ${error}`)
	}
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
	if (initialSpawn) system.run(() => grantSettingsBook(player))
})

system.run(() => {
	for (const player of world.getAllPlayers()) grantSettingsBook(player)
})

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
	SETTINGS_CACHE.delete(playerId)
})
