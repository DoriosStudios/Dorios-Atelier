// scripts/chisel.js
import { system, world } from "@minecraft/server";

const CHISEL_COMPONENT_ID = "utilitycraft:chisel";

const MATERIAL_CYCLES = [
	[
		"minecraft:polished_andesite",
		"utilitycraft:andesite_bricks",
		"utilitycraft:andesite_tiles",
		"utilitycraft:chiseled_andesite",
		"utilitycraft:smooth_andesite",
	],
	[
		"minecraft:basalt",
		"utilitycraft:basalt_bricks",
		"utilitycraft:basalt_tiles",
		"utilitycraft:chiseled_basalt",
		"utilitycraft:chiseled_basalt_alt",
		"minecraft:smooth_basalt",
		"minecraft:polished_basalt",
	],
	[
		"minecraft:polished_blackstone",
		"minecraft:polished_blackstone_bricks",
		"utilitycraft:blackstone_tiles",
		"minecraft:chiseled_blackstone",
		"utilitycraft:smooth_blackstone",
	],
	[
		"utilitycraft:polished_calcite",
		"utilitycraft:calcite_bricks",
		"utilitycraft:calcite_tiles",
		"utilitycraft:chiseled_calcite",
		"utilitycraft:smooth_calcite",
	],
	[
		"minecraft:polished_diorite",
		"utilitycraft:diorite_bricks",
		"utilitycraft:diorite_tiles",
		"utilitycraft:chiseled_diorite",
		"utilitycraft:smooth_diorite",
	],
	[
		"utilitycraft:polished_dripstone",
		"utilitycraft:dripstone_bricks",
		"utilitycraft:dripstone_tiles",
		"utilitycraft:chiseled_dripstone",
		"utilitycraft:smooth_dripstone",
	],
	[
		"minecraft:polished_granite",
		"utilitycraft:granite_bricks",
		"utilitycraft:granite_tiles",
		"utilitycraft:chiseled_granite",
		"utilitycraft:smooth_granite",
	],
	[
		"minecraft:polished_tuff",
		"minecraft:tuff_bricks",
		"utilitycraft:tuff_tiles",
		"minecraft:chiseled_tuff",
		"utilitycraft:smooth_tuff",
	],
];

const BLOCK_ALIAS = new Map([
	["minecraft:calcite", "utilitycraft:smooth_calcite"],
	["minecraft:dripstone_block", "utilitycraft:smooth_dripstone"],
	["minecraft:tuff", "utilitycraft:smooth_tuff"],
	["minecraft:tuff_tiles", "utilitycraft:tuff_tiles"],
	["minecraft:chiseled_polished_blackstone", "utilitycraft:chiseled_blackstone"],
]);

// Build lookup map: id -> { states, index }
const BLOCK_LOOKUP = new Map();
for (const states of MATERIAL_CYCLES) {
	states.forEach((id, index) => {
		BLOCK_LOOKUP.set(id, { states, index });
	});
}

function resolveBlockId(blockId) {
	let current = blockId;
	const visited = new Set();
	while (BLOCK_ALIAS.has(current) && !visited.has(current)) {
		visited.add(current);
		current = BLOCK_ALIAS.get(current);
	}
	return current;
}

function getNextBlockId(blockId) {
	const canonical = resolveBlockId(blockId);
	const entry = BLOCK_LOOKUP.get(canonical);
	if (!entry) return undefined;
	const nextIndex = (entry.index + 1) % entry.states.length;
	return entry.states[nextIndex];
}

/**
 * Danifica (ou remove) o formão na mão do jogador.
 * Usa selectedSlotIndex para garantir que atingimos a pilha correta.
 */
function damageHeldChisel(player) {
	// roda na próxima tick para evitar possíveis travamentos sincronizados
	system.run(() => {
		try {
			const inventoryComp = player.getComponent("minecraft:inventory");
			if (!inventoryComp) return;
			const container = inventoryComp.container;
			if (!container) return;

			const slot = player.selectedSlotIndex;
			if (slot === undefined || slot === null) return;

			const stack = container.getItem(slot);
			if (!stack) return;

			const durability = stack.getComponent?.("minecraft:durability");
			if (!durability) return;

			const broke = durability.damage(1);
			if (broke) {
				// remove o item quebrado
				container.setItem(slot, undefined);
				return;
			}

			// escreve o stack atualizado de volta
			container.setItem(slot, stack);
		} catch (err) {
			// não explode o servidor; loga para console se disponível
			try { console.warn("damageHeldChisel error:", err); } catch (_) { }
		}
	});
}

/*
  Registra o componente customizado no startup.
  O handler onUseOn vai disparar quando um item com esse componente for usado em um bloco.
*/
system.beforeEvents.startup.subscribe((startupEvent) => {
	startupEvent.itemComponentRegistry.registerCustomComponent(CHISEL_COMPONENT_ID, {
		/**
		 * event: ItemComponentUseOnEvent
		 * - event.block: o bloco no qual o item foi usado (Block)
		 * - event.source: a entidade (player)
		 * - event.itemStack: a pilha de item usada
		 */
		onUseOn(event /*, params */) {
			try {
				const { block, source, itemStack } = event;
				if (!block || !source || !itemStack) return;

				// Obtém o próximo estado do bloco
				const nextBlockId = getNextBlockId(block.typeId);
				if (!nextBlockId) return;

				// Altera o bloco diretamente (estamos em handler válido para modificar o mundo)
				block.setType(nextBlockId);

				// Danifica a ferramenta na mão do jogador
				// Preferimos usar a função que manipula o inventário do jogador para garantir remoção correta
				damageHeldChisel(source);
			} catch (err) {
				try { console.warn("chisel onUseOn error:", err); } catch (_) { }
			}
		}
	});
});
